import type { ActionSpec } from '@/core/types/actions';
import type { GameState } from '@/core/types/combat';

export interface MapNode {
  id: string;
  type: 'Combat' | 'Elite' | 'Event' | 'Shop' | 'Boss' | 'Rest';
  revealed: boolean;
  next: string[];
  x: number;
  y: number;
}

export interface EventOption {
  id: string;
  text: string;
  description: string;
  gains?: string[];
  costs?: string[];
  danger?: 'low' | 'medium' | 'high';
  condition?: (state: GameState) => boolean;
  actions?: ActionSpec[];
}

export interface StoryEventDef {
  id: string;
  title: string;
  loreText: string[];
  imagePath?: string;
  floorMin: number;
  floorMax: number;
  weight?: number;
  options: EventOption[];
}

export interface ActiveEventState {
  id: string;
  offeredRelicId?: string;
  seedRoll?: number;
  stage?: string;
  data?: Record<string, any>;
}

export interface EventListener {
  (event: any): void;
}
