import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  auth: {
    startOAuth: (provider: string) => ipcRenderer.invoke('auth:start', provider),
    signOut: () => ipcRenderer.invoke('auth:signout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
  },
});
