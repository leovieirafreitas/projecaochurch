const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveProject: (data) => ipcRenderer.invoke('save-project', data),
    openProject: () => ipcRenderer.invoke('open-project'),
    openProjectsFolder: () => ipcRenderer.invoke('open-projects-folder'),
    ensureProjectsDir: () => ipcRenderer.invoke('ensure-projects-dir'),
    loadFromFile: (path) => ipcRenderer.invoke('load-from-file', path),
    // Helper to check if we are in Electron
    isElectron: true
});
