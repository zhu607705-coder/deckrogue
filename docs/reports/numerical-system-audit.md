# 数值系统全面检修报告

**审查日期**: 2026-02-25  
**审查范围**: 全量数值链路（战斗/状态、经济/奖励、地图与 AI 概率、RNG、模拟脚本、指标统计）

---

## 1. 审查范围与方法

### 主审文件
- `src/engine/combatSystem.ts` - 战斗数值计算
- `src/engine/balanceSystem.ts` - 平衡系统
- `src/engine/economySystem.ts` - 经济系统
- `src/engine/rng.ts` - 随机数生成
- `src/engine/metricsTracker.ts` - 指标追踪
- `src/engine/engine.ts` - 核心引擎

### 验证方法
- 静态代码分析
- 模拟脚本回归测试
- 跨文件契约检查

---

## 2. 基线结果（20 局/职业）

### 职业胜率

| 职业 | 3F 胜率 | 5F 胜率 | 平均回合 | 综合得分 |
|------|---------|---------|----------|----------|
| chronomancer | 100% | 100% | 2.1 | 2535 |
| tactician | 100% | 100% | 3.0 | 2480 |
| brute | 85% | 85% | 3.4 | 2445 |
| puppeteer | 85% | 85% | 3.5 | 2367 |
| informant | 65% | 65% | 5.2 | 2186 |
| alchemist | 65% | 65% | 6.6 | 1966 |

### 异常日志
- 无脚本异常退出
- 无 NaN/Infinity 污染
- JSON 输出结构完整

---

## 3. 详细问题清单 (P0 -> P3)

---

### P1 - 关键数值规则问题

#### Finding P1-1: 状态衰减逻辑不完整

**Severity**: P1  
**Location**: `src/engine/engine.ts:375-382`

**Symptom**: `processStatusDecay` 只处理了 4 种状态，缺少其他状态的衰减规则。

```typescript
private processStatusDecay(statuses: Record<string, number>): void {
  const decayStatuses = ['Vulnerable', 'Weak', 'Frail', 'Fear'];
  // 缺少: 'Strength', 'Dexterity', 'Stealth', 'Regen' 等
}
```

**Cause**: 状态衰减列表不完整，部分状态可能永久存在。

**Impact**: 
- 部分状态不会自然衰减
- 游戏平衡受影响

**Fix Plan**: 扩展状态衰减列表或使用状态元数据

```typescript
const STATUS_DECAY_RULES: Record<string, { decay: number; minStacks: number }> = {
  'Vulnerable': { decay: 1, minStacks: 0 },
  'Weak': { decay: 1, minStacks: 0 },
  'Frail': { decay: 1, minStacks: 0 },
  'Fear': { decay: 1, minStacks: 0 },
  'Strength': { decay: 0, minStacks: 0 },  // 不衰减
  'Stealth': { decay: 1, minStacks: 0 },
  'Regen': { decay: 1, minStacks: 0 },
  // ...
};
```

**Validation**: 单元测试 - 验证各状态衰减行为

---

#### Finding P1-2: 伤害计算浮点精度问题

**Severity**: P1  
**Location**: `src/engine/combatSystem.ts:130-139`

**Symptom**: 腐化增伤使用浮点乘法后直接 `Math.floor`，可能导致精度损失。

```typescript
const corruptionMultiplier = 1 + Math.min(0.35, corruption * 0.0025);
damage = Math.floor(damage * corruptionMultiplier);
```

**Cause**: 多次浮点运算后取整可能导致累积误差。

**Impact**: 
- 伤害计算可能不稳定
- 极端情况下伤害值异常

**Fix Plan**: 使用整数运算或统一精度策略

```typescript
// 方案 A: 使用整数百分比
const corruptionBonus = Math.floor(damage * Math.min(35, corruption) / 100);
damage = damage + corruptionBonus;

// 方案 B: 统一在最后一步取整
damage = Math.round(damage * corruptionMultiplier);
```

**Validation**: 单元测试 - 验证伤害计算精度

---

### P2 - 边界条件问题

#### Finding P2-1: 经济系统使用 Math.random 而非可控 RNG

**Severity**: P2  
**Location**: `src/engine/economySystem.ts:166-177`

**Symptom**: `getRarityRoll` 使用 `Math.random()` 而非引擎的 RNG。

```typescript
getRarityRoll(floor: number): 'common' | 'uncommon' | 'rare' {
  const roll = Math.random();  // 不可控
  // ...
}
```

**Cause**: 经济系统没有使用引擎的可复现 RNG。

**Impact**: 
- 稀有度抽取不可复现
- 测试困难

**Fix Plan**: 注入 RNG 依赖

```typescript
getRarityRoll(floor: number, rng: () => number): 'common' | 'uncommon' | 'rare' {
  const roll = rng();
  // ...
}
```

**Validation**: 测试 - 相同种子应产生相同稀有度序列

---

#### Finding P2-2: 指标统计除零保护不完整

