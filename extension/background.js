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

// State management using chrome.storage
let state = {
  isCheckedIn: false,
  lastActiveTime: Date.now(),
  idleStartTime: null,
  currentSession: {
    startTime: null,
    activities: [],
    idleTime: 0,
    activeTime: 0,
    locationHistory: [],
    checkInLocation: null,
    deviceInfo: null,
    flags: []
  },
  currentApp: null,
  breakStartTime: null,
  focusStartTime: null,
  meetingStartTime: null,
  taskStartTime: null,
  productivityStats: {
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
  },
  lastSync: null
};

// Initialize extension state
async function initializeState() {
  try {
    const storedState = await chrome.storage.local.get([
      'isCheckedIn',
      'currentSession',
      'lastSync',
      'lastActiveTime',
      'idleStartTime',
      'currentApp',
      'breakStartTime',
      'focusStartTime',
      'meetingStartTime',
      'taskStartTime',
      'productivityStats'
    ]);

    // Update state from storage
    state = {
      ...state,
      ...storedState,
      currentSession: storedState.currentSession || state.currentSession,
      productivityStats: storedState.productivityStats || state.productivityStats,
      lastSync: storedState.lastSync ? new Date(storedState.lastSync) : null
    };

    // Set up periodic sync
    await chrome.alarms.create('syncActivity', { periodInMinutes: 5 });
    
    // Set up idle detection
    await chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

    // If checked in, ensure tracking is active
    if (state.isCheckedIn && state.currentSession.startTime) {
      startLocationTracking();
      startActivityTracking();
    }

    console.log('Extension state initialized:', { 
      isCheckedIn: state.isCheckedIn, 
      lastSync: state.lastSync?.toISOString() || 'Never'
    });

    // Save initial state
    await saveState();
  } catch (error) {
    console.error('Error initializing extension state:', error);
  }
}

// Save state to storage
async function saveState() {
  try {
    const stateToSave = {
      ...state,
      lastSync: new Date().toISOString()
    };
    await chrome.storage.local.set(stateToSave);
    state.lastSync = new Date();
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncActivity' && state.isCheckedIn) {
    await syncActivityData();
  }
});

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        isCheckedIn: state.isCheckedIn,
        currentSession: state.isCheckedIn ? {
          ...state.currentSession,
          startTime: state.currentSession.startTime ? new Date(state.currentSession.startTime).toISOString() : null,
          endTime: state.currentSession.endTime ? new Date(state.currentSession.endTime).toISOString() : null,
          locationHistory: state.currentSession.locationHistory.map(loc => ({
            ...loc,
            timestamp: new Date(loc.timestamp).toISOString()
          }))
        } : null,
        lastSync: state.lastSync ? state.lastSync.toISOString() : null
      });
      break;
      
    case 'CHECK_IN':
      handleCheckIn(message.data)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'CHECK_OUT':
      handleCheckOut()
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'LOG_ACTIVITY':
      if (!state.isCheckedIn) {
        sendResponse({ error: 'Not checked in' });
        return true;
      }
      logActivity(message.data.type, message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'UPDATE_SETTINGS':
      updateSettings(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    default:
      sendResponse({ error: 'Unknown message type' });
      return true;
  }
});

// Handle idle state
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'idle' && state.isCheckedIn) {
    state.idleStartTime = Date.now();
    await logActivity('idle_start', { timestamp: new Date().toISOString() });
    await saveState();
  } else if (newState === 'active' && state.idleStartTime) {
    const idleDuration = Date.now() - state.idleStartTime;
    state.currentSession.idleTime += idleDuration;
    state.idleStartTime = null;
    await logActivity('idle_end', { 
      timestamp: new Date().toISOString(),
      duration: idleDuration
    });
    await saveState();
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
  if (!state.isCheckedIn || !state.currentSession.startTime) return

  logActivity(WEB_ACTIVITY_TYPES.NAVIGATION, {
    url: details.url,
    title: details.title,
    transitionType: details.transitionType
  })
})

