'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  close: () => ipcRenderer.send('popup:selfClose'),
  solve: (answer) => ipcRenderer.send('popup:selfSolve', { answer }),
  onTerminalUpdate: (cb) => {
    ipcRenderer.on('terminal:update', (_event, data) => cb(data));
  },
});
