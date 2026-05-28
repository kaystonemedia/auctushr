# Electron Shell Architecture - Loading Web App with Native Capabilities

## Your Idea: Perfect! ✅

**"Electron shell that loads the web app, exposing Electron capabilities without rewriting UI"**

This is **exactly what Electron is designed for** and is the **standard pattern** used by Slack, Discord, VS Code, etc.!

---

## Current State vs. Ideal State

### **Current State** (What I See)
- Loading custom HTML (`modern-ui.html`)
- Not loading your Next.js web app directly
- Electron capabilities exist but not integrated with web app

### **Ideal State** (What You Want)
```
┌─────────────────────────────────────────┐
│      Electron Shell (main.js)         │
│  ┌─────────────────────────────────┐ │
│  │  BrowserWindow                   │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │  Your Next.js Web App       │ │ │
│  │  │  (localhost:3000 or build) │ │ │
│  │  └─────────────────────────────┘ │ │
│  │         ↑                        │ │
│  │         │ window.electronAPI     │ │
│  │         ↓                        │ │
│  │  Preload Script (bridge)         │ │
│  └─────────────────────────────────┘ │
│         ↑ IPC                         │
│         ↓                             │
│  Main Process (native capabilities)   │
└─────────────────────────────────────────┘
```

---

## Architecture: Electron Shell Pattern

### **1. Electron Shell (main.js)**
- Creates BrowserWindow
- Loads your web app URL
- Handles native operations
- Exposes capabilities via IPC

### **2. Preload Bridge (preload.js)**
- Safe bridge between web and Electron
- Exposes `window.electronAPI`
- No changes needed to web code

### **3. Web App (Your Next.js App)**
- **Unchanged** - works in browser and Electron
- **Optional**: Detects Electron and uses native features
- Falls back gracefully if not in Electron

---

## Implementation

### Step 1: Update Electron Shell to Load Web App

**Current**: Loading `modern-ui.html`  
**New**: Load your Next.js web app

**Update `electron/main.js`**:

```javascript
async createWindow() {
  // Determine URL to load
  const isDev = !app.isPackaged;
  const webAppUrl = isDev 
    ? 'http://localhost:3000'  // Dev: Next.js dev server
    : `file://${path.join(__dirname, '../out/index.html')}`;  // Prod: Static build

  this.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,  // Frameless for custom title bar
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
      // Allow loading from localhost (dev) or file:// (prod)
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
  if (isDev) {
    // Development: Load from Next.js dev server
    await this.mainWindow.loadURL(webAppUrl);
    
    // Open DevTools in development
    this.mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from static build
    await this.mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  // Handle navigation (prevent external links from opening in Electron)
  this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (isDev) {
      // In dev, allow localhost navigation
      if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } else {
      // In prod, only allow file:// protocol
      if (parsedUrl.protocol !== 'file:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    }
  });

  // Handle new window (open external links in browser)
  this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}
```

---

### Step 2: Enhanced Preload Bridge

**Your `preload.js` is already good!** Just enhance it:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Detect if running in Electron
const isElectron = true;

// Enhanced Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  isElectron: isElectron,
  platform: process.platform,
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // System integration
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (event, isDark) => callback(isDark));
  },
  
  // Your existing APIs
  startMonitoring: () => ipcRenderer.send('start-monitoring'),
  stopMonitoring: () => ipcRenderer.send('stop-monitoring'),
  getCurrentSessionStats: () => ipcRenderer.invoke('get-current-session-stats'),
  takeScreenshotNow: () => ipcRenderer.invoke('takeScreenshotNow'),
  // ... all your existing APIs
  
  // Events
  onMonitoringStarted: (callback) => ipcRenderer.on('monitoring-started', callback),
  onScreenshotTaken: (callback) => ipcRenderer.on('screenshot-taken', callback),
  // ... all your existing events
});

// Also expose monitorAPI (your existing)
contextBridge.exposeInMainWorld('monitorAPI', {
  // ... your existing monitorAPI
});
```

---

### Step 3: Web App - Optional Electron Detection

**Create**: `lib/electron-bridge.ts` (Optional helper)

