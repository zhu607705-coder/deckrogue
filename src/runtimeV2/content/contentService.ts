import cardsData from '@/content/data/cards.json';
import charactersData from '@/content/data/characters.json';
import enemiesData from '@/content/data/enemies.json';
import potionsData from '@/content/data/potions.json';
import relicsData from '@/content/data/relics.json';

export interface CardData {
  id: string;
  name: string;
  rarity: string;
  cost: number;
  type: string;
  targeting?: string;
  tags?: string[];
  text?: string;
  actions?: Array<{
    type: string;
    amount?: number;
    target?: string;
    [key: string]: unknown;
  }>;
  art_prompt?: string;
  upgrade?: {
    name?: string;
    text?: string;
    actions?: Array<{
      type: string;
      amount?: number;
      target?: string;
      [key: string]: unknown;
    }>;
  };
  character?: string;
}

export interface CharacterData {
  id: string;
  name: string;
  maxHp: number;
  maxEnergy: number;
  startingDeck: string[];
  extendedPool?: string[];
  specialResource?: string;
  description?: string;
  complexity?: 'low' | 'medium' | 'high';
  archetype?: string[];
  starting_gold?: number;
  portraitPrompt?: string;
  secondaryResource?: string;
  rewardWeights?: Record<string, unknown>;
}

export interface EnemyData {
  id: string;
  name: string;
  hp_range: [number, number];
  keywords: string[];
  intent_policy?: Array<{
    intent: string;
    weight: number;
  }>;
  description?: string;
}

export interface RelicData {
  id: string;
  name: string;
  rarity: string;
  description?: string;
  flavor_text?: string;
  effects?: Array<{
    type: string;
    [key: string]: unknown;
  }>;
}

export interface ContentBundle {
  version: string;
  cards: CardData[];
  characters: CharacterData[];
  enemies: EnemyData[];
  relics: RelicData[];
  potions?: Array<{
    id: string;
    name: string;
    description?: string;
    price?: number;
    rarity?: string;
  }>;
}

class ContentService {
  private cards: Map<string, CardData>;
  private characters: Map<string, CharacterData>;
  private enemies: Map<string, EnemyData>;
  private relics: Map<string, RelicData>;
  private potions: Map<string, { id: string; name: string; description?: string; price?: number; rarity?: string }>;

  constructor(bundle?: ContentBundle) {
    this.cards = new Map((bundle?.cards ?? cardsData as CardData[]).map(c => [c.id, c]));
    this.characters = new Map((bundle?.characters ?? charactersData as CharacterData[]).map(c => [c.id, c]));
    this.enemies = new Map((bundle?.enemies ?? enemiesData as EnemyData[]).map(e => [e.id, e]));
    this.relics = new Map((bundle?.relics ?? relicsData as RelicData[]).map(r => [r.id, r]));
    this.potions = new Map((bundle?.potions ?? potionsData as Array<{ id: string; name: string; description?: string; price?: number; rarity?: string }>).map(p => [p.id, p]));
  }

  getCard(id: string): CardData | undefined {
    return this.cards.get(id);
  }

  getCharacter(id: string): CharacterData | undefined {
    return this.characters.get(id);
  }

  getEnemy(id: string): EnemyData | undefined {
    return this.enemies.get(id);
  }

  getRelic(id: string): RelicData | undefined {
    return this.relics.get(id);
  }

  getPotion(id: string): { id: string; name: string; description?: string; price?: number; rarity?: string } | undefined {
    return this.potions.get(id);
  }

  getAllCards(): CardData[] {
    return Array.from(this.cards.values());
  }

  getAllCharacters(): CharacterData[] {
    return Array.from(this.characters.values());
  }

  getCardsByCharacter(characterId: string): CardData[] {
    return this.getAllCards().filter(c => c.character === characterId || c.character === 'All');
  }

  getCardsByRarity(rarity: string): CardData[] {
    return this.getAllCards().filter(c => c.rarity === rarity);
  }
}

let globalContentService: ContentService | null = null;

export function getContentService(): ContentService {
  if (!globalContentService) {
    globalContentService = new ContentService();
  }
  return globalContentService;
}

export function resetContentService(): void {
  globalContentService = null;
}

export { ContentService };
