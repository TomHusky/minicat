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
  getSettings(): Promise<PetSettings> {
    return ipcRenderer.invoke('agentpet:get-settings');
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
