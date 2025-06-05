// Constants
const IDLE_THRESHOLD = 5 * 60; // 5 minutes in seconds
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const API_BASE_URL = 'https://styletry.com/api';

// Web activity tracking
const WEB_ACTIVITY_TYPES = {
  NAVIGATION: 'navigation',
  CLICK: 'click',
  SCROLL: 'scroll',
  INPUT: 'input',
  FOCUS: 'focus',
  BLUR: 'blur'
}

// Activity tracking constants
const ACTIVITY_TYPES = {
  ...WEB_ACTIVITY_TYPES,
  APP_USAGE: 'app_usage',
  MEETING: 'meeting',
  TASK: 'task',
  BREAK: 'break',
  FOCUS: 'focus'
}

// Break detection
const BREAK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const FOCUS_THRESHOLD = 25 * 60 * 1000; // 25 minutes

// State
let isCheckedIn = false;
let lastActiveTime = Date.now();
let idleStartTime = null;
let currentSession = {
  startTime: null,
  activities: [],
  idleTime: 0,
  activeTime: 0,
  locationHistory: [],
  checkInLocation: null,
  deviceInfo: null,
  flags: []
};

// State for enhanced tracking
let currentApp = null;
let breakStartTime = null;
let focusStartTime = null;
let meetingStartTime = null;
let taskStartTime = null;
let productivityStats = {
  focusTime: 0,
  idleTime: 0,
  breakTime: 0,
  meetingTime: 0,
  taskProgress: 0,
  topWebsites: [],
  activityByHour: Array(24).fill(0).map((_, hour) => ({
    hour,
    active: 0,
    idle: 0
  })),
  meetings: [],
  tasks: []
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Set up periodic sync
  chrome.alarms.create('syncActivity', { periodInMinutes: 5 });
  
  // Initialize storage
  await chrome.storage.local.set({
    isCheckedIn: false,
    currentSession: null,
    lastSync: null,
    settings: {
      breakReminders: true,
      meetingNotifications: true,
      idleWarnings: true,
      syncInterval: 5,
      idleThreshold: 5
    }
  });

  // Set up idle detection
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD);
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncActivity') {
    await syncActivityData();
  }
});

// Handle idle state changes
chrome.idle.onStateChanged.addListener(async (state) => {
  if (!isCheckedIn) return;

  const now = Date.now();
  
  if (state === 'idle') {
    idleStartTime = now;
    currentSession.flags.push({
      type: 'idle_start',
      timestamp: new Date(now).toISOString(),
      severity: 'low'
    });
  } else if (state === 'active' && idleStartTime) {
    const idleDuration = now - idleStartTime;
    currentSession.idleTime += idleDuration;
    
    currentSession.flags.push({
      type: 'idle_end',
      timestamp: new Date(now).toISOString(),
      duration: Math.round(idleDuration / 1000 / 60), // Convert to minutes
      severity: idleDuration > 30 * 60 * 1000 ? 'high' : 'medium' // 30 minutes
    });
    
    idleStartTime = null;
  }
});

// Track tab changes
chrome.tabs.onActivated.addListener(() => {
  updateLastActiveTime();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateLastActiveTime();
    logActivity('tab_change', { url: tab.url });
  }
});

// Track web activity
chrome.webNavigation.onCompleted.addListener((details) => {
  if (!isCheckedIn || !currentSession.startTime) return

  logActivity(WEB_ACTIVITY_TYPES.NAVIGATION, {
    url: details.url,
    title: details.title,
    transitionType: details.transitionType
  })
})

// Track tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isCheckedIn || !currentSession.startTime || !changeInfo.url) return

  logActivity(WEB_ACTIVITY_TYPES.NAVIGATION, {
    url: changeInfo.url,
    title: tab.title,
    tabId
  })
})

// Track tab focus
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!isCheckedIn || !currentSession.startTime) return

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    logActivity(WEB_ACTIVITY_TYPES.FOCUS, {
      url: tab.url,
      title: tab.title,
      tabId: tab.id
    })
  })
})

// Inject content script for activity tracking
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    }).catch(console.error)
  }
})

// Track application usage
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isCheckedIn || !currentSession.startTime) return;

  const tab = await chrome.tabs.get(activeInfo.tabId);
  const url = new URL(tab.url);
  const domain = url.hostname;

  // Update current app
  currentApp = {
    name: domain,
    startTime: Date.now()
  };

  // Log app usage
  logActivity(ACTIVITY_TYPES.APP_USAGE, {
    app: domain,
    title: tab.title
  });

  // Update website stats
  updateWebsiteStats(domain);
});

// Track meetings (integrate with calendar)
async function checkCalendarEvents() {
  if (!isCheckedIn || !currentSession.startTime) return;

  try {
    // Check if user has a meeting now
    const now = new Date();
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      params: {
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 30 * 60000).toISOString(),
        singleEvents: true
      }
    });

    const events = await response.json();
    if (events.items?.length > 0) {
      const currentEvent = events.items[0];
      if (!meetingStartTime) {
        meetingStartTime = Date.now();
        logActivity(ACTIVITY_TYPES.MEETING, {
          title: currentEvent.summary,
          startTime: currentEvent.start.dateTime,
          endTime: currentEvent.end.dateTime
        });
      }
    } else if (meetingStartTime) {
      const duration = Date.now() - meetingStartTime;
      productivityStats.meetingTime += duration;
      meetingStartTime = null;
    }
  } catch (error) {
    console.error('Error checking calendar:', error);
  }
}

