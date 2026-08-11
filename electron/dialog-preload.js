const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the dialog
contextBridge.exposeInMainWorld('dialogAPI', {
  // Update working hours
  updateWorkingHours: (start, end) => {
    ipcRenderer.send('dialog-working-hours-update', { start, end });
  }
});

