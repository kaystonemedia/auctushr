// Track user interactions
const TRACKING_INTERVAL = 1000; // 1 second
let lastScrollPosition = window.scrollY;
let lastActivityTime = Date.now();
let activityTimeout = null;
let isInitialized = false;

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize content script
async function initialize() {
  try {
    // Check if extension is ready
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    isInitialized = true;
    console.log('Content script initialized:', response);
  } catch (error) {
    console.error('Failed to initialize content script:', error);
    // Retry initialization after a delay
    setTimeout(initialize, 1000);
  }
}

// Send activity to background script
async function sendActivity(type, data = {}) {
  if (!isInitialized) {
    console.log('Content script not initialized, queuing activity:', type);
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'LOG_ACTIVITY',
      data: {
        type,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        ...data
      }
    });
  } catch (error) {
    console.error('Error sending activity:', error);
    // If we get a connection error, try to reinitialize
    if (error.message.includes('Receiving end does not exist')) {
      isInitialized = false;
      initialize();
    }
  }
}

// Track clicks
document.addEventListener('click', debounce((event) => {
  const target = event.target;
  sendActivity('click', {
    target: {
      tagName: target.tagName,
      id: target.id,
      className: target.className,
      text: target.textContent?.slice(0, 100)
    }
  });
}, 250));

// Track scrolling
window.addEventListener('scroll', debounce(() => {
  const currentScroll = window.scrollY;
  const scrollDelta = Math.abs(currentScroll - lastScrollPosition);
  
  if (scrollDelta > 50) { // Only track significant scrolls
    sendActivity('scroll', {
      delta: scrollDelta,
      position: currentScroll
    });
    lastScrollPosition = currentScroll;
  }
}, 250));

// Track input
document.addEventListener('input', debounce((event) => {
  const target = event.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    sendActivity('input', {
      target: {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        type: target.type
      }
    });
  }
}, 250));

// Track focus/blur
document.addEventListener('focusin', (event) => {
  const target = event.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    sendActivity('focus', {
      target: {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        type: target.type
      }
    });
  }
}, true);

document.addEventListener('focusout', (event) => {
  const target = event.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    sendActivity('blur', {
      target: {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        type: target.type
      }
    });
  }
}, true);

// Track visibility changes
document.addEventListener('visibilitychange', () => {
  sendActivity('visibility', {
    state: document.visibilityState
  });
});

// Track mouse movement (with throttling)
let mouseMoveTimeout;
document.addEventListener('mousemove', () => {
  if (mouseMoveTimeout) return;
  
  mouseMoveTimeout = setTimeout(() => {
    sendActivity('mouse_move', {
      timestamp: new Date().toISOString()
    });
    mouseMoveTimeout = null;
  }, 1000);
});

// Track keyboard activity (with throttling)
let keyPressTimeout;
document.addEventListener('keydown', () => {
  if (keyPressTimeout) return;
  
  keyPressTimeout = setTimeout(() => {
    sendActivity('keyboard', {
      timestamp: new Date().toISOString()
    });
    keyPressTimeout = null;
  }, 1000);
});

// Initialize when the script loads
initialize();

// Send initial page load activity
sendActivity('page_load', {
  url: window.location.href,
  title: document.title,
  referrer: document.referrer
}); 