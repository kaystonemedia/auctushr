// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const syncStatus = document.getElementById('syncStatus');
const activeTime = document.getElementById('activeTime');
const idleTime = document.getElementById('idleTime');
const locationStatus = document.getElementById('locationStatus');
const flagCount = document.getElementById('flagCount');
const checkInBtn = document.getElementById('checkInBtn');
const checkOutBtn = document.getElementById('checkOutBtn');
const notifications = document.getElementById('notifications');
const breakReminders = document.getElementById('breakReminders');
const meetingNotifications = document.getElementById('meetingNotifications');
const idleWarnings = document.getElementById('idleWarnings');

// State
let currentStatus = null;
let settings = {
  breakReminders: true,
  meetingNotifications: true,
  idleWarnings: true,
  syncInterval: 5,
  idleThreshold: 5
};

let updateInterval = null;

// Format time for display
function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diff = now - date;
  
  // If less than a minute ago
  if (diff < 60000) {
    return 'Just now';
  }
  
  // If less than an hour ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // If less than a day ago
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Otherwise show date and time
  return date.toLocaleString();
}

// Format duration for display
function formatDuration(seconds) {
  if (!seconds) return '0h 0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notifications.insertBefore(notification, notifications.firstChild);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Update status UI
function updateStatusUI() {
  if (!currentStatus) return;

  // Update status indicator
  statusIndicator.className = 'status-dot';
  if (currentStatus.isCheckedIn) {
    statusIndicator.classList.add('checked-in');
    statusText.textContent = 'Checked In';
    checkInBtn.disabled = true;
    checkOutBtn.disabled = false;
  } else {
    statusIndicator.classList.add('checked-out');
    statusText.textContent = 'Checked Out';
    checkInBtn.disabled = false;
    checkOutBtn.disabled = true;
  }

  // Update sync status
  if (currentStatus.isSyncing) {
    syncStatus.innerHTML = 'Syncing...';
    statusIndicator.classList.add('syncing');
  } else {
    syncStatus.textContent = `Last sync: ${formatTime(currentStatus.lastSync)}`;
    statusIndicator.classList.remove('syncing');
  }

  // Update stats
  if (currentStatus.currentSession) {
    const session = currentStatus.currentSession;
    const startTime = session.startTime ? new Date(session.startTime) : null;
    const now = new Date();
    
    // Calculate active time
    let activeTimeSeconds = session.activeTime || 0;
    if (startTime && currentStatus.isCheckedIn) {
      activeTimeSeconds += Math.floor((now - startTime) / 1000);
    }
    
    activeTime.textContent = formatDuration(activeTimeSeconds);
    idleTime.textContent = formatDuration(session.idleTime || 0);
    locationStatus.textContent = session.locationHistory?.length > 0 ? 'Tracking' : 'Not tracking';
    flagCount.textContent = session.flags?.length || 0;
  } else {
    activeTime.textContent = '0h 0m';
    idleTime.textContent = '0h 0m';
    locationStatus.textContent = 'Not tracking';
    flagCount.textContent = '0';
  }
}

// Fetch current status
async function fetchStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    currentStatus = response;
    updateStatusUI();
  } catch (error) {
    console.error('Error fetching status:', error);
  }
}

// Load settings
async function loadSettings() {
  try {
    const { settings: savedSettings } = await chrome.storage.local.get('settings');
    if (savedSettings) {
      settings = savedSettings;
      breakReminders.checked = settings.breakReminders;
      meetingNotifications.checked = settings.meetingNotifications;
      idleWarnings.checked = settings.idleWarnings;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
async function saveSettings() {
  try {
    settings = {
      ...settings,
      breakReminders: breakReminders.checked,
      meetingNotifications: meetingNotifications.checked,
      idleWarnings: idleWarnings.checked
    };

    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      data: settings
    });

    await chrome.storage.local.set({ settings });
    showNotification('Settings saved', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Failed to save settings', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Check in/out buttons
  checkInBtn.addEventListener('click', async () => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_IN',
        data: {
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          },
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`
          }
        }
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      await fetchStatus();
    } catch (error) {
      console.error('Check-in error:', error);
      alert(error.message || 'Failed to check in');
    }
  });

  checkOutBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_OUT' });
      if (response.error) {
        throw new Error(response.error);
      }
      await fetchStatus();
    } catch (error) {
      console.error('Check-out error:', error);
      alert(error.message || 'Failed to check out');
    }
  });

  // Settings toggles
  breakReminders.addEventListener('change', saveSettings);
  meetingNotifications.addEventListener('change', saveSettings);
  idleWarnings.addEventListener('change', saveSettings);
}

// Initialize popup
async function initialize() {
  await loadSettings();
  setupEventListeners();
  await fetchStatus();

  // Set up periodic updates
  updateInterval = setInterval(fetchStatus, 5000);
}

// Start initialization when popup loads
document.addEventListener('DOMContentLoaded', initialize);

// Clean up on popup close
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
}); 