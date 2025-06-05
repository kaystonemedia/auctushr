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

// Format time duration
function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Format time
function formatTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    activeTime.textContent = formatDuration(currentStatus.currentSession.activeTime);
    idleTime.textContent = formatDuration(currentStatus.currentSession.idleTime);
    locationStatus.textContent = currentStatus.currentSession.locationHistory?.length > 0 ? 'Tracking' : 'Not tracking';
    flagCount.textContent = currentStatus.currentSession.flags?.length || 0;
  } else {
    activeTime.textContent = '0h 0m';
    idleTime.textContent = '0h 0m';
    locationStatus.textContent = 'Not tracking';
    flagCount.textContent = '0';
  }
}

// Update status from background
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (response?.error) throw new Error(response.error);
    
    currentStatus = response;
    updateStatusUI();
  } catch (error) {
    console.error('Error updating status:', error);
    showNotification('Failed to update status', 'error');
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
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
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

      if (response?.error) throw new Error(response.error);
      
      await updateStatus();
      showNotification('Successfully checked in', 'success');
    } catch (error) {
      console.error('Error checking in:', error);
      showNotification(error.message || 'Error checking in', 'error');
    }
  });

  checkOutBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_OUT' });
      if (response?.error) throw new Error(response.error);
      
      await updateStatus();
      showNotification('Successfully checked out', 'success');
    } catch (error) {
      console.error('Error checking out:', error);
      showNotification(error.message || 'Error checking out', 'error');
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
  await updateStatus();

  // Update status every 5 seconds
  setInterval(updateStatus, 5000);
}

// Start initialization when popup loads
document.addEventListener('DOMContentLoaded', initialize); 