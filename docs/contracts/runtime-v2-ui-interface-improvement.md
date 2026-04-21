# Runtime V2 与 UI 接口改进方案

## 当前问题分析

### 1. 数据结构问题
- **RenderModel 设计过于耦合**：直接暴露了 `RuleSnapshot` 的大部分字段，UI 与规则内核耦合度高
- **数据层次不清晰**：UI 数据与规则数据混合在一起，职责不明确
- **类型定义不完整**：缺乏对 UI 特定数据的详细类型定义

### 2. 数据转换问题
- **硬编码逻辑**：`deriveRewardCards` 等方法硬编码了卡牌属性
- **数据获取方式**：没有从实际的卡牌数据中获取信息
- **房间数据生成**：房间数据的生成逻辑简单，缺乏动态内容

### 3. 事件处理问题
- **事件结构简单**：`RuleEvent` 结构过于通用，缺乏具体的事件类型
- **事件传递机制**：缺少明确的事件订阅和处理机制
- **UI 事件反馈**：缺乏从 UI 到内核的事件反馈机制

### 4. 性能问题
- **全量重建**：每次状态变化都重新生成整个 `RenderModel`
- **无增量更新**：缺乏增量更新机制，造成性能浪费
- **数据冗余**：存在数据冗余，增加了传输和处理成本

### 5. 扩展性问题
- **接口设计僵化**：难以添加新的游戏元素和功能
- **模块化不足**：缺乏模块化设计，难以维护和扩展
- **向后兼容性**：缺乏明确的版本管理和向后兼容策略

## 改进方案

### 1. 数据结构改进

#### 1.1 分层数据结构

**核心原则**：分离规则数据与 UI 数据，建立清晰的分层结构

```typescript
// 规则内核层
interface RuleSnapshot {
  // 现有字段...
}

// UI 适配层
interface UIModel {
  screen: string;
  player: UIPlayerModel;
  map: UIMapModel;
  room: UIRoomModel;
  combat: UICombatModel | null;
  reward: UIRewardModel | null;
  activeEvent: UIEventModel | null;
  notifications: UINotification[];
}

// 具体 UI 模型
interface UIPlayerModel {
  characterId: string | null;
  hp: number;
  maxHp: number;
  gold: number;
  intel: number;
  devotion: number;
  corruption: number;
  deckCount: number;
  relicCount: number;
  potionCount: number;
  healthRatio: number;
  statusEffects: UIStatusEffect[];
}

interface UIMapModel {
  currentNodeId: string | null;
  currentFloor: number | null;
  nodes: UIMapNode[];
  revealedNodeIds: string[];
  availableNodeIds: string[];
  pathProgress: number;
}

interface UIRoomModel {
  kind: RoomKind;
  title: string;
  body: string;
  choices: UIRoomChoice[];
  metadata: Record<string, any>;
}

interface UIRewardModel {
  cards: UICard[];
  gold: number;
  relics: UIItem[];
  potions: UIItem[];
  source: string;
}

interface UICombatModel {
  turn: number;
  isPlayerTurn: boolean;
  player: UICombatPlayer;
  enemies: UICombatEnemy[];
  hand: UICard[];
  drawPileCount: number;
  discardPileCount: number;
  effects: UICombatEffect[];
}
```

#### 1.2 类型系统增强

**核心原则**：提供详细、明确的类型定义，减少运行时错误

```typescript
type RoomKind = 'shop' | 'rest' | 'reward' | 'event' | 'combat' | 'character_select' | 'launcher';

type CardType = 'Attack' | 'Skill' | 'Power' | 'Curse' | 'Status';

type CardRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

type CharacterId = 'informant' | 'alchemist' | 'soldier' | 'mage' | 'thief';

type EnemyId = string;

type RelicId = string;

type PotionId = string;

interface UICard {
  id: string;
  name: string;
  cost: number;
  rarity: CardRarity;
  type: CardType;
  description: string;
  flavorText?: string;
  imageUrl?: string;
  isUpgraded?: boolean;
  effects: CardEffect[];
}

interface UIStatusEffect {
  id: string;
  name: string;
  description: string;
  stacks: number;
  duration: number;
  icon: string;
}
```

### 2. 数据转换改进

#### 2.1 数据转换层

**核心原则**：建立专门的数据转换层，处理从规则数据到 UI 数据的映射

