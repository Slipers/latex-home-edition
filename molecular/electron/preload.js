/* Pont sécurisé entre la page et le système (fichiers, export, mises à jour) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lmcDesktop', {
  open: () => ipcRenderer.invoke('lmc:open'),
  save: opts => ipcRenderer.invoke('lmc:save', opts),
  exportFile: (name, bytes) => ipcRenderer.invoke('lmc:export', { name, bytes }),
  pendingFile: () => ipcRenderer.invoke('lmc:pending'),
  version: () => ipcRenderer.invoke('lmc:version'),
  checkUpdates: () => ipcRenderer.invoke('lmc:check-updates'),
  onUpdate: cb => ipcRenderer.on('lmc:update', (e, info) => cb(info)),
  onOpenFile: cb => ipcRenderer.on('lmc:open-file', (e, f) => cb(f)),
});
