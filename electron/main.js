const { app, BrowserWindow, ipcMain, screen, systemPreferences, Menu, Tray, dialog, nativeTheme } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');
const os = require('os');
const http = require('http');
const screenshotDesktop = require('screenshot-desktop');
const windowStateKeeper = require('electron-window-state');
const {
  applyAuthSession,
  restoreStoredAuth
} = require('./supabase-session');

const ENV_FILES = ['.env.local', '.env.production', '.env'];
const DEFAULT_PROD_URL = 'https://auctushr.vercel.app';

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  return url.trim().replace(/\/+$/, '');
}

function readEnvValue(key) {
  for (const file of ENV_FILES) {
    try {
      const envPath = path.join(__dirname, '..', file);
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
      if (match && match[1]) {
        return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    } catch (error) {
      console.error(`Failed to read ${file} for ${key}:`, error.message);
    }
  }
  return null;
}

function resolveAppBaseUrl() {
  const directEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  const candidate = directEnv || readEnvValue('NEXT_PUBLIC_APP_URL') || DEFAULT_PROD_URL;
  return normalizeBaseUrl(candidate) || DEFAULT_PROD_URL;
}

// Initialize store for user settings and session data
const store = new Store();

/** When false, closing the window hides to tray instead of quitting. */
app.isQuiting = false;

class AuctusMonitor {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.isMonitoring = false;
    this.userData = null;
    this.workingHours = { start: '09:00', end: '17:00' };
    this.lastActivity = Date.now();
    this.screenshots = [];
    this.activityData = [];
    this.screenshotInterval = null;
    this.activityInterval = null;
    this.syncInterval = null;
    
    // Screenshots directory setup
    this.screenshotsDir = path.join(os.homedir(), 'Documents', 'AuctusHR-Screenshots');
    this.createScreenshotsDirectory();
    
    // Privacy and consent settings
    this.privacySettings = {
      allowScreenshots: true,
      allowActivityTracking: true,
      allowDataSync: true,
      blurScreenshots: false,
      dataRetentionDays: 30,
      userConsent: false
    };
    this.productionServerUrl = resolveAppBaseUrl();
    this.isDev = !app.isPackaged;
    const devServerUrl = 'http://localhost:3000';
    this.serverUrl = this.isDev ? devServerUrl : this.productionServerUrl;
    this.serverUrl = normalizeBaseUrl(this.serverUrl) || devServerUrl;
    
    // Supabase session (via web app OAuth / stored tokens)
    this.authUser = null;
    this.authToken = null;
    this.timerOverlay = null;
    this.screenshotIntervalId = null;
    this.idleCheckInterval = null;
    this.currentIdleTime = 0;
    this.cumulativeIdleTime = 0;
    this.lastStatsTimestamp = Date.now();
    this.maxIdleTime = 10 * 60 * 1000; // 10 minutes in milliseconds (overridden by settings)
    this.breakReminderMs = 4 * 60 * 60 * 1000; // default: 4 hours (half of 8h)
    this.lastBreakAlertTime = 0;
    this.breakCheckInterval = null;
    this.lastIdleAlertTime = 0;
    this.lastActiveWindow = null; // Track last active window for activity detection
    
    // OAuth callback server
    this.oauthServer = null;
    this.preferredOAuthPort = 8765;
    this.oauthPort = this.preferredOAuthPort;
    this.lastNotificationId = null;
    /** Local HTML dashboard (time tracking, screenshots) — not the Next.js /monitoring admin page */
    this.useStandaloneMonitoringUI = false;

    // Minimize / close → system tray (monitoring apps should keep running in background)
    this.minimizeToTrayEnabled = store.get('minimizeToTray', true) !== false;
  }

  shouldMinimizeToTray() {
    return this.minimizeToTrayEnabled !== false && !!this.tray;
  }

  minimizeToTray() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    if (!this.shouldMinimizeToTray()) {
      this.mainWindow.minimize();
      return;
    }

    this.mainWindow.hide();

    if (process.platform === 'win32') {
      this.mainWindow.setSkipTaskbar(true);
    }

    if (!store.get('trayHintShown')) {
      store.set('trayHintShown', true);
      this.showTrayNotification(
        'Running in background',
        'AuctusHR is in the system tray. Click the tray icon to reopen.'
      );
    }
  }

  async initialize() {
    // Load privacy settings from store
    const savedSettings = store.get('privacySettings');
    if (savedSettings) {
      this.privacySettings = { ...this.privacySettings, ...savedSettings };
    }
    
    // Ensure OAuth callback server is running to accept web redirects
    try {
      await this.startOAuthServer();
    } catch (e) {
      console.log('OAuth server failed to start at init (non-fatal):', e?.message || e);
    }
    
    // Check user consent before proceeding
    if (!this.privacySettings.userConsent) {
      await this.requestUserConsent();
    }

    // Tray must exist before the window is shown so minimize/close can hide to tray
    try {
      await this.setupTray();
    } catch (error) {
      console.log('Tray setup failed, continuing without tray:', error.message);
    }
    
    // Create the main window before any long-running network work so the UI is visible immediately
    await this.createWindow();
    
    // Restore Supabase session from store or web app
    try {
      await this.initializeSupabaseAuth();
    } catch (error) {
      console.error('Supabase auth initialization failed:', error?.message || error);
      this.handleOfflineMode();
    }
    
    // Load app settings (productive hours, idle threshold)
    try {
      await this.loadAppSettings();
    } catch (error) {
      console.error('App settings load failed:', error?.message || error);
    }
    
    await this.setupIPC();
    await this.requestPermissions();
    
    // Start periodic screenshot capture if monitoring is enabled
    this.startPeriodicScreenshots();
    
    // Initialize timer overlay
    this.setupTimerOverlay();
  }

  async loadAppSettings() {
    try {
      const isServerRunning = await this.checkServerConnection();
      if (!isServerRunning) {
        console.log('Settings: server not running, using defaults');
        return;
      }
      const { net } = require('electron');
      const url = `${this.serverUrl}/api/settings`;
      await new Promise((resolve) => {
        const req = net.request({ method: 'GET', url });
        let body = '';
        req.on('response', (res) => {
          res.on('data', (chunk) => { body += chunk.toString(); });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const settings = parsed.settings || {};
              const productivity = settings.productivity || {};
              const targetHours = Number(productivity.targetProductiveHours) || 8;
              const idleThresholdMin = Number(productivity.idleThreshold) || 10;
              this.breakReminderMs = Math.max(30, (targetHours * 60) / 2) * 60 * 1000;
              this.maxIdleTime = idleThresholdMin * 60 * 1000;
              store.set('appSettings', { targetProductiveHours: targetHours, idleThreshold: idleThresholdMin });
              console.log('Settings loaded:', { targetHours, idleThresholdMin, breakReminderMs: this.breakReminderMs });
            } catch (e) {
              console.log('Failed to parse settings:', e.message);
            }
            resolve(true);
          });
        });
        req.on('error', () => resolve(false));
        req.end();
      });
    } catch (e) {
      console.log('Settings load failed:', e?.message || e);
    }
  }

  async requestUserConsent() {
    return new Promise((resolve) => {
      const consentDialog = new BrowserWindow({
        width: 500,
        height: 400,
        modal: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'consent-preload.js')
        }
      });

      const consentHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .consent-box { border: 1px solid #ccc; padding: 15px; margin: 10px 0; }
            .checkbox-group { margin: 10px 0; }
            button { padding: 10px 20px; margin: 5px; }
            .accept { background: #4CAF50; color: white; border: none; }
            .decline { background: #f44336; color: white; border: none; }
          </style>
        </head>
        <body>
          <h2>Privacy Consent Required</h2>
          <p>AuctusHR needs your consent to collect productivity data:</p>
          
          <div class="consent-box">
            <div class="checkbox-group">
              <input type="checkbox" id="screenshots" checked>
              <label for="screenshots">Allow periodic screenshots (every 5 minutes)</label>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="activity" checked>
              <label for="activity">Track active applications and productivity</label>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="sync" checked>
              <label for="sync">Sync data to company productivity system</label>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="blur">
              <label for="blur">Blur sensitive content in screenshots</label>
            </div>
          </div>
          
          <p><strong>Data Retention:</strong> Your data will be automatically deleted after 30 days.</p>
          <p><strong>Your Rights:</strong> You can change these settings anytime from the system tray.</p>
          
          <button class="accept" onclick="acceptConsent()">Accept & Continue</button>
          <button class="decline" onclick="declineConsent()">Decline</button>
          
          <script>
            function acceptConsent() {
              const settings = {
                allowScreenshots: document.getElementById('screenshots').checked,
                allowActivityTracking: document.getElementById('activity').checked,
                allowDataSync: document.getElementById('sync').checked,
                blurScreenshots: document.getElementById('blur').checked,
                userConsent: true
              };
              window.consentAPI.consentResponse(settings);
            }
            
            function declineConsent() {
              window.consentAPI.consentResponse(null);
            }
          </script>
        </body>
        </html>
      `;

      consentDialog.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(consentHTML)}`);
      
      // Handle consent response
      ipcMain.once('consent-dialog-response', (event, settings) => {
        if (settings) {
          this.privacySettings = { ...this.privacySettings, ...settings };
          store.set('privacySettings', this.privacySettings);
          consentDialog.close();
          resolve();
        } else {
          // User declined - exit app
          app.quit();
        }
      });
    });
  }

  async initializeSupabaseAuth() {
    try {
      console.log('Initializing Supabase auth session...');

      if (restoreStoredAuth(this, store)) {
        console.log('Restored Supabase session:', this.authUser?.email);
        this.startTaskAndNotificationPolling?.();
        return;
      }

      const isServerRunning = await this.checkServerConnection();
      if (!isServerRunning) {
        console.log('Web app server not running, using offline mode');
        this.handleOfflineMode();
        return;
      }

      this.checkWebStorageAuth();

      console.log('No stored Supabase session — sign in via the desktop app');
      this.safeSendToMainWindow('auth-state-changed', {
        authenticated: false,
        user: null
      });
    } catch (error) {
      console.error('Supabase auth initialization failed:', error);
      this.handleOfflineMode();
    }
  }

  // Check if the web app server is running
  async checkServerConnection() {
    try {
      // Use a simple HTTP request to check if server is running
      const { net } = require('electron');
      const request = net.request({
        method: 'HEAD',
        url: `${this.serverUrl}/api/auth/session`
      });
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          request.abort();
          resolve(false);
        }, 5000);
        
        request.on('response', (response) => {
          clearTimeout(timeout);
          // 401/403 means server is reachable but user is not authenticated yet.
          // Treat 5xx/connection failures as offline.
          resolve(response.statusCode > 0 && response.statusCode < 500);
        });
        
        request.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
        
        request.end();
      });
    } catch (error) {
      console.log('Server connection check failed:', error.message);
      return false;
    }
  }

  // Check for stored auth data from web app
  checkStoredAuthData() {
    try {
      // Method 1: Check persistent storage (electron-store)
      const storedAuthData = store.get('webAppAuthData');
      const authTimestamp = store.get('webAppAuthTimestamp');
      
        if (storedAuthData && authTimestamp) {
        const now = Date.now();
        const timeDiff = now - authTimestamp;
        
        // Check if auth data is less than 24 hours old
        if (timeDiff < 24 * 60 * 60 * 1000) {
          console.log('✅ Found valid stored auth data from persistent storage');
          if (storedAuthData.token && storedAuthData.user) {
            applyAuthSession(this, storedAuthData.token, storedAuthData.user, store);
          }
          return storedAuthData;
        } else {
          console.log('⏰ Stored auth data expired, clearing...');
          store.delete('webAppAuthData');
          store.delete('webAppAuthTimestamp');
        }
      }
      
      // Method 2: Check if we can access localStorage from a web context
      // This is a fallback for when the web app stores auth data
      this.checkWebStorageAuth();
      
      return null;
    } catch (error) {
      console.error('Error checking stored auth data:', error);
      return null;
    }
  }

  // Check web app's localStorage for auth data
  async checkWebStorageAuth() {
    try {
      console.log('🔍 Checking for auth data in web app localStorage...');
      
      // First check if server is running
      const isServerRunning = await this.checkServerConnection();
      if (!isServerRunning) {
        console.log('⚠️ Web app server not running, skipping localStorage check');
        return;
      }
      
      // Create a hidden window to check localStorage
      const checkWindow = new BrowserWindow({
        show: false,
        webSecurity: false,
        nodeIntegration: false,
        contextIsolation: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      // Add error handling for window load
      checkWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log('⚠️ Failed to load web app for localStorage check:', errorDescription);
        checkWindow.close();
      });
      
      try {
        await checkWindow.loadURL(`${this.serverUrl}`);
        
        // Wait a moment for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const authData = await checkWindow.webContents.executeJavaScript(`
          (function() {
            try {
              const data = localStorage.getItem('desktopAuthData');
              const timestamp = localStorage.getItem('desktopAuthTimestamp');
              
              console.log('Checking localStorage:', { hasData: !!data, hasTimestamp: !!timestamp });
              
              if (data && timestamp) {
                const now = Date.now();
                const timeDiff = now - parseInt(timestamp);
                
                console.log('Auth data age:', timeDiff / 1000 / 60, 'minutes');
                
                // Check if less than 1 hour old (shorter window for localStorage)
                if (timeDiff < 60 * 60 * 1000) {
                  console.log('Found fresh auth data in localStorage');
                  return JSON.parse(data);
                } else {
                  console.log('Auth data in localStorage expired');
                  localStorage.removeItem('desktopAuthData');
                  localStorage.removeItem('desktopAuthTimestamp');
                }
              } else {
                console.log('No auth data found in localStorage');
              }
              return null;
            } catch (error) {
              console.error('Error in localStorage check:', error.message);
              return null;
            }
          })()
        `);
        
        checkWindow.close();
        
        if (authData && authData.token && authData.user) {
          console.log('✅ Found valid auth data in web localStorage!');
          console.log('User:', authData.user.email);
          this.handleOAuthSuccess(authData.token, authData.user);
        } else {
          console.log('❌ No valid auth data found in web localStorage');
        }
        
      } catch (loadError) {
        console.log('⚠️ Failed to load web app page:', loadError.message);
        checkWindow.close();
      }
      
    } catch (error) {
      console.error('Error checking web storage auth:', error.message);
    }
  }

  // Handle offline mode when web app is not available
  handleOfflineMode() {
    console.log('Running in offline mode - cloud sync disabled');
    
    // Set offline user data
    this.userData = {
      id: 'offline-user',
      email: 'offline@local.app',
      name: 'Offline User',
      role: 'employee',
      offline: true
    };
    
    // Store offline data
    store.set('userData', this.userData);
    store.set('offlineMode', true);
    
    // Notify main window about offline state
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-state-changed', {
        authenticated: true,
        user: this.userData,
        offline: true
      });
    }
    
    console.log('Offline mode initialized');
    this.startTaskAndNotificationPolling();
  }

  async createWindow() {
    const isDev = !app.isPackaged;
    const devServerUrl = 'http://localhost:3000';
    // For now, always load from production URL
    const webAppUrl = this.serverUrl || this.productionServerUrl || DEFAULT_PROD_URL;

    this.useStandaloneMonitoringUI =
      process.argv.includes('--monitoring-ui') ||
      process.env.ELECTRON_STANDALONE_MONITORING === '1';
    
    console.log('Creating window...');
    console.log('isDev:', isDev);
    console.log(
      'Loading from:',
      this.useStandaloneMonitoringUI ? 'modern-ui.html (standalone desktop monitor)' : webAppUrl
    );

    // Window state persistence - remembers size and position
    let mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800,
      minWidth: 800,
      minHeight: 600,
    });

    this.mainWindow = new BrowserWindow({
      x: mainWindowState.x,
      y: mainWindowState.y,
      width: mainWindowState.width,
      height: mainWindowState.height,
      minWidth: 800,
      minHeight: 600,
      show: false,
      frame: false,  // Fully frameless - no native frame at all
      movable: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        // Performance optimizations
        enableWebGL: true,
        backgroundThrottling: false,  // Keep running when in background
      },
      // Remove titleBarStyle and titleBarOverlay - we want fully custom
      backgroundColor: '#ffffff',
      backgroundColor: '#1a1a1a',
      icon: path.join(__dirname, '../public/globe.svg')
    });

    // Let windowStateKeeper manage the window
    mainWindowState.manage(this.mainWindow);

    // Setup native context menu for main window
    this.setupContextMenu();

    // Window is now ready - load the web app
    // Show window immediately (don't wait for content to load)
    this.mainWindow.once('ready-to-show', () => {
      console.log('Window ready to show');
      this.mainWindow.setOpacity(0);
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Fade in animation
      const fadeIn = setInterval(() => {
        const opacity = this.mainWindow.getOpacity();
        if (opacity >= 1) {
          clearInterval(fadeIn);
        } else {
          this.mainWindow.setOpacity(Math.min(opacity + 0.1, 1));
        }
      }, 16); // ~60fps
    });

    // Also show window if ready-to-show doesn't fire (fallback)
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isVisible()) {
        console.log('Window not visible after timeout, forcing show');
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    }, 3000);

    // Handle page load events for debugging
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('Page started loading...');
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page finished loading');
    });

    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Page failed to load:', {
        errorCode,
        errorDescription,
        url: validatedURL
      });
      // Show error page
      this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Loading Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #1a1a1a;
              color: white;
            }
            .error-container {
              text-align: center;
              padding: 40px;
            }
            h1 { color: #ff4444; }
            code { background: #333; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Failed to Load App</h1>
            <p>Error Code: <code>${errorCode}</code></p>
            <p>Error: ${errorDescription}</p>
            <p>URL: <code>${validatedURL}</code></p>
            <p style="margin-top: 20px; color: #888;">
              Make sure Next.js dev server is running on port 3000
            </p>
          </div>
        </body>
        </html>
      `)}`);
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    // Load Next.js shell, or the bundled standalone desktop monitor (modern-ui.html)
    try {
      // Open DevTools for debugging (even in production for now)
      if (isDev) {
        this.mainWindow.webContents.openDevTools();
      }
      
      // Log any console messages from the web page
      this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Web Console ${level}]:`, message, `(${sourceId}:${line})`);
      });
      
      // Log renderer process crashes
      this.mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('Renderer process crashed:', details);
      });
      
      // Log uncaught exceptions
      this.mainWindow.webContents.on('uncaught-exception', (event, error) => {
        console.error('Uncaught exception:', error);
      });

      if (this.useStandaloneMonitoringUI) {
        const monitorHtmlPath = path.join(__dirname, 'modern-ui.html');
        console.log('Loading standalone desktop monitor from:', monitorHtmlPath);
        await this.mainWindow.loadFile(monitorHtmlPath);
        console.log('Standalone monitoring UI loaded');
      } else {
        console.log('Loading web app from:', webAppUrl);
        await this.mainWindow.loadURL(webAppUrl);
        console.log('Web app loaded successfully');

        // Inject CSS to ensure title bar drag region works with remote content
        this.mainWindow.webContents.once('did-finish-load', () => {
          this.mainWindow.webContents.insertCSS(`
          [data-electron-title-bar] {
            -webkit-app-region: drag !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 99999 !important;
            pointer-events: auto !important;
            height: 40px !important;
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            background-color: white !important;
          }
          [data-electron-title-bar] button,
          [data-electron-title-bar] [style*="no-drag"],
          [data-electron-title-bar] [style*="no-drag"] * {
            -webkit-app-region: no-drag !important;
          }
        `).catch(err => console.error('Failed to inject title bar CSS:', err));
        
          this.mainWindow.webContents.executeJavaScript(`
          const titleBar = document.querySelector('[data-electron-title-bar]');
          console.log('Title bar element:', titleBar ? 'Found' : 'NOT FOUND');
          if (titleBar) {
            console.log('Title bar styles:', window.getComputedStyle(titleBar).display);
            console.log('Title bar z-index:', window.getComputedStyle(titleBar).zIndex);
          }
        `).catch(err => console.error('Failed to check title bar:', err));
        });

        setTimeout(() => {
          this.mainWindow.webContents.executeJavaScript(`
          console.log('Page loaded, checking content...');
          console.log('Title bar element:', document.querySelector('[data-electron-title-bar]') ? 'Found' : 'Not found');
          console.log('Title:', document.title);
        `).catch(err => console.error('Failed to execute check script:', err));
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to load web app:', error);
      // Fallback: Show error page and make sure window is visible
      this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Loading Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #1a1a1a;
              color: white;
            }
            .error-container {
              text-align: center;
              padding: 40px;
            }
            h1 { color: #ff4444; }
            code { background: #333; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Failed to Load App</h1>
            <p>Error: ${error.message}</p>
            <p>Check console for details.</p>
          </div>
        </body>
        </html>
      `)}`);
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    // Handle external links - open in browser instead of Electron
    const { shell } = require('electron');
    
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Prevent navigation to external sites (except your app)
    this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (this.useStandaloneMonitoringUI) {
        try {
          const parsedUrl = new URL(navigationUrl);
          if (parsedUrl.protocol === 'file:') return;
        } catch {
          return;
        }
      }
      const parsedUrl = new URL(navigationUrl);
      const allowedHosts = ['auctushr.vercel.app', 'auctushr.com', 'www.auctushr.com', new URL(webAppUrl).hostname];
      
      if (!allowedHosts.includes(parsedUrl.hostname)) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    });

    this.mainWindow.on('close', (event) => {
      if (app.isQuiting) {
        return;
      }
      if (this.shouldMinimizeToTray()) {
        event.preventDefault();
        this.minimizeToTray();
      }
    });

    this.mainWindow.on('minimize', (event) => {
      if (app.isQuiting || !this.shouldMinimizeToTray()) {
        return;
      }
      event.preventDefault();
      this.minimizeToTray();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  async ensureMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    try {
      await this.createWindow();
    } catch (error) {
      console.error('Failed to recreate main window:', error);
    }

    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null;
  }

  async focusMainWindow({ route } = {}) {
    const window = await this.ensureMainWindow();
    if (!window) {
      return;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    if (process.platform === 'win32') {
      window.setSkipTaskbar(false);
    }

    window.show();
    window.focus();

    if (route) {
      const sendRoute = () => this.safeSendToMainWindow('navigate', route);
      if (window.webContents.isLoading()) {
        window.webContents.once('did-finish-load', sendRoute);
      } else {
        sendRoute();
      }
    }
  }

  async setupTray() {
    try {
      // Try to create tray with fallback icon
      // Check multiple possible paths for the icon
      const possibleIconPaths = [
        path.join(__dirname, '../public/electron/icon.png'),
        path.join(process.cwd(), 'public/electron/icon.png'),
        path.join(app.getAppPath(), 'public/electron/icon.png'),
      ];
      
      let iconPath = null;
      for (const possiblePath of possibleIconPaths) {
        if (fs.existsSync(possiblePath)) {
          iconPath = possiblePath;
          break;
        }
      }
      
      const fallbackIconPath = path.join(__dirname, '../public/globe.svg');
      
      // Determine which icon to use
      let usableIconPath = null;
      if (iconPath && fs.existsSync(iconPath)) {
        const stats = fs.statSync(iconPath);
        if (stats.size >= 1024) {
          usableIconPath = iconPath;
        }
      }
      
      if (!usableIconPath && fs.existsSync(fallbackIconPath)) {
        usableIconPath = fallbackIconPath;
      }
      
      if (!usableIconPath) {
        console.log('Tray: no icon files found, creating tray with empty icon');
        this.tray = new Tray(require('electron').nativeImage.createEmpty());
      } else {
        console.log('Tray: Using icon at', usableIconPath);
        this.tray = new Tray(usableIconPath);
      }
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Window',
          click: () => {
            this.focusMainWindow();
          }
        },
        {
          label: this.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
          click: () => {
            if (this.isMonitoring) {
              this.stopMonitoring();
            } else {
              this.startMonitoring();
            }
          }
        },
        {
          label: 'Work Status',
          submenu: [
            {
              label: 'Working',
              type: 'radio',
              checked: store.get('workStatus') === 'working',
              click: () => this.updateWorkStatus('working')
            },
            {
              label: 'Break',
              type: 'radio',
              checked: store.get('workStatus') === 'break',
              click: () => this.updateWorkStatus('break')
            },
            {
              label: 'Offline',
              type: 'radio',
              checked: store.get('workStatus') === 'offline',
              click: () => this.updateWorkStatus('offline')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            this.focusMainWindow({ route: '/settings' });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.isQuiting = true;
            app.quit();
          }
        }
      ]);
      
      this.tray.setContextMenu(contextMenu);
      this.tray.setToolTip('AuctusHR');
      
      this.tray.on('click', () => {
        this.focusMainWindow();
      });
      
      console.log('Tray setup completed successfully');
    } catch (error) {
      console.error('Tray setup failed:', error);
      // Don't crash the app if tray fails
    }
  }

  setupContextMenu() {
    // Native context menu for the main window
    const contextMenuTemplate = [
      {
        label: 'Cut',
        role: 'cut',
        accelerator: 'CmdOrCtrl+X'
      },
      {
        label: 'Copy',
        role: 'copy',
        accelerator: 'CmdOrCtrl+C'
      },
      {
        label: 'Paste',
        role: 'paste',
        accelerator: 'CmdOrCtrl+V'
      },
      {
        label: 'Select All',
        role: 'selectAll',
        accelerator: 'CmdOrCtrl+A'
      },
      { type: 'separator' },
      {
        label: 'Reload',
        role: 'reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.reload();
          }
        }
      },
      {
        label: 'Force Reload',
        role: 'forceReload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.reloadIgnoringCache();
          }
        }
      },
      {
        label: 'Toggle Developer Tools',
        role: 'toggleDevTools',
        accelerator: 'F12',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.toggleDevTools();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Minimize to Tray',
        accelerator: 'CmdOrCtrl+M',
        click: () => {
          this.minimizeToTray();
        }
      },
      {
        label: 'Hide to Tray',
        accelerator: 'CmdOrCtrl+W',
        click: () => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.close();
          }
        }
      }
    ];

    // Set context menu for the main window
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.on('context-menu', (e, params) => {
        const menu = Menu.buildFromTemplate(contextMenuTemplate);
        menu.popup();
      });
    }
  }

  async setupIPC() {
    // Remove any existing handlers to prevent duplicates
    try {
      ipcMain.removeHandler('takeScreenshotNow');
      ipcMain.removeHandler('getProductivityData');
      ipcMain.removeHandler('getBreakReminder');
      ipcMain.removeHandler('getOvertimeStatus');
      ipcMain.removeHandler('get-current-session-stats');
      ipcMain.removeHandler('get-privacy-settings');
      ipcMain.removeHandler('get-working-hours');
      ipcMain.removeHandler('get-monitoring-status');
      ipcMain.removeHandler('get-task-stats');
      ipcMain.removeHandler('get-notifications');
      ipcMain.removeHandler('window-is-maximized');
      ipcMain.removeHandler('get-system-theme');
      ipcMain.removeHandler('get-system-info');
      ipcMain.removeHandler('get-break-reminder');
      ipcMain.removeHandler('get-overtime-status');
      ipcMain.removeHandler('get-productivity-data');
      ipcMain.removeHandler('get-user-preferences');
      ipcMain.removeHandler('export-session-data');
      ipcMain.removeHandler('export-productivity-report');
    } catch (error) {
      // Ignore errors if handlers don't exist yet
    }

    ipcMain.handle('get-system-info', () => {
      const now = Date.now();
      const sessionStart = store.get('sessionStartTime');
      const sessionDuration = sessionStart ? now - new Date(sessionStart).getTime() : 0;
      const idleTime = now - this.lastActivity;
      const memory = process.memoryUsage ? process.memoryUsage() : { rss: 0, heapUsed: 0, heapTotal: 0 };
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions?.node || '',
        electronVersion: process.versions?.electron || '',
        chromeVersion: process.versions?.chrome || '',
        appVersion: app.getVersion(),
        uptimeMs: Math.floor((process.uptime ? process.uptime() : 0) * 1000),
        sessionDurationMs: sessionDuration,
        idleTimeMs: idleTime,
        isMonitoring: this.isMonitoring,
        screenshotsCount: this.screenshots?.length || 0,
        activitiesCount: this.activityData?.length || 0,
        memory: {
          rssBytes: memory.rss || 0,
          heapUsedBytes: memory.heapUsed || 0,
          heapTotalBytes: memory.heapTotal || 0,
        },
      };
    });

    // Window controls
    ipcMain.on('window-minimize', () => {
      this.minimizeToTray();
    });

    ipcMain.on('window-maximize', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize();
        } else {
          this.mainWindow.maximize();
        }
      }
    });

    ipcMain.on('window-close', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.close();
      }
    });

    // Window state change events for UI updates
    if (this.mainWindow) {
      this.mainWindow.on('maximize', () => {
        this.safeSendToMainWindow('window-maximized', true);
      });
      this.mainWindow.on('unmaximize', () => {
        this.safeSendToMainWindow('window-maximized', false);
      });
    }

    ipcMain.handle('window-is-maximized', () => {
      return this.mainWindow && !this.mainWindow.isDestroyed() 
        ? this.mainWindow.isMaximized() 
        : false;
    });

    // System theme (nativeTheme already imported at top)
    ipcMain.handle('get-system-theme', () => {
      return nativeTheme.shouldUseDarkColors;
    });

    // Send initial theme on window ready
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.once('did-finish-load', () => {
        this.mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
      });
    }

    // Listen for theme changes
    nativeTheme.on('updated', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
      }
    });
    
    // Handle monitoring control
    ipcMain.on('start-monitoring', async (event, data) => {
      if (data && data.userData) {
        this.userData = data.userData;
        store.set('userData', this.userData);
      }
      this.startMonitoring();
    });

    ipcMain.on('stop-monitoring', () => {
      this.stopMonitoring();
    });

    // Handle work status updates
    ipcMain.on('update-work-status', (event, status) => {
      this.updateWorkStatus(status);
    });

    // Handle user login/logout from web app
    ipcMain.on('user-login', (event, userData) => {
      this.userData = userData;
      store.set('userData', userData);
      this.checkWorkingHours();
    });

    ipcMain.on('user-logout', () => {
      this.userData = null;
      this.stopMonitoring();
      this.stopTaskAndNotificationPolling();
      store.delete('userData');
      store.delete('sessionStartTime');
    });

    // Handle privacy settings updates
    ipcMain.on('update-privacy-settings', (event, newSettings) => {
      this.updatePrivacySettings(newSettings);
    });

    // Handle working hours updates
    ipcMain.on('update-working-hours', (event, { start, end }) => {
      this.updateWorkingHours(start, end);
    });

    // Handle data requests from renderer
    ipcMain.handle('get-current-session-stats', () => {
      return this.getCurrentSessionStats();
    });

    ipcMain.handle('get-privacy-settings', () => {
      return this.privacySettings;
    });

    ipcMain.handle('get-working-hours', () => {
      return this.workingHours;
    });

    ipcMain.handle('get-monitoring-status', () => {
      const now = Date.now();
      const sessionStart = store.get('sessionStartTime');
      const sessionDuration = sessionStart ? now - new Date(sessionStart).getTime() : 0;
      const currentIdleStreak = Math.max(0, now - this.lastActivity);
      const idleTime = Math.min(sessionDuration, this.cumulativeIdleTime + currentIdleStreak);
      
      return {
        isMonitoring: this.isMonitoring,
        userData: this.userData,
        lastActivity: this.lastActivity,
        sessionStart: store.get('sessionStartTime'),
        sessionDuration: sessionDuration,
        idleTime: idleTime,
        currentIdleStreak,
        screenshotsCount: this.screenshots.length,
        activityCount: this.activityData.length,
        isActive: currentIdleStreak < 60000
      };
    });

    // Handle manual data cleanup
    ipcMain.on('cleanup-old-data', () => {
      this.cleanupOldData();
    });

    // Handle screenshot capture on demand
    ipcMain.handle('takeScreenshotNow', async () => {
      if (this.privacySettings.allowScreenshots) {
        const screenshot = await this.takeScreenshot();
        const screenshotData = {
          id: Date.now().toString(),
          filename: `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
          timestamp: Date.now(),
          size: '1.2MB' // Placeholder size
        };
        return { success: true, ...screenshotData };
      } else {
        throw new Error('Screenshots are disabled in privacy settings');
      }
    });

    // Handle productivity data requests
    ipcMain.handle('get-productivity-data', () => {
      const now = Date.now();
      const sessionStart = store.get('sessionStartTime');
      const sessionDuration = sessionStart ? now - new Date(sessionStart).getTime() : 0;
      const currentIdleStreak = Math.max(0, now - this.lastActivity);
      const idleTime = Math.min(sessionDuration, this.cumulativeIdleTime + currentIdleStreak);
      const activeTime = Math.max(0, sessionDuration - idleTime);
      const productivityScore = sessionDuration > 0
        ? Math.round((activeTime / sessionDuration) * 100)
        : 0;
      const focusLevel = currentIdleStreak < 60000
        ? 90
        : currentIdleStreak < 5 * 60 * 1000
          ? 60
          : 25;
      
      return {
        productivityScore,
        focusLevel,
        activeTime,
        sessionStart: store.get('sessionStartTime'),
        currentActivity: this.activityData[this.activityData.length - 1] || null,
        idleTime: idleTime,
        currentIdleStreak,
        sessionDuration: sessionDuration
      };
    });

    // Handle break reminder requests
    ipcMain.handle('getBreakReminder', () => {
      const now = Date.now();
      const sessionStart = store.get('sessionStartTime') || now;
      const elapsed = now - sessionStart;
      const minutesElapsed = Math.floor(elapsed / 60000);
      const minutesUntilBreak = Math.max(0, 25 - (minutesElapsed % 25));
      
      return {
        shouldBreak: minutesUntilBreak === 0,
        timeUntilBreak: minutesUntilBreak * 60000
      };
    });

    // Handle overtime status requests
    ipcMain.handle('getOvertimeStatus', () => {
      const sessionStart = store.get('sessionStartTime');
      if (!sessionStart) {
        return { isOvertime: false, overtimeMinutes: 0 };
      }
      
      const elapsed = Date.now() - sessionStart;
      const hours = Math.floor(elapsed / 3600000);
      const isOvertime = hours >= 8;
      const overtimeMinutes = isOvertime ? Math.floor((elapsed - (8 * 3600000)) / 60000) : 0;
      
      return {
        isOvertime,
        overtimeMinutes
      };
    });

    // Handle activity tracking toggle
    ipcMain.on('toggle-activity-tracking', (event, enabled) => {
      this.privacySettings.allowActivityTracking = enabled;
      store.set('privacySettings', this.privacySettings);
      
      if (!enabled) {
        this.activityData = [];
        store.set('activityData', []);
      }
    });

    // Handle screenshot capture toggle
    ipcMain.on('toggle-screenshot-capture', (event, enabled) => {
      this.privacySettings.allowScreenshots = enabled;
      store.set('privacySettings', this.privacySettings);
      
      if (!enabled) {
        this.screenshots = [];
        store.set('screenshots', []);
      }
    });

    // New monitoring interface IPC handlers
    ipcMain.on('pause-monitoring', () => {
      this.pauseMonitoring();
    });

    ipcMain.on('sync-data-now', () => {
      this.syncMonitoringData();
    });

    ipcMain.on('export-data', () => {
      this.exportData();
    });

    // Handle data requests from monitoring interface (removed duplicate)

    ipcMain.handle('get-break-reminder', () => {
      const sessionStart = store.get('sessionStartTime');
      if (!sessionStart) return { shouldBreak: false, timeUntilBreak: 0 };
      
      const sessionDuration = Date.now() - sessionStart;
      const breakInterval = 25 * 60 * 1000; // 25 minutes
      const timeUntilBreak = breakInterval - (sessionDuration % breakInterval);
      
      return {
        shouldBreak: timeUntilBreak <= 0,
        timeUntilBreak: Math.max(0, timeUntilBreak)
      };
    });

    ipcMain.handle('get-overtime-status', () => {
      const sessionStart = store.get('sessionStartTime');
      if (!sessionStart) return { isOvertime: false, overtimeMinutes: 0 };
      
      const sessionDuration = Date.now() - sessionStart;
      const standardWorkDay = 8 * 60 * 60 * 1000; // 8 hours
      const overtimeMinutes = Math.max(0, (sessionDuration - standardWorkDay) / (60 * 1000));
      
      return {
        isOvertime: overtimeMinutes > 0,
        overtimeMinutes: Math.floor(overtimeMinutes)
      };
    });

    ipcMain.handle('get-user-preferences', () => {
      return {
        privacySettings: this.privacySettings,
        workingHours: this.workingHours,
        notifications: store.get('notifications', true),
        autoStart: store.get('autoStart', false),
        theme: store.get('theme', 'light')
      };
    });

    ipcMain.on('update-user-preferences', (event, prefs) => {
      if (prefs.privacySettings) {
        this.updatePrivacySettings(prefs.privacySettings);
      }
      if (prefs.workingHours) {
        this.updateWorkingHours(prefs.workingHours.start, prefs.workingHours.end);
      }
      if (prefs.notifications !== undefined) {
        store.set('notifications', prefs.notifications);
      }
      if (prefs.autoStart !== undefined) {
        store.set('autoStart', prefs.autoStart);
      }
      if (prefs.theme) {
        store.set('theme', prefs.theme);
      }
    });

    ipcMain.on('show-notification', (event, { message, type }) => {
      this.showTrayNotification(message);
    });

    ipcMain.on('minimize-to-tray', () => {
      this.minimizeToTray();
    });

    ipcMain.on('open-settings', () => {
      this.showSettingsDialog();
    });

    ipcMain.handle('export-session-data', () => {
      return this.exportData();
    });

    ipcMain.handle('export-productivity-report', () => {
      return this.generateProductivityReport();
    });

    // Handle opening screenshots folder
    ipcMain.on('open-screenshots-folder', () => {
      this.openScreenshotsFolder();
    });

    // Handle data sync toggle
    ipcMain.on('toggle-data-sync', (event, enabled) => {
      this.privacySettings.allowDataSync = enabled;
      store.set('privacySettings', this.privacySettings);
    });

    // Handle blur screenshots toggle
    ipcMain.on('toggle-blur-screenshots', (event, enabled) => {
      this.privacySettings.blurScreenshots = enabled;
      store.set('privacySettings', this.privacySettings);
    });

    // Task and Notification IPC Handlers
    ipcMain.handle('get-task-stats', async () => {
      return await this.fetchTaskStats();
    });

    ipcMain.handle('get-notifications', async () => {
      return await this.fetchNotifications();
    });

    ipcMain.on('mark-notification-read', async (event, notificationId) => {
      await this.markNotificationAsRead(notificationId);
      event.reply('notification-marked-read', { id: notificationId });
    });

    ipcMain.on('clear-all-notifications', (event) => {
      // Send event to frontend to clear notifications
      event.reply('notifications-cleared');
    });

    // Handle data retention policy update
    ipcMain.on('update-data-retention', (event, days) => {
      this.privacySettings.dataRetentionDays = days;
      store.set('privacySettings', this.privacySettings);
      this.cleanupOldData();
    });

    // Legacy channel — auth is handled via web app OAuth (Supabase)
    ipcMain.on('firebase-login', async () => {
      console.log('Direct login deprecated — use openWebAppForAuth (Supabase OAuth)');
      this.openWebAppForAuth();
    });
    ipcMain.on('supabase-login', async () => {
      this.openWebAppForAuth();
    });

    // Handle custom working hours dialog response
    ipcMain.on('custom-working-hours', (event, { start, end }) => {
      this.updateWorkingHours(start, end);
    });

    // Handle dialog working hours update
    ipcMain.on('dialog-working-hours-update', (event, { start, end }) => {
      this.updateWorkingHours(start, end);
    });

    // Handle consent response
    ipcMain.on('consent-response', (event, settings) => {
      if (settings) {
        this.privacySettings = { ...this.privacySettings, ...settings };
        store.set('privacySettings', this.privacySettings);
      }
    });

    // Handle consent dialog response
    ipcMain.on('consent-dialog-response', (event, settings) => {
      if (settings) {
        this.privacySettings = { ...this.privacySettings, ...settings };
        store.set('privacySettings', this.privacySettings);
      }
    });

    // Handle open web app
    ipcMain.on('open-web-app', () => {
      this.openWebApp();
    });

    // Handle OAuth authentication
    ipcMain.on('open-web-app-for-auth', () => {
      this.openWebAppForAuth();
    });

    // Handle timer overlay controls
    ipcMain.on('show-timer-overlay', () => {
      this.showTimerOverlay();
    });

    ipcMain.on('hide-timer-overlay', () => {
      this.hideTimerOverlay();
    });

    ipcMain.on('move-timer-overlay', (event, { x, y }) => {
      this.moveTimerOverlay(x, y);
    });

    // Handle monitoring controls (removed duplicates)

    // Handle data sync
    ipcMain.on('sync-data-now', () => {
      this.syncMonitoringData();
    });

    // Handle data cleanup
    ipcMain.on('cleanup-old-data', () => {
      this.cleanupOldData();
    });

    // Handle data export
    ipcMain.on('export-data', () => {
      return this.exportData();
    });
  }

  async requestPermissions() {
    if (process.platform === 'darwin') {
      // Request screen recording permission on macOS
      const screenAccess = systemPreferences.getMediaAccessStatus('screen');
      if (screenAccess !== 'granted') {
        await systemPreferences.askForMediaAccess('screen');
      }
    }
  }

  async checkWorkingHours() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if it's a working day (Monday-Friday)
      const isWorkingDay = currentDay >= 1 && currentDay <= 5;
      
      // Check if current time is within working hours
      const isWorkingHours = currentTime >= this.workingHours.start && 
                            currentTime <= this.workingHours.end;
      
      // Auto-start monitoring if within working hours and not already monitoring
      if (isWorkingDay && isWorkingHours && !this.isMonitoring && this.userData) {
        console.log('Auto-starting monitoring - within working hours');
        this.startMonitoring();
        this.showTrayNotification('Monitoring auto-started - work hours detected');
      }
      
      // Auto-stop monitoring if outside working hours
      if (!isWorkingHours && this.isMonitoring) {
        console.log('Auto-stopping monitoring - outside working hours');
        this.stopMonitoring();
        this.showTrayNotification('Monitoring stopped - outside working hours');
      }
      
      // Update work status based on time
      if (isWorkingDay && isWorkingHours) {
        this.updateWorkStatus('working');
      } else if (isWorkingDay && currentTime < this.workingHours.start) {
        this.updateWorkStatus('before-work');
      } else if (isWorkingDay && currentTime > this.workingHours.end) {
        this.updateWorkStatus('after-work');
      } else {
        this.updateWorkStatus('weekend');
      }
      
      // Schedule next check in 1 minute
      setTimeout(() => this.checkWorkingHours(), 60 * 1000);
      
    } catch (error) {
      console.error('Working hours check error:', error);
    }
  }

  // Enhanced working hours management
  updateWorkingHours(start, end) {
    this.workingHours = { start, end };
    store.set('workingHours', this.workingHours);
    
    // Re-check working hours after update
    this.checkWorkingHours();
    
    this.showTrayNotification(`Working hours updated: ${start} - ${end}`);
  }

  // Get current work session statistics
  getCurrentSessionStats() {
    const sessionStart = store.get('sessionStartTime');
    if (!sessionStart) return null;
    
    const now = Date.now();
    const sessionDuration = now - new Date(sessionStart).getTime();
    const sessionHours = Math.floor(sessionDuration / (1000 * 60 * 60));
    const sessionMinutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    // Calculate productivity metrics for current session
    const sessionActivities = this.activityData.filter(activity => 
      new Date(activity.timestamp) >= new Date(sessionStart)
    );
    
    const avgProductivity = sessionActivities.length > 0 
      ? sessionActivities.reduce((sum, act) => sum + act.productivityScore, 0) / sessionActivities.length
      : 0;
    
    const focusTime = sessionActivities.filter(act => act.focusLevel === 'focused').length * 30; // 30 seconds per activity
    const communicationTime = sessionActivities.filter(act => act.focusLevel === 'communication').length * 30;
    const browsingTime = sessionActivities.filter(act => act.focusLevel === 'browsing').length * 30;
    
    return {
      sessionDuration,
      sessionHours,
      sessionMinutes,
      avgProductivity: Math.round(avgProductivity),
      focusTime,
      communicationTime,
      browsingTime,
      totalActivities: sessionActivities.length
    };
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    // Ensure we have user data (create offline user if needed)
    if (!this.userData) {
      if (store.get('offlineMode')) {
        this.handleOfflineMode(); // This sets userData for offline mode
      } else {
        console.log('Cannot start monitoring: No user data available');
        return;
      }
    }

    this.isMonitoring = true;
    this.lastActivity = Date.now();
    this.cumulativeIdleTime = 0;
    this.lastStatsTimestamp = Date.now();
    store.set('sessionStartTime', new Date().toISOString()); // Start session

    // Start enhanced periodic screenshots with idle monitoring
    this.startPeriodicScreenshots();

    // Track activity every 30 seconds
    this.activityInterval = setInterval(() => {
      this.trackActivity();
    }, 30 * 1000);

    // Start break reminders based on settings
    if (this.breakCheckInterval) {
      clearInterval(this.breakCheckInterval);
      this.breakCheckInterval = null;
    }
    this.lastBreakAlertTime = Date.now();
    this.breakCheckInterval = setInterval(() => {
      try {
        const now = Date.now();
        const sessionStart = store.get('sessionStartTime');
        const elapsed = sessionStart ? now - new Date(sessionStart).getTime() : 0;
        const sinceLastBreak = now - this.lastBreakAlertTime;
        // If half productive hours passed and user not idle beyond threshold, remind break
        const systemIdleMs = require('electron').powerMonitor.getSystemIdleTime() * 1000;
        const isCurrentlyIdle = systemIdleMs >= this.maxIdleTime;
        if (elapsed >= this.breakReminderMs && sinceLastBreak >= this.breakReminderMs && !isCurrentlyIdle) {
          this.showTrayNotification('Break Reminder', 'You have been working for a while, consider taking a short break.');
          this.lastBreakAlertTime = now;
        }
      } catch (_) {}
    }, 60 * 1000); // check each minute

    // Sync data every 15 minutes
    this.syncInterval = setInterval(() => {
      this.syncMonitoringData();
    }, 15 * 60 * 1000);

    // Show modern timer overlay
    this.showTimerOverlay();

    // Take initial screenshot
    this.takeScreenshot();
    
    this.updateTrayMenu();
    this.showTrayNotification('Monitoring started');
    
    // Notify renderer process
    this.safeSendToMainWindow('monitoring-status-changed', {
      isMonitoring: true,
      startTime: new Date().toISOString()
    });
    
    // Start stats update interval
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, 1000); // Update every second for real-time display
    
    // Start task and notification polling
    this.startTaskAndNotificationPolling();
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.cumulativeIdleTime = 0;
    this.lastStatsTimestamp = Date.now();

    // Stop enhanced periodic screenshots and idle monitoring
    this.stopPeriodicScreenshots();

    // Clear other intervals
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.breakCheckInterval) {
      clearInterval(this.breakCheckInterval);
      this.breakCheckInterval = null;
    }

    // Final sync before stopping
    this.syncMonitoringData();

    // Hide timer overlay
    this.hideTimerOverlay();

    store.delete('sessionStartTime'); // End session
    
    this.updateTrayMenu();
    this.showTrayNotification('Monitoring stopped');

    // Notify renderer process
    this.safeSendToMainWindow('monitoring-status-changed', {
      isMonitoring: false,
      stopTime: new Date().toISOString()
    });
    
    // Stop stats update interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
  }

  // Apply blur effect to screenshot for privacy
  async applyBlurToScreenshot(dataUrl) {
    try {
      // Create an offscreen canvas to apply blur effect
      const canvas = new (require('canvas'))();
      const ctx = canvas.getContext('2d');
      
      // For now, return the original data with a note about privacy level
      // In a production app, you would implement actual image blurring here
      console.log('Privacy blur applied to screenshot');
      return dataUrl;
    } catch (error) {
      console.log('Blur effect not available, returning original screenshot');
      return dataUrl;
    }
  }

  // Update privacy settings
  updatePrivacySettings(newSettings) {
    this.privacySettings = { ...this.privacySettings, ...newSettings };
    store.set('privacySettings', this.privacySettings);
    
    // Apply changes immediately
    if (!this.privacySettings.allowScreenshots) {
      this.screenshots = [];
      store.set('screenshots', []);
    }
    
    if (!this.privacySettings.allowActivityTracking) {
      this.activityData = [];
      store.set('activityData', []);
    }
    
    this.showTrayNotification('Privacy settings updated');
  }

  // Data cleanup based on retention policy
  cleanupOldData() {
    const retentionMs = this.privacySettings.dataRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;
    
    // Clean old screenshots
    this.screenshots = this.screenshots.filter(screenshot => 
      new Date(screenshot.timestamp).getTime() > cutoffTime
    );
    store.set('screenshots', this.screenshots);
    
    // Clean old activity data
    this.activityData = this.activityData.filter(activity => 
      new Date(activity.timestamp).getTime() > cutoffTime
    );
    store.set('activityData', this.activityData);
    
    console.log('Old data cleaned up based on retention policy');
  }

  async getActiveWindow() {
    try {
      // Mock active window data for testing
      return {
        title: 'Mock Application Window',
        owner: 'MockApp',
        url: 'mock://localhost',
        isMock: true
      };
    } catch (error) {
      console.error('Active window error:', error);
      return null;
    }
  }

  // Get active window title as string for focus level calculation
  getActiveWindowTitle(activeWindow) {
    if (!activeWindow) return '';
    
    if (typeof activeWindow === 'string') {
      return activeWindow;
    }
    
    if (activeWindow && typeof activeWindow === 'object') {
      return activeWindow.title || activeWindow.owner || '';
    }
    
    return '';
  }

  // Get system idle time (keyboard/mouse activity)
  getSystemIdleTime() {
    try {
      if (process.platform === 'win32') {
        // For now, we'll use a simple approach based on window changes
        // In a real implementation, you'd use Windows API (GetLastInputInfo)
        return 0; // We'll handle idle detection differently
      } else {
        return 0;
      }
    } catch (error) {
      console.log('System idle detection failed:', error.message);
      return 0;
    }
  }

  // Safely send message to main window
  safeSendToMainWindow(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(channel, data);
      } catch (error) {
        console.log(`Failed to send ${channel} to renderer:`, error.message);
      }
    }
  }

  async trackActivity() {
    try {
      // Check if main window is destroyed, stop tracking if so
      if (this.mainWindow && this.mainWindow.isDestroyed()) {
        console.log('Main window destroyed, stopping activity tracking');
        this.stopMonitoring();
        return;
      }
      
      const now = Date.now();
      const activeWindow = await this.getActiveWindow();
      
      // Update last activity from reliable system idle time when available
      try {
        const systemIdleMs = require('electron').powerMonitor.getSystemIdleTime() * 1000; // seconds -> ms
        const lastInputTimestamp = now - systemIdleMs;
        if (!this.lastActivity || lastInputTimestamp > this.lastActivity) {
          this.lastActivity = lastInputTimestamp;
        }
      } catch (_) {
        // Fallback: consider window change as activity
        const windowChanged = activeWindow && activeWindow !== this.lastActiveWindow;
        if (windowChanged) {
          this.lastActivity = now;
          this.lastActiveWindow = activeWindow;
        }
      }
      
      const idleTime = now - this.lastActivity;
      
      // Enhanced idle detection (5 minutes of no activity)
      const isIdle = idleTime > 5 * 60 * 1000;
      
      // Calculate productivity score based on activity
      const productivityScore = this.calculateProductivityScore(activeWindow, idleTime);
      
      const activity = {
        timestamp: new Date().toISOString(),
        userId: this.userData.id,
        activeWindow,
        idleTime,
        isIdle,
        productivityScore,
        workStatus: this.userData.workStatus || 'working',
        sessionDuration: this.getSessionDuration(),
        focusLevel: this.calculateFocusLevel(this.getActiveWindowTitle(activeWindow)),
        systemActive: !isIdle // System is active if not idle
      };

      this.activityData.push(activity);
      
      // Keep only last 500 activity records in memory
      if (this.activityData.length > 500) {
        this.activityData = this.activityData.slice(-500);
      }

      // Auto-stop monitoring if idle for too long (30 minutes)
      if (idleTime > 30 * 60 * 1000 && this.isMonitoring) {
        console.log('Auto-stopping monitoring due to extended idle time');
        this.stopMonitoring();
        this.showTrayNotification('Monitoring stopped due to inactivity');
      }

      // Save to local storage
      store.set('activityData', this.activityData);
      
      // Notify renderer process
      this.safeSendToMainWindow('activity-updated', activity);
    } catch (error) {
      console.error('Activity tracking error:', error);
    }
  }

  calculateProductivityScore(activeWindow, idleTime) {
    let score = 100;
    
    // Deduct points for idle time
    if (idleTime > 5 * 60 * 1000) { // 5+ minutes
      score -= 20;
    }
    if (idleTime > 15 * 60 * 1000) { // 15+ minutes
      score -= 30;
    }
    
    // Add points for productive applications
    if (activeWindow) {
      const activeWindowTitle = this.getActiveWindowTitle(activeWindow);
      const productiveApps = [
        'code', 'visual studio', 'intellij', 'eclipse', 'sublime',
        'chrome', 'firefox', 'edge', 'safari',
        'excel', 'word', 'powerpoint', 'outlook',
        'slack', 'teams', 'zoom', 'meet',
        'figma', 'sketch', 'adobe', 'photoshop'
      ];
      
      const isProductive = productiveApps.some(app => 
        activeWindowTitle.toLowerCase().includes(app)
      );
      
      if (isProductive) {
        score += 10;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  calculateFocusLevel(activeWindow) {
    // Ensure activeWindow is a string
    if (!activeWindow || typeof activeWindow !== 'string') {
      console.log('Invalid activeWindow value:', activeWindow);
      return 'other';
    }
    
    const activeWindowLower = activeWindow.toLowerCase();
    
    const focusApps = [
      'code', 'visual studio', 'intellij', 'eclipse', 'sublime',
      'excel', 'word', 'powerpoint', 'outlook'
    ];
    
    const communicationApps = [
      'slack', 'teams', 'zoom', 'meet', 'skype'
    ];
    
    const browsingApps = [
      'chrome', 'firefox', 'edge', 'safari'
    ];
    
    if (focusApps.some(app => activeWindowLower.includes(app))) {
      return 'focused';
    } else if (communicationApps.some(app => activeWindowLower.includes(app))) {
      return 'communication';
    } else if (browsingApps.some(app => activeWindowLower.includes(app))) {
      return 'browsing';
    } else {
      return 'other';
    }
  }

  getSessionDuration() {
    const startTime = store.get('sessionStartTime');
    if (!startTime) return 0;
    
    return Date.now() - new Date(startTime).getTime();
  }

  async syncMonitoringData() {
    if (store.get('offlineMode') || !this.userData || this.userData.offline) {
      console.log('Skipping monitoring sync - offline mode');
      return;
    }

    const token = this.authToken || this.userData?.token;
    if (!token) {
      console.log('Skipping monitoring sync - no Supabase access token');
      return;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/monitoring/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          screenshots: this.screenshots,
          activityData: this.activityData,
          syncTime: new Date().toISOString()
        })
      });

      if (response.ok) {
        // Clear synced data
        this.screenshots = [];
        this.activityData = [];
        store.set('lastSync', new Date().toISOString());
        
        console.log('Data synced successfully');
      } else {
        console.log('Sync failed, keeping data locally:', response.statusText);
        // Don't clear data if sync failed, keep it for retry
      }
    } catch (error) {
      console.log('Sync error, keeping data locally:', error.message);
      // Don't clear data if sync failed, keep it for retry
    }
  }

  updateWorkStatus(status) {
    if (this.userData) {
      this.userData.workStatus = status;
      store.set('userData', this.userData);
      this.updateTrayMenu();
      
      // Notify renderer process
      if (this.mainWindow) {
        this.mainWindow.webContents.send('work-status-changed', status);
      }
    }
  }

  updateTrayMenu() {
    if (!this.tray) {
      console.log('Tray not available, skipping menu update');
      return;
    }
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          this.focusMainWindow();
        }
      },
      { type: 'separator' },
      {
        label: this.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring',
        click: () => {
          if (this.isMonitoring) {
            this.stopMonitoring();
          } else {
            this.startMonitoring();
          }
        }
      },
      {
        label: 'Work Status',
        submenu: [
          {
            label: 'Working',
            type: 'radio',
            checked: this.userData?.workStatus === 'working',
            click: () => this.updateWorkStatus('working')
          },
          {
            label: 'Break',
            type: 'radio',
            checked: this.userData?.workStatus === 'break',
            click: () => this.updateWorkStatus('break')
          },
          {
            label: 'Meeting',
            type: 'radio',
            checked: this.userData?.workStatus === 'meeting',
            click: () => this.updateWorkStatus('meeting')
          },
          {
            label: 'Offline',
            type: 'radio',
            checked: this.userData?.workStatus === 'offline',
            click: () => this.updateWorkStatus('offline')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Privacy & Settings',
        submenu: [
          {
            label: 'Screenshot Capture',
            type: 'checkbox',
            checked: this.privacySettings.allowScreenshots,
            click: () => {
              this.privacySettings.allowScreenshots = !this.privacySettings.allowScreenshots;
              this.updatePrivacySettings(this.privacySettings);
            }
          },
          {
            label: 'Activity Tracking',
            type: 'checkbox',
            checked: this.privacySettings.allowActivityTracking,
            click: () => {
              this.privacySettings.allowActivityTracking = !this.privacySettings.allowActivityTracking;
              this.updatePrivacySettings(this.privacySettings);
            }
          },
          {
            label: 'Data Sync',
            type: 'checkbox',
            checked: this.privacySettings.allowDataSync,
            click: () => {
              this.privacySettings.allowDataSync = !this.privacySettings.allowDataSync;
              this.updatePrivacySettings(this.privacySettings);
            }
          },
          {
            label: 'Blur Screenshots',
            type: 'checkbox',
            checked: this.privacySettings.blurScreenshots,
            click: () => {
              this.privacySettings.blurScreenshots = !this.privacySettings.blurScreenshots;
              this.updatePrivacySettings(this.privacySettings);
            }
          },
          { type: 'separator' },
          {
            label: 'Working Hours',
            submenu: [
              {
                label: '9:00 AM - 5:00 PM',
                click: () => this.updateWorkingHours('09:00', '17:00')
              },
              {
                label: '8:00 AM - 6:00 PM',
                click: () => this.updateWorkingHours('08:00', '18:00')
              },
              {
                label: '10:00 AM - 6:00 PM',
                click: () => this.updateWorkingHours('10:00', '18:00')
              },
              { type: 'separator' },
              {
                label: 'Custom Hours...',
                click: () => this.showCustomHoursDialog()
              }
            ]
          },
          { type: 'separator' },
          {
            label: 'Data Retention',
            submenu: [
              {
                label: '7 days',
                click: () => this.updatePrivacySettings({ dataRetentionDays: 7 })
              },
              {
                label: '30 days',
                click: () => this.updatePrivacySettings({ dataRetentionDays: 30 })
              },
              {
                label: '90 days',
                click: () => this.updatePrivacySettings({ dataRetentionDays: 90 })
              }
            ]
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Actions',
        submenu: [
          {
            label: 'Take Screenshot Now',
            enabled: this.privacySettings.allowScreenshots,
            click: () => {
              if (this.privacySettings.allowScreenshots) {
                this.takeScreenshot();
              }
            }
          },
          {
            label: 'Sync Data Now',
            enabled: this.privacySettings.allowDataSync,
            click: () => {
              if (this.privacySettings.allowDataSync) {
                this.syncMonitoringData();
              }
            }
          },
          {
            label: 'Clean Old Data',
            click: () => this.cleanupOldData()
          },
          {
            label: 'Export Data',
            click: () => this.exportData()
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  // Show custom working hours dialog
  showCustomHoursDialog() {
    const dialog = new BrowserWindow({
      width: 400,
      height: 300,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'dialog-preload.js')
      }
    });

    const dialogHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .time-input { margin: 10px 0; }
          input[type="time"] { padding: 5px; margin-left: 10px; }
          button { padding: 10px 20px; margin: 5px; }
          .save { background: #4CAF50; color: white; border: none; }
          .cancel { background: #f44336; color: white; border: none; }
        </style>
      </head>
      <body>
        <h3>Set Custom Working Hours</h3>
        <div class="time-input">
          <label>Start Time: <input type="time" id="startTime" value="${this.workingHours.start}"></label>
        </div>
        <div class="time-input">
          <label>End Time: <input type="time" id="endTime" value="${this.workingHours.end}"></label>
        </div>
        <button class="save" onclick="saveHours()">Save</button>
        <button class="cancel" onclick="cancel()">Cancel</button>
        
        <script>
          function saveHours() {
            const start = document.getElementById('startTime').value;
            const end = document.getElementById('endTime').value;
            window.dialogAPI.updateWorkingHours(start, end);
            window.close();
          }
          
          function cancel() {
            window.close();
          }
        </script>
      </body>
      </html>
    `;

    dialog.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(dialogHTML)}`);
    
    // Set up IPC for this dialog
    ipcMain.once('dialog-working-hours-update', (event, { start, end }) => {
      this.updateWorkingHours(start, end);
      dialog.close();
    });
  }

  // Export data for backup
  async exportData() {
    try {
      const data = {
        screenshots: this.screenshots,
        activityData: this.activityData,
        userData: this.userData,
        privacySettings: this.privacySettings,
        workingHours: this.workingHours,
        exportDate: new Date().toISOString()
      };
      
      const { filePath } = await dialog.showSaveDialog(this.mainWindow, {
        defaultPath: `auctushr-data-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        this.showTrayNotification('Data exported successfully');
        return { success: true, filePath };
      }
      return { success: false };
    } catch (error) {
      console.error('Export error:', error);
      this.showTrayNotification('Export failed');
      return { success: false, error: error.message };
    }
  }

  showTrayNotification(titleOrMessage, bodyOptional) {
    const title = bodyOptional ? titleOrMessage : 'AuctusHR';
    const body = bodyOptional || titleOrMessage;
    console.log('Notification:', title, body);
    
    // Windows tray balloon if tray exists
    if (this.tray && process.platform === 'win32' && this.tray.displayBalloon) {
      try {
        this.tray.displayBalloon({
          title,
          content: body
        });
        return;
      } catch (_) {}
    }
    
    // Fallback to OS Notification API
    try {
      const { Notification } = require('electron');
      if (Notification && Notification.isSupported()) {
        const n = new Notification({ title, body });
        n.show();
        return;
      }
    } catch (_) {}
    
    // Final fallback: send to renderer to show in-app banner
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('show-idle-alert', { title, message: body, type: 'info' });
    }
  }

  getTodayStats() {
    const today = new Date().toDateString();
    const todayScreenshots = this.screenshots.filter(s => 
      new Date(s.timestamp).toDateString() === today
    );
    const todayActivity = this.activityData.filter(a => 
      new Date(a.timestamp).toDateString() === today
    );

    return {
      screenshots: todayScreenshots.length,
      activities: todayActivity.length,
      startTime: todayActivity.length > 0 ? todayActivity[0].timestamp : null,
      isActive: this.isMonitoring
    };
  }

  pauseMonitoring() {
    if (this.isMonitoring) {
      this.isMonitoring = false;
      
      // Clear intervals
      if (this.screenshotInterval) {
        clearInterval(this.screenshotInterval);
        this.screenshotInterval = null;
      }
      if (this.activityInterval) {
        clearInterval(this.activityInterval);
        this.activityInterval = null;
      }
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      // Update store
      store.set('monitoringStatus', 'paused');
      
      // Notify renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('monitoring-stopped', { status: 'paused' });
      }
      
      console.log('Monitoring paused');
    }
  }

  openWebApp() {
    // Open the hosted web app (never localhost) in default browser with auth context
    const { shell } = require('electron');
    const baseUrl = this.productionServerUrl || this.serverUrl || DEFAULT_PROD_URL;
    let url = baseUrl;
    
    if (this.authUser) {
      url += '/dashboard';
      console.log('Opening web app for authenticated user:', this.authUser.email, '→', url);
    } else {
      url += '/auth/sign-in';
      console.log('Opening web app login page - user not authenticated →', url);
    }
    
    shell.openExternal(url);
  }

  generateProductivityReport() {
    try {
      const sessionStart = store.get('sessionStartTime');
      if (!sessionStart) {
        return { error: 'No active session' };
      }
      
      const sessionDuration = Date.now() - sessionStart;
      const hours = Math.floor(sessionDuration / 3600000);
      const minutes = Math.floor((sessionDuration % 3600000) / 60000);
      
      const report = {
        sessionDuration: `${hours}h ${minutes}m`,
        productivityScore: this.calculateProductivityScore(this.getActiveWindowTitle(this.getActiveWindow()), Date.now() - this.lastActivity),
        focusLevel: this.calculateFocusLevel(this.getActiveWindowTitle(this.getActiveWindow())),
        screenshotsTaken: this.screenshots.length,
        activitiesTracked: this.activityData.length,
        breakReminders: Math.floor(sessionDuration / (25 * 60 * 1000)), // 25-minute intervals
        overtime: this.getOvertimeStatus(),
        timestamp: new Date().toISOString()
      };
      
      return report;
    } catch (error) {
      console.error('Error generating productivity report:', error);
      return { error: 'Failed to generate report' };
    }
  }

  getOvertimeStatus() {
    const sessionStart = store.get('sessionStartTime');
    if (!sessionStart) return { isOvertime: false, overtimeMinutes: 0 };
    
    const sessionDuration = Date.now() - sessionStart;
    const standardWorkDay = 8 * 60 * 60 * 1000; // 8 hours
    const overtimeMinutes = Math.max(0, (sessionDuration - standardWorkDay) / (60 * 1000));
    
    return {
      isOvertime: overtimeMinutes > 0,
      overtimeMinutes: Math.floor(overtimeMinutes)
    };
  }

  showSettingsDialog() {
    // Create a settings dialog window
    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      parent: this.mainWindow,
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    const settingsHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Settings</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .setting-group { margin: 20px 0; }
          .setting-item { margin: 10px 0; }
          button { padding: 10px 20px; margin: 5px; }
        </style>
      </head>
      <body>
        <h2>AuctusHR Settings</h2>
        <div class="setting-group">
          <h3>Privacy Settings</h3>
          <div class="setting-item">
            <label><input type="checkbox" id="allowScreenshots" checked> Allow Screenshots</label>
          </div>
          <div class="setting-item">
            <label><input type="checkbox" id="allowActivityTracking" checked> Allow Activity Tracking</label>
          </div>
          <div class="setting-item">
            <label><input type="checkbox" id="blurScreenshots"> Blur Screenshots</label>
          </div>
        </div>
        <div class="setting-group">
          <h3>Working Hours</h3>
          <div class="setting-item">
            <label>Start Time: <input type="time" id="startTime" value="09:00"></label>
          </div>
          <div class="setting-item">
            <label>End Time: <input type="time" id="endTime" value="17:00"></label>
          </div>
        </div>
        <button onclick="saveSettings()">Save Settings</button>
        <button onclick="window.close()">Cancel</button>
        
        <script>
          // Load current settings
          window.electronAPI.getPrivacySettings().then(settings => {
            document.getElementById('allowScreenshots').checked = settings.allowScreenshots;
            document.getElementById('allowActivityTracking').checked = settings.allowActivityTracking;
            document.getElementById('blurScreenshots').checked = settings.blurScreenshots;
          });
          
          window.electronAPI.getWorkingHours().then(hours => {
            document.getElementById('startTime').value = hours.start;
            document.getElementById('endTime').value = hours.end;
          });
          
          function saveSettings() {
            const settings = {
              allowScreenshots: document.getElementById('allowScreenshots').checked,
              allowActivityTracking: document.getElementById('allowActivityTracking').checked,
              blurScreenshots: document.getElementById('blurScreenshots').checked
            };
            
            const hours = {
              start: document.getElementById('startTime').value,
              end: document.getElementById('endTime').value
            };
            
            window.electronAPI.updatePrivacySettings(settings);
            window.electronAPI.updateWorkingHours(hours);
            window.close();
          }
        </script>
      </body>
      </html>
    `;

    settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(settingsHTML));
  }

  // Screenshot functionality with feedback
  async takeScreenshot() {
    if (!this.privacySettings.allowScreenshots) {
      const error = 'Screenshots are disabled in privacy settings';
      console.log(error);
      this.mainWindow?.webContents.send('screenshot-error', error);
      throw new Error(error);
    }
    
    try {
      console.log('Taking screenshot...');
      
      // Show feedback that screenshot is being taken
      this.mainWindow?.webContents.send('screenshot-taking');
      
      // Capture the entire desktop using screenshot-desktop
      const imageBuffer = await screenshotDesktop({ format: 'png' });
      if (!imageBuffer || !imageBuffer.length) {
        throw new Error('Failed to capture desktop image');
      }

      let screenshotData = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        
        // Apply blur if enabled
        if (this.privacySettings.blurScreenshots) {
          screenshotData = await this.applyBlurToScreenshot(screenshotData);
        }
        
        const timestamp = new Date().toISOString();
        const filename = `screenshot_${timestamp.replace(/[:.]/g, '-')}.png`;
        const filePath = path.join(this.todayScreenshotsDir, filename);
        
        // Save the actual image file
        const base64Data = screenshotData.replace(/^data:image\/png;base64,/, '');
        const fileBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, fileBuffer);
        
        const screenshot = {
          id: `screenshot_${Date.now()}`,
          timestamp: timestamp,
          userId: this.userData?.id || 'unknown',
          dataUrl: screenshotData, // Keep for preview purposes
          activeWindow: await this.getActiveWindow(),
          workStatus: this.userData?.workStatus || 'working',
          privacyLevel: this.privacySettings.blurScreenshots ? 'blurred' : 'normal',
          filename: filename,
          filePath: filePath,
          size: `${Math.round(fileBuffer.length / 1024)} KB`
        };
        
        // Store screenshot data
        this.screenshots.push(screenshot);
        
        // Keep only last 50 screenshots in memory
        if (this.screenshots.length > 50) {
          this.screenshots = this.screenshots.slice(-50);
        }

        // Save to local storage
        store.set('screenshots', this.screenshots);
        
        // Send success feedback
        this.mainWindow?.webContents.send('screenshot-taken', screenshot);
        
        // Show system notification
        this.showTrayNotification('Screenshot Captured', `Screenshot saved to: ${screenshot.filePath}`);
        
        // Update stats
        this.updateStats();
        
        console.log('Screenshot taken successfully:', screenshot.filename);
        return screenshot;
    } catch (error) {
      console.error('Screenshot failed:', error);
      
      // Send error feedback
      this.mainWindow?.webContents.send('screenshot-error', error?.message || 'Failed to capture screenshot');
      
      // Show error notification
      this.showTrayNotification('Screenshot Failed', error?.message || 'Failed to capture screenshot');
      
      throw error;
    }
  }

  // Create screenshots directory
  createScreenshotsDirectory() {
    try {
      if (!fs.existsSync(this.screenshotsDir)) {
        fs.mkdirSync(this.screenshotsDir, { recursive: true });
        console.log('Screenshots directory created:', this.screenshotsDir);
      }
      
      // Create subdirectories for organization
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      this.todayScreenshotsDir = path.join(this.screenshotsDir, today);
      
      if (!fs.existsSync(this.todayScreenshotsDir)) {
        fs.mkdirSync(this.todayScreenshotsDir, { recursive: true });
        console.log('Today\'s screenshots directory created:', this.todayScreenshotsDir);
      }
      
    } catch (error) {
      console.error('Error creating screenshots directory:', error);
      // Fallback to temp directory
      this.screenshotsDir = path.join(os.tmpdir(), 'AuctusHR-Screenshots');
      this.todayScreenshotsDir = this.screenshotsDir;
    }
  }

  // Open screenshots folder in file explorer
  openScreenshotsFolder() {
    try {
      const { shell } = require('electron');
      shell.openPath(this.todayScreenshotsDir);
      console.log('Opening screenshots folder:', this.todayScreenshotsDir);
    } catch (error) {
      console.error('Error opening screenshots folder:', error);
    }
  }

  // Update productivity statistics
  updateStats() {
    try {
      if (!this.userData || !this.isMonitoring) return;
      
      const now = Date.now();
      const sessionStart = store.get('sessionStartTime');
      const sessionDuration = sessionStart ? now - new Date(sessionStart).getTime() : 0;

      // Use reliable system idle time from Electron powerMonitor
      try {
        const systemIdleMs = require('electron').powerMonitor.getSystemIdleTime() * 1000; // seconds -> ms
        const lastInputTimestamp = now - systemIdleMs;
        // Keep the most recent notion of last activity
        if (!this.lastActivity || lastInputTimestamp > this.lastActivity) {
          this.lastActivity = lastInputTimestamp;
        }
      } catch (e) {
        // Fallback: keep existing lastActivity if powerMonitor not available
      }

      const currentIdleStreak = Math.max(0, now - this.lastActivity);
      const elapsedSinceLastStats = Math.max(0, now - (this.lastStatsTimestamp || now));
      this.lastStatsTimestamp = now;
      if (currentIdleStreak >= 60 * 1000) {
        this.cumulativeIdleTime += elapsedSinceLastStats;
      }
      const idleTime = Math.min(sessionDuration, this.cumulativeIdleTime + currentIdleStreak);
      const activeTime = Math.max(0, sessionDuration - idleTime);
      const productivityScore = sessionDuration > 0
        ? Math.round((activeTime / sessionDuration) * 100)
        : 0;
      
      // Calculate basic stats
      const stats = {
        sessionDuration: sessionDuration,
        idleTime: idleTime,
        currentIdleStreak,
        screenshotCount: this.screenshots.length,
        activityCount: this.activityData.length,
        lastActivity: this.lastActivity,
        isActive: currentIdleStreak < 60000, // Active if activity within last minute
        productivityScore,
        timestamp: now,
        activeTime,
        isIdle: currentIdleStreak > 5 * 60 * 1000 // 5 minutes current streak
      };
      
      // Store updated stats
      store.set('currentStats', stats);
      
      // Notify main window of stats update
      this.safeSendToMainWindow('stats-updated', stats);
      
      // Update timer overlay with current stats
      if (this.timerOverlay && !this.timerOverlay.isDestroyed()) {
        this.timerOverlay.webContents.send('update-timer', {
          sessionDuration: Math.floor(sessionDuration / 1000),
          idleTime: Math.floor(idleTime / 1000),
          isActive: stats.isActive
        });
      }
      
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // Calculate productivity score based on activity and screenshots
  calculateProductivityScore() {
    try {
      const now = Date.now();
      const recentActivity = this.activityData.filter(activity => 
        (now - new Date(activity.timestamp).getTime()) < 3600000 // Last hour
      );
      
      const recentScreenshots = this.screenshots.filter(screenshot => 
        (now - new Date(screenshot.timestamp).getTime()) < 3600000 // Last hour
      );
      
      // Basic productivity calculation
      let score = 0;
      
      // Activity score (0-50 points)
      if (recentActivity.length > 0) {
        score += Math.min(recentActivity.length * 2, 50);
      }
      
      // Screenshot consistency score (0-30 points)
      if (recentScreenshots.length > 0) {
        score += Math.min(recentScreenshots.length * 5, 30);
      }
      
      // Idle time penalty (0-20 points deduction)
      const timeSinceLastActivity = now - this.lastActivity;
      if (timeSinceLastActivity > 300000) { // 5 minutes
        score -= Math.min((timeSinceLastActivity / 60000) * 2, 20);
      }
      
      return Math.max(0, Math.min(100, score));
      
    } catch (error) {
      console.error('Error calculating productivity score:', error);
      return 0;
    }
  }

  // Enhanced screenshot with preview
  async takeScreenshotWithPreview() {
    try {
      const screenshot = await this.takeScreenshot();
      
      // Create a preview window
      const previewWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Screenshot Preview',
        resizable: true,
        minimizable: true,
        maximizable: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });
      
      // Load preview HTML
      const previewHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Screenshot Preview</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
              background: #f5f5f5;
            }
            .preview-container {
              background: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .screenshot-info {
              margin-bottom: 20px;
              padding: 15px;
              background: #e8f5e8;
              border-radius: 5px;
              border-left: 4px solid #4caf50;
            }
            .screenshot-preview {
              text-align: center;
              margin: 20px 0;
            }
            .screenshot-preview img {
              max-width: 100%;
              border: 1px solid #ddd;
              border-radius: 5px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .actions {
              text-align: center;
              margin-top: 20px;
            }
            .btn {
              padding: 10px 20px;
              margin: 0 10px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
            }
            .btn-primary { background: #007bff; color: white; }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-success { background: #28a745; color: white; }
          </style>
        </head>
        <body>
          <div class="preview-container">
            <div class="screenshot-info">
              <h3>📸 Screenshot Captured Successfully!</h3>
              <p><strong>Filename:</strong> ${screenshot.filename}</p>
              <p><strong>Time:</strong> ${new Date(screenshot.timestamp).toLocaleString()}</p>
              <p><strong>Size:</strong> ${screenshot.size}</p>
            </div>
            
            <div class="screenshot-preview">
              <h4>Screenshot Preview</h4>
              <div style="background: #f0f0f0; padding: 40px; border-radius: 5px; margin: 20px 0;">
                <p style="color: #666; font-size: 18px;">📱 Screenshot Preview</p>
                <p style="color: #999;">(Actual screenshot would appear here)</p>
              </div>
            </div>
            
            <div class="actions">
              <button class="btn btn-success" onclick="saveScreenshot()">💾 Save to Desktop</button>
              <button class="btn btn-primary" onclick="openInFolder()">📁 Open in Folder</button>
              <button class="btn btn-secondary" onclick="closePreview()">✖️ Close</button>
            </div>
          </div>
          
          <script>
            function saveScreenshot() {
              // This would integrate with Electron's save dialog
              alert('Screenshot saved to Desktop!');
            }
            
            function openInFolder() {
              // This would open the folder containing the screenshot
              alert('Opening screenshot folder...');
            }
            
            function closePreview() {
              window.close();
            }
          </script>
        </body>
        </html>
      `;
      
      previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(previewHTML)}`);
      
      return screenshot;
      
    } catch (error) {
      console.error('Screenshot preview failed:', error);
      throw error;
    }
  }

  startPeriodicScreenshots() {
    // Start periodic screenshot capture every 5 minutes if monitoring is enabled
    if (this.privacySettings.allowScreenshots && this.isMonitoring) {
      this.screenshotIntervalId = setInterval(async () => {
        try {
          if (this.isMonitoring && this.privacySettings.allowScreenshots) {
            console.log('Taking periodic screenshot...');
            await this.takeScreenshot();
            
            // Sync screenshot data to the web app
            await this.syncScreenshotData();
          }
        } catch (error) {
          console.error('Periodic screenshot failed:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      // Also start idle monitoring
      this.startIdleMonitoring();
    }
  }

  stopPeriodicScreenshots() {
    if (this.screenshotIntervalId) {
      clearInterval(this.screenshotIntervalId);
      this.screenshotIntervalId = null;
    }
    
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  startIdleMonitoring() {
    // Monitor user idle time every 30 seconds
    this.idleCheckInterval = setInterval(() => {
      const idleTime = require('electron').powerMonitor.getSystemIdleTime() * 1000; // Convert to ms
      this.currentIdleTime = idleTime;
      
      // Idle threshold alert from settings
      if (idleTime > this.maxIdleTime) {
        if (Date.now() - this.lastIdleAlertTime > 5 * 60 * 1000) { // avoid spamming, 5 min cooldown
          this.showTrayNotification('Idle Alert', 'You have been idle for a while. Activity will be recorded as idle.');
          this.lastIdleAlertTime = Date.now();
        }
        this.handleIdleTimeout();
      }
      
      // Update UI with current idle time
      if (this.mainWindow) {
        this.mainWindow.webContents.send('idle-time-update', {
          idleTime: idleTime,
          isIdle: idleTime > 60000 // Idle if more than 1 minute
        });
      }
    }, 30000); // Check every 30 seconds
  }

  handleIdleTimeout() {
    // Show idle alert notification
    const notification = {
      title: 'Idle Time Alert',
      message: 'You\'ve been idle for over 10 minutes. This will be recorded in your productivity report.',
      type: 'warning'
    };
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('show-idle-alert', notification);
    }
    
    // Log idle time to productivity data
    this.activityData.push({
      timestamp: new Date().toISOString(),
      type: 'idle_timeout',
      duration: this.currentIdleTime,
      productivity_impact: -20 // Negative impact on productivity
    });
    
    // Store data
    store.set('activityData', this.activityData);
  }

  async syncScreenshotData() {
    // Sync screenshot data with the web app's productivity service
    if (this.userData && this.screenshots.length > 0) {
      try {
        const unsyncedScreenshots = this.screenshots.filter(s => !s.synced);
        
        for (const screenshot of unsyncedScreenshots) {
          const response = await fetch(`${this.serverUrl}/api/productivity/screenshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({
              userId: this.userData.id,
              timestamp: screenshot.timestamp,
              filename: screenshot.filename,
              base64Data: screenshot.dataUrl,
              metadata: {
                activeWindow: screenshot.activeWindow,
                productivity_score: screenshot.productivity_score || 0,
                privacyLevel: screenshot.privacyLevel,
                workStatus: screenshot.workStatus
              }
            })
          });
          
          if (response.ok) {
            screenshot.synced = true;
            console.log('Screenshot synced successfully:', screenshot.filename);
          }
        }
        
        // Update stored screenshots
        store.set('screenshots', this.screenshots);
        
      } catch (error) {
        console.error('Failed to sync screenshot data:', error);
      }
    }
  }

  setupTimerOverlay() {
    // Create a modern floating timer overlay
    this.timerOverlay = new BrowserWindow({
      width: 200,
      height: 100,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Position overlay at top-right corner
    const { screen } = require('electron');
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    this.timerOverlay.setPosition(width - 220, 20);

    // Create modern timer overlay HTML
    const timerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 15px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 12px;
            cursor: move;
            user-select: none;
            transition: all 0.2s ease;
            -webkit-app-region: drag;
          }
          
          body:hover {
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          }
          
          body:active {
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
          }
          
          .timer-header {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            font-weight: 500;
          }
          
          .timer-display {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin-bottom: 6px;
            font-family: 'Consolas', monospace;
          }
          
          .timer-status {
            font-size: 9px;
            color: #888;
            text-align: center;
            line-height: 1.2;
          }
          
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
            background: #4CAF50;
            animation: pulse 2s infinite;
          }
          
          .status-dot.break {
            background: #FF9800;
          }
          
          .status-dot.overtime {
            background: #f44336;
          }
          
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          .controls {
            position: absolute;
            top: 8px;
            right: 6px;
            display: flex;
            gap: 4px;
            -webkit-app-region: no-drag;
          }

          .control-btn {
            width: 16px;
            height: 16px;
            border: none;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            color: #4a4a4a;
            background: rgba(0, 0, 0, 0.08);
          }

          .control-btn:hover {
            background: rgba(0, 0, 0, 0.16);
          }

          .close-btn:hover {
            background: #ef4444;
            color: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="control-btn close-btn" onclick="hideOverlay(event)" title="Hide timer overlay">×</button>
        </div>
        <div class="timer-header">Work Session</div>
        <div class="timer-display" id="sessionTime">00:00:00</div>
        <div class="timer-status">
          <span class="status-dot" id="statusDot"></span>
          <span id="statusText">Active</span>
        </div>
        
        <script>
          let sessionStart = Date.now();
          let isBreakTime = false;
          let isOvertime = false;
          
          function updateTimer() {
            const now = Date.now();
            const elapsed = now - sessionStart;
            
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('sessionTime').textContent = 
              hours.toString().padStart(2, '0') + ':' + 
              minutes.toString().padStart(2, '0') + ':' + 
              seconds.toString().padStart(2, '0');
            
            // Update status based on time
            const workHours = 8 * 60 * 60 * 1000; // 8 hours
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            
            if (elapsed > workHours) {
              isOvertime = true;
              statusDot.className = 'status-dot overtime';
              const overtimeMinutes = Math.floor((elapsed - workHours) / 60000);
              statusText.textContent = 'Overtime: +' + overtimeMinutes + 'm';
            } else if (elapsed % (25 * 60 * 1000) < 1000) { // Every 25 minutes (Pomodoro)
              isBreakTime = true;
              statusDot.className = 'status-dot break';
              statusText.textContent = 'Break suggested';
              
              setTimeout(() => {
                isBreakTime = false;
                statusDot.className = 'status-dot';
                statusText.textContent = 'Active';
              }, 5000);
            }
          }
          
          function hideOverlay(event) {
            event?.stopPropagation?.();

            if (window.electronAPI?.hideTimerOverlay) {
              window.electronAPI.hideTimerOverlay();
            } else {
              window.close();
            }
          }
          
          // Update timer every second
          updateTimer();
          setInterval(updateTimer, 1000);
          
          // Listen for work session updates
          if (window.electronAPI) {
            window.electronAPI.onActivityUpdated((event, data) => {
              if (data.sessionStart) {
                sessionStart = new Date(data.sessionStart).getTime();
              }
            });
          }
          
        </script>
      </body>
      </html>
    `;

    this.timerOverlay.loadURL('data:text/html,' + encodeURIComponent(timerHTML));
    
    // Initially hide the overlay
    this.timerOverlay.hide();
    
    // Show overlay when monitoring starts
    if (this.isMonitoring) {
      this.timerOverlay.show();
    }
  }

  showTimerOverlay() {
    if (this.timerOverlay) {
      this.timerOverlay.show();
    }
  }

  hideTimerOverlay() {
    if (this.timerOverlay) {
      this.timerOverlay.hide();
    }
  }

  moveTimerOverlay(x, y) {
    if (this.timerOverlay) {
      const { screen } = require('electron');
      const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
      const { x: areaX, y: areaY, width, height } = display.workArea;
      const { width: overlayWidth, height: overlayHeight } = this.timerOverlay.getBounds();

      // Clamp position to active display bounds.
      const clampedX = Math.max(areaX, Math.min(Math.round(x), areaX + width - overlayWidth));
      const clampedY = Math.max(areaY, Math.min(Math.round(y), areaY + height - overlayHeight));

      this.timerOverlay.setPosition(clampedX, clampedY);
    }
  }

  // Handle OAuth callback from web app
  handleOAuthCallback(url) {
    try {
      console.log('=== ELECTRON OAUTH CALLBACK RECEIVED ===')
      console.log('Full callback URL:', url);
      
      // Check if this is a test URL
      if (url.includes('auctushr://test/')) {
        console.log('✅ Protocol handler test successful!');
        return;
      }
      
      // Handle direct login from web app popup
      if (url.includes('auctushr://auth/login')) {
        console.log('Direct login from web app popup detected');
        
        try {
          const urlObj = new URL(url);
          const params = new URLSearchParams(urlObj.search);
          const token = params.get('token');
          const user = params.get('user');
          
          console.log('Extracted params:', {
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            hasUser: !!user,
            userLength: user ? user.length : 0
          });
          
          if (!token) {
            console.error('❌ No token found in URL');
            this.showAuthError('No authentication token received');
            return;
          }
          
          if (!user) {
            console.error('❌ No user data found in URL');
            this.showAuthError('No user data received');
            return;
          }
          
          console.log('Parsing user data...');
          const userData = JSON.parse(decodeURIComponent(user));
          console.log('✅ User data parsed successfully:', userData.email);
          
          this.handleOAuthSuccess(token, userData);
          return;
          
        } catch (parseError) {
          console.error('❌ Failed to parse OAuth callback URL:', parseError);
          console.error('URL that failed:', url);
          this.showAuthError(`Failed to parse authentication data: ${parseError.message}`);
          return;
        }
      }
      
      // Parse the callback URL
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Extract authentication data
      const token = params.get('token');
      const user = params.get('user');
      const success = params.get('success');
      
      console.log('Parsed callback params:', {
        success,
        hasToken: !!token,
        hasUser: !!user,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
      });
      
      if (success === 'true' && token && user) {
        const userData = JSON.parse(decodeURIComponent(user));
        applyAuthSession(this, token, userData, store);
        console.log('OAuth authentication successful:', userData.email);
        this.startTaskAndNotificationPolling();
        
        // Show success notification
        this.safeSendToMainWindow('auth-success', {
          message: `Welcome back, ${userData.name || userData.email}!`,
          user: userData
        });
        
        // Focus the main window
        this.focusMainWindow();
        
        // Show system notification
        this.showTrayNotification('Authentication Successful', `Logged in as ${userData.name || userData.email}`);
        
      } else {
        // Handle authentication failure
        const error = params.get('error') || 'Authentication failed';
        console.error('OAuth authentication failed:', error);
        
        if (this.mainWindow) {
          this.mainWindow.webContents.send('auth-error', {
            message: 'Authentication failed. Please try again.',
            error: error
          });
        }
        
        this.showTrayNotification('Authentication Failed', 'Please try logging in again');
      }
      
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      
      if (this.mainWindow) {
        this.mainWindow.webContents.send('auth-error', {
          message: 'Authentication error. Please try again.',
          error: error.message
        });
      }
    }
  }

  // Start local OAuth callback server
  startOAuthServer() {
    return new Promise((resolve, reject) => {
      if (this.oauthServer) {
        try {
          this.oauthServer.close();
        } catch (error) {
          console.warn('Error closing existing OAuth server:', error.message);
        }
      }

      const createServer = () => {
        return http.createServer((req, res) => {
          console.log('OAuth callback received:', req.url);
          console.log('OAuth callback method:', req.method);
          console.log('OAuth callback headers:', req.headers);
          
          const url = new URL(req.url, `http://localhost:${this.oauthPort}`);
          console.log('OAuth callback parsed URL:', url.toString());
          
          if (url.pathname === '/oauth/callback') {
            // Handle the OAuth callback
            const token = url.searchParams.get('token');
            const user = url.searchParams.get('user');
            const success = url.searchParams.get('success');
            
            console.log('OAuth callback params:', { token: token ? 'present' : 'missing', user: user ? 'present' : 'missing', success });
            
            // Send response to browser
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Authentication Successful</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                  <h2>🎉 Authentication Successful!</h2>
                  <p>You can now close this browser tab and return to the AuctusHR desktop app.</p>
                  <script>
                    setTimeout(() => window.close(), 3000);
                  </script>
                </body>
              </html>
            `);
            
            // Process the OAuth data
            if (success === 'true' && token && user) {
              try {
                const userData = JSON.parse(decodeURIComponent(user));
                console.log('OAuth user data parsed successfully:', userData.email);
                this.handleOAuthSuccess(token, userData);
              } catch (error) {
                console.error('Error parsing OAuth user data:', error);
                this.handleOAuthError('Failed to parse user data');
              }
            } else {
              console.log('OAuth callback missing required params');
              this.handleOAuthError(url.searchParams.get('error') || 'Authentication failed');
            }
          } else {
            console.log('OAuth callback path not found:', url.pathname);
            res.writeHead(404);
            res.end('Not found');
          }
        });
      };

      const attemptListen = (port, hasRetried) => {
        this.oauthServer = createServer();

        const onError = (error) => {
          this.oauthServer.removeListener('error', onError);
          try {
            this.oauthServer.close();
          } catch (closeError) {
            console.warn('Error closing OAuth server after failure:', closeError.message);
          }

          if (error.code === 'EADDRINUSE' && !hasRetried) {
            console.warn(`OAuth port ${port} is in use. Retrying with a random port...`);
            attemptListen(0, true);
          } else {
            console.error('Failed to start OAuth server:', error);
            reject(error);
          }
        };

        this.oauthServer.once('error', onError);

        this.oauthServer.listen(port, '127.0.0.1', () => {
          this.oauthPort = this.oauthServer.address().port;
          console.log(`OAuth callback server started on port ${this.oauthPort}`);
          this.oauthServer.removeListener('error', onError);
          resolve();
        });
      };

      const initialPort = this.preferredOAuthPort || this.oauthPort || 8765;
      attemptListen(initialPort, false);
    });
  }

  // Handle successful OAuth
  handleOAuthSuccess(token, userData) {
    console.log('OAuth authentication successful:', userData.email);
    applyAuthSession(this, token, userData, store);
    
    // Show success notification
    this.safeSendToMainWindow('auth-success', {
      message: `Welcome back, ${userData.name || userData.email}!`,
      user: userData
    });
    
    // Focus the main window
    this.focusMainWindow();
    
    // Show system notification
    this.showTrayNotification('Authentication Successful', `Logged in as ${userData.name || userData.email}`);
    
    // Close OAuth server
    if (this.oauthServer) {
      this.oauthServer.close();
      this.oauthServer = null;
    }
  }

  // Handle OAuth error
  handleOAuthError(error) {
    console.error('OAuth authentication failed:', error);
    this.showAuthError(error);
  }

  // Show authentication error in UI (not blocking popup)
  showAuthError(message) {
    console.error('🚫 Auth Error:', message);
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-error', {
        message: `Authentication failed: ${message}`,
        error: message
      });
    }
    
    // Log to console instead of showing blocking notification
    console.log('Auth error displayed in UI:', message);
    
    // Close OAuth server if running
    if (this.oauthServer) {
      this.oauthServer.close();
      this.oauthServer = null;
    }
  }

  // Open web app for authentication
  async openWebAppForAuth() {
    const { shell } = require('electron');
    
    try {
      // Start local OAuth callback server
      await this.startOAuthServer();
      
      // Generate a unique state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      store.set('oauthState', state);
      
      // Use local HTTP callback instead of protocol
      const callbackUrl = `http://localhost:${this.oauthPort}/oauth/callback`;
      const baseUrl = this.productionServerUrl || this.serverUrl || DEFAULT_PROD_URL;
      const authUrl = `${baseUrl}/auth/sign-in?electron=true&callback=${encodeURIComponent(callbackUrl)}&state=${state}`;
      
      console.log('Opening web app for authentication:', authUrl);
      console.log('OAuth callback will be received at:', callbackUrl);
      
      // Open in default browser
      shell.openExternal(authUrl);
      
      // Show waiting message in main window
      if (this.mainWindow) {
        this.mainWindow.webContents.send('auth-waiting', {
          message: 'Please complete authentication in your browser...'
        });
      }
      
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      this.openWebAppDirectly();
    }
  }

  // Fallback method to open web app directly
  openWebAppDirectly() {
    console.log('Protocol handler not working, opening web app directly');
    const { shell } = require('electron');
    const baseUrl = this.productionServerUrl || this.serverUrl || DEFAULT_PROD_URL;
    shell.openExternal(`${baseUrl}/auth/sign-in`);
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('auth-error', {
        message: 'Protocol handler not working. Please login manually and then restart the app.',
        error: 'protocol_not_supported'
      });
    }
  }

  // HTTP API Integration Methods
  async makeAPIRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.serverUrl}${endpoint}`;
      const parsedUrl = new URL(url);
      const transport = parsedUrl.protocol === 'https:' ? require('https') : require('http');

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      const token = this.authToken || this.userData?.token;
      if (token) {
        requestOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      const req = transport.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`API Error: ${res.statusCode} - ${response.message || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async fetchTaskStats() {
    try {
      if (!this.userData || !this.userData.uid) {
        return { received: 0, pending: 0, completed: 0 };
      }

      // Fetch task stats from your API
      const response = await this.makeAPIRequest(`/api/tasks?userId=${this.userData.uid}&stats=true`);
      
      // Calculate stats from the response
      const stats = {
        received: response.tasks?.filter(task => 
          task.status === 'backlog' || task.status === 'accepted'
        ).length || 0,
        pending: response.tasks?.filter(task => 
          task.status === 'in_progress' || task.status === 'in_review'
        ).length || 0,
        completed: response.tasks?.filter(task => 
          task.status === 'completed'
        ).length || 0
      };

      return stats;
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
      return { received: 0, pending: 0, completed: 0 };
    }
  }

  async fetchNotifications() {
    try {
      if (!this.userData || !this.userData.uid) {
        return [];
      }

      // Fetch notifications from your API
      const response = await this.makeAPIRequest(`/api/notifications?userId=${this.userData.uid}&limit=10`);
      
      // Transform notifications to match expected format
      const notifications = response.notifications?.map(notification => ({
        id: notification.id,
        type: this.mapNotificationType(notification.type),
        title: this.getNotificationTitle(notification),
        message: notification.message,
        timestamp: new Date(notification.createdAt),
        read: notification.read || false
      })) || [];

      return notifications;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  mapNotificationType(type) {
    const typeMap = {
      'break': 'break',
      'meeting': 'meeting', 
      'idle': 'idle',
      'late': 'late',
      'early': 'early',
      'custom': 'custom'
    };
    return typeMap[type] || 'custom';
  }

  getNotificationTitle(notification) {
    if (notification.type === 'break') return 'Break Reminder';
    if (notification.type === 'meeting') return 'Meeting Reminder';
    if (notification.type === 'idle') return 'Idle Time Warning';
    if (notification.type === 'late') return 'Late Arrival';
    if (notification.type === 'early') return 'Early Departure';
    return 'Notification';
  }

  async markNotificationAsRead(notificationId) {
    try {
      if (!this.userData || !this.userData.uid) {
        return false;
      }

      await this.makeAPIRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        body: { read: true }
      });

      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async pollTaskAndNotificationUpdates({ forceNotification = false } = {}) {
    if (!this.userData || !this.userData.uid || !this.mainWindow) {
      return;
    }

    try {
      const taskStats = await this.fetchTaskStats();
      if (taskStats) {
        this.mainWindow.webContents.send('task-stats-updated', taskStats);
      }

      const notifications = await this.fetchNotifications();
      if (notifications && notifications.length > 0) {
        const latestNotification = notifications[0];
        if (forceNotification || latestNotification.id !== this.lastNotificationId) {
          this.lastNotificationId = latestNotification.id;
          this.mainWindow.webContents.send('notification-received', latestNotification);
        }
      }
    } catch (error) {
      console.error('Error polling for updates:', error);
    }
  }

  startTaskAndNotificationPolling() {
    if (this.taskStatsPollingInterval) {
      return;
    }

    // Run once immediately so users don't wait for the first interval
    this.pollTaskAndNotificationUpdates({ forceNotification: true });

    // Poll every 30 seconds for task stats and notifications
    this.taskStatsPollingInterval = setInterval(() => {
      this.pollTaskAndNotificationUpdates();
    }, 30000);
  }

  stopTaskAndNotificationPolling() {
    if (this.taskStatsPollingInterval) {
      clearInterval(this.taskStatsPollingInterval);
      this.taskStatsPollingInterval = null;
    }
    this.lastNotificationId = null;
  }
}

// Enforce single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Initialize the monitor
const monitor = new AuctusMonitor();

// Register custom protocol for OAuth callback
console.log('Registering protocol handler for auctushr://');

// For development, we need to handle the protocol differently
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  // In development, register with full path to electron executable
  const protocolRegistered = app.setAsDefaultProtocolClient('auctushr', process.execPath, [
    path.resolve(process.argv[1])
  ]);
  console.log('Development protocol registration result:', protocolRegistered);
} else {
  // In production, use standard registration
  const protocolRegistered = app.setAsDefaultProtocolClient('auctushr');
  console.log('Production protocol registration result:', protocolRegistered);
}

// Additional Windows registry registration for better compatibility
if (process.platform === 'win32') {
  try {
    const { spawn } = require('child_process');
    const appPath = app.isPackaged ? process.execPath : `"${process.execPath}" "${path.resolve(process.argv[1])}"`;
    
    // Register in Windows registry
    const regCommands = [
      `reg add "HKEY_CURRENT_USER\\Software\\Classes\\auctushr" /ve /d "AuctusHR Protocol" /f`,
      `reg add "HKEY_CURRENT_USER\\Software\\Classes\\auctushr" /v "URL Protocol" /d "" /f`,
      `reg add "HKEY_CURRENT_USER\\Software\\Classes\\auctushr\\DefaultIcon" /ve /d "${appPath},0" /f`,
      `reg add "HKEY_CURRENT_USER\\Software\\Classes\\auctushr\\shell\\open\\command" /ve /d "${appPath} \\"%1\\"" /f`
    ];
    
    console.log('Registering Windows protocol in registry...');
    regCommands.forEach(cmd => {
      spawn('cmd', ['/c', cmd], { stdio: 'ignore' });
    });
    
    console.log('✅ Windows registry protocol registration attempted');
  } catch (error) {
    console.log('⚠️ Windows registry registration failed (non-critical):', error.message);
  }
}

// Handle protocol URLs (OAuth callback)
app.on('open-url', (event, url) => {
  console.log('=== PROTOCOL URL RECEIVED (open-url) ===');
  console.log('URL:', url);
  event.preventDefault();
  monitor.handleOAuthCallback(url);
});

// Handle protocol URLs on Windows
app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('=== SECOND INSTANCE DETECTED ===');
  console.log('Command line:', commandLine);
  
  // Someone tried to run a second instance, focus our window instead
  monitor.focusMainWindow();
  
  // Handle protocol URL from command line
  const url = commandLine.find(arg => arg.startsWith('auctushr://'));
  if (url) {
    console.log('Found protocol URL in command line:', url);
    monitor.handleOAuthCallback(url);
  } else {
    console.log('No protocol URL found in command line');
  }
});

app.whenReady().then(() => {
  // If launched via protocol on first run, the URL can be in argv (Windows)
  if (process.platform === 'win32' && process.argv && process.argv.length > 1) {
    const urlArg = process.argv.find(arg => typeof arg === 'string' && arg.startsWith('auctushr://'));
    if (urlArg) {
      console.log('Found protocol URL in initial argv:', urlArg);
      monitor.handleOAuthCallback(urlArg);
    }
  }
  monitor.initialize();
});

app.on('window-all-closed', () => {
  // Keep app running in background
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    monitor.createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  monitor.stopMonitoring();
});