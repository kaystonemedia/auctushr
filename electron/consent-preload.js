const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the consent dialog
contextBridge.exposeInMainWorld('consentAPI', {
  // Send consent response
  consentResponse: (settings) => {
    ipcRenderer.send('consent-dialog-response', settings);
  }
});


