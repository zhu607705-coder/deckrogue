import {
  localCardArt,
  localCharacterArt,
  localEnemyArt,
  localEventArt,
  localShopArt,
} from '@/content/assets/standeeArt';

export type TuanjieModelKind = 'card' | 'character' | 'enemy' | 'event' | 'shop' | 'relic' | 'environment';
export type TuanjieModelFormat = 'tuanjie-2d-prefab' | 'unity-prefab' | 'glb' | 'gltf' | 'fbx';
export type TuanjieModelStatus = 'placeholder' | 'ready' | 'blocked';

export interface TuanjieModelEntry {
  modelId: string;
  sourceId: string;
  kind: TuanjieModelKind;
  format: TuanjieModelFormat;
  status: TuanjieModelStatus;
  sourceArt: string;
  previewArt: string;
  fallbackArt: string;
  tuanjieProjectHint: string;
  notes?: string;
}

const TUANJIE_PROJECT_ROOT = 'My deckrogue/Assets/DeckRogue';
const MODEL_FORMAT: TuanjieModelFormat = 'tuanjie-2d-prefab';
const MODEL_STATUS: TuanjieModelStatus = 'placeholder';

const CHARACTER_IDS = [
  'informant',
  'brute',
  'tactician',
  'puppeteer',
  'chronomancer',
  'alchemist',
  'penitent_judge',
  'void_sanctioner',
] as const;

const CARD_IDS = [
  'strike',
  'defend',
  'gather_intel',
  'crushing_blow',
  'fortify_position',
  'glass_marionette',
  'borrow_tomorrow',
  'alchemical_mix',
  'judgement_cut',
  'seal_the_sin',
] as const;

const ENEMY_IDS = [
  'goblin',
  'cultist',
  'jaw_worm',
  'gremlin_nob',
  'slime_boss',
  'hexaghost',
  'time_guardian',
  'the_mire_saint',
] as const;

const EVENT_IDS = [
  'event_martyr_shrine',
  'event_rusting_medicae',
  'npc_inquisitor_interrogator',
  'npc_medicae_servitor',
  'npc_shrine_warden',
  'npc_warp_oracle',
] as const;

const SHOP_IDS = [
  'shop_merchant_salvager',
  'shop_salvage_exchange',
] as const;

function entry(
  kind: TuanjieModelKind,
  sourceId: string,
  art: string,
  folder: string,
  fallbackArt = art,
): TuanjieModelEntry {
  return {
    modelId: `${kind}_${sourceId}`,
    sourceId,
    kind,
    format: MODEL_FORMAT,
    status: MODEL_STATUS,
    sourceArt: art,
    previewArt: art,
    fallbackArt,
    tuanjieProjectHint: `${TUANJIE_PROJECT_ROOT}/${folder}/${sourceId}/`,
    notes: 'Placeholder contract for Tuanjie 2D prefab modeling based on existing DeckRogue runtime art.',
  };
}

export const TUANJIE_MODEL_MANIFEST = [
  ...CHARACTER_IDS.map((id) => entry('character', id, localCharacterArt(id), 'Characters')),
  ...CARD_IDS.map((id) => entry('card', id, localCardArt(id), 'Cards', localCardArt('strike'))),
  ...ENEMY_IDS.map((id) => entry('enemy', id, localEnemyArt(id), 'Enemies', localEnemyArt('goblin'))),
  ...EVENT_IDS.map((id) => entry('event', id, localEventArt(id), 'Events')),
  ...SHOP_IDS.map((id) => entry('shop', id, localShopArt(id), 'Shops')),
] as const satisfies readonly TuanjieModelEntry[];

export function listTuanjieModelEntries(kind?: TuanjieModelKind): TuanjieModelEntry[] {
  return TUANJIE_MODEL_MANIFEST.filter((entry) => !kind || entry.kind === kind);
}

export function getTuanjieModelEntry(modelId: string): TuanjieModelEntry | undefined {
  return TUANJIE_MODEL_MANIFEST.find((entry) => entry.modelId === modelId);
}

export function getTuanjieModelForSource(kind: TuanjieModelKind, sourceId: string): TuanjieModelEntry | undefined {
  return TUANJIE_MODEL_MANIFEST.find((entry) => entry.kind === kind && entry.sourceId === sourceId);
}

export function resolveTuanjiePreviewArt(kind: TuanjieModelKind, sourceId: string): string {
  const entry = getTuanjieModelForSource(kind, sourceId);
  if (entry) return entry.previewArt;

  if (kind === 'card') return localCardArt(sourceId);
  if (kind === 'character') return localCharacterArt(sourceId);
  if (kind === 'enemy') return localEnemyArt(sourceId);
  if (kind === 'event') return localEventArt(sourceId);
  if (kind === 'shop') return localShopArt(sourceId);
  return localCardArt('strike');
}
