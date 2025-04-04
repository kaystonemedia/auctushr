// DOM Elements
const enableTrackingEl = document.getElementById('enableTracking');
const idleThresholdEl = document.getElementById('idleThreshold');
const syncIntervalEl = document.getElementById('syncInterval');
const collectUrlsEl = document.getElementById('collectUrls');
const collectTitlesEl = document.getElementById('collectTitles');
const retentionPeriodEl = document.getElementById('retentionPeriod');
const newDomainEl = document.getElementById('newDomain');
const addDomainBtn = document.getElementById('addDomain');
const domainListEl = document.getElementById('domainList');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');

// Default settings
const defaultSettings = {
  trackingEnabled: true,
  idleThreshold: 5,
  syncInterval: 5,
  collectUrls: false,
  collectTitles: true,
  retentionPeriod: 30,
  productiveDomains: []
};

// Initialize options page
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  const { userSettings } = await chrome.storage.sync.get('userSettings');
  const settings = { ...defaultSettings, ...userSettings };

  // Apply settings to form
  enableTrackingEl.checked = settings.trackingEnabled;
  idleThresholdEl.value = settings.idleThreshold;
  syncIntervalEl.value = settings.syncInterval;
  collectUrlsEl.checked = settings.collectUrls;
  collectTitlesEl.checked = settings.collectTitles;
  retentionPeriodEl.value = settings.retentionPeriod;

  // Render productive domains
  renderDomainList(settings.productiveDomains);
});

// Event Listeners
addDomainBtn.addEventListener('click', () => {
  const domain = newDomainEl.value.trim().toLowerCase();
  if (!domain) return;

  chrome.storage.sync.get('userSettings', ({ userSettings }) => {
    const settings = { ...defaultSettings, ...userSettings };
    if (!settings.productiveDomains.includes(domain)) {
      settings.productiveDomains.push(domain);
      chrome.storage.sync.set({ userSettings: settings });
      renderDomainList(settings.productiveDomains);
      newDomainEl.value = '';
    }
  });
});

saveBtn.addEventListener('click', async () => {
  const settings = {
    trackingEnabled: enableTrackingEl.checked,
    idleThreshold: parseInt(idleThresholdEl.value),
    syncInterval: parseInt(syncIntervalEl.value),
    collectUrls: collectUrlsEl.checked,
    collectTitles: collectTitlesEl.checked,
    retentionPeriod: parseInt(retentionPeriodEl.value)
  };

  // Get current productive domains
  const { userSettings } = await chrome.storage.sync.get('userSettings');
  settings.productiveDomains = userSettings?.productiveDomains || [];

  // Save settings
  await chrome.storage.sync.set({ userSettings: settings });

  // Notify background script
  chrome.runtime.sendMessage({ 
    type: 'updateSettings', 
    settings 
  });

  // Show success message
  showMessage('Settings saved successfully!');
});

resetBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    await chrome.storage.sync.set({ userSettings: defaultSettings });
    chrome.runtime.sendMessage({ 
      type: 'updateSettings', 
      settings: defaultSettings 
    });
    location.reload();
  }
});

// Helper Functions
function renderDomainList(domains) {
  domainListEl.innerHTML = domains.map(domain => `
    <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
      <span>${domain}</span>
      <button 
        class="text-red-600 hover:text-red-700"
        onclick="removeDomain('${domain}')"
      >
        Remove
      </button>
    </div>
  `).join('');
}

function removeDomain(domain) {
  chrome.storage.sync.get('userSettings', ({ userSettings }) => {
    const settings = { ...defaultSettings, ...userSettings };
    settings.productiveDomains = settings.productiveDomains.filter(d => d !== domain);
    chrome.storage.sync.set({ userSettings: settings });
    renderDomainList(settings.productiveDomains);
  });
}

function showMessage(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
} 