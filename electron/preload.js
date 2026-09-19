/* Pont sécurisé entre la page et le système (fichiers, PDF, mises à jour) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lheDesktop', {
  open: () => ipcRenderer.invoke('lhe:open'),
  save: opts => ipcRenderer.invoke('lhe:save', opts),
  pendingFile: () => ipcRenderer.invoke('lhe:pending'),
  exportPdf: name => ipcRenderer.invoke('lhe:pdf', { name }),
  exportFile: (name, bytes) => ipcRenderer.invoke('lhe:export', { name, bytes }),
  version: () => ipcRenderer.invoke('lhe:version'),
  checkUpdates: () => ipcRenderer.invoke('lhe:check-updates'),
  onUpdate: cb => ipcRenderer.on('lhe:update', (e, info) => cb(info)),
  onOpenFile: cb => ipcRenderer.on('lhe:open-file', (e, f) => cb(f)),
});
