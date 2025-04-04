import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBYTSC2E_nqaUHISZ6ntU8kpG1JjN-Y8Cg",
  authDomain: "kaystonemedia-c0f7c.firebaseapp.com",
  projectId: "kaystonemedia-c0f7c",
  storageBucket: "kaystonemedia-c0f7c.firebasestorage.app",
  messagingSenderId: "464022249810",
  appId: "1:464022249810:web:2abccbb6dd77915ea3da8b",
  measurementId: "G-6JTQHHHWM4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
  departmentId: null
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

// Update current activity
function updateCurrentActivity(tab) {
  const now = new Date();
  
  // If there's an existing activity, save it first
  if (currentActivity.startTime) {
    const duration = now - currentActivity.startTime;
    saveActivity(duration);
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
    departmentId: currentActivity.departmentId
  };

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
      timestamp: new Date()
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

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
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
      break;
  }
}); 