// Consent Management System
class ConsentManager {
  constructor() {
    this.consentTypes = {
      WEBSITE_TRACKING: 'website_tracking',
      LOCATION_TRACKING: 'location_tracking', 
      KEYBOARD_MONITORING: 'keyboard_monitoring',
      PRODUCTIVITY_ANALYTICS: 'productivity_analytics',
      SYSTEM_ACTIVITY: 'system_activity'
    };
    
    this.consentStatus = {};
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Load existing consent status
    const stored = await chrome.storage.local.get('userConsent');
    this.consentStatus = stored.userConsent || {};
    
    // Check if we need to request consent
    await this.checkConsentRequired();
    
    this.initialized = true;
  }

  async checkConsentRequired() {
    const hasRequiredConsent = Object.values(this.consentTypes).every(
      type => this.consentStatus[type] !== undefined
    );
    
    if (!hasRequiredConsent) {
      await this.requestConsent();
    }
  }

  async requestConsent() {
    return new Promise((resolve) => {
      // Create consent modal
      const modal = this.createConsentModal();
      document.body.appendChild(modal);
      
      // Handle consent responses
      modal.addEventListener('click', async (e) => {
        if (e.target.id === 'consent-accept-all') {
          await this.grantAllConsent();
          modal.remove();
          resolve(true);
        } else if (e.target.id === 'consent-customize') {
          await this.showDetailedConsent();
          modal.remove();
          resolve(true);
        } else if (e.target.id === 'consent-deny') {
          await this.denyAllConsent();
          modal.remove();
          resolve(false);
        }
      });
    });
  }

  createConsentModal() {
    const modal = document.createElement('div');
    modal.id = 'consent-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    modal.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <h2 style="margin: 0 0 20px 0; color: #1a1a1a;">Data Collection Consent</h2>
        <p style="margin: 0 0 15px 0; color: #666; line-height: 1.5;">
          KaystoneHR Attendance Extension needs your permission to track your work activity. This includes:
        </p>
        <ul style="margin: 0 0 20px 0; color: #666; padding-left: 20px;">
          <li>Website activity and time tracking</li>
          <li>Location monitoring for attendance verification</li>
          <li>Keyboard and mouse activity monitoring</li>
          <li>Productivity analytics and reporting</li>
        </ul>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
          <strong>Your privacy matters:</strong> All data is encrypted and only shared with authorized HR personnel.
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="consent-deny" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 6px; cursor: pointer;">
            Deny
          </button>
          <button id="consent-customize" style="padding: 8px 16px; border: 1px solid #666; background: white; border-radius: 6px; cursor: pointer;">
            Customize
          </button>
          <button id="consent-accept-all" style="padding: 8px 16px; border: none; background: #000; color: white; border-radius: 6px; cursor: pointer;">
            Accept All
          </button>
        </div>
      </div>
    `;
    
    return modal;
  }

  async showDetailedConsent() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.id = 'detailed-consent-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      
      modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; max-height: 80vh; overflow-y: auto;">
          <h2 style="margin: 0 0 20px 0;">Customize Data Collection</h2>
          
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px;">
              <input type="checkbox" id="consent-website" style="margin-right: 10px;">
              <strong>Website Activity Tracking</strong>
            </label>
            <p style="margin: 0 0 10px 25px; color: #666; font-size: 14px;">
              Track time spent on websites, clicks, scrolls, and page navigation for productivity analysis.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px;">
              <input type="checkbox" id="consent-location" style="margin-right: 10px;">
              <strong>Location Tracking</strong>
            </label>
            <p style="margin: 0 0 10px 25px; color: #666; font-size: 14px;">
              Monitor your location to verify attendance and detect suspicious movement patterns.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px;">
              <input type="checkbox" id="consent-keyboard" style="margin-right: 10px;">
              <strong>Keyboard & Mouse Monitoring</strong>
            </label>
            <p style="margin: 0 0 10px 25px; color: #666; font-size: 14px;">
              Track keyboard and mouse activity to measure active work time and detect idle periods.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px;">
              <input type="checkbox" id="consent-productivity" style="margin-right: 10px;">
              <strong>Productivity Analytics</strong>
            </label>
            <p style="margin: 0 0 10px 25px; color: #666; font-size: 14px;">
              Analyze your work patterns to provide productivity insights and recommendations.
            </p>
          </div>
          
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
            <button id="detailed-consent-save" style="padding: 8px 16px; border: none; background: #000; color: white; border-radius: 6px; cursor: pointer;">
              Save Preferences
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Handle detailed consent
      modal.querySelector('#detailed-consent-save').addEventListener('click', async () => {
        this.consentStatus = {
          [this.consentTypes.WEBSITE_TRACKING]: modal.querySelector('#consent-website').checked,
          [this.consentTypes.LOCATION_TRACKING]: modal.querySelector('#consent-location').checked,
          [this.consentTypes.KEYBOARD_MONITORING]: modal.querySelector('#consent-keyboard').checked,
          [this.consentTypes.PRODUCTIVITY_ANALYTICS]: modal.querySelector('#consent-productivity').checked,
          [this.consentTypes.SYSTEM_ACTIVITY]: modal.querySelector('#consent-keyboard').checked
        };
        
        await this.saveConsent();
        modal.remove();
        resolve(true);
      });
    });
  }

  async grantAllConsent() {
    this.consentStatus = Object.values(this.consentTypes).reduce((acc, type) => {
      acc[type] = true;
      return acc;
    }, {});
    
    await this.saveConsent();
  }

  async denyAllConsent() {
    this.consentStatus = Object.values(this.consentTypes).reduce((acc, type) => {
      acc[type] = false;
      return acc;
    }, {});
    
    await this.saveConsent();
  }

  async saveConsent() {
    await chrome.storage.local.set({ 
      userConsent: this.consentStatus,
      consentTimestamp: Date.now()
    });
  }

  hasConsent(consentType) {
    return this.consentStatus[consentType] === true;
  }

  async revokeConsent(consentType) {
    this.consentStatus[consentType] = false;
    await this.saveConsent();
  }

  async getConsentStatus() {
    return { ...this.consentStatus };
  }
}

// Export the consent manager
const consentManager = new ConsentManager();

// Helper functions for checking consent
async function checkConsentForWebsiteTracking() {
  await consentManager.initialize();
  return consentManager.hasConsent(consentManager.consentTypes.WEBSITE_TRACKING);
}

async function checkConsentForLocationTracking() {
  await consentManager.initialize();
  return consentManager.hasConsent(consentManager.consentTypes.LOCATION_TRACKING);
}

async function checkConsentForKeyboardMonitoring() {
  await consentManager.initialize();
  return consentManager.hasConsent(consentManager.consentTypes.KEYBOARD_MONITORING);
}

async function checkConsentForProductivityAnalytics() {
  await consentManager.initialize();
  return consentManager.hasConsent(consentManager.consentTypes.PRODUCTIVITY_ANALYTICS);
} 