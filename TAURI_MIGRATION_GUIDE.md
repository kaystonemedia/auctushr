# Tauri Migration Guide - Cross-Platform Native WebView Solution

## Why Tauri for Cross-Platform?

Tauri uses **native webviews** on each platform:
- **Windows**: WebView2 (Microsoft Edge WebView2)
- **macOS**: WKWebView (Safari's webview)
- **Linux**: WebKitGTK (GTK's webview)

This gives you the **same benefits as WebView2** (smaller size, native feel) **on all platforms**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Application                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Frontend (Next.js Web App)                       │ │
│  │  • Same code for all platforms                    │ │
│  │  • React/Next.js components                       │ │
│  │  • Calls Tauri APIs via @tauri-apps/api           │ │
│  └──────────────────────────────────────────────────┘ │
│                    ↑ invoke() / emit()                  │
│                    ↓                                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Tauri Backend (Rust)                             │ │
│  │  • Screenshot capture                            │ │
│  │  • System idle detection                         │ │
│  │  • File operations                               │ │
│  │  • System tray                                   │ │
│  │  • Protocol handler                              │ │
│  │  • OAuth callback server                         │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Migration Mapping: Electron → Tauri

### IPC Communication

**Electron (Current)**:
```typescript
// Preload exposes window.electronAPI
window.electronAPI.takeScreenshotNow()
window.electronAPI.startMonitoring()
window.electronAPI.on('screenshot-taken', callback)
```

**Tauri (New)**:
```typescript
// Use @tauri-apps/api
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Commands (replaces ipcRenderer.invoke)
const screenshot = await invoke('take_screenshot');

// Events (replaces ipcRenderer.on)
const unlisten = await listen('screenshot-taken', (event) => {
  console.log('Screenshot taken:', event.payload);
});
```

### Native Operations

**Electron (Current)**:
```javascript
// main.js
ipcMain.handle('takeScreenshotNow', async () => {
  const imageBuffer = await screenshotDesktop({ format: 'png' });
  // ... save screenshot
  return screenshot;
});
```

**Tauri (New)**:
```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn take_screenshot() -> Result<Screenshot, String> {
    // Platform-specific screenshot code
    #[cfg(target_os = "windows")]
    {
        // Windows screenshot using Windows API
    }
    #[cfg(target_os = "macos")]
    {
        // macOS screenshot using CGDisplayCreateImage
    }
    #[cfg(target_os = "linux")]
    {
        // Linux screenshot using X11 or Wayland
    }
    Ok(screenshot)
}
```

---

## Step-by-Step Migration

### Phase 1: Setup Tauri Project

1. **Install Tauri CLI**:
```bash
npm install -D @tauri-apps/cli
npm install @tauri-apps/api
```

2. **Initialize Tauri**:
```bash
npx tauri init
```

3. **Project Structure**:
```
project-root/
├── src/                    # Next.js app (existing)
├── components/             # React components (existing)
├── src-tauri/              # NEW: Tauri backend
│   ├── src/
│   │   ├── main.rs         # Rust entry point
│   │   ├── commands.rs    # Tauri commands
│   │   └── lib.rs
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
└── package.json
```

### Phase 2: Migrate IPC Calls

**Before (Electron)**:
```typescript
// components/monitoring/desktop-monitor.tsx
if (window.electronAPI) {
  window.electronAPI.startMonitoring();
  window.electronAPI.on('monitoring-started', (data) => {
    setMonitoringData(data);
  });
}
```

**After (Tauri)**:
```typescript
// components/monitoring/desktop-monitor.tsx
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  // Start monitoring
  invoke('start_monitoring');
  
  // Listen for events
  const unlisten = listen('monitoring-started', (event) => {
    setMonitoringData(event.payload);
  });
  
  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

### Phase 3: Implement Native Operations in Rust

**Screenshot Capture**:
```rust
// src-tauri/src/commands.rs
use tauri::command;
use screenshot;

#[command]
pub async fn take_screenshot() -> Result<ScreenshotData, String> {
    let screenshot = screenshot::capture_display()
        .map_err(|e| e.to_string())?;
    
    // Save to file
    let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("screenshot_{}.png", timestamp);
    let path = get_screenshots_dir()?.join(&filename);
    
    screenshot.save(&path)
        .map_err(|e| e.to_string())?;
    
    Ok(ScreenshotData {
        filename,
        path: path.to_string_lossy().to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}
```

**System Idle Detection**:
```rust
#[command]
pub async fn get_system_idle_time() -> Result<u64, String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::GetLastInputInfo;
        // Windows implementation
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS implementation using IOKit
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux implementation using X11
    }
}
```

### Phase 4: Update Web App Code

Replace all `window.electronAPI` calls:

```typescript
// Create a compatibility layer
// lib/tauri-api.ts
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export const tauriAPI = {
  // Monitoring
  startMonitoring: () => invoke('start_monitoring'),
  stopMonitoring: () => invoke('stop_monitoring'),
  
  // Screenshots
  takeScreenshotNow: () => invoke('take_screenshot'),
  
  // Events
  on: (event: string, callback: (data: any) => void): Promise<UnlistenFn> => {
    return listen(event, (e) => callback(e.payload));
  },
  
  // ... other methods
};

// Use in components
import { tauriAPI } from '@/lib/tauri-api';
await tauriAPI.takeScreenshotNow();
```

### Phase 5: Build Configuration

**tauri.conf.json**:
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../out"
  },
  "package": {
    "productName": "AuctusHR",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "open": true
      },
      "fs": {
        "all": true,
        "scope": ["$DOCUMENT/*", "$APPDATA/*"]
      },
      "path": {
        "all": true
      },
      "protocol": {
        "all": true,
        "asset": true,
        "assetScope": ["**"]
      }
    },
    "windows": [
      {
        "title": "AuctusHR",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "systemTray": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true,
      "menuOnLeftClick": false
    }
  }
}
```

---

## Platform-Specific Considerations

### Windows
- Uses WebView2 (same as direct WebView2 approach)
- Screenshots: Windows Graphics Capture API
- Idle detection: `GetLastInputInfo` API
- System tray: Windows native tray

### macOS
- Uses WKWebView (Safari's webview)
- Screenshots: `CGDisplayCreateImage` or `screencapture` command
- Idle detection: IOKit or `ioreg`
- System tray: macOS menu bar

### Linux
- Uses WebKitGTK
- Screenshots: X11 (`xwd`) or Wayland (`grim`)
- Idle detection: X11 (`xprintidle`) or systemd
- System tray: GTK StatusIcon or AppIndicator

---

## Build & Distribution

### Development
```bash
npm run tauri dev
```

### Build for Current Platform
```bash
npm run tauri build
```

### Cross-Platform Builds (CI/CD)

**GitHub Actions Example**:
```yaml
name: Build Tauri App

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build Tauri app
        run: npm run tauri build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

**Outputs**:
- **Windows**: `.msi` installer
- **macOS**: `.dmg` or `.app`
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

---

## Benefits Summary

1. ✅ **Cross-platform** - Windows, macOS, Linux from one codebase
2. ✅ **Smaller bundles** - ~5-15MB vs Electron's 100MB+
3. ✅ **Native webviews** - WebView2, WKWebView, WebKitGTK
4. ✅ **Better performance** - Native rendering engines
5. ✅ **Rust backend** - Safe, fast native operations
6. ✅ **Modern architecture** - Active development, good ecosystem
7. ✅ **Can build from any OS** - With proper CI/CD setup

---

## Migration Checklist

- [ ] Install Tauri CLI and dependencies
- [ ] Initialize Tauri project structure
- [ ] Create compatibility layer (`lib/tauri-api.ts`)
- [ ] Migrate IPC calls to Tauri `invoke()`
- [ ] Migrate event listeners to Tauri `listen()`
- [ ] Implement native operations in Rust
- [ ] Test on Windows
- [ ] Test on macOS (or CI/CD)
- [ ] Test on Linux (or CI/CD)
- [ ] Update build scripts
- [ ] Set up CI/CD for cross-platform builds
- [ ] Update documentation

---

## Next Steps

1. **Start with Tauri setup** - Initialize project structure
2. **Create compatibility layer** - Ease migration from Electron API
3. **Implement critical features** - Screenshots, idle detection
4. **Test on Windows first** - Validate approach
5. **Expand to macOS/Linux** - Platform-specific implementations

Would you like me to start implementing the Tauri migration?