```typescript
// 数据转换服务
class UIModelConverter {
  constructor(private contentService: ContentService) {}

  convert(snapshot: RuleSnapshot): UIModel {
    return {
      screen: snapshot.lifecycle.screen,
      player: this.convertPlayer(snapshot),
      map: this.convertMap(snapshot),
      room: this.convertRoom(snapshot),
      combat: snapshot.combat ? this.convertCombat(snapshot) : null,
      reward: snapshot.reward ? this.convertReward(snapshot) : null,
      activeEvent: snapshot.activeEvent ? this.convertEvent(snapshot) : null,
      notifications: this.generateNotifications(snapshot),
    };
  }

  private convertPlayer(snapshot: RuleSnapshot): UIPlayerModel {
    // 从内容服务获取角色数据
    const characterData = this.contentService.getCharacter(snapshot.player.characterId);
    return {
      characterId: snapshot.player.characterId,
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      gold: snapshot.player.gold,
      intel: snapshot.player.intel,
      devotion: snapshot.player.devotion,
      corruption: snapshot.player.corruption,
      deckCount: snapshot.player.deck.length,
      relicCount: snapshot.player.relicIds.length,
      potionCount: snapshot.player.potionIds.length,
      healthRatio: snapshot.player.maxHp > 0 ? snapshot.player.hp / snapshot.player.maxHp : 0,
      statusEffects: this.convertStatusEffects(snapshot),
    };
  }

  private convertReward(snapshot: RuleSnapshot): UIRewardModel {
    const cards = snapshot.reward.cardIds.map(cardId => {
      const cardData = this.contentService.getCard(cardId);
      return {
        id: cardId,
        name: cardData?.name || cardId.replace(/_/g, ' '),
        cost: cardData?.cost || 1,
        rarity: cardData?.rarity || 'Common',
        type: cardData?.type || 'Attack',
        description: cardData?.description || `Card: ${cardId}`,
        flavorText: cardData?.flavorText,
        imageUrl: cardData?.imageUrl,
        isUpgraded: false,
        effects: cardData?.effects || [],
      };
    });

    return {
      cards,
      gold: 0, // 从规则数据中获取
      relics: [], // 从规则数据中获取
      potions: [], // 从规则数据中获取
      source: snapshot.reward.source,
    };
  }

  // 其他转换方法...
}
```

#### 2.2 内容服务

**核心原则**：建立专门的内容服务，提供统一的内容数据访问

```typescript
class ContentService {
  private characters: Map<string, CharacterData>;
  private cards: Map<string, CardData>;
  private enemies: Map<string, EnemyData>;
  private relics: Map<string, RelicData>;
  private potions: Map<string, PotionData>;

  constructor(contentBundle: ContentBundle) {
    this.characters = new Map(contentBundle.characters.map(c => [c.id, c]));
    this.cards = new Map(contentBundle.cards.map(c => [c.id, c]));
    this.enemies = new Map(contentBundle.enemies.map(e => [e.id, e]));
    // 初始化其他内容...
  }

  getCharacter(id: string): CharacterData | undefined {
    return this.characters.get(id);
  }

  getCard(id: string): CardData | undefined {
    return this.cards.get(id);
  }

  // 其他获取方法...
}
```

### 3. 事件系统改进

#### 3.1 结构化事件系统

**核心原则**：建立结构化的事件系统，支持不同类型的事件

```typescript
type EventType =
  | 'combat.start'
  | 'combat.end'
  | 'combat.turn.start'
  | 'combat.turn.end'
  | 'combat.damage.dealt'
  | 'combat.damage.received'
  | 'combat.enemy.death'
  | 'combat.player.death'
  | 'reward.offered'
  | 'reward.taken'
  | 'reward.skipped'
  | 'map.node.entered'
  | 'map.node.revealed'
  | 'player.stat.changed'
  | 'player.deck.changed'
  | 'player.relic.acquired'
  | 'player.potion.acquired'
  | 'error'
  | 'warning';

interface UIEvent {
  type: EventType;
  timestamp: number;
  payload: any;
  metadata?: Record<string, any>;
}

interface CombatDamageEvent {
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  sourceId?: string;
  targetId?: string;
  amount: number;
  block: number;
  finalDamage: number;
  type: 'physical' | 'magical' | 'true';
}

interface RewardOfferedEvent {
  cards: string[];
  gold: number;
  relics: string[];
  potions: string[];
  source: string;
}
```