```typescript
// lib/electron-bridge.ts
// This file is optional - your web app works without it!

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
  
  // Your app-specific APIs
  startMonitoring?: () => void;
  stopMonitoring?: () => void;
  getCurrentSessionStats?: () => Promise<any>;
  takeScreenshotNow?: () => Promise<any>;
  
  // Events
  onMonitoringStarted?: (callback: (data: any) => void) => void;
  onScreenshotTaken?: (callback: (data: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    monitorAPI?: any;
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

export function useElectron(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}

// Helper hook for React
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

### Step 4: Use in Your Components (Optional)

**Your web code stays the same**, but you can optionally enhance it:

```tsx
// components/some-component.tsx
import { useElectronFeatures } from '@/lib/electron-bridge';

export function SomeComponent() {
  const { isElectron, electronAPI } = useElectronFeatures();
  
  const handleScreenshot = async () => {
    if (isElectron && electronAPI?.takeScreenshotNow) {
      // Use Electron native screenshot
      const screenshot = await electronAPI.takeScreenshotNow();
      console.log('Screenshot taken:', screenshot);
    } else {
      // Fallback: Use web API or show message
      alert('Screenshot feature only available in desktop app');
    }
  };
  
  return (
    <button onClick={handleScreenshot}>
      Take Screenshot
    </button>
  );
}
```

---

## Key Benefits

### ✅ **No Web Code Changes Required**
- Your Next.js app works as-is in browser
- Electron features are **optional enhancements**
- Graceful fallback if not in Electron

### ✅ **Single Codebase**
- Same React components
- Same styling (Tailwind, shadcn/ui)
- Same business logic

### ✅ **Native Capabilities When Available**
- Screenshots, system integration, etc.
- Only when running in Electron
- Web version still works

### ✅ **Easy Development**
- Dev: `npm run dev` + `npm run electron:dev`
- Web app runs on `localhost:3000`
- Electron loads `localhost:3000`
- Hot reload works!

---

## Development Workflow

### **Development**:
```bash
# Terminal 1: Start Next.js dev server
npm run dev  # Runs on localhost:3000

# Terminal 2: Start Electron (loads localhost:3000)
npm run electron:dev
```

### **Production Build**:
```bash
# Build Next.js static export
npm run build  # Creates 'out' directory

# Build Electron app (includes 'out' directory)
npm run electron:build
```

---

## Configuration Updates

### **Update `next.config.ts`**:

```typescript
const nextConfig: NextConfig = {
  // For Electron builds, use static export
  output: process.env.BUILD_TARGET === 'electron' ? 'export' : 'standalone',
  
  // Trailing slash for Electron file:// protocol
  trailingSlash: process.env.BUILD_TARGET === 'electron',
  
  // Use 'out' directory for Electron builds
  distDir: process.env.BUILD_TARGET === 'electron' ? 'out' : '.next',
  
  // ... rest of your config
};
```

### **Update `package.json` scripts**:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "cross-env BUILD_TARGET=electron npm run build && electron-builder"
  }
}
```

---

## File Structure

```
project-root/
├── app/                    # Your Next.js app (unchanged)
├── components/             # Your React components (unchanged)
├── lib/
│   └── electron-bridge.ts  # NEW: Optional Electron helpers
├── electron/
│   ├── main.js            # UPDATED: Loads web app
│   ├── preload.js         # UPDATED: Enhanced bridge
│   └── ...
├── out/                    # Generated: Static build (for Electron)
└── package.json
```

---

## Migration Steps

1. **Update `electron/main.js`** to load web app instead of `modern-ui.html`
2. **Enhance `preload.js`** with window controls and system integration
3. **Create `lib/electron-bridge.ts`** (optional helper)
4. **Update build scripts** in `package.json`
5. **Test**: Run `npm run electron:dev` - should load your web app!

---

## Example: What Changes

### **Before** (Current):
- Electron loads custom HTML file
- Web app runs separately
- No integration

### **After** (Shell Pattern):
- Electron loads your Next.js web app
- Web app detects Electron (optional)
- Native features available when in Electron
- Web version still works in browser

---

## This is Exactly What Slack/Discord Do!

- **Slack**: Electron shell loads React web app
- **Discord**: Electron shell loads React web app  
- **VS Code**: Electron shell loads web UI
- **Your App**: Same pattern! ✅

---

## Next Steps

Would you like me to:
1. **Update your `electron/main.js`** to load the web app?
2. **Enhance your `preload.js`** with additional capabilities?
3. **Create the `electron-bridge.ts`** helper file?
4. **Update build configuration**?

This approach gives you:
- ✅ Native Electron capabilities
- ✅ No web code changes required
- ✅ Single codebase
- ✅ Works in browser AND Electron

**This is the right approach!** 🎯

