# Implementation Guide: Electron Shell for Your Web App

## Current Situation

Looking at your code, you're currently:
- Loading `modern-ui.html` (custom HTML file)
- Not loading your Next.js web app
- Electron capabilities exist but not integrated

## Goal: Electron Shell Pattern

**Electron Shell** → **Loads Your Web App** → **Exposes Native Capabilities**

---

## Step-by-Step Implementation

### Step 1: Update `electron/main.js` - Load Web App

**Find this line** (around line 1709):
```javascript
this.mainWindow.loadFile(path.join(__dirname, 'modern-ui.html'));
```

**Replace with**:

```javascript
async createWindow() {
  const isDev = !app.isPackaged;
  
  // Determine URL to load
  const devServerUrl = 'http://localhost:3000';
  const webAppUrl = isDev 
    ? devServerUrl  // Dev: Next.js dev server
    : this.productionServerUrl || DEFAULT_PROD_URL;  // Prod: Your hosted app

  this.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
      height: 40
    },
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    icon: path.join(__dirname, '../public/globe.svg')
  });

  // Smooth fade-in
  this.mainWindow.once('ready-to-show', () => {
    this.mainWindow.setOpacity(0);
    this.mainWindow.show();
    
    // Fade in animation
    const fadeIn = setInterval(() => {
      const opacity = this.mainWindow.getOpacity();
      if (opacity >= 1) {
        clearInterval(fadeIn);
      } else {
        this.mainWindow.setOpacity(Math.min(opacity + 0.1, 1));
      }
    }, 16);
  });

  // Load your web app
  try {
    if (isDev) {
      // Development: Load from Next.js dev server
      console.log('Loading web app from:', devServerUrl);
      await this.mainWindow.loadURL(devServerUrl);
      
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      // Production: Load from your hosted app
      console.log('Loading web app from:', webAppUrl);
      await this.mainWindow.loadURL(webAppUrl);
    }
  } catch (error) {
    console.error('Failed to load web app:', error);
    // Fallback: Show error page
    this.mainWindow.loadURL(`data:text/html,<h1>Failed to load app</h1><p>${error.message}</p>`);
  }

  // Handle external links - open in browser
  const { shell } = require('electron');
  
  this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external sites
  this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (isDev) {
      // In dev, allow localhost navigation
      if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } else {
      // In prod, only allow your domain
      const allowedHosts = ['auctushr.com', 'www.auctushr.com']; // Add your domains
      if (!allowedHosts.includes(parsedUrl.hostname)) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    }
  });

  this.mainWindow.on('closed', () => {
    this.mainWindow = null;
  });
}
```

---

### Step 2: Enhance `electron/preload.js` - Add Window Controls

