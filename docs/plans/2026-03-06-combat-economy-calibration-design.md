# 战斗闭环与经济闭环校准设计

日期：2026-03-06  
状态：已确认进入实施  
范围：仅校准内容层与运行时参数，不重写 UI，不改目录结构

## 1. 背景

数值域统一重构已经完成，`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/` 现已提供唯一的基线、公式、估值与运行时适配层。  
当前剩余问题不再是“多套口径并存”，而是“内容层与经济曲线尚未吃满新基线”。  
回归产物已经明确暴露两个方向的失衡：

- 战斗闭环：`informant` 前 3 层存活率为 `0`，`brute` 与 `tactician` 为 `1`
- 经济闭环：奖励、商店价格、删除成本、药水/遗物可达性仍偏固定表驱动，缺少按楼层购买能力校准

证据文件：

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/baseline_audit.json`

## 2. 目标

本轮目标分两项，同时推进：

1. 战斗闭环校准  
   将各职业早期强度拉回同一带宽，避免 `informant` 早期直接崩盘，同时压低 `brute` / `tactician` 的明显优势。

2. 经济闭环校准  
   让金币、商店、删除、奖励与楼层成长形成稳定闭环，使“可购买什么”成为决策，而不是固定表的偶然结果。

## 3. 设计原则

### 3.1 不破坏统一数值域

所有本轮修正只允许：

- 调整内容层卡牌与职业起手配置
- 调整奖励/价格/成长的运行时参数
- 扩充回归脚本与报告

不允许：

- 在 `relicSystem`、`synergySystem`、`economySystem` 中重新引入第二套口径
- 绕开 `numericsRuntime` 与 `numericsFormulas`

### 3.2 先修早期闭环，再修中后期放大

本轮不追求全职业最终完美平衡，而是优先解决前 3 层的稳定性问题。  
原因很直接：当前失衡主要发生在起手牌组、早期回合效率与首层商店/奖励可达性上。

### 3.3 用回归指标驱动调整

任何改动都必须回到以下产物验证：

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json`

通过标准不是“手感变好了”，而是：

- `informant` 前 3 层存活率脱离 0
- 各职业前 3 层存活率收敛到同一合理带宽
- 商店与删除成本不再让前期出现“买不起任何有意义内容”或“总能轻松全买”的极端

## 4. 方案比较

### 方案 A：只调角色起手卡组

优点：

- 改动小
- 可以快速拉起 `informant`

缺点：

- 只能修战斗，不修经济
- 容易把问题转移到中期奖励与商店

### 方案 B：只调经济曲线

优点：

- 能修购买能力和楼层成长

缺点：

- 不能解决起手阶段就会死的问题
- `informant` 仍会在经济发挥前阵亡

### 方案 C：同时校准战斗闭环与经济闭环

优点：

- 符合当前问题结构
- 战斗与经济都基于统一数值域，能形成真正闭环

缺点：

- 需要同步修改内容层和运行时参数
- 需要更严格的回归验证

推荐：方案 C。  
原因是当前问题已经不是单边失衡，而是起手强度、奖励节奏、商店可达性三者互相叠加。

## 5. 战斗闭环设计

### 5.1 主要问题

从现有回归看：

- `informant` 起手牌组过于依赖 Intel 条件成立
- `go_dark` 是 0 费但要 2 Intel，早期很容易成为死牌
- `brute` 起手 `bash + flex + 5 strike` 的直接压制太强
- `tactician` 起手 `deadly_poison + acrobatics` 在低层敌人血量区间收益过高

### 5.2 战斗校准方向

1. `informant` 增强早期可兑现性  
   思路是降低第一轮“空转”的概率，而不是简单加面板。

2. `brute` 压低早期爆发  
   思路是削弱首层直接击穿能力，保留中期强度特征。

3. `tactician` 约束毒与过牌在前 3 层的压制力  
   思路是减少低层敌人面对毒叠层的不可逆滚雪球。

### 5.3 战斗侧优先改动点

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`

## 6. 经济闭环设计

### 6.1 主要问题

当前经济系统虽然已经接入统一基线，但仍有两个结构性问题：

1. 奖励输出偏固定  
   `calculateRewardRuntime()` 的金币、卡牌选择数、药水/遗物概率还不够体现“楼层购买能力”。

2. 价格闭环不完整  
   商店价格、删除成本和单层平均新增金币之间没有明确目标带宽。

### 6.2 经济校准方向

1. 以“单层可达性”作为约束  
   玩家在前 3 层应具备有限但真实的购买能力，而不是长期只能存钱或长期无脑全买。

2. 以“楼层净资产 EVU 增长”作为目标  
   增长要平滑递增，不允许前期极紧、后期极度通胀。

### 6.3 经济侧优先改动点

- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/features/progression/economySystem.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`

## 7. 验证策略

### 7.1 战斗验证

- `npm run lint`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts --runs=12 --floors=3`

关键观察：

- `informant.survivalRateFirst3`
- 各职业 `avgCombatTurns`
- 职业间存活率离散度

### 7.2 经济验证

- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts --runs=12`

关键观察：

- 平均金币获得
- 商店可达性
- 删除成本与楼层净资产的比例

### 7.3 总体验证

- `npm run build`
- `npm run check:import-boundaries`
- `npm run check:deprecated-imports`
- `npm run check:readme-consistency`

## 8. 风险与回滚

主要风险：

- 过度强化 `informant`，把失衡从“过弱”变成“前期最稳”
- 过度压低 `brute` / `tactician`，导致职业特色消失
- 经济曲线改动过大，破坏现有商店与奖励节奏

控制方式：

- 只做小步修正
- 每轮修改后立即回归
- 优先调起手兑现率与曲线参数，不做大规模内容重写

## 9. 预期结果

实施后应达到：

- 战斗侧：职业前 3 层存活率明显收敛，`informant` 脱离 0
- 经济侧：前期购买能力稳定，删除/购买/存钱三者出现真实取舍
- 报告侧：可以明确写出“旧缺陷 -> 本轮修正 -> 回归结果 -> 仍待优化项”
