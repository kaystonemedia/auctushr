const { contextBridge, ipcRenderer } = require('electron');

const windowMaximizedListeners = new WeakMap();
const themeChangedListeners = new WeakMap();

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  isElectron: true,
  platform: process.platform,
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  unmaximize: () => ipcRenderer.send('window-maximize'), // Toggle
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  
  // Window state listeners
  onWindowMaximized: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (_event, isMaximized) => callback(isMaximized);
    windowMaximizedListeners.set(callback, listener);
    ipcRenderer.on('window-maximized', listener);
  },
  removeWindowMaximizedListener: (callback) => {
    const listener = windowMaximizedListeners.get(callback);
    if (listener) {
      ipcRenderer.removeListener('window-maximized', listener);
      windowMaximizedListeners.delete(callback);
    }
  },
  
  // System theme
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  
  // System info / diagnostics
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  onThemeChanged: (callback) => {
    if (typeof callback !== 'function') return;
    const listener = (_event, isDark) => callback(isDark);
    themeChangedListeners.set(callback, listener);
    ipcRenderer.on('theme-changed', listener);
  },
  removeThemeChangedListener: (callback) => {
    const listener = themeChangedListeners.get(callback);
    if (listener) {
      ipcRenderer.removeListener('theme-changed', listener);
      themeChangedListeners.delete(callback);
    }
  },
  
  // Monitoring controls
  startMonitoring: () => ipcRenderer.send('start-monitoring'),
  stopMonitoring: () => ipcRenderer.send('stop-monitoring'),
  pauseMonitoring: () => ipcRenderer.send('pause-monitoring'),
  
  // Data retrieval
  getCurrentSessionStats: () => ipcRenderer.invoke('get-current-session-stats'),
  getPrivacySettings: () => ipcRenderer.invoke('get-privacy-settings'),
  getWorkingHours: () => ipcRenderer.invoke('get-working-hours'),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  getProductivityData: () => ipcRenderer.invoke('get-productivity-data'),
  
  // Settings updates
  updatePrivacySettings: (settings) => ipcRenderer.send('update-privacy-settings', settings),
  updateWorkingHours: (hours) => ipcRenderer.send('update-working-hours', hours),
  
  // Actions
  takeScreenshotNow: () => ipcRenderer.invoke('takeScreenshotNow'),
  syncDataNow: () => ipcRenderer.send('sync-data-now'),
  cleanupOldData: () => ipcRenderer.send('cleanup-old-data'),
  exportData: () => ipcRenderer.send('export-data'),
  openScreenshotsFolder: () => ipcRenderer.send('open-screenshots-folder'),
  
  // Web app integration
  openWebApp: () => ipcRenderer.send('open-web-app'),
  openWebAppForAuth: () => ipcRenderer.send('open-web-app-for-auth'),
  
  // Task and notification integration
  getTaskStats: () => ipcRenderer.invoke('get-task-stats'),
  getNotifications: () => ipcRenderer.invoke('get-notifications'),
  markNotificationAsRead: (notificationId) => ipcRenderer.send('mark-notification-read', notificationId),
  clearAllNotifications: () => ipcRenderer.send('clear-all-notifications'),
  
  // Timer overlay controls
  showTimerOverlay: () => ipcRenderer.send('show-timer-overlay'),
  hideTimerOverlay: () => ipcRenderer.send('hide-timer-overlay'),
  moveTimerOverlay: (x, y) => ipcRenderer.send('move-timer-overlay', { x, y }),
  
  // Listeners for updates
  onMonitoringStarted: (callback) => ipcRenderer.on('monitoring-started', (_event, data) => callback?.(data)),
  onMonitoringStopped: (callback) => ipcRenderer.on('monitoring-stopped', (_event, data) => callback?.(data)),
  onMonitoringStatusChanged: (callback) => ipcRenderer.on('monitoring-status-changed', (_event, data) => callback?.(data)),
  onActivityUpdated: (callback) => ipcRenderer.on('activity-updated', (_event, data) => callback?.(data)),
  onScreenshotTaken: (callback) => ipcRenderer.on('screenshot-taken', (_event, data) => callback?.(data)),
  onStatsUpdated: (callback) => ipcRenderer.on('stats-updated', (_event, data) => callback?.(data)),
  onPrivacySettingsUpdated: (callback) => ipcRenderer.on('privacy-settings-updated', (_event, data) => callback?.(data)),
  onWorkingHoursUpdated: (callback) => ipcRenderer.on('working-hours-updated', (_event, data) => callback?.(data)),
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', (_event, data) => callback?.(data)),
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', (_event, data) => callback?.(data)),
  onAuthError: (callback) => ipcRenderer.on('auth-error', (_event, data) => callback?.(data)),
  onAuthWaiting: (callback) => ipcRenderer.on('auth-waiting', (_event, data) => callback?.(data)),
  onIdleTimeUpdate: (callback) => ipcRenderer.on('idle-time-update', (_event, data) => callback?.(data)),
  onShowIdleAlert: (callback) => ipcRenderer.on('show-idle-alert', (_event, data) => callback?.(data)),
  onTaskStatsUpdated: (callback) => ipcRenderer.on('task-stats-updated', (_event, data) => callback?.(data)),
  onNotificationReceived: (callback) => ipcRenderer.on('notification-received', (_event, data) => callback?.(data)),
  onNotificationsCleared: (callback) => ipcRenderer.on('notifications-cleared', (_event, data) => callback?.(data)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose a simplified API for the monitoring interface
contextBridge.exposeInMainWorld('monitorAPI', {
  // Real-time monitoring data
  getProductivityData: () => ipcRenderer.invoke('get-productivity-data'),
  getBreakReminder: () => ipcRenderer.invoke('get-break-reminder'),
  getOvertimeStatus: () => ipcRenderer.invoke('get-overtime-status'),
  
  // User preferences
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  updateUserPreferences: (prefs) => ipcRenderer.send('update-user-preferences', prefs),
  
  // Notifications
  showNotification: (message, type = 'info') => ipcRenderer.send('show-notification', { message, type }),
  
  // System integration
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  openSettings: () => ipcRenderer.send('open-settings'),
  
  // Data export
  exportSessionData: () => ipcRenderer.invoke('export-session-data'),
  exportProductivityReport: () => ipcRenderer.invoke('export-productivity-report')
});

// Expose some Node.js APIs for development
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('development', {
    platform: process.platform,
    versions: process.versions
  });
}