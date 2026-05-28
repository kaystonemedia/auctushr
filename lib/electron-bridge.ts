// lib/electron-bridge.ts
// Optional helper - your web app works without this!
// This provides type-safe access to Electron APIs

'use client';

import { useEffect, useState } from 'react';

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  appVersion: string;
  uptimeMs: number;
  sessionDurationMs: number;
  idleTimeMs: number;
  isMonitoring: boolean;
  screenshotsCount: number;
  activitiesCount: number;
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
}

export interface ElectronAPI {
  isElectron?: boolean;
  platform?: string;

  // Window controls
  minimize?: () => void;
  maximize?: () => void;
  unmaximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
  onWindowMaximized?: (callback: (isMaximized: boolean) => void) => void;
  removeWindowMaximizedListener?: (callback: (isMaximized: boolean) => void) => void;

  // System theme
  getSystemTheme?: () => Promise<boolean>;
  onThemeChanged?: (callback: (isDark: boolean) => void) => void;
  removeThemeChangedListener?: (callback: (isDark: boolean) => void) => void;

  // System info / diagnostics
  getSystemInfo?: () => Promise<SystemInfo>;

  // Monitoring controls
  startMonitoring?: (payload?: { userData?: unknown }) => void;
  stopMonitoring?: () => void;
  pauseMonitoring?: () => void;

  // Data retrieval
  getCurrentSessionStats?: () => Promise<any>;
  getPrivacySettings?: () => Promise<any>;
  getWorkingHours?: () => Promise<any>;
  getMonitoringStatus?: () => Promise<any>;
  getProductivityData?: () => Promise<any>;

  // Settings updates
  updatePrivacySettings?: (settings: any) => void;
  updateWorkingHours?: (hours: any) => void;

  // Actions
  takeScreenshotNow?: () => Promise<any>;
  syncDataNow?: () => void;
  cleanupOldData?: () => void;
  exportData?: () => void;
  openScreenshotsFolder?: () => void;

  // Web app integration
  openWebApp?: () => void;
  openWebAppForAuth?: () => void;

  // Task and notification integration
  getTaskStats?: () => Promise<any>;
  getNotifications?: () => Promise<any>;
  markNotificationAsRead?: (notificationId: string) => void;
  clearAllNotifications?: () => void;

  // Timer overlay controls
  showTimerOverlay?: () => void;
  hideTimerOverlay?: () => void;
  moveTimerOverlay?: (x: number, y: number) => void;

  // Event listeners
  onMonitoringStarted?: (callback: (data: any) => void) => void;
  onMonitoringStopped?: (callback: (data: any) => void) => void;
  onMonitoringStatusChanged?: (callback: (data: any) => void) => void;
  onActivityUpdated?: (callback: (data: any) => void) => void;
  onScreenshotTaken?: (callback: (data: any) => void) => void;
  onStatsUpdated?: (callback: (data: any) => void) => void;
  onPrivacySettingsUpdated?: (callback: (data: any) => void) => void;
  onWorkingHoursUpdated?: (callback: (data: any) => void) => void;
  onAuthStateChanged?: (callback: (data: any) => void) => void;
  onAuthSuccess?: (callback: (data: any) => void) => void;
  onAuthError?: (callback: (data: any) => void) => void;
  onAuthWaiting?: (callback: (data: any) => void) => void;
  onIdleTimeUpdate?: (callback: (data: any) => void) => void;
  onShowIdleAlert?: (callback: (data: any) => void) => void;
  onTaskStatsUpdated?: (callback: (data: any) => void) => void;
  onNotificationReceived?: (callback: (data: any) => void) => void;
  onNotificationsCleared?: (callback: () => void) => void;
  removeAllListeners?: (channel: string) => void;
}

export interface MonitorAPI {
  getProductivityData?: () => Promise<any>;
  getBreakReminder?: () => Promise<{ shouldBreak: boolean; timeUntilBreak: number }>;
  getOvertimeStatus?: () => Promise<{ isOvertime: boolean; overtimeMinutes: number }>;
  getUserPreferences?: () => Promise<any>;
  updateUserPreferences?: (prefs: Record<string, unknown>) => void;
  showNotification?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  minimizeToTray?: () => void;
  openSettings?: () => void;
  exportSessionData?: () => Promise<any>;
  exportProductivityReport?: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    monitorAPI?: MonitorAPI;
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
  const [isElectronEnv, setIsElectronEnv] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectronEnv(true);
      
      // Check if maximized
      window.electronAPI.isMaximized?.().then(setIsMaximized);
      
      // Get system theme with smooth transition
      window.electronAPI.getSystemTheme?.().then((isDark) => {
        // Add smooth transition class to body for theme changes
        document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        setSystemTheme(isDark ? 'dark' : 'light');
      });
      
      // Listen for theme changes with smooth transitions
      const handleThemeChange = (isDark: boolean) => {
        // Add transition class for smooth theme switching
        document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        setSystemTheme(isDark ? 'dark' : 'light');
      };
      
      window.electronAPI.onThemeChanged?.(handleThemeChange);
      
      // Cleanup listener on unmount
      return () => {
        window.electronAPI?.removeThemeChangedListener?.(handleThemeChange);
      };
    }
  }, []);

  return {
    isElectron: isElectronEnv,
    isMaximized,
    systemTheme,
    electronAPI: typeof window !== 'undefined' ? window.electronAPI || null : null,
  };
}