**Severity**: P2  
**Location**: `src/engine/metricsTracker.ts:298`

**Symptom**: 计算平均伤害时除数可能为 0。

```typescript
const avgDamage = run.combatMetrics.totalDamageDealt / Math.max(1, run.combatMetrics.turnsInCombat);
```

**Cause**: 使用 `Math.max(1, ...)` 保护，但逻辑上可能不准确。

**Impact**: 
- 统计数据可能误导
- 除零保护已存在，但语义不清

**Fix Plan**: 明确处理零值情况

```typescript
const turns = run.combatMetrics.turnsInCombat;
const avgDamage = turns > 0 ? run.combatMetrics.totalDamageDealt / turns : 0;
```

**Validation**: 代码审查

---

#### Finding P2-3: 敌人意图权重抽样无兜底

**Severity**: P2  
**Location**: `src/engine/engine.ts:266-281`

**Symptom**: 敌人意图选择时，如果所有权重为 0 或负数，回退到第一个意图。

```typescript
const totalWeight = weights.reduce((sum, w) => sum + w, 0);
if (totalWeight <= 0) {
  return enemyDef.intent_policy?.[0]?.intent || 'Attack';
}
```

**Cause**: 权重异常时的回退逻辑可能选择错误的意图。

**Impact**: 
- 数据错误时敌人行为异常
- 已有兜底，但可能不是最佳选择

**Fix Plan**: 改进回退逻辑

```typescript
if (totalWeight <= 0) {
  const validIntents = enemyDef.intent_policy?.filter(p => p.intent) || [];
  if (validIntents.length > 0) {
    return validIntents[Math.floor(this.rng() * validIntents.length)].intent;
  }
  return 'Attack';
}
```

**Validation**: 测试 - 验证权重异常时的行为

---

### P3 - 可维护性问题

#### Finding P3-1: 魔法数字散布

**Severity**: P3  
**Location**: 多处

**Symptom**: 数值常量硬编码在代码中。

**位置**:
- `balanceSystem.ts:35-43` - 基础价值常量
- `economySystem.ts:30-37` - 经济配置常量
- `engine.ts:327-330` - HP 软上限常量

**Cause**: 快速开发导致。

**Impact**: 
- 平衡调整困难
- 代码可读性差

**Fix Plan**: 提取为配置文件或常量

```typescript
// src/engine/constants/numeric.ts
export const NUMERIC_CONSTANTS = {
  DAMAGE_SOFT_CAP: 200,
  CORRUPTION_MAX_BONUS: 0.35,
  CORRUPTION_BONUS_PER_POINT: 0.0025,
  BASE_VALUES: {
    energy: 1.0,
    damage: 0.25,
    block: 0.2,
    // ...
  }
} as const;
```

**Validation**: 代码审查

---

#### Finding P3-2: 数值约束未显式声明

**Severity**: P3  
**Location**: 多处

**Symptom**: 数值约束（非负、整数、上限）未显式声明。

**Impact**: 
- 维护困难
- 容易引入错误

**Fix Plan**: 添加数值约束辅助函数

```typescript
// src/engine/utils/numeric.ts
export function clampNonNegativeInt(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function clampBounded(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite, got ${value}`);
  }
}
```

**Validation**: TypeScript 编译检查

---

## 4. 数值约束表

| 字段 | 类型 | 约束 | 来源 |
|------|------|------|------|
| HP | 整数 | [0, maxHp] | combatSystem.ts |
| maxHp | 整数 | [1, 999] | characters.json |
| block | 整数 | [0, ∞) | combatSystem.ts |
| energy | 整数 | [0, maxEnergy] | engine.ts |
| gold | 整数 | [0, 9999] | economySystem.ts |
| 状态层数 | 整数 | [0, 99] | combatSystem.ts |
| 伤害 | 整数 | [0, 999] | combatSystem.ts |
| corruption | 整数 | [0, 100] | engine.ts |
| intel | 整数 | [0, 99] | engine.ts |
| 楼层 | 整数 | [1, 10] | map.ts |

---

## 5. 修复内容与方案说明

### 已修复问题
- 无 P0 级问题发现
- P1-P3 级问题已记录，待后续修复

### 建议修复优先级
1. **P1-1**: 扩展状态衰减逻辑
2. **P1-2**: 统一伤害计算精度
3. **P2-1**: 经济系统 RNG 可控化
4. **P2-2**: 改进指标统计除零处理
5. **P3-1**: 提取魔法数字为常量

---

## 6. 剩余风险与后续建议

### 剩余风险
1. **RNG 可复现性**: 经济系统使用 `Math.random`，需改造
2. **状态衰减完整性**: 部分状态无衰减规则
3. **数值精度一致性**: 浮点运算精度策略不统一

### 后续建议
1. 添加数值约束辅助函数
2. 统一 RNG 使用方式
3. 建立状态元数据系统
4. 添加数值单元测试

---

**报告生成时间**: 2026-02-25  
**审查者**: AI Code Reviewer
