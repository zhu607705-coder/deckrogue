# `src/engine/engine.ts` 系统性审查报告

**审查日期**: 2026-02-25  
**审查范围**: engine.ts + 全战斗链路依赖  
**审查方法**: 静态代码分析 + 跨文件契约检查

---

## 1. 审查范围与方法

### 主审文件
- `src/engine/engine.ts` (1163 行)

### 扩展链路文件
- `src/engine/combatSystem.ts`
- `src/engine/relicSystem.ts`
- `src/engine/targetingService.ts`
- `src/engine/actionManager.ts`
- `src/engine/actionQueue.ts`
- `src/engine/actions/v2/ActionFactory.ts`
- `src/engine/actions/v2/DamageActions.ts`
- `src/engine/actions/v2/SpecialActions.ts`
- `src/engine/types.ts`

---

## 2. 整体架构评估

### 2.1 engine.ts 职责分布图

| 区域 | 行号 | 职责 | 方法数 | 复杂度 |
|------|------|------|--------|--------|
| 初始化与状态管理 | 28-99 | 构造、状态创建、事件订阅 | 4 | 低 |
| 角色选择 | 100-133 | selectCharacter, startGame | 2 | 低 |
| 地图导航 | 134-169 | moveToNode | 1 | 中 |
| 战斗系统 | 170-332 | startCombat, 敌人生成, 回合管理 | 8 | 高 |
| 卡牌出牌 | 407-448 | playCard | 1 | 中 |
| 敌人回合 | 450-527 | endTurn, executeEnemyTurn | 3 | 高 |
| 事件处理 | 529-606 | handleEnemyDefeated, handleCombatVictory | 4 | 中 |
| 奖励系统 | 648-669, 817-835 | generateCardRewards, takeReward | 3 | 低 |
| 事件系统 | 671-705 | startEvent, makeEventChoice | 2 | 低 |
| 商店系统 | 707-774 | enterShop, buyCard, buyRelic, buyPotion, removeCard | 5 | 中 |
| 休息系统 | 776-815 | restHeal, restUpgrade, upgradeCard | 3 | 中 |
| 存档系统 | 843-860 | getSaveData, loadSaveData | 2 | 低 |
| **UI 兼容层** | 862-1162 | enterNode, revealNode, resolveEventChoice, 等 | 20+ | **高** |

### 2.2 架构问题总结

**核心问题**: `GameEngine` 类职责严重超载，承担了至少 8 个独立模块的职责：
1. 游戏状态管理
2. 战斗控制器
3. 奖励服务
4. 商店服务
5. 事件服务
6. 存档服务
7. UI 兼容层
8. 工具函数集合

---

## 3. Findings（按严重度排序）

---

### P0 - 确定性缺陷

#### Finding P0-1: 商店升级路径重复扣费

**Severity**: P0  
**Location**: `src/engine/engine.ts:907-924`  
**What**: `enterUpgrade()` 方法在商店路径下会扣除 50 金币，但 `upgradeCard()` 完成后返回商店时没有退回机制，且 `cancelUpgrade()` 也不会退回费用。

```typescript
// engine.ts:907-924
enterUpgrade(returnScreen?: 'Rest' | 'Shop'): void {
  if (this.state.screen === 'Rest') {
    if (this.state.campfireChoiceLocked) return;
    this.state.campfireChoiceLocked = true;
  }
  // ...
  if (this.state.screen === 'Shop') {
    if (this.state.player.gold < 50) return;
    this.state.player.gold -= 50;  // 扣费
  }
  this.state.screen = 'Upgrade';
}
```

**Why**: 
- 扣费逻辑在 `enterUpgrade` 中执行
- `cancelUpgrade()` 直接返回原屏幕，不退费
- `upgradeCard()` 完成后也不退费
- 玩家取消升级会永久损失 50 金币

**Impact**: 
- 玩家经济损失
- 游戏体验严重受损
- 可能导致无法购买关键物品

**Fix**: 
```typescript
// 方案 A: 在 cancelUpgrade 中退费
cancelUpgrade(): void {
  if (this.state.upgradeReturnScreen === 'Shop') {
    this.state.player.gold += 50;  // 退费
  }
  // ... 其余逻辑
}

// 方案 B: 改为预扣费模式
enterUpgrade(): void {
  // 不扣费，只标记
  this.state.pendingUpgradeCost = this.state.screen === 'Shop' ? 50 : 0;
}

upgradeCard(): void {
  if (this.state.pendingUpgradeCost) {
    this.state.player.gold -= this.state.pendingUpgradeCost;
    this.state.pendingUpgradeCost = 0;
  }
  // ... 其余逻辑
}
```