**Add to your existing `preload.js`**:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Enhanced Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  isElectron: true,
  platform: process.platform,
  
  // Window controls (NEW)
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // System theme (NEW)
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  },
  
  // Your existing APIs (keep all of these)
  startMonitoring: () => ipcRenderer.send('start-monitoring'),
  stopMonitoring: () => ipcRenderer.send('stop-monitoring'),
  pauseMonitoring: () => ipcRenderer.send('pause-monitoring'),
  getCurrentSessionStats: () => ipcRenderer.invoke('get-current-session-stats'),
  getPrivacySettings: () => ipcRenderer.invoke('get-privacy-settings'),
  getWorkingHours: () => ipcRenderer.invoke('get-working-hours'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  getProductivityData: () => ipcRenderer.invoke('get-productivity-data'),
  updatePrivacySettings: (settings) => ipcRenderer.send('update-privacy-settings', settings),
  updateWorkingHours: (hours) => ipcRenderer.send('update-working-hours', hours),
  takeScreenshotNow: () => ipcRenderer.invoke('takeScreenshotNow'),
  syncDataNow: () => ipcRenderer.send('sync-data-now'),
  cleanupOldData: () => ipcRenderer.send('cleanup-old-data'),
  exportData: () => ipcRenderer.send('export-data'),
  openScreenshotsFolder: () => ipcRenderer.send('open-screenshots-folder'),
  openWebApp: () => ipcRenderer.send('open-web-app'),
  openWebAppForAuth: () => ipcRenderer.send('open-web-app-for-auth'),
  getTaskStats: () => ipcRenderer.invoke('get-task-stats'),
  getNotifications: () => ipcRenderer.invoke('get-notifications'),
  markNotificationAsRead: (notificationId) => ipcRenderer.send('mark-notification-read', notificationId),
  clearAllNotifications: () => ipcRenderer.send('clear-all-notifications'),
  showTimerOverlay: () => ipcRenderer.send('show-timer-overlay'),
  hideTimerOverlay: () => ipcRenderer.send('hide-timer-overlay'),
  moveTimerOverlay: (x, y) => ipcRenderer.send('move-timer-overlay', { x, y }),
  
  // Your existing event listeners (keep all of these)
  onMonitoringStarted: (callback) => ipcRenderer.on('monitoring-started', callback),
  onMonitoringStopped: (callback) => ipcRenderer.on('monitoring-stopped', callback),
  onMonitoringStatusChanged: (callback) => ipcRenderer.on('monitoring-status-changed', callback),
  onActivityUpdated: (callback) => ipcRenderer.on('activity-updated', callback),
  onScreenshotTaken: (callback) => ipcRenderer.on('screenshot-taken', callback),
  onStatsUpdated: (callback) => ipcRenderer.on('stats-updated', callback),
  onPrivacySettingsUpdated: (callback) => ipcRenderer.on('privacy-settings-updated', callback),
  onWorkingHoursUpdated: (callback) => ipcRenderer.on('working-hours-updated', callback),
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', callback),
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', callback),
  onAuthError: (callback) => ipcRenderer.on('auth-error', callback),
  onAuthWaiting: (callback) => ipcRenderer.on('auth-waiting', callback),
  onIdleTimeUpdate: (callback) => ipcRenderer.on('idle-time-update', callback),
  onShowIdleAlert: (callback) => ipcRenderer.on('show-idle-alert', callback),
  onTaskStatsUpdated: (callback) => ipcRenderer.on('task-stats-updated', callback),
  onNotificationReceived: (callback) => ipcRenderer.on('notification-received', callback),
  onNotificationsCleared: (callback) => ipcRenderer.on('notifications-cleared', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Keep your existing monitorAPI
contextBridge.exposeInMainWorld('monitorAPI', {
  getProductivityData: () => ipcRenderer.invoke('getProductivityData'),
  getBreakReminder: () => ipcRenderer.invoke('getBreakReminder'),
  getOvertimeStatus: () => ipcRenderer.invoke('getOvertimeStatus'),
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  updateUserPreferences: (prefs) => ipcRenderer.send('update-user-preferences', prefs),
  showNotification: (message, type = 'info') => ipcRenderer.send('show-notification', { message, type }),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  openSettings: () => ipcRenderer.send('open-settings'),
  exportSessionData: () => ipcRenderer.invoke('export-session-data'),
  exportProductivityReport: () => ipcRenderer.invoke('export-productivity-report')
});
```

---

### Step 3: Add IPC Handlers in `electron/main.js`

**Add these IPC handlers** (in your `setupIPC` method or create new method):

```javascript
setupIPC() {
  // ... your existing IPC handlers
  
  // Window controls (NEW)
  ipcMain.on('window-minimize', () => {
    if (this.mainWindow) {
      this.mainWindow.minimize();
    }
  });

  ipcMain.on('window-maximize', () => {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  });

  ipcMain.handle('window-is-maximized', () => {
    return this.mainWindow ? this.mainWindow.isMaximized() : false;
  });

  // System theme (NEW)
  const { nativeTheme } = require('electron');
  
  ipcMain.handle('get-system-theme', () => {
    return nativeTheme.shouldUseDarkColors;
  });

  nativeTheme.on('updated', () => {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    }
  });
}
```

---

### Step 4: Create Optional Electron Helper (Web App)

**Create**: `lib/electron-bridge.ts`

```typescript
// lib/electron-bridge.ts
// Optional helper - your web app works without this!

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;
  
  // Window controls
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
  
  // System
  getSystemTheme?: () => Promise<boolean>;
  onThemeChanged?: (callback: (isDark: boolean) => void) => void;
  
  // Your app APIs (add as needed)
  startMonitoring?: () => void;
  stopMonitoring?: () => void;
  getCurrentSessionStats?: () => Promise<any>;
  takeScreenshotNow?: () => Promise<any>;
  // ... add other APIs as needed
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    monitorAPI?: any;
  }
}

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

