const auth = { currentUser: null };
const db = {};
let currentProfile = null;

// API configuration
const API_BASE_URL = 'http://localhost:3000/api';
const BATCH_SIZE = 10;
let activityQueue = [];

// Activity tracking state
let currentActivity = {
  startTime: null,
  url: null,
  title: null,
  domain: null,
  productiveTime: 0,
  idleTime: 0,
  lastSync: null,
  employeeId: null,
  departmentId: null,
  onBreak: false, // Added for break tracking
  breakStart: null // Added for break tracking
};

let isTracking = false;
let userSettings = {
  productiveDomains: [],
  trackingEnabled: true,
  idleThreshold: 5, // minutes
  syncInterval: 5, // minutes
  collectUrls: true,
  collectTitles: true
};

let notificationUnsubscribe = null;

function doc(_db, collectionName, id) {
  return { collectionName, id };
}

async function getDoc(docRef) {
  if (docRef.collectionName === 'users' && auth.currentUser && docRef.id === auth.currentUser.uid && currentProfile) {
    return {
      exists: () => true,
      data: () => ({
        ...currentProfile,
        employeeId: currentProfile.id || currentProfile.uid || auth.currentUser.uid,
        departmentId: currentProfile.department || null
      })
    };
  }
  return {
    exists: () => false,
    data: () => null
  };
}

function collection(_db, collectionName) {
  return { collectionName };
}

function query(collectionRef, ...constraints) {
  return { collectionName: collectionRef.collectionName, constraints };
}

function where(field, op, value) {
  return { type: 'where', field, op, value };
}

function orderBy(field, direction = 'desc') {
  return { type: 'orderBy', field, direction };
}

function onSnapshot(_queryRef, callback) {
  // Notifications are delivered through API polling in this migrated version.
  // Keep the signature for compatibility.
  void callback({
    docChanges: () => []
  });
  return () => {};
}

async function signInWithCustomToken(authState, token) {
  const response = await fetch(`${API_BASE_URL}/auth/user`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Unable to authenticate extension session');
  }

  const payload = await response.json();
  const user = payload?.user;
  if (!user) {
    throw new Error('Unable to load user profile');
  }

  authState.currentUser = {
    uid: user.uid || user.auth_user_id || user.id,
    email: user.email
  };
  currentProfile = user;
  return { user: authState.currentUser };
}

// Define working hours (e.g., 9am to 5pm)
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

function isWithinWorkingHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

// Subscribe to Firestore notifications for the logged-in user
async function subscribeToNotifications(userId) {
  if (notificationUnsubscribe) {
    notificationUnsubscribe();
  }
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('employeeId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  notificationUnsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const notification = change.doc.data();
        // Send notification to all tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'showNotification',
              notification
            });
          });
        });
      }
    });
  });
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set up alarms for periodic syncing
  chrome.alarms.create('syncActivity', {
    periodInMinutes: userSettings.syncInterval
  });

  // Set up idle detection
  chrome.idle.setDetectionInterval(userSettings.idleThreshold * 60);

  // Load user settings and authentication
  await loadUserSettings();
  await initializeAuth();

  // Restore session state on startup
  chrome.storage.local.get('workSessionState', (result) => {
    const state = result.workSessionState;
    if (state) {
      currentActivity.startTime = state.startTime ? new Date(state.startTime) : null;
      currentActivity.onBreak = state.onBreak || false;
      currentActivity.breakStart = state.breakStart ? new Date(state.breakStart) : null;
      // Optionally, resume timer overlay if checked in and not on break
      if (currentActivity.startTime && !currentActivity.onBreak) {
        notifyTabsStartTimerOverlay(currentActivity.startTime);
      }
    }
  });
});

