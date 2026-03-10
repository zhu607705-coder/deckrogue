# 数值系统全面检修与维护执行计划（全量数值链路）

## Summary
目标是对当前项目的“数值系统”做一次完整的静态审查 + 动态验证 + 修复回归闭环，覆盖公式正确性、计算边界、输入输出一致性、数值算法稳定性与精度可靠性，并形成可追踪的检修报告。

本计划已按你的选择锁定：
- 范围：全量数值链路（战斗/状态、经济/奖励、地图与 AI 概率、RNG、模拟脚本、指标统计）
- 验证深度：静态审查 + 模拟脚本 + 关键流程回归
- 修复策略：精度与正确性优先（平衡只做必要微调）

## 目标与成功标准
1. 数值正确性
- 核心公式与实现一致，无明显计算错误（伤害、格挡、状态层数、金币、价格、奖励、评分、概率）。
- 无 `NaN` / `Infinity` / 非法负值传播到核心状态。

2. 数据完整性与一致性
- 数值输入输出链路一致（内容数据 -> 引擎计算 -> UI 展示/脚本统计）。
- 存档/读档后关键数值（HP、金币、状态层数、腐化、种子状态）不漂移。

3. 算法可靠性
- RNG 可复现（相同 seed 输出一致）。
- 概率/权重抽样逻辑无系统偏差。
- 模拟脚本统计口径稳定，JSON 输出字段完整且可解释。

4. 可维护性
- 识别数值逻辑重复、魔法数字、舍入策略不一致等问题。
- 给出最小修复方案与结构性优化方案。

## 审查范围（文件级）
### 核心数值实现（主审）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/combatSystem.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/balanceSystem.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/economySystem.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/evaluationSystem.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/rng.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/metricsTracker.ts`

### 数值消费与状态桥接（交叉验证）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/engine.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/engine/runGenerator.ts`

### 模拟与回归脚本（主审）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/simulate_early_balance.ts`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/balance_test.ts`

### 数据源（抽样核对）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/cards.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/enemies.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/relics.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/characters.json`

### UI 数值显示一致性（抽样）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/CombatView.tsx`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/ShopView.tsx`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/RewardView.tsx`

## 执行阶段（决策完成）
## Phase 0 — 基线建立（不改代码）
### 目的
建立当前数值行为的“修复前基线”，用于后续对比。

### 执行项
1. 运行基础检查
- `npm run lint`
- `npm run build`

2. 运行数值模拟基线（20 局/职业）
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/simulate_early_balance.ts --runs=20`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/balance_test.ts --runs=20 --floors=5`

3. 导出/保存基线结果
- 保存命令输出到报告附录（文本）
- 抽取 JSON 输出到基线证据文件（如 `reports/numerical-audit/baseline/*.json`）

### 产物
- 基线指标总表（每职业胜率、平均回合、楼层推进、敌人威胁）
- 基线异常日志（如脚本报错、超时、字段缺失）

## Phase 1 — 静态数值审查（公式、精度、边界）
### 审查维度
1. 公式与实现一致性
- `balanceSystem` 中卡牌价值、遗物价值、协同/评分公式是否与实际战斗/经济逻辑一致。
- `economySystem` 中价格、奖励、楼层缩放公式是否存在重复定义或口径冲突。
- `evaluationSystem` 与 `metricsTracker` 的统计口径是否一致。

2. 舍入与精度策略一致性
- 所有数值边界处统一检查：`Math.floor` / `Math.round` / `Math.ceil` / clamp 使用是否合理。
- 明确哪些值允许浮点（评分、倍率），哪些值必须整数（HP、伤害、格挡、金币、价格、状态层数）。
- 检查浮点乘法后落地整数的时机是否一致（尤其伤害倍率、腐化伤害增幅、奖励缩放）。

3. 边界条件与非法值传播
- 空对象/空数组统计均值除零风险。
- 负值扣减导致的下溢（HP、block、gold、status stacks）。
- 未定义数据字段导致 `Number(undefined)` 或 `NaN`。
- 概率权重总和为 0 或权重含负数时的抽样行为。

4. RNG 与可复现性
- `createRNG(seed, state?)` 的状态推进是否稳定。
- 相同 seed 是否保证地图、敌人选择、奖励选择一致（至少在脚本路径内）。
- 存档状态恢复时 RNG state 的连续性（交叉检查 `engine.ts`/保存逻辑）。

### 输出格式
- Findings（P0-P3）按严重度排序，逐条列出位置、影响、修复方案。
- 数值约束表（哪些字段必须整数/非负/有上限）。

## Phase 2 — 动态验证（模拟 + 关键流程回归）
### A. 模拟脚本验证（主验证）
1. 全职业 20 局回归
- `simulate_early_balance.ts --runs=20`
- `balance_test.ts --runs=20 --floors=5`

2. 单职业深挖（仅对异常职业）
- 使用已支持 CLI：`--class=<characterId> --runs=20`
- 触发条件：
  - 3 层存活率显著异常
  - 平均战斗回合异常拉长
  - 敌人威胁榜单异常集中（可能数值或 AI 概率偏差）

3. 稳定性验证
- 同一命令重复执行两次，对比关键指标与 JSON 字段结构。
- 核对 deterministic 区间（如相同 seed 逻辑路径的一致性；允许 UI 无关日志差异）。

### B. 关键运行流程回归（数值一致性抽样）
目标是验证“引擎数值变化 -> UI 展示/状态文本”的一致性，而不是做全 UI 验收。

抽样场景：
1. 战斗中玩家/敌人受击
- HP 条与 HP 文本同步更新
- 伤害、格挡、力量、易伤、中毒、腐化显示与实际结算一致