// Track breaks
function checkBreakStatus() {
  if (!isCheckedIn || !currentSession.startTime) return;

  const now = Date.now();
  const lastActivity = lastActiveTime;

  if (now - lastActivity > BREAK_THRESHOLD) {
    if (!breakStartTime) {
      breakStartTime = now;
      logActivity(ACTIVITY_TYPES.BREAK, { startTime: new Date(now).toISOString() });
    }
  } else if (breakStartTime) {
    const duration = now - breakStartTime;
    productivityStats.breakTime += duration;
    breakStartTime = null;
    logActivity(ACTIVITY_TYPES.BREAK, {
      endTime: new Date(now).toISOString(),
      duration
    });
  }
}

// Track focus time
function checkFocusStatus() {
  if (!isCheckedIn || !currentSession.startTime) return;

  const now = Date.now();
  const lastActivity = lastActiveTime;

  if (now - lastActivity < FOCUS_THRESHOLD) {
    if (!focusStartTime) {
      focusStartTime = now;
      logActivity(ACTIVITY_TYPES.FOCUS, { startTime: new Date(now).toISOString() });
    }
  } else if (focusStartTime) {
    const duration = now - focusStartTime;
    productivityStats.focusTime += duration;
    focusStartTime = null;
    logActivity(ACTIVITY_TYPES.FOCUS, {
      endTime: new Date(now).toISOString(),
      duration
    });
  }
}

// Update website stats
function updateWebsiteStats(domain) {
  const now = new Date();
  const hour = now.getHours();
  
  // Update activity by hour
  productivityStats.activityByHour[hour].active += 1;

  // Update top websites
  const websiteIndex = productivityStats.topWebsites.findIndex(w => w.domain === domain);
  if (websiteIndex >= 0) {
    productivityStats.topWebsites[websiteIndex].time += 1;
    productivityStats.topWebsites[websiteIndex].visits += 1;
  } else {
    productivityStats.topWebsites.push({
      domain,
      time: 1,
      visits: 1
    });
  }

  // Sort and limit top websites
  productivityStats.topWebsites.sort((a, b) => b.time - a.time);
  productivityStats.topWebsites = productivityStats.topWebsites.slice(0, 10);
}

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'CHECK_IN':
        handleCheckIn(message.data)
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('Check-in error:', error);
            sendResponse({ error: error.message || 'Failed to check in' });
          });
        return true;

      case 'CHECK_OUT':
        handleCheckOut()
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('Check-out error:', error);
            sendResponse({ error: error.message || 'Failed to check out' });
          });
        return true;

      case 'GET_STATUS':
        sendResponse({
          isCheckedIn,
          currentSession: currentSession.startTime ? {
            ...currentSession,
            activeTime: calculateActiveTime()
          } : null,
          lastSync: chrome.storage.local.get('lastSync')
        });
        return true;

      case 'GET_PRODUCTIVITY_STATS':
        const { timeRange } = message.data;
        const stats = getProductivityStats(timeRange);
        sendResponse({ stats });
        return true;

      case 'UPDATE_SETTINGS':
        updateSettings(message.data)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ error: error.message }));
        return true;

      case 'LOG_ACTIVITY':
        logActivity(message.data.type, message.data)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ error: error.message }));
        return true;

      default:
        sendResponse({ error: 'Unknown message type' });
        return true;
    }
  } catch (error) {
    console.error('Message handling error:', error);
    sendResponse({ error: 'Internal error' });
    return true;
  }
});

// Helper functions
function updateLastActiveTime() {
  const now = Date.now();
  if (idleStartTime) {
    currentSession.idleTime += now - idleStartTime;
    idleStartTime = null;
  }
  lastActiveTime = now;
  logActivity('active');
}

function calculateActiveTime() {
  if (!currentSession.startTime) return 0;
  
  const now = Date.now();
  const totalTime = now - new Date(currentSession.startTime).getTime();
  return totalTime - currentSession.idleTime;
}

async function logActivity(type, data) {
  if (!isCheckedIn) return;

  const activity = {
    type,
    ...data,
    timestamp: new Date().toISOString()
  };

  currentSession.activities.push(activity);
  lastActiveTime = Date.now();

  // Sync if it's an important activity
  if (['check_in', 'check_out', 'idle_start', 'idle_end'].includes(type)) {
    await syncActivityData();
  }
}

