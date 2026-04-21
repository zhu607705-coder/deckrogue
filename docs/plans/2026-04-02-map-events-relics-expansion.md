# 地图走格子特殊事件与遗物扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加更多用于地图走格子的特殊事件与遗物功能，丰富游戏体验，然后继续完成战斗界面 UI 细化。

**Architecture:** 基于现有的 StoryEventDef 和 RelicDef 结构，添加新的事件和遗物定义，保持与现有系统的兼容性。

**Tech Stack:** TypeScript、现有事件系统、现有遗物系统

---

## 文件结构

### 创建的文件
- **新增事件定义**: 内联添加到 `src/content/narrative/storyEvents.ts`
- **新增遗物定义**: 内联添加到 `src/content/data/relics.json`

### 修改的文件
- `src/content/narrative/storyEvents.ts` - 添加新的特殊事件
- `src/content/data/relics.json` - 添加新的遗物
- `src/ui/views/EventView.tsx` - 可能需要优化事件显示
- `src/ui/views/CombatView.tsx` - 应用战斗界面新样式

---

## 任务分解

### Task 1: 添加地图导航类特殊事件

**目标:** 添加与地图节点交互相关的特殊事件，如传送门、秘密通道等

**Files:**
- Modify: `src/content/narrative/storyEvents.ts`

**Step 1: 添加传送门事件**
```typescript
{
  id: 'warp_gate_discovery',
  title: '亚空间传送门',
  imagePath: '/assets/events/event_warp.png',
  floorMin: 2,
  floorMax: 6,
  weight: 0.7,
  loreText: [
    '一道不稳定的传送门在你面前脉动，紫色的能量从裂隙中喷涌而出。',
    '门的另一端似乎连接着某个未知的扇区——可能是捷径，也可能是陷阱。'
  ],
  options: [
    {
      id: 'warp_gate_enter',
      text: '[踏入传送门]',
      description: '随机传送到下一层或上一层的随机节点。',
      gains: ['随机传送（可能跳过危险或错过奖励）'],
      costs: ['有 20% 概率受到 15 点亚空间侵蚀伤害'],
      danger: 'medium'
    },
    {
      id: 'warp_gate_stabilize',
      text: '[稳定传送门]',
      description: '消耗 30 点生命值来稳定传送门，选择传送方向。',
      gains: ['选择传送到上一层或下一层', '获得遗物《空间锚点》'],
      costs: ['失去 30 点当前生命值'],
      danger: 'high'
    },
    {
      id: 'warp_gate_leave',
      text: '[谨慎离开]',
      description: '不冒险，继续当前路线。',
      gains: ['获得 10 点 Intel'],
      costs: [],
      danger: 'low'
    }
  ]
}
```

**Step 2: 添加秘密通道事件**
```typescript
{
  id: 'secret_passage',
  title: '隐藏通道',
  imagePath: '/assets/events/event_forge.png',
  floorMin: 1,
  floorMax: 5,
  weight: 0.6,
  loreText: [
    '墙壁上一道看似普通的裂缝引起了你的注意。凑近一看，这是一条精心伪装的秘密通道。',
    '通道尽头隐约有光芒闪烁——可能是宝藏，也可能是守卫的岗哨。'
  ],
  options: [
    {
      id: 'secret_passage_explore',
      text: '[探索通道]',
      description: '进入秘密通道探索。',
      gains: ['50% 概率获得随机稀有遗物', '50% 概率获得 120 金币'],
      costs: ['无论结果如何，都需要跳过下一个节点'],
      danger: 'medium'
    },
    {
      id: 'secret_passage_guard',
      text: '[设下陷阱]',
      description: '在通道口设下陷阱，然后继续前进。',
      gains: ['下一场精英战敌人开局 2 层虚弱'],
      costs: [],
      danger: 'low'
    },
    {
      id: 'secret_passage_ignore',
      text: '[忽略通道]',
      description: '假装没看见，继续你的征程。',
      gains: [],
      costs: [],
      danger: 'low'
    }
  ]
}
```

