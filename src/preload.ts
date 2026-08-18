import { contextBridge, ipcRenderer } from 'electron';
import type { CreateEventRequest, FeedbackType } from './types';

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
    correlate: () => ipcRenderer.invoke('sync:correlate'),
    runAll: () => ipcRenderer.invoke('sync:runAll'),
  },
  brief: {
    generate: (date: string) => ipcRenderer.invoke('brief:generate', date),
    getLatest: () => ipcRenderer.invoke('brief:getLatest'),
  },
  feedback: {
    submit: (briefItemId: number, type: FeedbackType) => ipcRenderer.invoke('feedback:submit', briefItemId, type),
  },
  calendar: {
    createEvent: (details: CreateEventRequest) => ipcRenderer.invoke('calendar:createEvent', details),
  },
});