2. 商店与奖励
- 商品价格、购买后金币扣减、免费/折扣逻辑一致
- 奖励数值展示与实际入账一致（金币、HP 恢复、药水/遗物效果说明）

3. 回合状态衰减
- 中毒、隐身、情报、腐化、延迟效果在回合切换时数值正确变化

## Phase 3 — 问题分类与修复实施（执行阶段）
### 修复优先级
- `P0`：崩溃、`NaN/Infinity` 污染核心状态、核心公式错误导致流程失真
- `P1`：关键数值规则错误（伤害/状态/奖励/价格/权重抽样）
- `P2`：边界问题、统计口径不一致、显示与实际轻度不一致
- `P3`：可维护性与风格问题（魔法数字、重复逻辑、命名不清）

### 修复策略（精度与正确性优先）
1. 先修“确定错误”
- 错误舍入点
- 权重抽样/概率错误
- 除零与非法值保护缺失
- 状态层数/HP/block/gold 下界缺失

2. 再修“一致性问题”
- UI 数值文本与实际状态源不同步
- 统计脚本口径与引擎实际规则不一致
- 内容数据字段默认值处理不一致

3. 最后做“必要微调”
- 若修复正确性后某职业/敌人数值明显偏离可玩区间，仅做小幅调参
- 不做大范围平衡重做

## Phase 4 — 修复后回归与对比
### 必跑回归
- `npm run lint`
- `npm run build`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/simulate_early_balance.ts --runs=20`
- `npx tsx /Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/balance_test.ts --runs=20 --floors=5`

### 对比输出
- 修复前后指标对比表（按职业）
- 修复前后异常数量对比（NaN/非法值/脚本异常/回合超时）
- 若存在平衡副作用，单列说明“原因 -> 影响 -> 是否接受”

## Phase 5 — 文档交付（详细检修报告）
### 报告文件（建议）
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/numerical-system-audit.md`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/numerical-system-audit-baseline.json`
- `/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/numerical-system-audit-postfix.json`

### 报告结构（固定）
1. 审查范围与方法
2. 基线结果（20 局/职业）
3. 详细问题清单（P0 -> P3）
4. 差异与异常说明（含复现条件）
5. 修复内容与方案说明
6. 修复后回归结果与前后对比
7. 剩余风险与后续建议

## 重要变化或新增 Public APIs / Interfaces / Types
### 默认策略（本次）
- 不变更对外公共 API（游戏 UI 对引擎的公开调用接口保持兼容）。
- 数值修复优先通过内部实现修正完成。

### 允许的内部新增（如需要）
- 数值保护辅助函数（例如 `assertFiniteNumber`, `clampNonNegativeInt`）
- 内部诊断类型（例如 `NumericAnomaly`, `NumericCheckResult`）
- 仅脚本侧的报告结构类型（不暴露给运行时 UI）

### 禁止项（本轮）
- 不进行大规模重构导致接口迁移
- 不进行与数值正确性无关的 UI 样式改动

## 核心检查清单（实现者执行时逐项勾验）
1. 所有战斗结算路径中的最终伤害/格挡/治疗是否落在合法范围且为整数。
2. 所有状态层数（Poison/Stealth/Intel/Corruption 等）是否有明确下界与递减规则。
3. 所有金币/价格/奖励是否不会出现负数或小数入账。
4. 所有概率抽样逻辑是否基于总权重采样，权重异常时有兜底。
5. 所有均值/比率统计是否避免除零。
6. RNG 同 seed 是否可复现，状态恢复是否连续。
7. UI 展示的关键数值文本是否绑定实时数据源，而不是静态快照。
8. 模拟脚本输出 JSON 字段是否稳定、完整、无 `NaN/null` 异常污染。

## Test Cases and Scenarios
### 静态与构建
1. `npm run lint` 通过。
2. `npm run build` 通过。

### 数值模拟
1. 全职业 `simulate_early_balance` 20 局运行完成，无脚本异常退出。
2. 全职业 `balance_test` 20 局、5 层运行完成，无 JSON 结构异常。
3. 至少一个异常职业执行 `--class=<id> --runs=20` 单独复核（如出现异常）。

### 核心数值行为（运行时抽样）
1. 玩家攻击敌人：敌方 HP 文本、血条、实际存活判定一致。
2. 敌人攻击玩家：玩家 HP 文本、血条、护甲扣减顺序一致。
3. 中毒结算：造成伤害并递减层数，毒死敌人能触发胜利链路。
4. 腐化增伤：显示值与伤害实际倍率一致（含上限逻辑）。
5. 商店购买：价格显示、金币扣减、库存变化一致。
6. 奖励结算：金币/药水/遗物效果展示与实际状态变化一致。
7. 存档/读档：HP、金币、状态层数、RNG 相关行为不出现明显漂移。

## 问题记录规范（报告内必须统一）
每条问题必须包含：
- `Severity`（P0/P1/P2/P3）
- `Title`
- `Location`（绝对路径 + 行号）
- `Symptom`（现象）
- `Cause`（根因）
- `Impact`（影响范围）
- `Fix Plan`（修复方案）
- `Validation`（如何验证修复）

## Assumptions and Defaults
1. 本计划面向“下一执行阶段”的实施，当前仅输出执行方案（不在本回合修改代码）。
2. 数值系统审查以引擎与脚本为主，UI 仅做数值展示一致性抽样，不做全面视觉设计审查。
3. 平衡改动仅在“修复正确性后显著失衡”时做必要微调，不做职业系统重做。
4. 使用现有脚本 CLI 作为主要量化证据来源（已支持 `--runs`、`--class`，`balance_test` 额外支持 `--floors`）。
5. 报告语言默认中文，必要术语保留英文（如 RNG、NaN、clamp、weight sampling）。