**Step 3: 添加先知神龛事件**
```typescript
{
  id: 'oracle_shrine',
  title: '先见之神龛',
  imagePath: '/assets/events/event_shrine.png',
  floorMin: 3,
  floorMax: 7,
  weight: 0.5,
  loreText: [
    '一座古老的神龛矗立在你面前，龛中宝石闪烁着神秘的光芒。',
    '据说这里的先知能够窥见未来——代价是你的一部分记忆。'
  ],
  options: [
    {
      id: 'oracle_shrine_consult',
      text: '[咨询先知]',
      description: '揭示下一层的所有节点类型和危险程度。',
      gains: ['揭示下一层所有节点', '获得 20 点 Intel'],
      costs: ['牌库随机移除 1 张非诅咒牌'],
      danger: 'medium'
    },
    {
      id: 'oracle_shrine_sacrifice',
      text: '[献上祭品]',
      description: '牺牲 1 张牌来换取更深远的视野。',
      gains: ['揭示接下来 3 层的 Boss 位置', '获得遗物《先见之眼》'],
      costs: ['选择并移除 1 张牌'],
      danger: 'high'
    },
    {
      id: 'oracle_shrine_leave',
      text: '[保持无知]',
      description: '命运未知才有趣。',
      gains: ['接下来 2 场战斗获得 1 层力量'],
      costs: [],
      danger: 'low'
    }
  ]
}
```

---

### Task 2: 添加地图节点交互类遗物

**目标:** 添加与地图节点选择、移动相关的遗物

**Files:**
- Modify: `src/content/data/relics.json`

**Step 1: 添加空间锚点遗物**
```json
{
  "id": "spatial_anchor",
  "name": "空间锚点",
  "description": "可以选择回到上一个经过的节点。每场战斗限用一次。",
  "price": 180,
  "tags": ["map", "utility"],
  "resonanceGroup": "utility",
  "trigger": "Passive",
  "effect": {
    "type": "Passive",
    "description": "允许返回上一节点"
  },
  "inscription": "这枚锚点能够撕裂亚空间，让你短暂地回到过去的位置。",
  "flavorText": "\"过去不是枷锁，而是选择。\""
}
```

**Step 2: 添加先见之眼遗物**
```json
{
  "id": "prophetic_eye",
  "name": "先见之眼",
  "description": "进入新楼层时，自动揭示所有节点类型。",
  "price": 220,
  "tags": ["map", "information"],
  "resonanceGroup": "utility",
  "trigger": "EnterFloor",
  "effect": {
    "type": "RevealAllNodes",
    "description": "揭示本层所有节点"
  },
  "inscription": "这只眼球来自一位被处决的先知，依然能窥见命运的丝线。",
  "flavorText": "\"看见未来，才能改变未来。\""
}
```

**Step 3: 添加捷径罗盘遗物**
```json
{
  "id": "shortcut_compass",
  "name": "捷径罗盘",
  "description": "每层可以选择跳过 1 个普通战斗节点。",
  "price": 195,
  "tags": ["map", "tempo"],
  "resonanceGroup": "tempo",
  "trigger": "Passive",
  "effect": {
    "type": "Passive",
    "description": "每层可跳过 1 个普通战斗"
  },
  "inscription": "这具罗盘永远指向最近的出口——无论那是否是你想去的方向。",
  "flavorText": "\"捷径往往是最长的路。但这次也许不是。\""
}
```

**Step 4: 添加陷阱探测仪遗物**
```json
{
  "id": "trap_detector",
  "name": "陷阱探测仪",
  "description": "危险节点（精英/Boss）会在地图上高亮显示。",
  "price": 150,
  "tags": ["map", "defense"],
  "resonanceGroup": "utility",
  "trigger": "Passive",
  "effect": {
    "type": "Passive",
    "description": "高亮危险节点"
  },
  "inscription": "这台古老的机械会在危险接近时发出嗡鸣——前提是你能区分嗡鸣和故障噪音。",
  "flavorText": "\"嘀嘀嘀...嘀嘀嘀...这玩意儿到底在探测什么？\""
}
```

**Step 5: 添加朝圣者权杖遗物**
```json
{
  "id": "pilgrims_staff",
  "name": "朝圣者权杖",
  "description": "每经过 3 个节点，恢复 8 点生命值。",
  "price": 170,
  "tags": ["map", "sustain"],
  "resonanceGroup": "sustain",
  "trigger": "PassNode",
  "effect": {
    "type": "Heal",
    "amount": 8,
    "interval": 3
  },
  "inscription": "这根权杖曾属于无数朝圣者中的一员——他们中的大多数没能走完朝圣之路。",
  "flavorText": "\"每一步都是救赎。\""
}
```