// Initialize authentication
async function initializeAuth() {
  try {
    // Get auth token from storage
    const { authToken } = await chrome.storage.local.get('authToken');
    if (!authToken) {
      console.warn('No auth token found');
      return;
    }

    // Sign in with custom token
    await signInWithCustomToken(auth, authToken);
    
    // Get user data
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    const userData = userDoc.data();
    
    currentActivity.employeeId = userData.employeeId;
    currentActivity.departmentId = userData.departmentId;

    // Subscribe to notifications for this user
    if (userData.employeeId) {
      subscribeToNotifications(userData.employeeId);
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
  }
}

// Load user settings from storage
async function loadUserSettings() {
  const result = await chrome.storage.sync.get('userSettings');
  if (result.userSettings) {
    userSettings = { ...userSettings, ...result.userSettings };
  }
}

function notifyTabsStartTimerOverlay(startTime) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'startTimerOverlay',
        startTime
      });
      console.log('Sent startTimerOverlay to tab', tab.id, 'with startTime', startTime);
    });
  });
}

function notifyTabsStopTimerOverlay() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'stopTimerOverlay'
      });
      console.log('Sent stopTimerOverlay to tab', tab.id);
    });
  });
}

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!userSettings.trackingEnabled) return;
  
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateCurrentActivity(tab);
});

// Track URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!userSettings.trackingEnabled || !changeInfo.url) return;

  updateCurrentActivity(tab);
});

// Handle idle state changes
chrome.idle.onStateChanged.addListener((state) => {
  if (!userSettings.trackingEnabled) return;

  if (state === 'idle' || state === 'locked') {
    handleIdleState();
  } else {
    handleActiveState();
  }
});

// Sync data periodically
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncActivity') {
    syncActivityData();
    syncToApi();
  }
});

// Set up periodic screen capture during working hours
chrome.alarms.create('screenCapture', { periodInMinutes: 15 }); // every 15 minutes

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'screenCapture' && isWithinWorkingHours()) {
    captureAndNotify();
  }
});

async function captureAndNotify() {
  // Capture the visible tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) return;
      // Notify employee via overlay
      chrome.tabs.sendMessage(tab.id, {
        type: 'showNotification',
        notification: {
          type: 'screen_capture',
          message: 'A screenshot was captured for productivity monitoring.'
        }
      });
      // Send image to backend for storage/logging
      await uploadCaptureToBackend(dataUrl);
    });
  });
}

async function uploadCaptureToBackend(dataUrl) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch(`${API_BASE_URL}/productivity/screencapture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: dataUrl,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to upload screen capture:', error);
  }
}

// When check-in occurs (startTime is set)
function updateCurrentActivity(tab) {
  const now = new Date();
  // If there's an existing activity, save it first
  if (currentActivity.startTime) {
    const duration = now - currentActivity.startTime;
    saveActivity(duration);
    // Session ended, stop timer overlay
    notifyTabsStopTimerOverlay();
  }
  // Start new activity
  const url = new URL(tab.url);
  currentActivity = {
    startTime: now,
    url: tab.url,
    title: tab.title,
    domain: url.hostname,
    productiveTime: 0,
    idleTime: 0,
    lastSync: now,
    employeeId: currentActivity.employeeId,
    departmentId: currentActivity.departmentId,
    onBreak: false, // Reset break state
    breakStart: null // Reset break start
  };
  // Start timer overlay for new session
  notifyTabsStartTimerOverlay(now);
  // Check if domain is productive
  if (userSettings.productiveDomains.includes(currentActivity.domain)) {
    startProductiveTimeTracking();
  }
}

// Handle idle state
function handleIdleState() {
  if (!currentActivity.startTime) return;

  const now = new Date();
  const duration = now - currentActivity.startTime;
  
  currentActivity.idleTime += duration;
  saveActivity(duration);
}

// Handle active state
function handleActiveState() {
  const now = new Date();
  currentActivity.startTime = now;
}

// Save activity data
async function saveActivity(duration) {
  if (!auth.currentUser || !currentActivity.employeeId) return;

  try {
    const activityData = {
      userId: auth.currentUser.uid,
      employeeId: currentActivity.employeeId,
      departmentId: currentActivity.departmentId,
      url: userSettings.collectUrls ? currentActivity.url : undefined,
      title: userSettings.collectTitles ? currentActivity.title : undefined,
      domain: currentActivity.domain,
      startTime: currentActivity.startTime,
      endTime: new Date(),
      duration: duration,
      productiveTime: currentActivity.productiveTime,
      idleTime: currentActivity.idleTime,
      timestamp: new Date(),
      onBreak: !!currentActivity.onBreak,
      breakStart: currentActivity.breakStart || null
    };

    // Add to queue
    activityQueue.push(activityData);

    // If queue reaches batch size, sync to API
    if (activityQueue.length >= BATCH_SIZE) {
      await syncToApi();
    }

    currentActivity.lastSync = new Date();
  } catch (error) {
    console.error('Error saving activity:', error);
  }
}

// Sync data to API
async function syncToApi() {
  if (activityQueue.length === 0) return;

  try {
    const response = await fetch(`${API_BASE_URL}/productivity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
      },
      body: JSON.stringify({
        logs: activityQueue
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Clear queue after successful sync
    activityQueue = [];
  } catch (error) {
    console.error('Error syncing to API:', error);
  }
}

