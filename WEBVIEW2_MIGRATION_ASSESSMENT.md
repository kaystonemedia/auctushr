# WebView2 Migration Assessment

## Executive Summary

**Migration Feasibility: ✅ YES, with some considerations**

Migrating from Electron to WebView2 is **technically feasible** and aligns with your goal of a more compact, native Windows experience. However, several Electron-specific features will need alternative implementations or architectural changes.

---

## Current Architecture Overview

### 1. **Electron Module** (`electron/`)
- **Main Process**: `main.js` (~4,681 lines)
- **Preload Scripts**: `preload.js`, `consent-preload.js`, `dialog-preload.js`
- **Purpose**: Desktop monitoring application with native system integration

### 2. **Web App** (`app/`, `components/`)
- **Framework**: Next.js 15 with React 19
- **Purpose**: Full-featured HR management web application
- **Integration**: Detects Electron via `window.electronAPI` and `window.monitorAPI`

### 3. **Chrome Extension** (`chrome-extension/`)
- **Purpose**: Browser-based activity tracking
- **Status**: Independent module, unaffected by migration

---

## Electron Functionality Breakdown

### ✅ **Easily Migratable to WebView2**

1. **Window Management**
   - Main window hosting web app
   - Multiple dialog windows (consent, settings, working hours)
   - Timer overlay window
   - **Migration**: WebView2 can host the web app natively. Dialogs can use HTML modals or separate WebView2 windows.

2. **OAuth/Protocol Handler**
   - Custom protocol: `auctushr://`
   - Local HTTP callback server (port 8765)
   - **Migration**: WebView2 supports custom protocol handlers via `CoreWebView2.AddWebResourceRequestedFilter`. OAuth callback server can remain as a background service.

3. **Data Storage**
   - `electron-store` for settings
   - File system for screenshots
   - **Migration**: Use Windows Registry, local JSON files, or SQLite via background service.

4. **Firebase Integration**
   - Authentication
   - Firestore data sync
   - **Migration**: Works identically in WebView2 (standard web APIs).

5. **IPC Communication**
   - `ipcMain`/`ipcRenderer` for main↔renderer communication
   - **Migration**: Use `CoreWebView2.PostWebMessageAsJson` and `WebMessageReceived` events for bidirectional communication.

---

### ⚠️ **Requires Background Service/Windows APIs**

1. **Screenshot Capture**
   - Uses `screenshot-desktop` npm package
   - Saves to `Documents/AuctusHR-Screenshots/`
   - **Migration**: 
     - **Option A**: Create a Windows background service using C#/C++ that exposes screenshot API via HTTP or named pipes
     - **Option B**: Use Windows API via WinRT/COM interop (limited in WebView2)
     - **Option C**: Use Windows Screen Capture API via a small native helper

2. **System Idle Time Detection**
   - Uses `powerMonitor.getSystemIdleTime()`
   - **Migration**: 
     - **Option A**: Background service polling Windows `GetLastInputInfo` API
     - **Option B**: Use Windows Power Management APIs via background service
     - **Option C**: WebView2 doesn't expose this directly, requires native code

