# 🌌 《Warp Deckbuilder》核心技术架构白皮书 v1.0

> 项目最高宪法 - 确保架构不走样、逻辑不崩塌

## 1. 架构总览 (Architecture Overview)

本项目采用 Tauri + TypeScript 构建，旨在打造一款具备严谨数值逻辑、高扩展性以及原生操作系统级特权（本地存档、无限制 IO）的商业级肉鸽卡牌独立游戏。

游戏底层的核心思想是彻底解耦。所有的业务流必须严格遵循以下「四层结算管道」：

```
┌─────────────────────────────────────────────────────────────────┐
│                      输入层 (Input Layer)                        │
│  玩家操作（出牌）或 AI 意图触发，生成 ActionSpec 压入队列         │
│  [ActionManager]                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      解析层 (Parser Layer)                       │
│  队列弹出 IAction，调用 TargetingService 锁定目标               │
│  组装 DamageContext 等请求体                                    │
│  [TargetingService, Action Classes]                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      修饰层 (Synergy/Modifier Layer)             │
│  结算卡牌配合、奇物加成、状态乘区（脆弱、亚空间潮汐）            │
│  应用软上限防御数值溢出                                         │
│  [SynergySystem]                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      结算层 (Settlement Layer)                   │
│  最终数值交由 CombatSystem 执行（扣血、加甲、抽牌）              │
│  通过 EventBus 广播事件                                         │
│  [CombatSystem, GlobalEventBus]                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心系统模块 (Core Modules)

### 2.1 动作队列中心 (ActionManager)

**职责**：整个游戏逻辑的心脏。消除深度递归嵌套，防止复杂的触发链条（如：A打B -> B反伤打死A -> A触发亡语爆炸 -> B被炸死）导致调用栈崩溃或时序错乱。

**规则**：
- 常规卡牌动作使用 `enqueueAll()` 推入队列尾部
- 奇物反击、被动触发等衍生动作，必须使用 `enqueueUrgent()` 插入队列头部，确保在当前动作结算完毕后立即执行
- 所有的 Action 实例必须是无状态的（Stateless），只负责执行一瞬间的逻辑

**文件**：`src/engine/actionManager.ts`

---

### 2.2 战斗结算系统 (CombatSystem)

**职责**：全游戏唯一拥有修改实体 HP、Block 以及施加 Status 权限的模块。

**规则**：
- ❌ **绝对禁止**在任何 Action 或 Relic 中直接写 `target.hp -= 10`
- ✅ 必须统一封装 `DamageContext` 调用 `combatSystem.applyDamage()`

**文件**：`src/engine/combatSystem.ts`

---

### 2.3 协同与乘区网络 (SynergySystem)

**职责**：管理数值膨胀，计算并统筹所有的独立乘区、加算区以及连击（Combo）。

**架构**：采用非线性模型（对数衰减、边际递减），对多段攻击、极端属性叠加实施软上限（Soft Cap）控制，确保游戏后期的数值健康。

**文件**：`src/engine/synergySystem.ts`

---

### 2.4 全局事件总线 (GlobalEventBus)

**职责**：实现奇物（Relic）、成就系统、UI 动画与底层逻辑的彻底解耦。

**标准事件流**：
```
TurnStart -> CardPlayed -> DamageDealt / DamageReceived -> EnemyDeath -> TurnEnd
```

**文件**：`src/engine/eventBus.ts`

---

### 2.5 目标解析服务 (TargetingService)

**职责**：统一处理所有目标选择逻辑，消除散落在各处的 `if (target === 'Enemy')` 判断。

**用法**：
```typescript
const targets = targetingService.resolveTargets(state, context, 'AllEnemies');
```

**文件**：`src/engine/targetingService.ts`

---

## 3. 客户端与基建 (Client & Infrastructure)

### 3.1 Tauri 容器引擎

**特性**：摒弃沉重的 Electron，采用 Rust 作为底层后端，确保客户端极小的内存占用与原生级性能。

**权限管控**：禁用浏览器默认行为（右键菜单、文本选中、快捷键刷新），接管完整窗口生命周期，提供真正的全屏沉浸体验。

---

### 3.2 原生 IO 与存档中心 (SaveManager)

**路径**：打破浏览器 localStorage 限制，将加密的 GameState 存档直接写入操作系统的 `$APPDATA/YourGame/saves` 目录。

**扩展**：为未来的「创意工坊 (Mod)」预留了本地文件扫描与动态 JSON 加载的底层能力。

---

## 4. 开发者与 AI 助手开发规范 (Strict Developer Rules)

⚠️ **警告**：任何参与本项目的开发者或 AI Code Assistant，在生成新卡牌、新奇物或新机制代码时，必须严格遵守以下法则（Hard Rules）：

---

### 【寻路法则】目标必须由服务解析

不允许在 Action 内部手动遍历 `combat.enemies` 寻找目标。

```typescript
// ❌ 错误做法
const target = combat.enemies.find(e => e.id === context.targetId);

