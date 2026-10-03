'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = name => (...args) => ipcRenderer.invoke('edit:' + name, ...args);
contextBridge.exposeInMainWorld('reproEdit', {
  state: invoke('state'), choosePhotoshop: invoke('photoshop'), open: invoke('open'), folder: invoke('folder'),
  exportFile: invoke('export'), upload: invoke('upload'), auto: invoke('auto'), retry: invoke('retry'),
  dashboard: invoke('dashboard'), quit: invoke('quit'),
  changed: handler => { const listener = () => handler(); ipcRenderer.on('editing-state', listener); return () => ipcRenderer.removeListener('editing-state', listener); },
});