**Confidence**: High  
**Validation**: 单元测试 - 商店进入升级 -> 取消 -> 验证金币不变

---

#### Finding P0-2: 状态双写不一致风险

**Severity**: P0  
**Location**: 
- `src/engine/engine.ts:550` (handleCombatVictory)
- `src/engine/engine.ts:1047, 1069` (usePotion)
- `src/engine/engine.ts:181-198` (startCombat)

**What**: `state.player` 和 `state.combat.player` 存在多处双写，但同步逻辑不一致。

```typescript
// handleCombatVictory (L550)
this.state.player.hp = combat.player.hp;  // 只同步 hp

// usePotion (L1047, L1069)
combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + ...);
this.state.player.hp = combat.player.hp;  // 手动同步

// startCombat (L181-198)
// combat.player 从 state.player 初始化，但后续变化不同步
```

**Why**: 
- `combat.player` 是战斗期间的独立状态副本
- 只有在特定位置手动同步回 `state.player`
- 遗漏同步会导致战斗结束后状态丢失

**Impact**: 
- 状态不一致
- 存档/读档后状态错误
- 难以追踪的 bug

**Fix**: 
```typescript
// 方案 A: 统一同步函数
private syncPlayerState(): void {
  if (!this.state.combat) return;
  this.state.player.hp = this.state.combat.player.hp;
  this.state.player.maxHp = this.state.combat.player.maxHp;
  this.state.player.intel = this.state.combat.player.intel;
}

// 方案 B: 使用 getter/setter 代理
get player(): PlayerState {
  return this.state.combat?.player ?? this.state.player;
}
```

**Confidence**: High  
**Validation**: 集成测试 - 战斗中使用药水 -> 战斗结束 -> 验证状态一致

---

### P1 - 核心功能错误

#### Finding P1-1: 事件总线重复订阅

**Severity**: P1  
**Location**: `src/engine/engine.ts:72-87`

**What**: `setupEventListeners()` 在构造函数中调用，但 `EnemyDefeated` 和 `EnemyDeath` 事件都调用同一个处理函数。

```typescript
globalEventBus.subscribe('EnemyDefeated', (event: any) => {
  this.handleEnemyDefeated(event.enemyId);
});
globalEventBus.subscribe('EnemyDeath', (event: any) => {
  this.handleEnemyDefeated(event.enemyId);  // 同一个处理函数
});
```

**Why**: 
- 两个事件名可能代表同一语义
- 如果两个事件都被发布，`handleEnemyDefeated` 会被调用两次
- 可能导致重复的奖励计算

**Impact**: 
- 重复处理敌人死亡
- 奖励/指标统计错误

**Fix**: 
```typescript
// 确定使用哪个事件名，移除重复订阅
globalEventBus.subscribe('EnemyDeath', (event: any) => {
  this.handleEnemyDefeated(event.enemyId);
});
```

**Confidence**: Medium (需确认事件发布点)  
**Validation**: 搜索 `EnemyDefeated` 和 `EnemyDeath` 的发布点

---

#### Finding P1-2: 遗物触发器类型断言绕过

**Severity**: P1  
**Location**: `src/engine/engine.ts:214-220, 367-373, 518-524`

**What**: 遗物系统触发使用 `(relicSystem as any).trigger` 绕过类型检查。

```typescript
(relicSystem as any).trigger?.('CombatStart', this.state, (actionOrSpec: any, ctx: IActionContext) => {
  if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
    this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
  } else {
    this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
  }
});
```

**Why**: 
- `relicSystem` 类型定义可能不包含 `trigger` 方法
- 使用 `as any` 绕过编译检查
- 运行时可能为 undefined

**Impact**: 
- 类型安全丧失
- 运行时错误风险
- 重构困难

**Fix**: 
```typescript
// 在 relicSystem.ts 中导出类型安全的接口
export interface RelicSystemInterface {
  trigger(eventType: string, state: GameState, enqueue: ActionEnqueueFn): void;
}

// 或使用可选链 + 类型守卫
if (relicSystem.trigger) {
  relicSystem.trigger('CombatStart', this.state, enqueue);
}
```

