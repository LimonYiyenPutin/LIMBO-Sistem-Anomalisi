'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('limboOS', {
  isDesktop: true,
  platform: process.platform,
  spawnPopup: (opts) => ipcRenderer.invoke('popup:spawn', opts),
  closePopup: (id) => ipcRenderer.invoke('popup:close', id),
  closeAllPopups: () => ipcRenderer.invoke('popup:closeAll'),
  popupCount: () => ipcRenderer.invoke('popup:count'),
  onPopupClosed: (cb) => on('popup:closed', cb),
  onPopupCount: (cb) => on('popup:count', cb),
  onPopupSolved: (cb) => on('popup:solved', cb),

  openTerminal: (opts) => ipcRenderer.invoke('terminal:open', opts),
  updateTerminal: (opts) => ipcRenderer.invoke('terminal:update', opts),
  closeTerminal: () => ipcRenderer.invoke('terminal:close'),
  onTerminalClosed: (cb) => on('terminal:closed', cb),

  sandboxPrepare: (files) => ipcRenderer.invoke('sandbox:prepare', files),
  sandboxStatus: (names) => ipcRenderer.invoke('sandbox:status', names),
  sandboxClear: (names) => ipcRenderer.invoke('sandbox:clear', names),
  sandboxList: () => ipcRenderer.invoke('sandbox:list'),
  sandboxPath: () => ipcRenderer.invoke('sandbox:path'),
  openSandbox: (fileName) => ipcRenderer.invoke('sandbox:open', fileName),

  metaInfo: () => ipcRenderer.invoke('meta:info'),
  metaState: () => ipcRenderer.invoke('meta:state'),
  checkReset: () => ipcRenderer.invoke('meta:checkReset'),
  resetMeta: () => ipcRenderer.invoke('meta:reset'),
  finalizeMeta: (payload) => ipcRenderer.invoke('meta:finalize', payload),
  rootAnomalyStatus: () => ipcRenderer.invoke('meta:rootAnomalyStatus'),
  rootAnomalyPrepare: (content) => ipcRenderer.invoke('meta:rootAnomalyPrepare', content),
  rootAnomalyOpen: () => ipcRenderer.invoke('meta:rootAnomalyOpen'),
  openResetHelper: () => ipcRenderer.invoke('meta:openResetHelper'),
  spill: (payload) => ipcRenderer.invoke('meta:spill', payload),
  spillCleanup: () => ipcRenderer.invoke('meta:spillCleanup'),
  wallpaperGlitch: () => ipcRenderer.invoke('meta:wallpaper'),
  wallpaperRestore: () => ipcRenderer.invoke('meta:wallpaperRestore'),

  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  closeWindow: () => ipcRenderer.invoke('win:close'),
  setFullscreen: (value) => ipcRenderer.invoke('win:fullscreen', value),
  quit: () => ipcRenderer.invoke('app:quit'),
  appInfo: () => ipcRenderer.invoke('app:platform'),
  devCapture: (name) => ipcRenderer.invoke('dev:capture', name),
});
