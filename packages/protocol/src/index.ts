export type AnimalType = 'cat' | 'lobster';

export interface PetSettings {
  animal: AnimalType;
  name: string;
  copilotListenerEnabled: boolean;
}

export interface PetNotification {
  phase: 'started' | 'progress' | 'completed' | 'failed' | 'idle';
  title: string;
  detail?: string;
  agentName?: string;
}
