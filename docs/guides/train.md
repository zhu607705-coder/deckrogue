# DeckRogue 训练手册

更新时间：2026-03-20

## 1. 训练定义

这里的“训练”指数值平衡训练，不是模型参数训练。

目标是用仓库里已经存在的三类脚本形成可重复闭环：

1. `scripts/analysis/balance_test.ts`
   负责战斗强度与职业分布回归。
2. `scripts/analysis/simulate_early_balance.ts`
   负责前 3 层经济、节点分布与可购买性回归。
3. `scripts/analysis/numeric_diagnostics.ts`
   负责 NaN、Infinity、负值异常与基础公式漂移巡检。

## 2. 当前基线

基线来源：

- `output/numerics/combat_regression.json`
- `output/numerics/economy_regression.json`

### 2.1 战斗基线

- `survivalSpreadFirst3 = 0.2333`
- `survivalSpreadAll5 = 0.2000`
- `powerSpread = 12.31`
- `avgCombatTurns` 区间：`1.44 ~ 3.37`
- 主要异常职业：
  - `informant`: `slow_combat_tempo`
  - `brute`: `dominant_fast_tempo`
  - `chronomancer`: `low_early_survival`
  - `alchemist`: `high_early_survival`、`dominant_overall_score`

关键职业点位：

- `chronomancer.survivalRateFirst3 = 0.6000`
- `alchemist.survivalRateFirst3 = 0.8333`

### 2.2 经济基线

- `card affordability = 1.0`
- `potion rewardToPriceRatio = 0.7673`
- `relic rewardToPriceRatio = 0.3706`
- `floor3 removal affordable = true`
- `floor1 removal affordable = false`
- `nodeDistribution.totalVariationDistance` 区间：`0.8070 ~ 0.8603`

当前最明显的问题不是“没钱买卡”，而是：

1. 药水和遗物的性价比仍偏低。
2. 节点解析分布与生成分布偏差过大。
3. 训练日志已经出现运行时状态机错误和未实现动作，说明当前产物已被引擎缺口污染。

## 3. 本轮预期优化目标

### 3.1 硬目标

1. `powerSpread <= 5.00`
2. `survivalSpreadFirst3 <= 0.15`
3. 最弱职业 `survivalRateFirst3 >= 0.65`
4. `potion rewardToPriceRatio >= 0.82`
5. `relic rewardToPriceRatio >= 0.42`
6. 所有职业 `nodeDistribution.totalVariationDistance <= 0.75`
7. `floor3 removal affordable = true`
8. 训练日志中不再出现 `Illegal run transition`
9. 训练日志中不再出现 `Unknown action type`
10. `numeric_diagnostics` 不出现 `error` 级别异常

### 3.2 护栏

1. 任何职业 `avgCombatTurns` 不要高于 `3.8`
2. 任何职业 `avgCombatTurns` 不要低于 `2.0`
3. 任何职业 `survivalRateFirst3` 不要低于 `0.60`
4. `card affordability` 必须保持 `1.0`
5. 不靠单职业极端加强换取 spread 收敛

### 3.3 本轮优先级

1. 先修训练日志里的运行时状态机错误
2. 再补齐训练过程中出现的未实现动作
3. 然后回收 `chronomancer` 低存活和 `alchemist` 过强漂移
4. 最后处理药水/遗物价格和节点分布偏斜

## 4. 训练命令

### 4.1 快速迭代

```bash
npx tsx scripts/analysis/balance_test.ts --runs=12 --floors=5
npx tsx scripts/analysis/simulate_early_balance.ts --runs=6
npx tsx scripts/analysis/numeric_diagnostics.ts --runs=1 --floors=3 --turns=8
```

### 4.2 标准训练轮

```bash
npx tsx scripts/analysis/balance_test.ts --runs=30 --floors=5
npx tsx scripts/analysis/simulate_early_balance.ts --runs=12
npx tsx scripts/analysis/numeric_diagnostics.ts --runs=2 --floors=3 --turns=8
```

## 5. 结果判定

满足以下条件，才算这一轮训练有效：

1. 三个脚本都跑完并落盘新产物
2. `combat_regression.json` 满足第 3 节硬目标中的战斗指标
3. `economy_regression.json` 满足第 3 节硬目标中的经济指标
4. `numeric_diagnostics` 没有 `error` 级别告警
5. 训练日志没有 `Illegal run transition`
6. 训练日志没有 `Unknown action type`

如果没有跑完，或者只改了文档没有实际执行，本轮不计入已完成训练。

即使脚本退出码为 `0`，只要命中第 5 或第 6 条，也按训练失败处理。

## 6. 2026-03-20 Round 0

状态：已执行，判定失败

执行命令：

```bash
npx tsx scripts/analysis/balance_test.ts --runs=30 --floors=5
npx tsx scripts/analysis/simulate_early_balance.ts --runs=12
npx tsx scripts/analysis/numeric_diagnostics.ts --runs=2 --floors=3 --turns=8
```

结果记录：

- 战斗回归：
  - `survivalSpreadFirst3 = 0.2333`，未达标
  - `powerSpread = 12.31`，未达标
  - 最弱职业变为 `chronomancer = 0.6000`
  - `alchemist = 0.8333`，出现过强漂移
- 经济回归：
  - `potion rewardToPriceRatio = 0.7673`，未达标
  - `relic rewardToPriceRatio = 0.3706`，未达标
  - `nodeDistribution.totalVariationDistance` 仍在 `0.8070 ~ 0.8603`
  - `floor3 removal affordable = true`，达标
- 数值诊断：
  - `errors = 0`
  - `warnings = 25`
- 训练阻塞：
  - 多次出现 `Illegal run transition: cannot resolve combat victory from game_over`
  - 多次出现 `Illegal run transition: cannot resolve combat victory from character_select`
  - 多次出现 `Unknown action type: RemoveStatus`
  - 多次出现 `Unknown action type: DamageBoost`
  - 多次出现 `Unknown action type: ConditionalDamage`
  - 多次出现 `Unknown action type: ConditionalApply`
  - 多次出现 `Unknown action type: TriggerPoisonOnTarget`

结论：

Round 0 已完成训练链路验证，但不计入有效优化轮。

下一轮开始前必须先修：

1. `runStateMachine` 与战斗胜利事件的非法状态迁移
2. `ActionManager` 中缺失的动作实现
3. 然后再重跑第 4.2 节标准训练轮
