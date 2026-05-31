export type AppView = 'dashboard' | 'chat' | 'failsafe';

export type CategoryChip = 'trauma' | 'police' | 'towing' | 'puncture';

export interface CategoryInfo {
  id: CategoryChip;
  label: string;
  icon: string;
}

export interface MedicalInfo {
  bloodType: string;
  emergencyContact: string;
  allergies: string;
  medications: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'trauma', label: 'Trauma Center', icon: '🏥' },
  { id: 'police', label: 'Police', icon: '👮' },
  { id: 'towing', label: 'Towing', icon: '🛻' },
  { id: 'puncture', label: 'Puncture Shop', icon: '🔧' },
];

export const DEFAULT_MEDICAL: MedicalInfo = {
  bloodType: 'O-',
  emergencyContact: '+1 (555) 000-0000',
  allergies: 'None on file',
  medications: 'None on file',
};

export const SOS_MORSE = [
  { dot: true, duration: 200 },  // S
  { dot: true, duration: 200 },
  { dot: true, duration: 200 },
  { gap: true, duration: 400 },   // letter gap
  { dash: true, duration: 600 },  // O
  { dash: true, duration: 600 },
  { dash: true, duration: 600 },
  { gap: true, duration: 400 },
  { dot: true, duration: 200 },  // S
  { dot: true, duration: 200 },
  { dot: true, duration: 200 },
  { gap: true, duration: 800 },   // word gap
];

// Dispatch types for emergency alerting
export type DispatchService = 'trauma' | 'ambulance';
export type DispatchStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface DispatchEntry {
  service: DispatchService;
  label: string;
  icon: string;
  status: DispatchStatus;
  timestamp?: number;
}

export const DEFAULT_DISPATCH_SERVICES: DispatchEntry[] = [
  { service: 'trauma', label: 'Trauma Center', icon: '🏥', status: 'pending' },
  { service: 'ambulance', label: 'Ambulance', icon: '🚑', status: 'pending' },
];