async function handleCheckIn(data) {
  if (!data || !data.location || !data.deviceInfo) {
    throw new Error('Invalid check-in data');
  }

  if (isCheckedIn) {
    throw new Error('Already checked in');
  }

  // Start new session
  currentSession = {
    startTime: new Date().toISOString(),
    activities: [],
    idleTime: 0,
    activeTime: 0,
    locationHistory: [],
    checkInLocation: data.location,
    deviceInfo: data.deviceInfo,
    flags: []
  };

  isCheckedIn = true;
  lastActiveTime = Date.now();

  try {
    // Save to storage
    await chrome.storage.local.set({
      isCheckedIn: true,
      currentSession,
      lastSync: new Date().toISOString()
    });

    // Start location tracking
    startLocationTracking();

    // Log initial activity
    await logActivity('check_in', {
      location: data.location,
      deviceInfo: data.deviceInfo
    });

    // Sync immediately
    await syncActivityData();
  } catch (error) {
    // Rollback on error
    isCheckedIn = false;
    currentSession = {
      startTime: null,
      activities: [],
      idleTime: 0,
      activeTime: 0,
      locationHistory: [],
      checkInLocation: null,
      deviceInfo: null,
      flags: []
    };
    throw error;
  }
}

async function handleCheckOut() {
  if (!isCheckedIn) {
    throw new Error('Not checked in');
  }

  try {
    // Get current location
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });

    const checkOutData = {
      time: new Date().toISOString(),
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
    };

    // Log check-out activity
    await logActivity('check_out', checkOutData);

    // Stop location tracking
    stopLocationTracking();

    // Sync final data
    await syncActivityData(true);

    // Reset session
    isCheckedIn = false;
    currentSession = {
      startTime: null,
      activities: [],
      idleTime: 0,
      activeTime: 0,
      locationHistory: [],
      checkInLocation: null,
      deviceInfo: null,
      flags: []
    };

    // Clear storage
    await chrome.storage.local.set({
      isCheckedIn: false,
      currentSession: null,
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Check-out error:', error);
    throw new Error(error.message || 'Failed to check out');
  }
}

async function syncActivityData(isCheckOut = false) {
  if (!isCheckedIn || !currentSession.startTime) return;

  try {
    const response = await fetch(`${API_BASE_URL}/attendance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify({
        session: {
          ...currentSession,
          activeTime: calculateActiveTime(),
          isCheckOut
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to sync activity data');
    }

    // Update last sync time
    await chrome.storage.local.set({
      lastSync: new Date().toISOString()
    });

    // Clear synced activities but keep recent ones
    if (!isCheckOut) {
      currentSession.activities = currentSession.activities.slice(-100);
      currentSession.locationHistory = currentSession.locationHistory.slice(-50);
    }
  } catch (error) {
    console.error('Error syncing activity data:', error);
    // Retry on next sync
  }
}

// Get productivity stats for time range
function getProductivityStats(timeRange) {
  const now = new Date();
  let startTime;

  switch (timeRange) {
    case 'today':
      startTime = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startTime = new Date(now.setDate(now.getDate() - now.getDay()));
      break;
    case 'month':
      startTime = new Date(now.setDate(1));
      break;
    default:
      startTime = new Date(now.setHours(0, 0, 0, 0));
  }

  // Filter activities by time range
  const filteredActivities = currentSession.activities.filter(
    activity => new Date(activity.timestamp) >= startTime
  );

  // Calculate stats
  const stats = {
    ...productivityStats,
    activities: filteredActivities
  };

  return stats;
}

// Set up periodic checks
setInterval(() => {
  checkBreakStatus();
  checkFocusStatus();
  checkCalendarEvents();
}, 60000); // Check every minute

let locationWatchId = null;

function startLocationTracking() {
  if (!navigator.geolocation) return;

  locationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      currentSession.locationHistory.push(location);

      // Check for suspicious movement
      if (currentSession.locationHistory.length >= 2) {
        const lastLocation = currentSession.locationHistory[currentSession.locationHistory.length - 2];
        const distance = calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          location.latitude,
          location.longitude
        );
        const timeDiff = (new Date(location.timestamp).getTime() - new Date(lastLocation.timestamp).getTime()) / 1000;
        
        // If moving faster than 30 km/h
        if (distance / timeDiff > 8.33) { // 30 km/h in m/s
          currentSession.flags.push({
            type: 'suspicious_movement',
            timestamp: location.timestamp,
            distance: Math.round(distance),
            speed: Math.round((distance / timeDiff) * 3.6), // Convert to km/h
            severity: 'high'
          });
        }
      }
    },
    (error) => {
      console.error('Location tracking error:', error);
      currentSession.flags.push({
        type: 'location_error',
        timestamp: new Date().toISOString(),
        error: error.message,
        severity: 'medium'
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

async function getAuthToken() {
  const { authToken } = await chrome.storage.local.get('authToken');
  return authToken;
}

async function updateSettings(newSettings) {
  await chrome.storage.local.set({ settings: newSettings });
  
  // Update idle detection interval
  chrome.idle.setDetectionInterval(newSettings.idleThreshold * 60);
  
  // Update sync interval
  chrome.alarms.clear('syncActivity');
  chrome.alarms.create('syncActivity', { periodInMinutes: newSettings.syncInterval });
}

// ... rest of the existing code ... 