# 游戏机制增强与性能优化规范

## Overview
- **Summary**: 对游戏核心机制（遗物系统、卡牌系统、Roguelike循环）进行系统性增强，同时优化性能和稳定性
- **Purpose**: 提升游戏深度、增加重玩价值、改善用户体验
- **Target Users**: 游戏玩家，包括新玩家和有经验的玩家

## Goals
- 实现遗物升级与驱魔系统，丰富遗物互动
- 实现卡牌升级、消耗与互斥机制，增加策略深度
- 改进地图生成算法，增加随机事件
- 优化加载性能和内存管理

## Non-Goals
- 不改变核心战斗数值平衡
- 不添加新的渲染技术
- 不重构应用架构

## 详细设计

### 1. 遗物系统增强

#### 1.1 遗物升级系统
```
机制:
- 玩家可以在休息站点消耗金币升级遗物
- 每个遗物有1-3个升级等级
- 升级效果可以是: 属性提升、触发概率增加、新增效果

实现:
- RelicUpgradeConfig: 升级配置
- upgradeRelic(relicId, level): 执行升级
- getUpgradeCost(relic, level): 获取升级费用
```

#### 1.2 遗物驱魔系统
```
机制:
- 商店提供驱魔选项（消耗金币移除负面遗物）
- 休息站点可以选择"驱散"随机移除一个遗物
- 某些事件提供驱魔选择

实现:
- hasCurse(relicId): 检查是否负面遗物
- purifyRelic(relicId): 驱魔移除
- addCurseRelic(): 添加负面遗物
```

### 2. 卡牌系统增强

#### 2.1 卡牌升级
```
机制:
- 战斗后可以选择升级特定卡牌
- 升级效果: 伤害+2、费用-1、添加关键词
- 每张卡牌最多升级1次

实现:
- CardUpgradeConfig: 卡牌升级配置
- upgradeCard(cardId): 执行升级
- getAvailableUpgrades(hand): 获取可升级卡牌
```

#### 2.2 卡牌消耗机制
```
机制:
- 新增"消耗"关键词卡牌
- 消耗卡牌使用后移入弃牌堆（或消灭）
- 消耗效果通常更强力

实现:
- hasConsumeKeyword(card): 检查消耗关键词
- consumeCard(card): 执行消耗逻辑
- CONSUME_TYPE: 'discard' | 'destroy' | 'exile'
```

#### 2.3 卡牌互斥
```
机制:
- 某些卡牌定义互斥组
- 当获得新卡时，如果互斥组已有卡，则替换
- 互斥增加构建限制，提高决策深度

实现:
- MUTUALLY_EXCLUSIVE_GROUPS: 互斥组配置
- checkMutualExclusivity(newCard, currentDeck): 检查互斥
- replaceMutualExclusiveCard(newCard, currentDeck): 替换卡牌
```

### 3. Roguelike循环增强

#### 3.1 地图生成改进
```
机制:
- 改进节点分布算法，保证路径多样性
- 增加特殊节点类型: 宝藏室、隐藏事件、契约祭坛
- Boss距离可视化改进

实现:
- MapGenerationConfig: 地图生成配置
- generateMap(floor, seed): 生成地图
- getSpecialNodeChance(floor): 计算特殊节点概率
```

#### 3.2 随机事件系统
```
机制:
- 增加事件池，包含正面/负面/中立事件
- 事件触发: 战斗后、休息时、商店前
- 事件提供有意义的选择

实现:
- EventConfig: 事件配置
- EventChoice: 事件选项
- triggerEvent(eventId, context): 触发事件
- getAvailableEvents(context): 获取可用事件
```

### 4. 性能与稳定性

#### 4.1 加载优化
```
目标:
- 首屏加载时间 < 2秒
- 路由切换时间 < 200ms

实现:
- 代码分割: 使用React.lazy进行路由级分割
- 资源预加载: 预加载关键资源
- Tree Shaking: 移除未使用代码
```

#### 4.2 内存管理
```
目标:
- 长时间游戏无内存泄漏
- 内存占用稳定

实现:
- 状态清理: 战斗结束时清理临时状态
- 资源释放: 组件卸载时释放资源
- 事件监听清理: 防止重复监听
```

## 技术实现

### 新增文件结构
```
src/core/relic/
├── RelicUpgrade.ts        # 遗物升级系统
├── RelicPurify.ts         # 遗物驱魔系统
├── relics.json            # 遗物配置（含升级数据）

src/core/cards/
├── CardUpgrade.ts         # 卡牌升级系统
├── CardConsume.ts         # 卡牌消耗系统
├── CardExclusivity.ts     # 卡牌互斥系统
├── cards.json             # 卡牌配置（含升级、消耗、互斥数据）

src/core/map/
├── MapGenerator.ts        # 地图生成器
├── NodeTypes.ts           # 节点类型定义
├── maps.json              # 地图配置

src/core/events/
├── RandomEvents.ts        # 随机事件系统
├── EventManager.ts        # 事件管理器
├── events.json            # 事件配置

src/core/performance/
├── PerformanceMonitor.ts   # 性能监控
├── MemoryManager.ts       # 内存管理
```

### 修改文件
```
src/core/combat/CombatManager.ts      # 集成卡牌升级
src/core/run/RunManager.ts            # 集成遗物升级
src/core/persistence/SaveManager.ts   # 保存升级数据
src/runtimeV2/scenes/MapScene.tsx     # 集成新地图生成
src/runtimeV2/scenes/EventScene.tsx   # 集成随机事件
```

## 数据结构

### 遗物升级
```typescript
interface RelicUpgradeConfig {
  relicId: string;
  levels: {
    level: number;
    cost: number;
    effect: RelicEffect;
  }[];
}
```

### 卡牌升级
```typescript
interface CardUpgradeConfig {
  cardId: string;
  upgrades: {
    damage?: number;
    cost?: number;
    addKeyword?: string[];
    effect?: CardEffect;
  };
}
```

### 互斥组
```typescript
interface MutualExclusiveGroup {
  groupId: string;
  cards: string[];
  description: string;
}
```

### 事件
```typescript
interface EventConfig {
  id: string;
  name: string;
  description: string;
  trigger: 'post_combat' | 'rest' | 'pre_shop';
  choices: EventChoice[];
}
```

## 验收标准

### 遗物系统
- [ ] 玩家可以在休息站点看到遗物升级选项
- [ ] 遗物升级消耗金币，效果正确应用
- [ ] 商店提供驱魔选项
- [ ] 负面遗物可以被移除

### 卡牌系统
- [ ] 战斗后可以选择升级卡牌
- [ ] 消耗卡牌使用后正确处理
- [ ] 互斥卡牌正确替换

### Roguelike
- [ ] 地图生成包含特殊节点
- [ ] 随机事件正确触发
- [ ] 事件选择正确应用效果

### 性能
- [ ] 首屏加载 < 2秒
- [ ] 长时间游戏无内存泄漏
- [ ] 控制台无内存警告