// Track tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!state.isCheckedIn || !state.currentSession.startTime || !changeInfo.url) return

  logActivity(WEB_ACTIVITY_TYPES.NAVIGATION, {
    url: changeInfo.url,
    title: tab.title,
    tabId
  })
})

// Track tab focus
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!state.isCheckedIn || !state.currentSession.startTime) return

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
  if (!state.isCheckedIn || !state.currentSession.startTime) return;

  const tab = await chrome.tabs.get(activeInfo.tabId);
  const url = new URL(tab.url);
  const domain = url.hostname;

  // Update current app
  state.currentApp = {
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
  if (!state.isCheckedIn || !state.currentSession.startTime) return;

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
      if (!state.meetingStartTime) {
        state.meetingStartTime = Date.now();
        logActivity(ACTIVITY_TYPES.MEETING, {
          title: currentEvent.summary,
          startTime: currentEvent.start.dateTime,
          endTime: currentEvent.end.dateTime
        });
      }
    } else if (state.meetingStartTime) {
      const duration = Date.now() - state.meetingStartTime;
      state.productivityStats.meetingTime += duration;
      state.meetingStartTime = null;
    }
  } catch (error) {
    console.error('Error checking calendar:', error);
  }
}

// Track breaks
function checkBreakStatus() {
  if (!state.isCheckedIn || !state.currentSession.startTime) return;

  const now = Date.now();
  const lastActivity = state.lastActiveTime;

  if (now - lastActivity > BREAK_THRESHOLD) {
    if (!state.breakStartTime) {
      state.breakStartTime = now;
      logActivity(ACTIVITY_TYPES.BREAK, { startTime: new Date(now).toISOString() });
    }
  } else if (state.breakStartTime) {
    const duration = now - state.breakStartTime;
    state.productivityStats.breakTime += duration;
    state.breakStartTime = null;
    logActivity(ACTIVITY_TYPES.BREAK, {
      endTime: new Date(now).toISOString(),
      duration
    });
  }
}