**Confidence**: High  
**Validation**: TypeScript 编译检查

---

#### Finding P1-3: 延迟卡触发时目标丢失

**Severity**: P1  
**Location**: `src/engine/engine.ts:608-646`

**What**: `tickDelayedCards()` 触发延迟卡时，`targetId` 可能为已死亡的敌人。

```typescript
for (const delayed of ready) {
  // ...
  this.actionManager.enqueueUrgent(
    spec,
    {
      source: 'player',
      sourceId: 'player',
      targetId: delayed.targetId,  // 可能已死亡
      // ...
    },
    'system'
  );
}
```

**Why**: 
- 延迟卡存储时记录了 `targetId`
- 多回合后目标可能已死亡
- 没有目标验证逻辑

**Impact**: 
- 动作执行失败
- 无效目标错误

**Fix**: 
```typescript
// 触发前验证目标
if (delayed.targetId) {
  const target = combat.enemies.find(e => e.id === delayed.targetId && e.hp > 0);
  if (!target) {
    // 选择新目标或跳过
    continue;
  }
}
```

**Confidence**: High  
**Validation**: 测试 - 延迟卡目标死亡后的行为

---

### P2 - 边界条件缺陷

#### Finding P2-1: 抽牌堆为空且弃牌堆为空时的处理

**Severity**: P2  
**Location**: `src/engine/engine.ts:387-405`

**What**: 当抽牌堆和弃牌堆都为空时，`drawCards` 会静默返回，没有日志或事件。

```typescript
if (combat.drawPile.length === 0) {
  if (combat.discardPile.length === 0) break;  // 静默返回
  combat.drawPile = this.shuffleDeck(combat.discardPile);
  combat.discardPile = [];
}
```

**Why**: 
- 极端情况下（牌组被全部消耗/移除）可能发生
- 没有任何提示，难以调试

**Impact**: 
- 调试困难
- 玩家困惑

**Fix**: 
```typescript
if (combat.drawPile.length === 0) {
  if (combat.discardPile.length === 0) {
    console.warn('Draw pile and discard pile both empty');
    break;
  }
  // ...
}
```

**Confidence**: Medium  
**Validation**: 测试 - 空牌组情况

---

#### Finding P2-2: 敌人意图选择权重为负数时的处理

**Severity**: P2  
**Location**: `src/engine/engine.ts:266-281`

**What**: `selectIntent` 使用 `Math.max(0, ...)` 处理负权重，但可能导致所有权重为 0。

```typescript
const weights = Array.isArray(enemyDef.intent_policy)
  ? enemyDef.intent_policy.map((p: any) => Math.max(0, Number(p.weight) || 0))
  : [];
const totalWeight = weights.reduce((sum, w) => sum + w, 0);
if (totalWeight <= 0) {
  return enemyDef.intent_policy?.[0]?.intent || 'Attack';  // 回退到第一个
}
```

**Why**: 
- 数据错误时可能所有权重为 0
- 回退逻辑可能选择错误的意图

**Impact**: 
- 敌人行为异常
- 游戏平衡受影响

**Fix**: 
```typescript
if (totalWeight <= 0) {
  // 随机选择或使用默认
  const validIntents = enemyDef.intent_policy?.filter(p => p.intent) || [];
  if (validIntents.length > 0) {
    return validIntents[Math.floor(this.rng() * validIntents.length)].intent;
  }
  return 'Attack';
}
```

**Confidence**: Medium  
**Validation**: 数据验证 - 检查所有敌人定义

---

#### Finding P2-3: 存档加载后 actionManager 状态不一致

**Severity**: P2  
**Location**: `src/engine/engine.ts:853-860`

**What**: `loadSaveData` 只更新了 `actionManager` 的状态引用，但没有重建事件监听器。

```typescript
loadSaveData(data: any): void {
  if (data.state) {
    this.state = data.state;
    this.rng = createRNG(this.state.seed, this.state.rngState);
    this.actionManager.updateState(this.state);  // 只更新状态
  }
  this.notify();
}
```

**Why**: 
- `actionManager` 可能持有旧状态的引用
- 事件监听器没有重新注册

**Impact**: 
- 存档加载后行为异常
- 状态不一致

**Fix**: 
```typescript
loadSaveData(data: any): void {
  if (data.state) {
    this.state = data.state;
    this.rng = createRNG(this.state.seed, this.state.rngState);
    this.actionManager.updateState(this.state);
    // 重新设置事件监听器
    this.setupEventListeners();
  }
  this.notify();
}
```