#### 3.2 事件订阅机制

**核心原则**：提供灵活的事件订阅和处理机制

```typescript
class EventBus {
  private listeners: Map<EventType, Array<(event: UIEvent) => void>>;

  constructor() {
    this.listeners = new Map();
  }

  subscribe(type: EventType, listener: (event: UIEvent) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);

    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        this.listeners.set(type, typeListeners.filter(l => l !== listener));
      }
    };
  }

  publish(type: EventType, payload: any, metadata?: Record<string, any>): void {
    const event: UIEvent = {
      type,
      timestamp: Date.now(),
      payload,
      metadata,
    };

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }

    // 全局监听器
    const allListeners = this.listeners.get('*' as EventType);
    if (allListeners) {
      allListeners.forEach(listener => listener(event));
    }
  }
}
```

### 4. 性能优化

#### 4.1 增量更新机制

**核心原则**：实现增量更新，只更新变化的部分

```typescript
class UIModelManager {
  private currentModel: UIModel;
  private converter: UIModelConverter;
  private eventBus: EventBus;

  constructor(converter: UIModelConverter, eventBus: EventBus) {
    this.converter = converter;
    this.eventBus = eventBus;
    this.currentModel = this.createInitialModel();
  }

  update(snapshot: RuleSnapshot): UIModel {
    const newModel = this.converter.convert(snapshot);
    const changes = this.detectChanges(this.currentModel, newModel);

    if (changes.length > 0) {
      this.currentModel = newModel;
      this.publishChangeEvents(changes);
    }

    return this.currentModel;
  }

  private detectChanges(oldModel: UIModel, newModel: UIModel): Change[] {
    const changes: Change[] = [];

    // 检测屏幕变化
    if (oldModel.screen !== newModel.screen) {
      changes.push({ type: 'screen', path: 'screen', oldValue: oldModel.screen, newValue: newModel.screen });
    }

    // 检测玩家数据变化
    if (JSON.stringify(oldModel.player) !== JSON.stringify(newModel.player)) {
      changes.push({ type: 'player', path: 'player', oldValue: oldModel.player, newValue: newModel.player });
    }

    // 检测其他变化...

    return changes;
  }

  private publishChangeEvents(changes: Change[]): void {
    changes.forEach(change => {
      this.eventBus.publish('ui.model.changed' as EventType, {
        change,
        timestamp: Date.now(),
      });
    });
  }

  private createInitialModel(): UIModel {
    // 创建初始模型
  }
}
```

#### 4.2 缓存机制

**核心原则**：实现缓存机制，减少重复计算

```typescript
class UIModelCache {
  private cache: Map<string, UIModel>;
  private cacheKeys: string[];
  private maxCacheSize: number;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.cacheKeys = [];
    this.maxCacheSize = maxSize;
  }

  get(key: string): UIModel | undefined {
    return this.cache.get(key);
  }

  set(key: string, model: UIModel): void {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cacheKeys.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, model);
    this.cacheKeys.push(key);
  }

  clear(): void {
    this.cache.clear();
    this.cacheKeys = [];
  }

  generateKey(snapshot: RuleSnapshot): string {
    // 生成缓存键
    return JSON.stringify({
      screen: snapshot.lifecycle.screen,
      player: snapshot.player,
      map: snapshot.map.currentNodeId,
      combat: snapshot.combat ? snapshot.combat.turn : null,
      reward: snapshot.reward ? snapshot.reward.cardIds : null,
    });
  }
}
```

### 5. 扩展性改进

#### 5.1 模块化设计

**核心原则**：采用模块化设计，便于扩展和维护