// Track focus time
function checkFocusStatus() {
  if (!state.isCheckedIn || !state.currentSession.startTime) return;

  const now = Date.now();
  const lastActivity = state.lastActiveTime;

  if (now - lastActivity < FOCUS_THRESHOLD) {
    if (!state.focusStartTime) {
      state.focusStartTime = now;
      logActivity(ACTIVITY_TYPES.FOCUS, { startTime: new Date(now).toISOString() });
    }
  } else if (state.focusStartTime) {
    const duration = now - state.focusStartTime;
    state.productivityStats.focusTime += duration;
    state.focusStartTime = null;
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
  state.productivityStats.activityByHour[hour].active += 1;

  // Update top websites
  const websiteIndex = state.productivityStats.topWebsites.findIndex(w => w.domain === domain);
  if (websiteIndex >= 0) {
    state.productivityStats.topWebsites[websiteIndex].time += 1;
    state.productivityStats.topWebsites[websiteIndex].visits += 1;
  } else {
    state.productivityStats.topWebsites.push({
      domain,
      time: 1,
      visits: 1
    });
  }

  // Sort and limit top websites
  state.productivityStats.topWebsites.sort((a, b) => b.time - a.time);
  state.productivityStats.topWebsites = state.productivityStats.topWebsites.slice(0, 10);
}

// Helper functions
function updateLastActiveTime() {
  const now = Date.now();
  if (state.idleStartTime) {
    state.currentSession.idleTime += now - state.idleStartTime;
    state.idleStartTime = null;
  }
  state.lastActiveTime = now;
  logActivity('active');
}

function calculateActiveTime() {
  if (!state.currentSession.startTime) return 0;
  
  const now = Date.now();
  const totalTime = now - new Date(state.currentSession.startTime).getTime();
  return totalTime - state.currentSession.idleTime;
}

async function logActivity(type, data) {
  if (!state.isCheckedIn) return;

  const activity = {
    type,
    ...data,
    timestamp: new Date().toISOString()
  };

  state.currentSession.activities.push(activity);
  state.lastActiveTime = Date.now();

  // Sync if it's an important activity
  if (['check_in', 'check_out', 'idle_start', 'idle_end'].includes(type)) {
    await syncActivityData();
  }
}

async function handleCheckIn(data) {
  if (!data || !data.location || !data.deviceInfo) {
    return { error: 'Invalid check-in data' }
  }

  if (state.isCheckedIn) {
    return { error: 'Already checked in' }
  }

  try {
    // Start new session
    state.currentSession = {
      startTime: new Date().toISOString(),
      activities: [],
      idleTime: 0,
      activeTime: 0,
      locationHistory: [{
        ...data.location,
        timestamp: new Date().toISOString()
      }],
      checkInLocation: data.location,
      deviceInfo: data.deviceInfo,
      flags: []
    }

    state.isCheckedIn = true
    state.lastActiveTime = Date.now()
    state.lastSync = new Date()

    // Save to storage
    await saveState()

    // Start location tracking
    startLocationTracking()

    // Log initial activity
    await logActivity('check_in', {
      location: data.location,
      deviceInfo: data.deviceInfo
    })

    // Sync immediately
    await syncActivityData()

    return { success: true }
  } catch (error) {
    // Rollback on error
    state.isCheckedIn = false
    state.currentSession = {
      startTime: null,
      activities: [],
      idleTime: 0,
      activeTime: 0,
      locationHistory: [],
      checkInLocation: null,
      deviceInfo: null,
      flags: []
    }
    state.lastSync = null
    console.error('Check-in error:', error)
    return { error: error.message || 'Failed to check in' }
  }
}

async function handleCheckOut() {
  if (!state.isCheckedIn) {
    return { error: 'Not checked in' }
  }

  try {
    // Stop location tracking
    stopLocationTracking()

    // Update session
    state.currentSession.endTime = new Date().toISOString()
    state.currentSession.activeTime = calculateActiveTime()

    // Save final state
    await saveState()

    // Sync final data
    await syncActivityData(true)

    // Reset state
    state.isCheckedIn = false
    state.currentSession = {
      startTime: null,
      activities: [],
      idleTime: 0,
      activeTime: 0,
      locationHistory: [],
      checkInLocation: null,
      deviceInfo: null,
      flags: []
    }

    return { success: true }
  } catch (error) {
    console.error('Check-out error:', error)
    return { error: error.message || 'Failed to check out' }
  }
}

async function syncActivityData(isCheckOut = false) {
  if (!state.isCheckedIn || !state.currentSession.startTime) return;

  try {
    const response = await fetch(`${API_BASE_URL}/attendance/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify({
        session: {
          ...state.currentSession,
          activeTime: calculateActiveTime(),
          isCheckOut
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to sync activity data');
    }

    // Update last sync time
    await saveState()

    // Clear synced activities but keep recent ones
    if (!isCheckOut) {
      state.currentSession.activities = state.currentSession.activities.slice(-100);
      state.currentSession.locationHistory = state.currentSession.locationHistory.slice(-50);
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
  const filteredActivities = state.currentSession.activities.filter(
    activity => new Date(activity.timestamp) >= startTime
  );

  // Calculate stats
  const stats = {
    ...state.productivityStats,
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

      state.currentSession.locationHistory.push(location);

      // Check for suspicious movement
      if (state.currentSession.locationHistory.length >= 2) {
        const lastLocation = state.currentSession.locationHistory[state.currentSession.locationHistory.length - 2];
        const distance = calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          location.latitude,
          location.longitude
        );
        const timeDiff = (new Date(location.timestamp).getTime() - new Date(lastLocation.timestamp).getTime()) / 1000;
        
        // If moving faster than 30 km/h
        if (distance / timeDiff > 8.33) { // 30 km/h in m/s
          state.currentSession.flags.push({
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
      state.currentSession.flags.push({
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
  await chrome.idle.setDetectionInterval(newSettings.idleThreshold * 60);
  
  // Update sync interval
  await chrome.alarms.clear('syncActivity');
  await chrome.alarms.create('syncActivity', { periodInMinutes: newSettings.syncInterval });
}

// ... rest of the existing code ... 