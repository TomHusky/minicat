export type AnimalType = 'cat' | 'dog' | 'lobster' | 'penguin' | 'panda';

export interface PetSettings {
  animal: AnimalType;
  name: string;
}

export interface PetNotification {
  phase: 'started' | 'progress' | 'completed' | 'failed';
  title: string;
  detail?: string;
  agentName?: string;
}
