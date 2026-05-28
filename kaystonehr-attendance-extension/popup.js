// DOM Elements
const statusEl = document.getElementById('status');
const trackingToggleEl = document.getElementById('trackingToggle');
const settingsBtnEl = document.getElementById('settingsBtn');
const currentSiteEl = document.getElementById('currentSite');
const currentDurationEl = document.getElementById('currentDuration');
const productiveTimeEl = document.getElementById('productiveTime');
const totalActiveEl = document.getElementById('totalActive');
const totalProductiveEl = document.getElementById('totalProductive');
const totalIdleEl = document.getElementById('totalIdle');
const sitesVisitedEl = document.getElementById('sitesVisited');
const lastSyncEl = document.getElementById('lastSync');

// State
let currentActivity = null;
let updateInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load tracking state
  const { userSettings } = await chrome.storage.sync.get('userSettings');
  trackingToggleEl.checked = userSettings?.trackingEnabled ?? true;
  updateStatus();

  // Get current activity
  chrome.runtime.sendMessage({ type: 'getActivity' }, (response) => {
    currentActivity = response;
    updateDisplay();
  });

  // Start periodic updates
  updateInterval = setInterval(updateDisplay, 1000);
});

// Event Listeners
trackingToggleEl.addEventListener('change', (e) => {
  chrome.runtime.sendMessage({ 
    type: 'toggleTracking', 
    enabled: e.target.checked 
  });
  updateStatus();
});

settingsBtnEl.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Update status text
function updateStatus() {
  statusEl.textContent = trackingToggleEl.checked 
    ? 'Tracking activity...' 
    : 'Tracking paused';
  
  statusEl.className = `text-sm ${
    trackingToggleEl.checked ? 'text-green-600' : 'text-gray-600'
  }`;
}

// Format duration in HH:MM:SS
function formatDuration(ms) {
  if (!ms) return '00:00:00';
  
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');
}

// Format duration in hours and minutes
function formatDurationHM(ms) {
  if (!ms) return '0h 0m';
  
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

// Update display with current activity
function updateDisplay() {
  if (!currentActivity) return;

  const now = new Date();
  const duration = currentActivity.startTime 
    ? now - new Date(currentActivity.startTime) 
    : 0;

  // Update current activity
  currentSiteEl.textContent = currentActivity.domain || 'None';
  currentDurationEl.textContent = formatDuration(duration);
  productiveTimeEl.textContent = formatDuration(currentActivity.productiveTime);

  // Update today's summary
  // Note: These values would need to be calculated from the background script
  // For now, we'll just show the current session's values
  totalActiveEl.textContent = formatDurationHM(duration);
  totalProductiveEl.textContent = formatDurationHM(currentActivity.productiveTime);
  totalIdleEl.textContent = formatDurationHM(currentActivity.idleTime);
  sitesVisitedEl.textContent = '1'; // This should be calculated from history

  // Update last sync time
  if (currentActivity.lastSync) {
    const lastSync = new Date(currentActivity.lastSync);
    lastSyncEl.textContent = lastSync.toLocaleTimeString();
  }
}

// Cleanup
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
}); 