**Confidence**: Medium  
**Validation**: 测试 - 存档/读档流程

---

### P3 - 可读性与维护性

#### Finding P3-1: UI 兼容层代码膨胀

**Severity**: P3  
**Location**: `src/engine/engine.ts:862-1162`

**What**: UI 兼容层包含 20+ 个方法，大部分是已有方法的别名或轻微变体。

```typescript
enterNode(nodeId: string): void {
  this.moveToNode(nodeId);  // 只是别名
}

pickRewardCard(cardInstanceId: string): void {
  this.takeReward(cardInstanceId);  // 只是别名
}

buyShopCard(cardInstanceId: string, basePrice?: number): void {
  // 与 buyCard 逻辑重复
}

buyShopRelic(relicId: string, basePrice?: number): void {
  // 与 buyRelic 逻辑重复
}
```

**Why**: 
- 历史演进导致
- UI 层需要不同签名的方法

**Impact**: 
- 代码膨胀
- 维护成本增加
- 容易引入不一致

**Fix**: 
```typescript
// 提取 UI 兼容层到独立文件
// src/engine/uiCompatibility.ts
export function createUICompatibilityLayer(engine: GameEngine) {
  return {
    enterNode: engine.moveToNode.bind(engine),
    pickRewardCard: engine.takeReward.bind(engine),
    // ...
  };
}
```

**Confidence**: High  
**Validation**: 代码审查

---

#### Finding P3-2: 魔法数字散布

**Severity**: P3  
**Location**: 多处

**What**: 游戏数值直接硬编码在代码中。

```typescript
// L111
this.state.player.gold = 99;

// L178
const enemyCount = nodeType === 'Boss' ? 1 : nodeType === 'Elite' ? 2 : 1 + Math.floor(this.rng() * 2);

// L327-330
const softCap = nodeType === 'Elite'
  ? (floor <= 3 ? 88 : floor <= 6 ? 112 : Infinity)
  : (floor <= 2 ? 30 : floor <= 4 ? 40 : floor <= 6 ? 52 : Infinity);

// L919
if (this.state.player.gold < 50) return;
this.state.player.gold -= 50;
```

**Why**: 
- 快速开发导致
- 数值调整困难

**Impact**: 
- 平衡调整困难
- 代码可读性差

**Fix**: 
```typescript
// src/engine/constants.ts
export const GAME_CONSTANTS = {
  STARTING_GOLD: 99,
  SHOP_UPGRADE_COST: 50,
  ENEMY_HP_SOFT_CAPS: {
    ELITE: { FLOOR_3: 88, FLOOR_6: 112 },
    NORMAL: { FLOOR_2: 30, FLOOR_4: 40, FLOOR_6: 52 }
  }
} as const;
```

**Confidence**: High  
**Validation**: 代码审查

---

#### Finding P3-3: `any` 类型过度使用

**Severity**: P3  
**Location**: 多处

**What**: 大量使用 `any` 类型绕过类型检查。

```typescript
// L214
(relicSystem as any).trigger?.('CombatStart', ...)

// L555
const rewards = (economySystem as any).calculateCombatRewards?.(...)

// L659
(((c as any).character ?? 'All') === 'All' || (c as any).character === characterId)

// L731
const price = (balanceSystem as any).getCardPrice?.(card.rarity)
```

**Why**: 
- 快速开发
- 类型定义不完整

**Impact**: 
- 类型安全丧失
- 重构风险高

**Fix**: 
```typescript
// 完善类型定义
interface BalanceSystem {
  getCardPrice(rarity: Rarity): number;
  // ...
}

interface EconomySystem {
  calculateCombatRewards(floor: number, relics: string[], nodeType: NodeType): RewardInfo;
  // ...
}
```

**Confidence**: High  
**Validation**: TypeScript 严格模式检查

---

## 4. 优化机会

### 4.1 性能优化

| 位置 | 问题 | 建议 |
|------|------|------|
| L237-243 | 敌人筛选每次战斗重新计算 | 缓存敌人池 |
| L657-662 | 卡牌奖励生成重复筛选 | 预计算卡牌池 |
| L712-722 | 商店生成重复排序 | 使用 Fisher-Yates 单次洗牌 |

### 4.2 重复逻辑