---

### Task 3: 验证新内容的 TypeScript 类型安全

**目标:** 确保新添加的事件和遗物符合现有类型定义

**Files:**
- Verify: `src/content/narrative/storyEvents.ts`
- Verify: `src/content/data/relics.json`
- Verify: `src/core/types/events.ts`

**Step 1: 运行 TypeScript 类型检查**
```bash
npm run lint
```
**Expected:** 无类型错误

**Step 2: 验证事件结构**
- 确认所有新事件都有完整的 id、title、loreText、options
- 确认 floorMin/floorMax 范围合理
- 确认 options 都有 id、text、description

**Step 3: 验证遗物结构**
- 确认所有新遗物都有完整的 id、name、description、price
- 确认 trigger 和 effect 结构正确

---

### Task 4: 继续完成战斗界面 UI 细化 - 应用新样式

**目标:** 将已完成的战斗界面 CSS 样式应用到实际组件

**Files:**
- Modify: `src/ui/views/CombatView.tsx`
- Modify: `src/ui/views/combat/Battlefield.tsx`
- Modify: `src/ui/views/combat/CombatHUD.tsx`

**Step 1: 应用玩家立绘区域样式**
```typescript
// 在 Battlefield.tsx 中
<div className="grimdark-player-section">
  <div className="grimdark-player-frame">
    <div className="grimdark-player-art">
      {/* 玩家立绘 */}
    </div>
    <div className="grimdark-player-shade" />
    <div className="grimdark-player-nameplate">
      {/* 玩家名称 */}
    </div>
  </div>
  <div className="grimdark-player-hud">
    {/* 玩家 HUD */}
  </div>
</div>
```

**Step 2: 应用敌人立绘区域样式**
```typescript
// 在 Battlefield.tsx 中
<div className="grimdark-enemies-section">
  {enemies.map((enemy, index) => (
    <div key={enemy.id} className={`grimdark-enemy-standee ${enemy.isBoss ? 'grimdark-enemy--boss' : enemy.isElite ? 'grimdark-enemy--elite' : ''}`}>
      <div className="grimdark-enemy-frame">
        {/* 敌人立绘 */}
      </div>
      <div className="grimdark-enemy-intent">
        {/* 敌人意图 */}
      </div>
    </div>
  ))}
</div>
```

**Step 3: 应用前线阵地样式**
```typescript
// 在 Battlefield.tsx 中
<div className="grimdark-frontline-zone">
  <div className="grimdark-frontline-container">
    <div className="grimdark-frontline-label">前线阵地</div>
    <div className="grimdark-constructs">
      {/* 构造物展示 */}
    </div>
  </div>
</div>
```

**Step 4: 应用战斗 HUD 增强样式**
```typescript
// 在 CombatHUD.tsx 中
<div className="grimdark-battlefield">
  <div className="grimdark-warp-overlay" />
  <div className="grimdark-elements">
    {/* 元素显示 */}
  </div>
  <div className="grimdark-delayed-cards">
    {/* 延迟卡牌 */}
  </div>
</div>
```

---

### Task 5: 运行完整测试套件验证

**目标:** 确保所有修改都不会破坏现有功能

**Files:**
- Test: 所有现有测试文件

**Step 1: 运行 Runtime V2 测试**
```bash
npm run test:runtime-v2:ts
```
**Expected:** 所有 114 个测试通过

**Step 2: 运行 TypeScript 类型检查**
```bash
npm run lint
```
**Expected:** 无类型错误

**Step 3: 运行构建验证**
```bash
npm run build
```
**Expected:** 构建成功

---

## 验收标准

- [ ] 所有新事件和遗物正确添加到对应文件
- [ ] TypeScript 类型检查通过
- [ ] 所有现有测试通过
- [ ] 项目构建成功
- [ ] 战斗界面新样式已应用到组件

## 后续展望

完成本次扩展后，可以考虑：
1. 添加更多与地图交互相关的机制
2. 实现新遗物的实际游戏逻辑（不仅仅是数据定义）
3. 添加更多战斗界面的交互优化
4. 为新内容添加专门的测试用例
