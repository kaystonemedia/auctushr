# Practical Electron UI Improvements for Your App

## Quick Wins - What You Can Do Right Now

Based on your current code, here are **immediate improvements** you can make:

---

## 1. **Add Custom Title Bar** (5 minutes)

You have `titleBarStyle: 'hidden'` but no custom controls. Add this:

**Create**: `components/electron/title-bar.tsx`
```tsx
'use client';

export function ElectronTitleBar() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return null; // Web version, no title bar needed
  }

  return (
    <div 
      className="h-10 bg-sidebar flex items-center justify-between px-4 select-none"
      style={{ 
        WebkitAppRegion: 'drag' as any,
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <div className="text-sidebar-foreground text-sm font-medium">
        AuctusHR
      </div>
      <div 
        className="flex gap-1"
        style={{ WebkitAppRegion: 'no-drag' as any }}
      >
        <button
          onClick={() => window.electronAPI?.minimize()}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
        >
          <span className="text-sidebar-foreground">−</span>
        </button>
        <button
          onClick={() => window.electronAPI?.maximize()}
          className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
        >
          <span className="text-sidebar-foreground">□</span>
        </button>
        <button
          onClick={() => window.electronAPI?.close()}
          className="w-10 h-10 flex items-center justify-center hover:bg-red-500/20 rounded transition-colors"
        >
          <span className="text-sidebar-foreground">×</span>
        </button>
      </div>
    </div>
  );
}
```

**Add to your layout**:
```tsx
// app/layout.tsx
import { ElectronTitleBar } from '@/components/electron/title-bar';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ElectronTitleBar />
        {/* rest of your app */}
      </body>
    </html>
  );
}
```

**Update preload.js**:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing code
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});
```

**Update main.js**:
```javascript
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});
```

---

## 2. **System Theme Detection** (10 minutes)

**Update preload.js**:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing code
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  },
});
```

**Update main.js**:
```javascript
const { nativeTheme } = require('electron');

ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors;
});

nativeTheme.on('updated', () => {
  if (this.mainWindow && !this.mainWindow.isDestroyed()) {
    this.mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  }
});
```

**Create hook**: `hooks/use-system-theme.ts`
```tsx
import { useEffect, useState } from 'react';

export function useSystemTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Get initial theme
      window.electronAPI.getSystemTheme().then(setIsDark);
      
      // Listen for changes
      window.electronAPI.onThemeChanged(setIsDark);
    }
  }, []);

  return isDark;
}
```

**Use in your app**:
```tsx
import { useSystemTheme } from '@/hooks/use-system-theme';

function MyComponent() {
  const isDark = useSystemTheme();
  // Use isDark to set theme
}
```

---

## 3. **Window State Persistence** (15 minutes)

**Install**: `npm install electron-window-state`

**Update main.js**:
```javascript
const windowStateKeeper = require('electron-window-state');

async createWindow() {
  // Load window state
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  this.mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    // ... rest of config
  });

  // Let windowState manage the window
  mainWindowState.manage(this.mainWindow);
  
  // ... rest of window setup
}
```

---

## 4. **Smooth Window Animations** (5 minutes)

**Update main.js**:
```javascript
async createWindow() {
  // ... window config
  show: false,  // Don't show until ready
  
  this.mainWindow.once('ready-to-show', () => {
    // Fade in animation
    this.mainWindow.setOpacity(0);
    this.mainWindow.show();
    
    // Smooth fade in
    let opacity = 0;
    const fadeInterval = setInterval(() => {
      opacity += 0.1;
      if (opacity >= 1) {
        opacity = 1;
        clearInterval(fadeInterval);
      }
      this.mainWindow.setOpacity(opacity);
    }, 16); // ~60fps
  });
}
```

---

## 5. **Native Context Menus** (10 minutes)

**Update preload.js**:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing code
  showContextMenu: (menuItems) => ipcRenderer.invoke('show-context-menu', menuItems),
});
```

**Update main.js**:
```javascript
const { Menu } = require('electron');

