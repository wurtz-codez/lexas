import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  auth: {
    startOAuth: (provider: string) => ipcRenderer.invoke('auth:start', provider),
    signOut: () => ipcRenderer.invoke('auth:signout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
  },
  onboarding: {
    save: (data: unknown) => ipcRenderer.invoke('onboarding:save', data),
    setCompleted: () => ipcRenderer.invoke('onboarding:setCompleted'),
    getStatus: () => ipcRenderer.invoke('onboarding:getStatus'),
  },
  sync: {
    gmail: () => ipcRenderer.invoke('sync:gmail'),
    calendar: () => ipcRenderer.invoke('sync:calendar'),
  },
  brief: {
    generate: (date: string) => ipcRenderer.invoke('brief:generate', date),
  },
});
