// content.js
// This script will be injected into all pages to display notification overlays for the user.

// Listen for messages from the background script to display notifications
let timerOverlay = null;
let timerInterval = null;
let timerStartTime = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'showNotification' && request.notification) {
    showNotificationOverlay(request.notification);
  }
  if (request.type === 'startTimerOverlay' && request.startTime) {
    startTimerOverlay(request.startTime);
  }
  if (request.type === 'stopTimerOverlay') {
    stopTimerOverlay();
  }
});

function showNotificationOverlay(notification) {
  // Remove any existing overlay
  const existing = document.getElementById('chrome-ext-notification-overlay');
  if (existing) existing.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'chrome-ext-notification-overlay';
  overlay.style.position = 'fixed';
  overlay.style.bottom = '32px';
  overlay.style.right = '32px';
  overlay.style.zIndex = '999999';
  overlay.style.background = 'rgba(34, 197, 94, 0.95)';
  overlay.style.color = '#fff';
  overlay.style.padding = '16px 24px';
  overlay.style.borderRadius = '8px';
  overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  overlay.style.fontSize = '16px';
  overlay.style.maxWidth = '350px';
  overlay.style.transition = 'opacity 0.3s';
  overlay.style.opacity = '1';

  overlay.innerHTML = `
    <strong>${notification.type ? notification.type.toUpperCase() : 'NOTIFICATION'}</strong><br/>
    <span>${notification.message}</span>
  `;

  document.body.appendChild(overlay);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }, 5000);
}

function startTimerOverlay(startTime) {
  stopTimerOverlay(); // Remove any existing overlay
  timerStartTime = new Date(startTime);

  timerOverlay = document.createElement('div');
  timerOverlay.id = 'chrome-ext-timer-overlay';
  timerOverlay.style.position = 'fixed';
  timerOverlay.style.top = '32px';
  timerOverlay.style.right = '32px';
  timerOverlay.style.zIndex = '999999';
  timerOverlay.style.background = 'rgba(31, 41, 55, 0.95)';
  timerOverlay.style.color = '#fff';
  timerOverlay.style.padding = '12px 20px';
  timerOverlay.style.borderRadius = '8px';
  timerOverlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  timerOverlay.style.fontSize = '18px';
  timerOverlay.style.cursor = 'move';
  timerOverlay.style.userSelect = 'none';
  timerOverlay.style.display = 'flex';
  timerOverlay.style.alignItems = 'center';
  timerOverlay.style.gap = '12px';

  // Timer text
  const timerText = document.createElement('span');
  timerText.id = 'chrome-ext-timer-text';
  timerOverlay.appendChild(timerText);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontSize = '20px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = stopTimerOverlay;
  timerOverlay.appendChild(closeBtn);

  document.body.appendChild(timerOverlay);

  // Drag functionality
  let isDragging = false, offsetX = 0, offsetY = 0;
  timerOverlay.onmousedown = function(e) {
    isDragging = true;
    offsetX = e.clientX - timerOverlay.getBoundingClientRect().left;
    offsetY = e.clientY - timerOverlay.getBoundingClientRect().top;
    document.onmousemove = function(e) {
      if (isDragging) {
        timerOverlay.style.top = (e.clientY - offsetY) + 'px';
        timerOverlay.style.right = '';
        timerOverlay.style.left = (e.clientX - offsetX) + 'px';
      }
    };
    document.onmouseup = function() {
      isDragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };

  // Timer update
  function updateTimer() {
    const now = new Date();
    const elapsed = Math.floor((now - timerStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    timerText.textContent = `Session: ${hours.toString().padStart(2, '0')}:${minutes
      .toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimerOverlay() {
  if (timerOverlay) {
    timerOverlay.remove();
    timerOverlay = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerStartTime = null;
}

// Use safeSendMessage instead of chrome.runtime.sendMessage to avoid errors in non-extension contexts.
function safeSendMessage(message, callback) {
  if (window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
    chrome.runtime.sendMessage(message, callback);
  } else {
    console.warn('chrome.runtime.sendMessage is not available in this context.');
  }
} 