// Sync activity data with Firebase
async function syncActivityData() {
  if (!auth.currentUser || !currentActivity.startTime) return;

  const now = new Date();
  const duration = now - currentActivity.startTime;
  
  await saveActivity(duration);
}

// Start productive time tracking
function startProductiveTimeTracking() {
  if (!currentActivity.startTime) return;

  const trackingInterval = setInterval(() => {
    if (!userSettings.trackingEnabled || !currentActivity.startTime) {
      clearInterval(trackingInterval);
      return;
    }

    currentActivity.productiveTime += 1000; // Add 1 second
  }, 1000);
}

// Helper to persist session state
function saveSessionState() {
  const state = {
    checkedIn: !!currentActivity.startTime,
    startTime: currentActivity.startTime ? currentActivity.startTime.toISOString() : null,
    onBreak: !!currentActivity.onBreak,
    breakStart: currentActivity.breakStart ? currentActivity.breakStart.toISOString() : null
  };
  chrome.storage.local.set({ workSessionState: state });
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'workCheckIn':
      currentActivity.startTime = new Date(request.startTime);
      currentActivity.onBreak = false;
      currentActivity.breakStart = null;
      saveSessionState();
      notifyTabsStartTimerOverlay(request.startTime);
      break;
    case 'workCheckOut':
      currentActivity.startTime = null;
      currentActivity.onBreak = false;
      currentActivity.breakStart = null;
      saveSessionState();
      notifyTabsStopTimerOverlay();
      break;
    case 'workBreakStart':
      currentActivity.onBreak = true;
      currentActivity.breakStart = new Date(request.breakStart);
      saveSessionState();
      notifyTabsStopTimerOverlay();
      break;
    case 'workBreakEnd':
      currentActivity.onBreak = false;
      currentActivity.breakStart = null;
      saveSessionState();
      if (currentActivity.startTime) {
        notifyTabsStartTimerOverlay(currentActivity.startTime);
      }
      break;
    case 'getActivity':
      sendResponse(currentActivity);
      break;
    case 'updateSettings':
      userSettings = { ...userSettings, ...request.settings };
      chrome.storage.sync.set({ userSettings });
      break;
    case 'toggleTracking':
      userSettings.trackingEnabled = request.enabled;
      chrome.storage.sync.set({ userSettings });
      if (!request.enabled) {
        notifyTabsStopTimerOverlay();
      }
      break;
    case 'getSessionState':
      sendResponse({
        checkedIn: !!currentActivity.startTime,
        startTime: currentActivity.startTime ? currentActivity.startTime.toISOString() : null,
        onBreak: !!currentActivity.onBreak,
        breakStart: currentActivity.breakStart ? currentActivity.breakStart.toISOString() : null
      });
      break;
  }
}); 