```typescript
// 核心模块
class UISystem {
  private converter: UIModelConverter;
  private eventBus: EventBus;
  private modelManager: UIModelManager;
  private cache: UIModelCache;

  constructor(contentBundle: ContentBundle) {
    const contentService = new ContentService(contentBundle);
    this.converter = new UIModelConverter(contentService);
    this.eventBus = new EventBus();
    this.modelManager = new UIModelManager(this.converter, this.eventBus);
    this.cache = new UIModelCache();
  }

  update(snapshot: RuleSnapshot): UIModel {
    const cacheKey = this.cache.generateKey(snapshot);
    const cachedModel = this.cache.get(cacheKey);

    if (cachedModel) {
      return cachedModel;
    }

    const model = this.modelManager.update(snapshot);
    this.cache.set(cacheKey, model);
    return model;
  }

  subscribe(type: EventType, listener: (event: UIEvent) => void): () => void {
    return this.eventBus.subscribe(type, listener);
  }

  publish(type: EventType, payload: any, metadata?: Record<string, any>): void {
    this.eventBus.publish(type, payload, metadata);
  }
}

// 插件系统
interface UIPlugin {
  name: string;
  version: string;
  initialize(system: UISystem): void;
  cleanup(): void;
}

class PluginManager {
  private plugins: Map<string, UIPlugin>;

  constructor() {
    this.plugins = new Map();
  }

  register(plugin: UIPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  initialize(system: UISystem): void {
    this.plugins.forEach(plugin => plugin.initialize(system));
  }

  cleanup(): void {
    this.plugins.forEach(plugin => plugin.cleanup());
  }
}
```

#### 5.2 版本管理

**核心原则**：实现版本管理，确保向后兼容性

```typescript
interface UIModelVersion {
  major: number;
  minor: number;
  patch: number;
}

class VersionManager {
  private currentVersion: UIModelVersion;
  private migrations: Map<string, (model: any) => any>;

  constructor() {
    this.currentVersion = { major: 1, minor: 0, patch: 0 };
    this.migrations = new Map();
    this.registerMigrations();
  }

  getCurrentVersion(): UIModelVersion {
    return this.currentVersion;
  }

  migrate(model: any, fromVersion: UIModelVersion): any {
    const versionKey = `${fromVersion.major}.${fromVersion.minor}.${fromVersion.patch}`;
    const migration = this.migrations.get(versionKey);

    if (migration) {
      return migration(model);
    }

    return model;
  }

  private registerMigrations(): void {
    // 注册迁移函数
    this.migrations.set('0.1.0', (model) => {
      // 从 0.1.0 迁移到 1.0.0
      return {
        ...model,
        version: { major: 1, minor: 0, patch: 0 },
        // 其他迁移逻辑
      };
    });
  }
}
```

### 6. 错误处理改进

#### 6.1 错误处理机制

**核心原则**：建立完善的错误处理机制，提高系统稳定性

```typescript
class ErrorHandler {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  handleError(error: Error, context?: string): void {
    console.error(`[UI System Error] ${context || 'Unknown'}:`, error);

    this.eventBus.publish('error' as EventType, {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    });
  }

  handleWarning(message: string, context?: string): void {
    console.warn(`[UI System Warning] ${context || 'Unknown'}:`, message);

    this.eventBus.publish('warning' as EventType, {
      message,
      context,
      timestamp: Date.now(),
    });
  }

  validateModel(model: UIModel): ValidationResult {
    const errors: string[] = [];

    // 验证模型
    if (!model.screen) {
      errors.push('Screen is required');
    }

    if (!model.player) {
      errors.push('Player data is required');
    }

    // 其他验证...

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## 实施计划

### 阶段 1：核心架构改进
1. 设计并实现新的分层数据结构
2. 建立数据转换层和内容服务
3. 实现结构化事件系统

### 阶段 2：性能优化
1. 实现增量更新机制
2. 添加缓存系统
3. 优化数据转换逻辑

### 阶段 3：扩展性改进
1. 实现模块化设计
2. 添加插件系统
3. 实现版本管理

### 阶段 4：错误处理
1. 实现错误处理机制
2. 添加模型验证
3. 完善错误反馈

### 阶段 5：集成与测试
1. 集成到现有系统
2. 编写单元测试
3. 进行性能测试
4. 收集用户反馈

## 预期收益

1. **代码质量提升**：更清晰、更模块化的代码结构
2. **性能优化**：减少不必要的计算和渲染
3. **扩展性增强**：更容易添加新功能和游戏元素
4. **可维护性提高**：更易于理解和维护的代码
5. **用户体验改善**：更流畅、更响应的 UI
6. **错误处理改进**：更稳定、更可靠的系统

## 风险评估

1. **兼容性风险**：需要确保向后兼容现有代码
2. **性能风险**：新系统可能引入性能问题
3. **实现复杂度**：新架构可能增加实现复杂度
4. **测试覆盖**：需要充分测试新功能

## 结论

通过实施这些改进，Runtime V2 与 UI 之间的接口将变得更加清晰、高效和可扩展。这将为游戏的长期发展奠定坚实的基础，同时提高开发效率和用户体验。