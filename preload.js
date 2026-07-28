const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sketchAPI', {
  saveAndCopy: (pngBuffer) => ipcRenderer.invoke('save-and-copy', pngBuffer),
  copyAndSave: (pngBuffer) => ipcRenderer.invoke('copy-and-save', pngBuffer),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  clipboardFormats: () => ipcRenderer.invoke('clipboard-formats'),
  importImage: () => ipcRenderer.invoke('import-image'),
  onMenu: (channel, handler) => {
    const map = {
      'save-copy': 'menu-save-copy',
      'copy-save': 'menu-copy-save',
      paste: 'menu-paste',
      import: 'menu-import',
      undo: 'menu-undo',
      redo: 'menu-redo',
      clear: 'menu-clear',
      delete: 'menu-delete',
      reset: 'app-reset',
      'open-image': 'open-image',
    };
    const ipcChannel = map[channel];
    if (!ipcChannel) return;
    ipcRenderer.on(ipcChannel, handler);
  },
});
