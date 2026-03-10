# engine.ts 修复报告

**修复日期**: 2026-02-25  
**修复范围**: P0-P1 级问题

---

## 修复清单

### P0-1: 商店升级扣费不退回 ✅

**文件**: `src/engine/engine.ts`, `src/engine/types.ts`

**问题**: 玩家在商店进入升级界面扣除 50 金币后，取消升级不会退回费用。

**修复**:
1. 在 `GameState` 中添加 `pendingUpgradeRefund` 字段
2. 在 `enterUpgrade()` 中设置标记
3. 在 `cancelUpgrade()` 中检查并退费

```typescript
// types.ts
pendingUpgradeRefund?: boolean;

// engine.ts - enterUpgrade
if (this.state.screen === 'Shop') {
  if (this.state.player.gold < 50) return;
  this.state.player.gold -= 50;
  this.state.pendingUpgradeRefund = true;  // 新增
}

// engine.ts - cancelUpgrade
if (this.state.pendingUpgradeRefund) {
  this.state.player.gold += 50;  // 退费
  this.state.pendingUpgradeRefund = false;
}
```

---

### P0-2: 状态双写不一致 ✅

**文件**: `src/engine/engine.ts`

**问题**: `state.player` 和 `state.combat.player` 同步逻辑不一致。

**修复**:
1. 添加 `syncPlayerStateFromCombat()` 统一同步方法
2. 在 `handleCombatVictory()` 中使用新方法

```typescript
private syncPlayerStateFromCombat(): void {
  const combat = this.state.combat;
  if (!combat) return;
  this.state.player.hp = combat.player.hp;
  this.state.player.maxHp = combat.player.maxHp;
  this.state.player.intel = combat.player.intel ?? this.state.player.intel;
}
```

---

### P1-1: 事件重复订阅 ✅

**文件**: `src/engine/engine.ts`

**问题**: `EnemyDefeated` 和 `EnemyDeath` 事件都订阅了同一个处理函数，但只有 `EnemyDeath` 被发布。

**修复**: 移除未使用的 `EnemyDefeated` 订阅

```typescript
// 修复前
globalEventBus.subscribe('EnemyDefeated', ...);  // 从未发布
globalEventBus.subscribe('EnemyDeath', ...);

// 修复后
globalEventBus.subscribe('EnemyDeath', ...);  // 只保留一个
```

---

### P1-2: 遗物触发器类型断言 ✅

**文件**: `src/engine/engine.ts`

**问题**: 使用 `(relicSystem as any).trigger?.()` 绕过类型检查。

**修复**: 直接调用类型安全的方法

```typescript
// 修复前
(relicSystem as any).trigger?.('CombatStart', ...)

// 修复后
relicSystem.trigger('CombatStart', ...)
```

---

### P1-3: 延迟卡目标丢失 ✅

**文件**: `src/engine/engine.ts`

**问题**: 延迟卡触发时，目标可能已死亡。

**修复**: 触发前验证目标，如已死亡则选择新目标

```typescript
let targetId = delayed.targetId;
if (targetId) {
  const target = combat.enemies.find(e => e.id === targetId && e.hp > 0);
  if (!target) {
    // 目标已死亡，选择新目标
    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length > 0) {
      targetId = aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)].id;
    } else {
      targetId = undefined;  // 无可用目标
    }
  }
}
```

---

## 验证结果

### TypeScript 编译
```
✅ npm run lint 通过
```

### 平衡测试 (10 局/职业, 3 层)

| 职业 | 3F 胜率 | 平均回合 |
|------|---------|----------|
| informant | 90% | 4.1 |
| brute | 90% | 2.8 |
| tactician | 100% | 3.0 |
| chronomancer | 100% | 2.1 |
| puppeteer | 100% | 3.1 |
| alchemist | 100% | 4.0 |

**结论**: 所有修复已生效，游戏运行正常。

---

## 剩余问题 (P2-P3)

以下问题未在本轮修复，建议后续处理：

| 问题 | 严重度 | 状态 |
|------|--------|------|
| 空牌堆静默处理 | P2 | 待修复 |
| 敌人意图权重边界 | P2 | 待修复 |
| 存档状态不一致 | P2 | 待修复 |
| UI 兼容层膨胀 | P3 | 待重构 |
| 魔法数字散布 | P3 | 待提取 |
| any 类型过度使用 | P3 | 待完善 |