ipcMain.handle('show-context-menu', (event, menuItems) => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate(menuItems.map(item => ({
      label: item.label,
      click: () => resolve(item.id),
      type: item.type || 'normal',
    })));
    
    menu.popup({
      window: BrowserWindow.fromWebContents(event.sender),
      callback: () => resolve(null),
    });
  });
});
```

**Use in React**:
```tsx
const handleRightClick = async (e: React.MouseEvent) => {
  e.preventDefault();
  
  if (window.electronAPI) {
    const result = await window.electronAPI.showContextMenu([
      { id: 'copy', label: 'Copy' },
      { id: 'paste', label: 'Paste' },
      { type: 'separator' },
      { id: 'custom', label: 'Custom Action' },
    ]);
    
    if (result === 'copy') {
      // Handle copy
    }
  }
};
```

---

## 6. **Better Window Configuration** (5 minutes)

**Update your main.js createWindow**:
```javascript
async createWindow() {
  this.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,  // Don't show until ready
    frame: false,  // Fully frameless (you have titleBarStyle: 'hidden', but frame: false is more explicit)
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
      height: 40
    },
    backgroundColor: '#1a1a1a',  // Match your dark theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      enableWebGL: true,
      backgroundThrottling: false,  // Keep running when in background
    },
    icon: path.join(__dirname, '../public/globe.svg')
  });

  // Smooth fade-in
  this.mainWindow.once('ready-to-show', () => {
    this.mainWindow.setOpacity(0);
    this.mainWindow.show();
    
    // Fade in
    const fadeIn = setInterval(() => {
      const currentOpacity = this.mainWindow.getOpacity();
      if (currentOpacity >= 1) {
        clearInterval(fadeIn);
      } else {
        this.mainWindow.setOpacity(Math.min(currentOpacity + 0.1, 1));
      }
    }, 16);
  });
}
```

---

## 7. **Performance Optimizations** (10 minutes)

**Add to main.js** (before `app.whenReady()`):
```javascript
// Enable hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Disable background throttling for better performance
app.commandLine.appendSwitch('disable-background-timer-throttling');
```

**Add to your CSS** (globals.css):
```css
/* GPU-accelerated animations */
* {
  transform: translateZ(0); /* Force GPU acceleration */
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Optimize repaints */
.animated-element {
  will-change: transform;
  transform: translateZ(0);
}
```

---

## 8. **Badge Counts & Progress** (5 minutes)

**Update preload.js**:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing code
  setBadgeCount: (count) => ipcRenderer.send('set-badge-count', count),
  setProgressBar: (progress) => ipcRenderer.send('set-progress-bar', progress),
});
```

**Update main.js**:
```javascript
ipcMain.on('set-badge-count', (event, count) => {
  app.setBadgeCount(count || 0);
});

ipcMain.on('set-progress-bar', (event, progress) => {
  if (progress >= 0 && progress <= 1) {
    this.mainWindow.setProgressBar(progress);
  } else {
    this.mainWindow.setProgressBar(-1); // Remove progress bar
  }
});
```

**Use in React**:
```tsx
// Show notification count
useEffect(() => {
  if (window.electronAPI && notificationCount > 0) {
    window.electronAPI.setBadgeCount(notificationCount);
  }
}, [notificationCount]);

// Show upload progress
window.electronAPI?.setProgressBar(uploadProgress / 100);
```

---

## Summary: What You're Missing

Based on your code, you're **already doing a lot right**, but you could add:

1. ✅ **Custom title bar** - You have `titleBarStyle: 'hidden'` but no custom controls
2. ✅ **System theme detection** - Not implemented
3. ✅ **Window state persistence** - Not implemented
4. ✅ **Smooth animations** - Basic, could be better
5. ✅ **Native context menus** - Not implemented
6. ✅ **Performance optimizations** - Some, but could be more

---

## Priority Order

**Do These First** (Biggest Impact):
1. Custom title bar (5 min) - Makes it feel native
2. System theme detection (10 min) - Better UX
3. Window state persistence (15 min) - Users expect this

**Then These** (Nice to Have):
4. Smooth animations (5 min)
5. Native context menus (10 min)
6. Badge counts (5 min)

**Total Time**: ~1 hour for all improvements

---

## The Real Question

**Is Electron limiting you, or are you not using its features?**

Looking at your code, I'd say: **You're not using Electron's full potential yet!**

Slack, Discord, VS Code all use these same features. The difference is they:
- Use custom title bars
- Integrate with system theme
- Persist window state
- Use native context menus
- Optimize performance

**You can achieve the same native feel** without migrating away from Electron!

Would you like me to implement any of these improvements in your codebase?

