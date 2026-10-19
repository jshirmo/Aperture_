export type FeedbackMethod = 'both' | 'audio' | 'haptic';
export type TextSize = 'standard' | 'large' | 'xl';
export type ContrastTheme = 'high-contrast-dark' | 'high-contrast-light';

export interface UserSettings {
  feedbackMethod: FeedbackMethod;
  speechRate: number; // 0.8 to 1.3
  theme: ContrastTheme;
  textSize: TextSize;
  autoContinuousGuidance: boolean;
  hapticIntensity: 'high' | 'medium' | 'low';
  soundEffects: boolean;
  hasCompletedOnboarding: boolean;
}

export interface SavedItem {
  id: string;
  name: string;
  category: string;
  room: string;
  locationDescription: string;
  lastSeenDate: string;
  capturedImage?: string; // base64 or sample data URL
  notes?: string;
  distinctiveFeatures: string[];
  confidence?: number;
}

export interface SavedEnvironment {
  id: string;
  name: string;
  baselineImage: string; // base64 or sample data URL
  baselineDate: string;
  notes?: string;
  walkwayClear: boolean;
}

export interface FindResult {
  targetDetected: boolean;
  targetName: string;
  direction: string; // e.g. "12 o'clock", "2 o'clock", "directly ahead"
  distance: string; // e.g. "approx 7 feet"
  actionInstruction: string;
  confidence: number;
  isCentered: boolean;
  isImmediateObstacle: boolean;
  obstacleWarning?: string | null;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DifferenceItem {
  item: string;
  changeType: 'moved' | 'new_obstacle' | 'removed' | 'opened_door' | string;
  location: string;
  isTripHazard: boolean;
  description: string;
}

export interface WhatChangedResult {
  hasChanges: boolean;
  safetyScore: 'clear' | 'caution' | 'hazard' | string;
  spokenSummary: string;
  unchangedAreaSummary?: string;
  differences: DifferenceItem[];
}

export interface IntentParseResult {
  action: 'FIND' | 'RECALL_LOCATION' | 'REMEMBER' | 'WHAT_CHANGED' | 'HELP_MODES';
  target?: string;
  transcript?: string;
  matchedSavedItemId?: string;
  environmentName?: string;
  spokenFeedback: string;
  confidence?: number;
}

export type ChatRolePreset = 'copilot' | 'identifier' | 'safety' | 'memory';

export interface ChatToolAction {
  type: 'find_guidance' | 'identified_object' | 'hazard_alert' | 'recalled_item';
  target?: string;
  direction?: string;
  distance?: string;
  isCentered?: boolean;
  features?: string[];
  category?: string;
  room?: string;
  hazardWarning?: string;
  savedItemId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  imageBase64?: string;
  toolAction?: ChatToolAction;
  isAudioPlaying?: boolean;
}

export type InspectMode = 'scene' | 'what_changed' | 'text' | 'hazards';

export interface InspectSceneResult {
  sceneSummary: string;
  primaryObject?: string;
  textDetected?: string;
  hazards?: string[];
  changesDetected?: string[];
  spokenGuidance: string;
  confidence: number;
  mode?: InspectMode;
}
export type AppView = 'home' | 'find' | 'read' | 'inspect';

export interface ReadTextResult {
  overview: string;
  fullText: string;
  headline?: string;
  category?: 'label' | 'sign' | 'document' | 'nutrition' | 'prescription' | 'other';
  confidence: number;
  spokenText: string;
  hasText?: boolean;
  timestamp: number;
}
