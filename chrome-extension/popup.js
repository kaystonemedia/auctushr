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

const workStatusEl = document.getElementById('workStatus');
const workTimerEl = document.getElementById('workTimer');
const checkInBtn = document.getElementById('checkInBtn');
const checkOutBtn = document.getElementById('checkOutBtn');
const breakBtn = document.getElementById('breakBtn');
const workToast = document.getElementById('workToast');

// State
let currentActivity = null;
let updateInterval = null;

let workState = {
  checkedIn: false,
  onBreak: false,
  startTime: null,
  breakStart: null
};
let workTimerInterval = null;

// On popup load, fetch session state from background
function fetchSessionStateAndUpdateUI() {
  chrome.runtime.sendMessage({ type: 'getSessionState' }, (state) => {
    if (state) {
      workState.checkedIn = state.checkedIn;
      workState.startTime = state.startTime;
      workState.onBreak = state.onBreak;
      workState.breakStart = state.breakStart;
      updateWorkUI();
    }
  });
}

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
  updateWorkUI();
  fetchSessionStateAndUpdateUI();
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

// Example: Fetch and display today's summary and current activity
function updateSummaryAndCurrentActivity() {
  // Fetch from backend or background script as needed
  // For now, just show stub data
  document.getElementById('totalActive').textContent = workState.checkedIn ? 'Active' : 'Inactive';
  document.getElementById('currentSite').textContent = workState.checkedIn ? 'Working...' : '-';
  document.getElementById('currentDuration').textContent = workTimerEl.textContent;
}

// Call this after updating work UI
function updateWorkUI() {
  if (!workState.checkedIn) {
    workStatusEl.textContent = 'Not checked in';
    checkInBtn.classList.remove('hidden');
    checkOutBtn.classList.add('hidden');
    breakBtn.classList.add('hidden');
    workTimerEl.textContent = '00:00:00';
    clearInterval(workTimerInterval);
  } else if (workState.onBreak) {
    workStatusEl.textContent = 'On Break';
    checkInBtn.classList.add('hidden');
    checkOutBtn.classList.remove('hidden');
    breakBtn.classList.remove('hidden');
    breakBtn.textContent = 'End Break';
    workTimerEl.textContent = 'Paused';
    clearInterval(workTimerInterval);
  } else {
    workStatusEl.textContent = 'Working';
    checkInBtn.classList.add('hidden');
    checkOutBtn.classList.remove('hidden');
    breakBtn.classList.remove('hidden');
    breakBtn.textContent = 'Start Break';
    startWorkTimer();
  }
  updateSummaryAndCurrentActivity();
}

function startWorkTimer() {
  clearInterval(workTimerInterval);
  function update() {
    if (!workState.startTime) return;
    const now = new Date();
    const elapsed = Math.floor((now - new Date(workState.startTime)) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    workTimerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes
      .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  update();
  workTimerInterval = setInterval(update, 1000);
}

function showWorkToast(msg, color = 'bg-green-600') {
  workToast.textContent = msg;
  workToast.className = `fixed bottom-4 right-4 ${color} text-white px-4 py-2 rounded shadow-lg`;
  workToast.classList.remove('hidden');
  setTimeout(() => workToast.classList.add('hidden'), 2500);
}

checkInBtn.addEventListener('click', () => {
  workState.checkedIn = true;
  workState.onBreak = false;
  workState.startTime = new Date().toISOString();
  updateWorkUI();
  showWorkToast('Checked in!');
  // Notify background to start session
  chrome.runtime.sendMessage({ type: 'workCheckIn', startTime: workState.startTime });
});

checkOutBtn.addEventListener('click', () => {
  workState.checkedIn = false;
  workState.onBreak = false;
  workState.startTime = null;
  updateWorkUI();
  showWorkToast('Checked out!', 'bg-red-600');
  // Notify background to end session
  chrome.runtime.sendMessage({ type: 'workCheckOut' });
});

breakBtn.addEventListener('click', () => {
  if (!workState.onBreak) {
    workState.onBreak = true;
    workState.breakStart = new Date().toISOString();
    updateWorkUI();
    showWorkToast('Break started!', 'bg-yellow-500');
    chrome.runtime.sendMessage({ type: 'workBreakStart', breakStart: workState.breakStart });
  } else {
    workState.onBreak = false;
    updateWorkUI();
    showWorkToast('Break ended!', 'bg-green-600');
    chrome.runtime.sendMessage({ type: 'workBreakEnd' });
  }
});

// Cleanup
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
}); 