3. **System Tray Integration**
   - Tray icon with context menu
   - Balloon notifications
   - **Migration**: 
     - **Option A**: Separate lightweight tray application (C#/C++)
     - **Option B**: Use Windows App SDK (WinUI 3) for tray integration
     - **Option C**: Background service handles tray, communicates with WebView2

4. **Native Notifications**
   - Electron `Notification` API
   - **Migration**: WebView2 can trigger Windows 10/11 native notifications via `CoreWebView2.ShowNotification`.

5. **File System Operations**
   - Opening folders (`shell.openPath`)
   - File dialogs (`dialog.showSaveDialog`)
   - **Migration**: 
     - **Option A**: Use WebView2's `CoreWebView2.ShowSaveDialogAsync` (limited)
     - **Option B**: Background service handles file operations
     - **Option C**: Use Windows File Picker APIs via WebView2 host

6. **Active Window Detection**
   - Currently mocked/limited
   - **Migration**: Requires Windows API (`GetForegroundWindow`, `GetWindowText`) via background service.

---

### 🔴 **Challenges & Solutions**

#### Challenge 1: Background Service Architecture
**Solution**: Create a lightweight Windows background service (C#/.NET or C++) that:
- Runs as a Windows service or background task
- Exposes REST API or named pipes for communication
- Handles all native Windows operations (screenshots, idle detection, file operations)
- WebView2 app communicates via HTTP localhost or WebMessage

#### Challenge 2: Inter-Process Communication
**Current**: Electron IPC (`ipcMain`/`ipcRenderer`)
**Solution**: 
- **Option A**: HTTP API on localhost (background service)
- **Option B**: Named pipes (Windows-specific, efficient)
- **Option C**: WebView2 `PostWebMessageAsJson` + background service WebSocket

#### Challenge 3: Single Instance Enforcement
**Current**: `app.requestSingleInstanceLock()`
**Solution**: Use Windows Mutex or named pipe in background service.

#### Challenge 4: Auto-Start/System Integration
**Current**: Electron auto-updater, installer
**Solution**: Use Windows installer (MSI/NSIS) or Windows App Installer. Background service can register for auto-start.

---

## Recommended Migration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    WebView2 Host App                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │         WebView2 Control (C#/C++)                │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │      Next.js Web App (localhost:3000)     │  │  │
│  │  │  or Static Build (file:// or embedded)    │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │         ↑ PostWebMessageAsJson                   │  │
│  │         ↓ WebMessageReceived                     │  │
│  └──────────────────────────────────────────────────┘  │
│                    ↓ HTTP/Named Pipes                   │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│          Background Service (C#/.NET or C++)            │
│  • Screenshot capture (Windows API)                    │
│  • System idle detection (GetLastInputInfo)            │
│  • File operations                                      │
│  • System tray (optional)                              │
│  • Protocol handler                                     │
│  • OAuth callback server                                │
└─────────────────────────────────────────────────────────┘
```

---

## Migration Steps

### Phase 1: Setup WebView2 Host Application
1. Create C# WinForms/WPF or C++ Win32 application
2. Embed WebView2 control
3. Load Next.js app (dev server or static build)
4. Implement basic WebMessage communication

### Phase 2: Create Background Service
1. Create Windows service/background task
2. Implement screenshot capture (Windows Graphics Capture API)
3. Implement idle detection (Windows API)
4. Expose HTTP API or named pipes

### Phase 3: Migrate IPC Communication
1. Replace `window.electronAPI` calls with WebView2 `PostWebMessageAsJson`
2. Handle responses via `WebMessageReceived`
3. Connect to background service API

### Phase 4: Migrate Native Features
1. Screenshot → Background service API
2. Idle detection → Background service polling
3. File operations → Background service or WebView2 APIs
4. Notifications → WebView2 `ShowNotification`

### Phase 5: Protocol Handler & OAuth
1. Register `auctushr://` protocol in Windows Registry
2. Background service handles protocol URLs
3. OAuth callback server remains in background service

### Phase 6: System Integration
1. System tray (optional, via background service)
2. Auto-start registration
3. Installer/updater

---

## Technology Stack Recommendations

### WebView2 Host Application
- **C#/.NET 6+** (WinForms or WPF) - Recommended for ease of development
- **C++ Win32** - For maximum performance/control
- **Windows App SDK (WinUI 3)** - Modern, but more complex

### Background Service
- **C#/.NET 6+ Windows Service** - Recommended
- **C++ Windows Service** - For performance-critical operations
- **Node.js Windows Service** (using `node-windows`) - Quick migration, but less native

### Communication
- **HTTP REST API** (localhost) - Simplest, cross-platform compatible
- **Named Pipes** - Windows-specific, efficient
- **WebSocket** - Real-time, good for monitoring updates

---

## Benefits of Migration

1. **Smaller Footprint**: WebView2 is ~100MB vs Electron's ~200MB+
2. **Better Performance**: Native Windows rendering engine
3. **System Integration**: Better Windows 10/11 integration
4. **Auto-Updates**: WebView2 updates via Windows Update
5. **Native Feel**: More native Windows UI/UX
6. **Reduced Maintenance**: No Electron version management

---

## Cross-Platform Considerations

### Option 1: **Tauri Framework** (Recommended for Cross-Platform) ⭐

**Tauri** is a Rust-based framework that uses native webviews on each platform:
- **Windows**: WebView2 (same as direct WebView2 approach)
- **macOS**: WKWebView (native macOS webview)
- **Linux**: WebKitGTK (native Linux webview)

**Benefits**:
- ✅ Single codebase for all platforms
- ✅ Smaller bundle size (~5-15MB vs Electron's 100MB+)
- ✅ Better performance (native webviews)
- ✅ Rust backend for native operations
- ✅ Can build for all platforms from any OS (with proper toolchains)
- ✅ Active development, modern architecture

**Architecture**:
```
┌─────────────────────────────────────────┐
│      Tauri Host (Rust)                  │
│  ┌──────────────────────────────────┐  │
│  │  Native WebView                  │  │
│  │  • Windows: WebView2            │  │
│  │  • macOS: WKWebView              │  │
│  │  • Linux: WebKitGTK              │  │
│  │  ┌────────────────────────────┐ │  │
│  │  │   Next.js Web App          │ │  │
│  │  └────────────────────────────┘ │  │
│  └──────────────────────────────────┘  │
│         ↑ Tauri IPC (invoke)            │
│         ↓ Tauri Events                  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│   Tauri Backend (Rust)                  │
│  • Screenshot capture                  │
│  • System idle detection               │
│  • File operations                     │
│  • System tray                         │
│  • Protocol handler                    │
└─────────────────────────────────────────┘
```

**Migration Path**:
- Replace Electron IPC with Tauri `invoke()` API
- Native operations handled in Rust backend
- Same web app code works across all platforms
- Build scripts handle cross-compilation

**Example**:
```typescript
// Instead of window.electronAPI.takeScreenshot()
import { invoke } from '@tauri-apps/api/core';
const screenshot = await invoke('take_screenshot');
```

### Option 2: **Platform-Specific Native Implementations**

Build separate host apps for each platform:

**Windows**: C#/.NET with WebView2
**macOS**: Swift/Objective-C with WKWebView
**Linux**: C++/GTK with WebKitGTK

**Pros**:
- Maximum native integration per platform
- Platform-specific optimizations

**Cons**:
- ❌ Three separate codebases to maintain
- ❌ Requires knowledge of C#, Swift, and C++
- ❌ More complex CI/CD (need Mac for macOS builds)
- ❌ Higher maintenance burden

### Option 3: **Hybrid Approach**

- **Windows**: WebView2 (as originally planned)
- **macOS/Linux**: Keep Electron temporarily, migrate later

**Pros**:
- ✅ Gradual migration
- ✅ Windows gets benefits immediately
- ✅ macOS/Linux continue working

**Cons**:
- ❌ Two codebases to maintain
- ❌ Inconsistent architecture

---

## Risks & Considerations

### For WebView2-Only Approach:
1. **Windows-Only**: WebView2 is Windows-specific (no macOS/Linux support)
2. **Development Complexity**: Requires C#/C++ knowledge for host app
3. **Testing**: Need to test WebView2 + background service integration
4. **Deployment**: More complex installer (host app + service + web app)
5. **Debugging**: More moving parts (host app, service, web app)

### For Tauri Approach:
1. **Learning Curve**: Need to learn Rust (but backend is minimal)
2. **Ecosystem**: Smaller ecosystem than Electron (but growing fast)
3. **Build Requirements**: Need platform toolchains (but can use CI/CD)
4. **Native APIs**: Some platform-specific APIs may need custom Rust code

### For Platform-Specific Approach:
1. **Maintenance**: Three codebases
2. **Development Time**: 3x the effort
3. **Team Skills**: Need C#, Swift, and C++ developers

---

## Estimated Effort

- **WebView2 Host App**: 2-3 weeks
- **Background Service**: 3-4 weeks
- **IPC Migration**: 1-2 weeks
- **Testing & Polish**: 2-3 weeks
- **Total**: ~8-12 weeks

---

## Recommended Approach: Tauri for Cross-Platform

Given your requirement for **Windows, macOS, and Linux** support, **Tauri is the best choice**:

### Why Tauri?
1. ✅ **Single codebase** - Write once, deploy everywhere
2. ✅ **Native webviews** - WebView2 (Windows), WKWebView (macOS), WebKitGTK (Linux)
3. ✅ **Smaller bundles** - ~5-15MB vs Electron's 100MB+
4. ✅ **Better performance** - Native rendering engines
5. ✅ **Rust backend** - Safe, fast native operations
6. ✅ **Cross-compilation** - Build for all platforms from any OS (with CI/CD)

### Tauri Migration Architecture

```
┌─────────────────────────────────────────────────────┐
│              Tauri Application                       │
│  ┌──────────────────────────────────────────────┐  │
│  │  Platform-Specific WebView                   │  │
│  │  • Windows: WebView2                        │  │
│  │  • macOS: WKWebView                         │  │
│  │  • Linux: WebKitGTK                         │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │      Next.js Web App                   │ │  │
│  │  │  (Same code for all platforms)        │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  │         ↑ invoke('command')                 │  │
│  │         ↓ emit('event')                     │  │
│  └──────────────────────────────────────────────┘  │
│                    ↓                                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│         Tauri Backend (Rust)                        │
│  • Screenshot capture (platform-specific)         │
│  • System idle detection                           │
│  • File operations                                 │
│  • System tray                                     │
│  • Protocol handler                                │
│  • OAuth callback server                           │
└─────────────────────────────────────────────────────┘
```

### Tauri vs Direct WebView2 Comparison

| Feature | Direct WebView2 | Tauri |
|---------|----------------|-------|
| **Windows Support** | ✅ Native | ✅ WebView2 |
| **macOS Support** | ❌ None | ✅ WKWebView |
| **Linux Support** | ❌ None | ✅ WebKitGTK |
| **Bundle Size** | ~100MB | ~5-15MB |
| **Codebase** | Platform-specific | Single codebase |
| **Build Complexity** | Medium | Low (with CI/CD) |
| **Native APIs** | C#/C++ | Rust |
| **Learning Curve** | C#/C++ | Rust (minimal) |

---

## Conclusion

### For Cross-Platform: **Use Tauri** ⭐

**Tauri is the recommended solution** because:
- Provides native webviews on all platforms (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux)
- Single codebase for all platforms
- Smaller bundle sizes
- Better performance
- Can build for all platforms (with proper CI/CD setup)

### For Windows-Only: **Direct WebView2**

If you only need Windows support, direct WebView2 implementation is fine, but Tauri still offers benefits (smaller size, Rust backend).

---

## Next Steps

### Option A: Tauri Migration (Recommended)
1. Set up Tauri project structure
2. Migrate Electron IPC to Tauri `invoke()` API
3. Implement native operations in Rust backend
4. Set up CI/CD for cross-platform builds
5. Test on Windows, macOS, and Linux

### Option B: Direct WebView2 (Windows Only)
1. Create WebView2 host app (C#)
2. Create background service
3. Migrate IPC communication
4. Implement native features

**Which approach would you prefer?** I can start implementing either:
- Tauri setup with cross-platform support
- Direct WebView2 implementation for Windows