/**
 * Get Electron API (or null if not in Electron)
 */
export function useElectron(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}

/**
 * React hook for Electron features
 */
export function useElectronFeatures() {
  const [isElectronEnv, setIsElectronEnv] = React.useState(false);
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectronEnv(true);
      
      // Check if maximized
      window.electronAPI.isMaximized?.().then(setIsMaximized);
      
      // Get system theme
      window.electronAPI.getSystemTheme?.().then((isDark) => {
        setSystemTheme(isDark ? 'dark' : 'light');
      });
      
      // Listen for theme changes
      window.electronAPI.onThemeChanged?.((isDark) => {
        setSystemTheme(isDark ? 'dark' : 'light');
      });
    }
  }, []);

  return {
    isElectron: isElectronEnv,
    isMaximized,
    systemTheme,
    electronAPI: window.electronAPI || null,
  };
}
```

---

### Step 5: Update Build Scripts

**Update `package.json`**:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "electron": "electron .",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "cross-env BUILD_TARGET=electron npm run build && electron-builder",
    "electron:dist": "cross-env BUILD_TARGET=electron npm run build && electron-builder --publish=never"
  }
}
```

---

## Testing

### Development:
```bash
# Terminal 1
npm run dev

# Terminal 2 (wait for localhost:3000)
npm run electron:dev
```

**Expected**: Electron window opens and loads your Next.js app from `localhost:3000`

### Production:
```bash
npm run electron:build
```

**Expected**: Electron app loads your production web app URL

---

## What This Achieves

✅ **Electron Shell** loads your web app  
✅ **No web code changes** required  
✅ **Native capabilities** exposed via `window.electronAPI`  
✅ **Works in browser** (web app unchanged)  
✅ **Works in Electron** (with native features)  
✅ **Single codebase**  

---

## Optional: Add Custom Title Bar Component

Since you have `titleBarStyle: 'hidden'`, you can add a custom title bar:

**Create**: `components/electron/title-bar.tsx`

```tsx
'use client';

export function ElectronTitleBar() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return null;
  }

  return (
    <div 
      className="h-10 bg-[#1a1a1a] flex items-center justify-between px-4 select-none"
      style={{ WebkitAppRegion: 'drag' as any }}
    >
      <div className="text-white text-sm font-medium">AuctusHR</div>
      <div 
        className="flex gap-1"
        style={{ WebkitAppRegion: 'no-drag' as any }}
      >
        <button
          onClick={() => window.electronAPI?.minimize?.()}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded"
        >
          <span className="text-white">−</span>
        </button>
        <button
          onClick={() => window.electronAPI?.maximize?.()}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded"
        >
          <span className="text-white">□</span>
        </button>
        <button
          onClick={() => window.electronAPI?.close?.()}
          className="w-10 h-10 flex items-center justify-center hover:bg-red-500/20 rounded"
        >
          <span className="text-white">×</span>
        </button>
      </div>
    </div>
  );
}
```

**Add to your layout** (optional):
```tsx
// app/layout.tsx
import { ElectronTitleBar } from '@/components/electron/title-bar';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ElectronTitleBar />
        {children}
      </body>
    </html>
  );
}
```

---

## Summary

**Your idea is perfect!** This is exactly how Electron should be used:

1. ✅ Electron shell loads web app
2. ✅ Native capabilities exposed via preload
3. ✅ Web code unchanged
4. ✅ Works in both browser and Electron

**Next Steps**:
1. Update `electron/main.js` to load web app
2. Enhance `preload.js` with window controls
3. Add IPC handlers
4. Test!

Would you like me to implement these changes in your codebase?

