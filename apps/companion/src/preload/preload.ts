import { contextBridge, ipcRenderer } from 'electron';
import type { PetNotification, PetSettings } from '@agentpet/protocol';

contextBridge.exposeInMainWorld('agentpet', {
  onNotify(listener: (notification: PetNotification) => void) {
    const wrapped = (_event: unknown, payload: PetNotification) => listener(payload);
    ipcRenderer.on('agentpet:notify', wrapped);
    return () => ipcRenderer.removeListener('agentpet:notify', wrapped);
  },
  onSettingsChanged(listener: (settings: PetSettings) => void) {
    const wrapped = (_event: unknown, payload: PetSettings) => listener(payload);
    ipcRenderer.on('agentpet:settings-changed', wrapped);
    return () => ipcRenderer.removeListener('agentpet:settings-changed', wrapped);
  },
  onUserActivityChanged(listener: (active: boolean) => void) {
    const wrapped = (_event: unknown, payload: boolean) => listener(payload);
    ipcRenderer.on('agentpet:user-activity-changed', wrapped);
    return () => ipcRenderer.removeListener('agentpet:user-activity-changed', wrapped);
  },
  getSettings(): Promise<PetSettings> {
    return ipcRenderer.invoke('agentpet:get-settings');
  },
  getUserActivity(): Promise<boolean> {
    return ipcRenderer.invoke('agentpet:get-user-activity');
  },
  saveSettings(settings: PetSettings): Promise<void> {
    return ipcRenderer.invoke('agentpet:save-settings', settings);
  },
  closeSettings(): void {
    ipcRenderer.send('agentpet:close-settings');
  },
  isSettingsWindow(): boolean {
    return window.location.hash === '#settings';
  },
});