| 位置 | 重复内容 | 建议 |
|------|----------|------|
| L727-738, L953-968 | buyCard vs buyShopCard | 合并为单一方法 |
| L740-751, L970-982 | buyRelic vs buyShopRelic | 合并为单一方法 |
| L753-764, L984-999 | buyPotion vs buyShopPotion | 合并为单一方法 |

### 4.3 可复用抽象

| 抽象机会 | 涉及方法 | 建议 |
|----------|----------|------|
| 房间结算 | leaveCurrentRoomToMap, handleCombatVictory | 提取 RoomResolutionService |
| 资源消费 | buyCard, buyRelic, removeCard | 提取 TransactionService |
| 状态同步 | 多处 player 状态同步 | 提取 StateSynchronizer |

---

## 5. 可读性与可维护性评估

### 5.1 方法复杂度评估

| 方法 | 行数 | 圈复杂度 | 评级 |
|------|------|----------|------|
| `startCombat` | 58 | 8 | 高 |
| `executeEnemyTurn` | 54 | 10 | 高 |
| `usePotion` | 100 | 15 | **极高** |
| `enterUpgrade` | 18 | 5 | 中 |
| `tickDelayedCards` | 39 | 6 | 中 |

### 5.2 建议拆分方案

```
src/engine/
├── engine.ts              # 核心状态管理 (~200 行)
├── combat/
│   ├── CombatController.ts  # 战斗逻辑
│   ├── EnemyGenerator.ts    # 敌人生成
│   └── TurnManager.ts       # 回合管理
├── services/
│   ├── ShopService.ts       # 商店逻辑
│   ├── RewardService.ts     # 奖励逻辑
│   ├── EventService.ts      # 事件逻辑
│   └── RestService.ts       # 休息逻辑
├── persistence/
│   └── SaveLoadService.ts   # 存档逻辑
└── ui/
    └── UICompatibility.ts   # UI 兼容层
```

---

## 6. 风险清单

| 风险 | 严重度 | 验证优先级 | 验证方法 |
|------|--------|------------|----------|
| 商店升级扣费不退回 | P0 | 1 | 单元测试 |
| 状态双写不一致 | P0 | 2 | 集成测试 |
| 事件重复订阅 | P1 | 3 | 事件追踪 |
| 延迟卡目标丢失 | P1 | 4 | 场景测试 |
| 存档状态不一致 | P2 | 5 | 存档测试 |

---

## 7. 附录：关键调用链

### 7.1 战斗流程

```
moveToNode(nodeId)
  └─> startCombat(nodeType)
       ├─> generateEnemies()
       ├─> globalEventBus.publish('CombatStart')
       ├─> relicSystem.trigger('CombatStart')
       └─> startTurn()
            ├─> processTurnStartDots()
            ├─> processStatusDecay()
            ├─> tickDelayedCards()
            └─> drawCards(5)
```

### 7.2 出牌流程

```
playCard(cardInstanceId, targetId)
  ├─> actionManager.enqueueAll(card.actions, context)
  ├─> actionManager.executeAll()
  └─> globalEventBus.publish('CardPlayed')
```

### 7.3 敌人回合

```
endTurn()
  ├─> discardHand()
  └─> executeEnemyTurn()
       ├─> processTurnStartDots() (per enemy)
       ├─> processStatusDecay() (per enemy)
       ├─> actionManager.enqueueAll(intentActions)
       ├─> actionManager.executeAll()
       └─> relicSystem.trigger('EndTurn')
```

---

## 8. 总结

### 问题统计

| 严重度 | 数量 |
|--------|------|
| P0 | 2 |
| P1 | 3 |
| P2 | 3 |
| P3 | 3 |
| **总计** | **11** |

### 优先修复顺序

1. **P0-1**: 商店升级扣费问题（立即修复）
2. **P0-2**: 状态双写不一致（立即修复）
3. **P1-1**: 事件重复订阅（短期修复）
4. **P1-2**: 遗物触发器类型断言（短期修复）
5. **P1-3**: 延迟卡目标丢失（短期修复）

### 长期改进建议

1. **架构重构**: 将 `GameEngine` 拆分为多个专职服务
2. **类型完善**: 消除所有 `any` 类型
3. **常量提取**: 将魔法数字提取为配置
4. **测试覆盖**: 为关键路径添加单元测试

---

**报告生成时间**: 2026-02-25  
**审查者**: AI Code Reviewer