// ✅ 正确做法
const targets = targetingService.resolveTargets(state, context, this.targetType);
```

---

### 【结算特权】严禁私自修改核心属性

任何扣血、加甲、施加状态的操作，必须外包。

```typescript
// ❌ 错误做法：直接修改实体
enemy.hp -= 5;
player.block += 10;
player.statuses['Weak'] = 2;

// ✅ 正确做法：提交给 CombatSystem 处理
combatSystem.applyDamage(state, damageContext);
combatSystem.gainBlock(state, 'player', 'player', 10);
combatSystem.applyStatus(state, 'enemy', enemy.id, 'Weak', 2);
```

---

### 【时序安全】衍生机制必须入队

当一个动作触发了后续动作时，禁止直接调用。

```typescript
// ❌ 错误做法：直接同步调用
new DealDamageAction(spec).execute(state, context);

// ✅ 正确做法：紧急插入队列
const action = ActionFactory.createAction(spec);
actionManager.enqueueUrgentAction(action, context, 'relic');
```

---

### 【职责单一】UI 与逻辑分离

系统引擎只负责数据运算和抛出 Event，绝对不允许在引擎代码中直接引入任何 DOM 操作、Vue/React 状态渲染。UI 层应当监听 EventBus 来播放动画或更新视图。

```typescript
// ❌ 错误做法：在引擎中操作 DOM
document.getElementById('hp-bar').style.width = '50%';

// ✅ 正确做法：广播事件，UI 监听
globalEventBus.publish({ type: 'DamageReceived', amount: 10 });
// UI 层：eventBus.subscribe('DamageReceived', updateHpBar)
```

---

## 5. 文件结构规范

```
src/engine/
├── actionManager.ts          # 队列管理器
├── actionQueue.ts            # 队列数据结构
├── combatSystem.ts           # 战斗结算（唯一修改 HP/Block）
├── targetingService.ts       # 目标解析服务
├── synergySystem.ts          # 乘区与协同
├── eventBus.ts               # 全局事件总线
├── runGenerator.ts           # 地图生成器
├── economySystem.ts          # 经济与掉落
├── metricsTracker.ts         # 数据统计
├── relicSystem.ts            # 奇物系统
└── actions/
    └── v2/                   # 重构后的 Action 类
        ├── DamageActions.ts   # 伤害/状态/资源
        ├── SpecialActions.ts  # 构装/元素/延迟
        ├── WarpActions.ts     # 亚空间机制
        ├── ActionFactory.ts   # 工厂模式
        └── index.ts
```

---

## 6. 数值设计原则

### 6.1 软上限 (Soft Cap)

为防止后期数值爆炸，所有伤害计算必须经过软上限处理：

```typescript
private applySoftCaps(damage: number): number {
  const softCap = 200;
  if (damage > softCap) {
    const excess = damage - softCap;
    return softCap + Math.floor(excess * 0.5);  // 超额部分收益减半
  }
  return damage;
}
```

### 6.2 对数平滑

敌人数值增长采用对数衰减公式，避免纯指数爆炸：

```typescript
// HP 倍率 = 1 + (floor * 0.15) * log10(1 + floor/10)
calculateHpMultiplier(floor: number): number {
  const logarithmicDampening = Math.log10(1 + floor / 10);
  return 1 + floor * 0.15 * logarithmicDampening;
}
```

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-02-25 | 初始版本，确立四层架构 |

---

## 8. 附录：快速参考卡

### Action 类模板

```typescript
export class MyNewAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, 'Enemy');

    targets.forEach(targetInfo => {
      // 伤害
      combatSystem.applyDamage(state, {
        amount: this.amount,
        sourceType: 'player',
        sourceId: 'player',
        targetType: targetInfo.type,
        targetId: targetInfo.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false
      });

      // 状态
      combatSystem.applyStatus(state, targetInfo.type, targetInfo.id, 'Weak', 2);

      // 护甲
      combatSystem.gainBlock(state, 'player', 'player', 5);
    });
  }
}
```

### 注册新 Action

```typescript
// ActionFactory.ts
ActionFactoryV2.registerAction('MyNewAction', MyNewAction);
```

### 监听事件

```typescript
// RelicSystem.ts
globalEventBus.subscribe('DamageReceived', (event) => {
  if (this.hasRelic(state, 'my_relic')) {
    const action = ActionFactory.createAction({ type: 'Heal', amount: 3 });
    actionManager.enqueueUrgentAction(action, { source: 'relic_my_relic' });
  }
});
```

---

**最后更新**: 2026-02-25
**维护者**: 首席肉鸽卡牌游戏架构师
