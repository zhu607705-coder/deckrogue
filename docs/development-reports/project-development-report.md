# 开发报告：deckrogue project-development-report

- 日期：<持续更新>
- 工作区：/Users/zhuhangcheng/Downloads/好玩/deckrogue
- 当前任务目标：将 DeckRogue 桌面化为可安装、可双击 EXE 启动的 Windows 游戏，并补齐 Electron 壳、桌面 smoke、Windows 打包链与门禁接线
- 当前状态：in_progress
- 当前阶段：implementation
- 最近一次通过验证的检查点：`npm run doctor:game:full`（`28/28`）
- 完成标准：Electron 生产模式不依赖 localhost，桌面 smoke 可跑通，Windows 安装包链和 release readiness 桌面检查完成接线，并记录未在本机完成的 Windows 实证范围
- 当前风险/阻塞：当前开发机为 macOS，本轮只能本地验证 Electron dev/prod 启动与 smoke，Windows 安装包实证需要 Windows 构建机或 CI

说明：这是本项目唯一开发报告文件。后续同一项目的新任务继续追加到本文件，不再新建第二份开发报告。

## 项目历史与当前基线整合

本节用于吸收本项目旧计划、旧开发报告和阶段性设计文档中的长期有效逻辑。后续制定计划或恢复上下文时，默认先读这一节，再按需回看原始 legacy 文档。

### 项目演进主线

DeckRogue 的工程演进可以收敛成四条连续主线：

1. 原型堆叠阶段先把玩法跑通，形成了战斗、地图、奖励、商店、篝火、事件、遗物、药水等完整闭环，也留下了入口不正式、目录职责模糊、状态权责分散、数值口径并存等问题。
2. 第一轮结构治理把仓库和 `src` 目录按功能区收口，建立 `core / features / content / ui / infrastructure` 的稳定边界，并接入正式 Launcher、读档/继续流程、构建分包和关键脚本门禁。
3. 第二轮数值治理把分散在战斗、经济、遗物、协同和诊断脚本中的估值与缩放逻辑统一到 `src/core/balance`，形成单一数值域，后续战斗与经济校准都必须站在这条基线上进行。
4. 第三轮 runtime 与训练治理把“能跑”的模拟流程升级成“可信”的回归流程，重点修状态机、事件生命周期、缺失动作与诊断门，避免继续使用带结构性错误的训练结果调参。

当前这个 `project-development-report.md` 承接上述四条主线。新一轮工作只要属于本项目范围，都应该接着这四条主线继续写，不再平行创建新的项目历史文件。

### 数值系统与工程治理沉淀

来自 `PLAN.md`、`2026-03-06-numerics-domain-refactor.md` 和 `development_report_2026-03-06.md` 的长期有效结论如下：

- 数值问题不能只看单个公式，必须覆盖完整链路：内容数据、引擎计算、UI 展示、回归脚本、RNG 复现、统计口径和存档恢复都属于数值系统。
- 统一数值域是后续一切平衡工作的前提。`balance / economy / relic / synergy / diagnostics` 不能各自维护一套价值口径，所有估值、缩放和风险折价都要回到 `src/core/balance`。
- 精度与正确性优先于“手感微调”。如果存在 `NaN`、`Infinity`、非法负值传播、概率偏差、口径不一致或种子不可复现，应该先修这些结构问题，再做职业强度回收。
- 工程治理与数值治理是同一条链路。入口边界、生命周期、懒加载、公共导出和脚本门禁决定数值系统能否被持续维护和可信验证。

当前仍然可以直接沿用的工程底线是：

- 新数值逻辑优先进入 `src/core/balance`
- 旧系统只保留薄兼容层，不再重新长出并行口径
- 任何数值修复都要附带脚本或测试验证，不能只凭局部体验判断
- 计划里如果出现“再加一套临时公式”或“先绕开统一基线”，默认视为逆向演化

### 战斗与经济校准沉淀

来自 `2026-03-06-combat-economy-calibration-design.md` 和 `2026-03-06-combat-economy-calibration.md` 的长期有效逻辑如下：

- 战斗闭环和经济闭环需要联动看，不能只改起始牌组，也不能只改商店曲线。早期存活、奖励节奏、购买能力和删除成本会共同决定职业强度分布。
- 校准顺序应固定为：先守住统一数值域，再修前 3 层稳定性，再看中后期放大，最后才允许做更细的职业差异化。
- 职业调整优先动内容层和运行时系数，主要杠杆是 `startingDeck`、职业基础生存、扩展池关键卡、奖励权重、价格/奖励曲线，不优先动 UI 或另起机制。
- 验证口径必须回到回归产物，尤其是 `combat_regression.json` 和 `economy_regression.json`。通过标准是早期存活率带宽、战斗节奏、商店可达性、删除可达性和奖励/价格比，不是单局体验。

这部分逻辑已经在项目历史里验证过一轮，后续继续调参时应默认沿用以下顺序：

1. 先确认训练链路干净，没有非法状态迁移和未知动作。
2. 再看职业间的早期生存与节奏离散度。
3. 最后做价格、奖励和路线分布的收口。

### Runtime 与训练可信度沉淀

来自 `2026-03-08-runtime-balance-content-next-steps.md` 和 `development_report_2026-03-20.md` 的长期有效逻辑如下：

- runtime 架构、训练可信度、内容扩展必须分层处理。顺序固定为：先修运行时权责和状态迁移，再修训练脚本的可信门禁，最后才做职业扩展与系统调参。
- `GameSetup` 和 `GameEngine` 的权责必须清晰，旧 run 的事件不能污染新 run，终局事件必须幂等，状态机应保持严格，不应用兜底跳转掩盖非法迁移。
- 训练脚本必须把结构性错误作为失败条件输出。`illegalRunTransitions`、`unknownActionTypes`、诊断 verdict 等字段属于训练结果的一部分，不是调试噪音。
- 动作系统和内容系统要同步维护。若卡牌或敌人配置引用了未实现动作，训练结果默认不可信，优先补齐动作或修正内容。

当前仍然有效的 runtime 纪律是：

- 没有通过状态机和动作诊断的训练产物，不进入平衡讨论
- 先修事件生产端和生命周期，再考虑放宽 reducer 规则
- 训练脚本命中结构诊断就应该直接失败，不保留“exit 0 但日志很脏”的路径

### 当前仍然有效的执行原则

综合以上 legacy 文档，本项目后续继续规划或实施时，默认遵守以下原则：

1. 任何新计划先读本文件，再决定是否还需要回看 legacy 文档。
2. 所有新的计划、进度、验证和结论直接追加到本文件。
3. 优先修结构正确性，再做平衡与体验调优。
4. 用统一数值域和统一训练门作为唯一可信基础。
5. 对职业、经济、runtime 的调整都要回到回归脚本和测试做闭环。

### Legacy 来源记录

以下 legacy 文档的长期有效逻辑已经整合进本节，原始文件已完成折叠清理，不再作为日常入口：

- `docs/plans/PLAN.md`
- `docs/plans/2026-03-06-combat-economy-calibration-design.md`
- `docs/plans/2026-03-06-combat-economy-calibration.md`
- `docs/plans/2026-03-06-numerics-domain-refactor.md`
- `docs/plans/2026-03-08-runtime-balance-content-next-steps.md`
- `development_report_2026-03-06`
- `development_report_2026-03-20`

## 报告集中策略与当前开发情况

### 报告集中策略

当前项目的报告集中规则分成两层：

1. `docs/development-reports/project-development-report.md` 是唯一的人类阅读主报告，用来集中吸收 legacy 报告、canonical JSON 报告和代码级结构现状。
2. `reports/*/*.json` 与 `docs/reports/report_bundle.md` 继续保留为机器可读或检查器消费的 canonical 工件，但这些工件的业务结论必须回写到本文件，不能让项目真实状态只留在散落 JSON 里。
3. `docs/reports/` 下的 legacy 细分报告已经完成折叠并删除，后续不再恢复多份人工平行报告。

当前已经纳入本文件的报告来源包括：

- `reports/doctor/report.json`
- `reports/release/release-readiness.json`
- `reports/security/security-report.json`
- `reports/translation/translation-audit.json`
- `reports/content/experience-polish.json`
- `reports/content/ecosystem-balance.json`
- `reports/content/numeric-diff.json`
- 已折叠删除的 legacy 报告簇：
  - `balance_report`
  - `balance_test_report`
  - `engine_fix_report`
  - `engine_review_report`
  - `numerical-system-audit`
  - `ui_fix_report`
  - `ui_review_report`

当前 canonical 基线可压缩为：

- `doctor`: 26 / 26 通过
- `release readiness`: 19 项里 18 通过、1 警告、0 失败
- `translation audit`: 英文残留 0、术语冲突 0、表意警告 0
- `security`: 总问题 84，其中中危 39、低危 45，当前结论为 `healthy / low`
- `experience polish`: 25 项里 20 已实现、3 部分实现、2 缺失，完成率 86
- `ecosystem balance`: 6 个职业都已进入同一评估面，但 `chronomancer`、`alchemist`、`puppeteer` 仍处于 watch
- `numeric diff`: 当前仍因缺少锚点与未验证项而保持 `fail`

### 数值层面开发情况

当前数值层的结构已经收敛到 `src/core/balance`：

- [index.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/index.ts) 统一导出 `balanceSystem`、`numericConstants`、`numericMath`、`numericsBaseline`、`valuationKernel`、`runtimeCoefficients`、`numericDiagnostics` 等模块。
- 这说明数值规则、估值、运行时系数、诊断与基线已经从旧的分散公式整理成单一入口。

从 legacy 报告折叠出的长期有效结论如下：

- `balance_report.md` 与 `balance_test_report.md` 记录了职业差异最早是通过起始牌组、卡牌即时价值和元素反应系数来调节的。
- `numerical-system-audit.md` 记录了旧引擎时代的重点风险是状态衰减不完整和浮点口径不统一。
- 当前代码层已经把伤害基础归一、乘区处理、软上限和腐化/遗物修正集中到了 `numericMath + combatSystem` 管线里，结构比旧报告阶段更一致。

当前数值层的真实状态可以归纳为：

1. 数值域集中化已经建立，后续新规则应继续进入 `core/balance`。
2. 平衡基线已经有 6 个职业同场比较能力，但生态解释还不完整，因为 `cardPickRate`、`relicPickRate`、`nodeAvoidance`、`failureExplainability` 仍然缺数据。
3. 当前数值链没有高危阻塞，但 `numeric-diff` 仍未形成可验真值链，所以“数值审计已完全闭环”当前仍是`假说`，验证计数为 `1`。

### 战斗层面开发情况

当前战斗层的主干已经相对清晰：

- [combatSystem.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/combat/combatSystem.ts) 统一负责：
  - `calculateDamage`
  - `applyDamage`
  - `applyStatus`
  - 状态乘区、协同乘区、腐化与遗物增伤、软上限处理
- [gameEngine.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts) 负责：
  - `startCombat`
  - 敌人生成
  - 回合开始与回合结束
  - 敌方行动
  - `handleCombatVictory`
  - 奖励生成和返回地图
- [SpecialActions.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts) 中的 `TriggerPoisonOnTargetAction` 已在本轮治理后对齐统一毒伤规则，走 `combatSystem.applyDamage(...)`，并与引擎毒伤 tick 保持 `true damage + ignore block` 一致。

从 legacy 报告折叠出的战斗层有效结论如下：

- `engine_fix_report.md` 记录的商店升级退款、战斗胜利同步、延迟卡目标丢失、事件订阅冗余等问题，当前都已经不再是主阻塞。
- `engine_review_report.md` 提醒 `GameEngine` 一直有职责偏大问题，这一点在当前代码里仍然成立。
- `balance_test_report.md` 和 `ecosystem-balance.json` 共同说明：职业主循环已经可测，但 `chronomancer` 过强、`puppeteer` 偏弱、`alchemist` 早期生存偏高仍需继续观察。

当前战斗层的真实状态可以归纳为：

1. 战斗伤害和状态已经有统一主管线，特殊分支继续向统一管线收口。
2. 卡牌出牌、动作排队、敌方行动、胜利奖励已经形成完整闭环。
3. 体验 polish 仍有两个明确缺口：
   - 状态施加反馈还是缺失
   - 升级页“提升类别标签”仍只做到 partial
4. 战斗逻辑当前没有 fresh 红灯，但 `GameEngine` 体量仍大，后续维护成本高。

### UI 层面开发情况

当前 UI 主路径已经形成完整壳层：

- [SetupLauncher.tsx](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/launcher/SetupLauncher.tsx) 提供启动器、继续作战、教程入口、存档概览和局外资源概览。
- [UnifiedAppShell.tsx](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/UnifiedAppShell.tsx) 负责统一入口、菜单、主题、教程、键位和多页面 lazy loading。
- [CombatView.tsx](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/CombatView.tsx) 已集成：
  - 战斗背景层
  - HUD
  - Battlefield
  - ActionHand
  - 术语联动
  - 教程 overlay
- [RewardView.tsx](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/RewardView.tsx) 已改成中央聚焦的单页决策布局，奖励卡牌使用 compact 版本。

从 legacy UI 报告折叠出的有效结论如下：

- 已折叠的 legacy UI 报告记录的地图图标重渲染、商店药水槽位、奖励空状态问题都已经收口。
- 已折叠的 legacy UI 审查结论对“UI 质量中等偏上、功能完整度高、MapIcon 曾是风险点、CombatView 过大”的判断，今天仍然有部分参考价值。

当前 UI 层的真实状态可以归纳为：

1. 玩家主流程页面已经成型，启动器、角色选择、地图、战斗、奖励、商店、事件、结算都能串起来。
2. 教程、术语泡泡、图鉴、奖励页和首战联动已经接上统一术语层。
3. 视觉 polish 已完成大部分，但 `experience-polish.json` 仍显示：
   - 2 项缺失
   - 3 项部分实现
4. `runtime-v2` 兼容路径里仍存在可见英文和占位文本，例如 [runtimeV2AppShell.tsx](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/react/runtimeV2AppShell.tsx) 与 [renderModel.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/renderModel.ts) 里的启动器、副本标题和奖励占位文案，因此“全 UI 文本完全统一”当前仍是`假说`，验证计数为 `1`。

### 实时结算层面开发情况

当前实时结算层主要由 `GameEngine + ActionManager + combatSystem + renderModel` 组成：

- [gameEngine.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts) 中：
  - `resolveCurrentNodeEntry` 统一处理地图节点进入
  - `startCombat` 在进入战斗前建立 `combatRestartCheckpoint`
  - `restartCombatFromCheckpoint` 重新绑定 RNG、状态和节点上下文
  - `handleCombatVictory` 把 `combat.player` 同步回 `state.player`，生成奖励并推进地图
- [renderModel.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/renderModel.ts) 负责把规则快照压成 UI 可消费的房间、奖励和地图结构。
- [combatSystem.ts](/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/combat/combatSystem.ts) 在 `applyDamage` 中统一发布 `DamageDealt / DamageReceived / EnemyDeath / PlayerDeath` 事件。

这条链当前已经具备的能力有：

1. 战斗中伤害、格挡、状态、死亡事件和奖励推进都能走到统一事件链。
2. 战斗重开和章节边界问题已经在前序工作中修过，并被场景矩阵重新验证过。
3. 存档/读档、快速继续、奖励后回地图、敌方回合推进都已经进过主门禁。

当前仍然需要明确记录的约束有：

- `cloneGameStateSnapshot()` 仍然基于 `JSON.parse(JSON.stringify(...))`，虽然现在放在 try/catch 内，但这条链仍然只适合纯数据状态，后续如果状态对象继续复杂化，需要更显式的快照边界。
- `GameEngine` 仍然承担过多职责，实时结算正确性依赖这一个大类继续保持稳定。
- `renderModel` 的 reward fallback 仍带有占位描述，这说明 runtime-v2 兼容链的实时展示还没有完全脱离过渡态。

### 当前集中结论

按当前代码与 canonical 报告综合判断，项目现状可以压成 4 条：

1. 数值、战斗、UI、实时结算四条链都已经有正式主干，并且 `doctor` 当前全绿。
2. 项目已经进入“可持续治理”阶段，主问题不再是流程缺失，而是生态平衡解释、runtime-v2 兼容文本、体验 polish 尾项和 `GameEngine` 体量。
3. 现有 JSON 报告已经完成 canonical 化，但这些结论必须继续回写本文件，避免再出现“报告散着、主报告空着”的状态。
4. “当前全局状态长期稳定”这条更强结论仍然是`假说`，因为 fresh 全链路验证计数仍然偏低，当前按规则只计 `1` 次。

## 操作记录

### Step 1 `初始化`
- 操作方向：建立本任务的单一开发报告文件，并记录起始方向
- 代码编写目的：确保后续每一步都有目的、结果和验证留痕
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 执行与变更：初始化开发报告
- 得到的结果：报告文件已创建，可持续更新
- 检查点状态：已完成
- 验证：文件已生成
- 风险/阻塞：无
- 后续展望：进入第一轮实际实施步骤

### Step 2 `技能定位`
- 操作方向：定位用户提到的“报告生成 skill”，确认应更新的对象
- 代码编写目的：避免把经验写到错误的 skill 或只改工作区文档而没有改能力层
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`、`/Users/zhuhangcheng/.agents/skills/skill-creator/SKILL.md`
- 执行与变更：检索全局 skill 目录，确认 `development-report-discipline` 是最匹配的报告生成 skill，并补读 `skill-creator` 的修改技能流程约束
- 得到的结果：锁定本次应修改 `development-report-discipline`，补充内容应聚焦多报告场景下的自动总包生成与验证
- 检查点状态：已完成
- 验证：已读取 skill 定义与相关脚本
- 风险/阻塞：无
- 后续展望：把这次验证过的总包生成经验写入 skill 本体

### Step 3 `经验写回`
- 操作方向：把“多来源报告自动汇总”模式写回 skill 规则
- 代码编写目的：让后续触发该 skill 时，默认产出自动生成总包、稳定 latest 入口和立即验证
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 执行与变更：新增“Report Bundle Pattern”章节，明确在报告文件数量增多或频繁更新时，需要补生成脚本、按固定结构生成总包、产出日期版和 latest 版、扫描人工与自动化报告目录，并在完成前立即运行一次
- 得到的结果：skill 规则已覆盖这次证明有效的工作流，后续使用者能更稳定地产生相同效果
- 检查点状态：已完成
- 验证：已通过 `sed` 与 `rg` 读取更新后的 skill 文本，确认描述层和正文层都已写入 bundle 规则
- 风险/阻塞：当前这套经验来自 1 次验证，应按“假说”持续观察更多工作区
- 后续展望：后续在更多报告整合任务中继续验证该模式

### Step 4 `技能级验证`
- 操作方向：确认 skill 文本已包含新的触发词和 bundle 规则
- 代码编写目的：避免只修改文件但没有完成实际校验
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 执行与变更：使用 `rg` 检索 `report bundling`、`Report Bundle Pattern`、`stable latest bundle`、`Do not claim this bundle workflow exists`
- 得到的结果：关键规则均可命中，skill 已包含本轮经验
- 检查点状态：已完成
- 验证：`rg -n "report bundling|report consolidation|Report Bundle Pattern|stable latest bundle|Do not claim this bundle workflow exists" /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 风险/阻塞：无
- 后续展望：将该 pattern 在后续 2 次以上实际任务中继续复验

### Step 5 `单文件规则收敛`
- 操作方向：把“按任务分散开发报告”改成“同一项目唯一报告文件”
- 代码编写目的：确保后续计划和继续开发前，都能先读到同一份历史上下文
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`、`/Users/zhuhangcheng/.codex/skills/development-report-discipline/scripts/init_development_report.py`、`/Users/zhuhangcheng/.codex/skills/development-report-discipline/references/report-template.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/memory.md`
- 执行与变更：把 skill 的报告路径改成固定 `project-development-report.md`，新增“计划前先读已有项目报告”的强制规则，初始化脚本改为固定输出同一路径，模板改成项目级表述，并把本项目工作记忆写成单文件硬规则
- 得到的结果：机制层、模板层、初始化层和项目记忆层都已切到同一项目唯一报告文件模式
- 检查点状态：已完成
- 验证：待执行脚本级验证
- 风险/阻塞：旧任务如果已经散落为多份 dated 报告，后续仍需要逐步合并
- 后续展望：执行初始化脚本验证，确认它稳定回到同一路径

### Step 6 `脚本级验证`
- 操作方向：验证初始化脚本是否已经稳定返回项目级固定报告路径
- 代码编写目的：避免只改文案，没有真正改掉路径选择逻辑
- 相关文件：`/Users/zhuhangcheng/.codex/skills/development-report-discipline/scripts/init_development_report.py`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- 执行与变更：执行初始化脚本，传入新的 slug 和 goal，检查输出路径是否仍为 `docs/development-reports/project-development-report.md`
- 得到的结果：脚本已回到固定项目路径，不再新建 dated 报告
- 检查点状态：已完成
- 验证：`python3 /Users/zhuhangcheng/.codex/skills/development-report-discipline/scripts/init_development_report.py --workspace /Users/zhuhangcheng/Downloads/好玩/deckrogue --slug any-task --goal "check single file rule" --stdout`
- 风险/阻塞：当前规则泛化验证计数仍是 `1`
- 后续展望：后续计划任务先按这份报告恢复历史，再继续验证两轮以上

### Step 7 `全局规则扩展`
- 操作方向：把“同一项目唯一报告文件”和“计划也集成进去”的规则扩展到全局
- 代码编写目的：避免只有本项目遵守，其他工作区继续分散创建计划和开发报告
- 相关文件：`/Users/zhuhangcheng/.codex/AGENTS.md`、`/Users/zhuhangcheng/.codex/memory.md`、`/Users/zhuhangcheng/.codex/skills/writing-plans/SKILL.md`、`/Users/zhuhangcheng/.agents/skills/writing-plans-0.1.0/SKILL.md`
- 执行与变更：在全局 AGENTS 和全局 memory 中新增 project single-report rule，并把 `writing-plans` 的默认保存目标改成 `project-development-report.md`
- 得到的结果：规则层和计划技能层都已转向“同一项目单一项目报告文件”
- 检查点状态：已完成
- 验证：待执行文本级验证
- 风险/阻塞：已有其他项目的旧习惯仍可能残留，需要后续逐步复验
- 后续展望：验证全局规则和 planning skill 的关键命中点

### Step 8 `历史计划并入入口`
- 操作方向：把本项目目录里的旧计划和历史开发报告自然并入当前项目唯一报告入口
- 代码编写目的：保证以后制定计划时，可以直接在同一文件看见之前做了什么
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/PLAN.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration-design.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-numerics-domain-refactor.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-08-runtime-balance-content-next-steps.md`、已折叠的 `development_report_2026-03-06`、已折叠的 `development_report_2026-03-20`
- 执行与变更：搜索整个工作区的计划类与历史开发报告文件，把它们的主题和当前价值整理到本文件的“历史计划与开发文档索引”
- 得到的结果：以后继续做计划时，这一份文件已经能提供同项目的主要历史入口
- 检查点状态：已完成
- 验证：已通过目录搜索确认相关历史文件已被识别并纳入索引
- 风险/阻塞：当前是索引式并入，不是全文物理合并
- 后续展望：如果后续确实频繁引用其中某一份 legacy 文档，再把更细摘要继续吸收到本文件

### Step 9 `无歧义验证补跑`
- 操作方向：补跑一轮不含 shell 反引号歧义的规则验证
- 代码编写目的：确保全局规则、planning skill 和 project-report skill 的命中证据干净可复用
- 相关文件：`/Users/zhuhangcheng/.codex/AGENTS.md`、`/Users/zhuhangcheng/.codex/memory.md`、`/Users/zhuhangcheng/.codex/skills/writing-plans/SKILL.md`、`/Users/zhuhangcheng/.agents/skills/writing-plans-0.1.0/SKILL.md`、`/Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 执行与变更：使用 `rg -e` 形式重新检索关键规则，避免反引号被 shell 提前解释
- 得到的结果：全局单文件规则、计划写回同一项目报告规则、计划前先读项目报告规则都已被稳定命中
- 检查点状态：已完成
- 验证：`rg -n -e 'project single-report rule' -e 'each project must keep one canonical \`project-development-report.md\`' -e 'do not create separate dated plan files' -e 'planning, implementation progress, verification, continuation context' /Users/zhuhangcheng/.codex/AGENTS.md /Users/zhuhangcheng/.codex/memory.md`；`rg -n -e 'Default save target' -e 'project-development-report.md' -e 'fold the still-relevant context' -e 'written into \`project-development-report.md\`' /Users/zhuhangcheng/.codex/skills/writing-plans/SKILL.md /Users/zhuhangcheng/.agents/skills/writing-plans-0.1.0/SKILL.md`；`rg -n -e 'same project should have one development report markdown file' -e 'Read the existing project report before planning or substantial implementation' -e 'do not create separate project-history plan files' -e 'legacy \`docs/plans\`, roadmap files' /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
- 风险/阻塞：当前泛化验证计数仍是 `1`
- 后续展望：后续用其他项目再复验这套规则

### Step 10 `历史逻辑实质整合`
- 操作方向：把 legacy 计划与历史开发报告中的长期有效逻辑直接写进本项目唯一开发报告正文
- 代码编写目的：确保以后续做或制定计划时，只读本文件就能恢复项目主线、约束、调参顺序和 runtime 纪律
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/PLAN.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration-design.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-numerics-domain-refactor.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-08-runtime-balance-content-next-steps.md`、已折叠的 `development_report_2026-03-06`、已折叠的 `development_report_2026-03-20`
- 执行与变更：补读上述 legacy 文档后，删除原先仅做目录跳转的“历史计划与开发文档索引”，改写为“项目历史与当前基线整合”，把项目演进主线、数值系统沉淀、战斗与经济校准沉淀、runtime 与训练可信度沉淀、当前执行原则统一写入正文
- 得到的结果：`project-development-report.md` 已从单纯入口页升级为可直接承接后续规划和实施的项目连续历史文件
- 检查点状态：已完成
- 验证：`rg -n -e '项目演进主线' -e '数值系统与工程治理沉淀' -e '战斗与经济校准沉淀' -e 'Runtime 与训练可信度沉淀' -e '当前仍然有效的执行原则' /Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- 风险/阻塞：原始 legacy 文档仍保留在仓库中，后续如内容继续变化，需要继续把新增长期有效逻辑同步回本文件
- 后续展望：后续所有计划和续做记录直接写入本文件，不再新增平行计划文档

## 验证汇总

- 运行命令：
  - `sed -n '1,220p' /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
  - `rg -n "report bundling|report consolidation|Report Bundle Pattern|stable latest bundle|Do not claim this bundle workflow exists" /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`
  - `python3 /Users/zhuhangcheng/.codex/skills/development-report-discipline/scripts/init_development_report.py --workspace /Users/zhuhangcheng/Downloads/好玩/deckrogue --slug any-task --goal "check single file rule" --stdout`
  - `find docs/development-reports -maxdepth 1 -type f -name '*.md' | sort`
  - `find . -type f \( -iname '*plan*' -o -path '*/plans/*' -o -iname '*development_report*' -o -iname '*development-report*' -o -iname '*roadmap*' \) | sort`
  - `rg -n "project-development-report|Read the existing project report before planning|do not create dated per-task development reports|same project should have one development report markdown file" /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md /Users/zhuhangcheng/.codex/skills/development-report-discipline/scripts/init_development_report.py /Users/zhuhangcheng/.codex/skills/development-report-discipline/references/report-template.md /Users/zhuhangcheng/.codex/AGENTS.md /Users/zhuhangcheng/.codex/memory.md /Users/zhuhangcheng/.codex/skills/writing-plans/SKILL.md /Users/zhuhangcheng/.agents/skills/writing-plans-0.1.0/SKILL.md /Users/zhuhangcheng/Downloads/好玩/deckrogue/memory.md`
  - `rg -n -e 'project single-report rule' -e 'each project must keep one canonical \`project-development-report.md\`' -e 'do not create separate dated plan files' -e 'planning, implementation progress, verification, continuation context' /Users/zhuhangcheng/.codex/AGENTS.md /Users/zhuhangcheng/.codex/memory.md`
  - `rg -n -e 'Default save target' -e 'project-development-report.md' -e 'fold the still-relevant context' -e 'written into \`project-development-report.md\`' /Users/zhuhangcheng/.codex/skills/writing-plans/SKILL.md /Users/zhuhangcheng/.agents/skills/writing-plans-0.1.0/SKILL.md`
  - `rg -n -e 'same project should have one development report markdown file' -e 'Read the existing project report before planning or substantial implementation' -e 'do not create separate project-history plan files' -e 'legacy \`docs/plans\`, roadmap files' /Users/zhuhangcheng/.codex/skills/development-report-discipline/SKILL.md`

### Step 11 `审校门禁收口`
- 操作方向：修复审查指出的假绿灯问题，让 `translation audit` 和 `release readiness` 变成真实门禁
- 代码编写目的：避免文本审校和发布检查只靠报告文件存在就通过，提升 `doctor` 可信度
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/translation_audit.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/playwright_ui_smoke_expansion.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/TutorialView.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
- 执行与变更：
  - 扩大 `translation_audit` 扫描范围到教程页和强化页，并覆盖卡牌升级名称与升级正文
  - 为 `translation_audit` 增加阈值判定，超过允许数量时直接 `exit 1`
  - 修正教程页残留英文和术语冲突
  - 收口 `cards.json` 中升级名称与升级正文的英文残留
  - 让 `check_release_readiness` 读取最新 doctor/security/UI smoke 报告内容，不再只看文件是否存在
  - 修复 `playwright_ui_smoke_expansion` 在无菜单页面仍试图点击“菜单”的路径漂移
- 得到的结果：文本审校、发布检查和浏览器门禁都已经变成真实可拦截的检查器，`doctor:game:full` 恢复全绿
- 检查点状态：已完成
- 验证：
  - `npm run report:translation-audit`
  - `npm run check:release-readiness`
  - `npm run lint --silent`
  - `npm run test:ui-smoke:expansion`
  - `npm run doctor:game:full`
- 风险/阻塞：当前“门禁已稳定”结论的总体验证计数是 `1`，仍需后续独立复验继续累积
- 后续展望：后续再扩审校范围时，优先补 fixture 级自测，避免继续靠业务文件现象驱动修规则
  - `rg -n -e '项目演进主线' -e '数值系统与工程治理沉淀' -e '战斗与经济校准沉淀' -e 'Runtime 与训练可信度沉淀' -e '当前仍然有效的执行原则' /Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- 结果：
  - 触发描述已增加 `report consolidation`、`report bundling`、`recurring report refresh`
  - 正文已新增 `Report Bundle Pattern` 章节
  - bundle 输出、latest 入口、脚本生成和“必须运行一次再宣称存在”的规则都已命中
  - 初始化脚本已固定回写到 `docs/development-reports/project-development-report.md`
  - 当前项目 `docs/development-reports` 目录只剩一个 `.md` 文件
  - 本项目的 `docs/plans/*` 和历史开发报告已被识别，并抽取长期有效逻辑写入本文件正文
  - 全局规则、全局记忆、report skill、planning skill 和本项目记忆都已写入单文件规则
  - 新一轮 `rg -e` 验证已消除 shell 反引号歧义
  - legacy 计划与开发报告的长期有效逻辑已实质整合进本文件正文，不再只是目录式入口
- 结论：本轮已把规则从本项目扩展到全局，并把本项目历史计划/开发文档的长期有效逻辑整合进同一项目报告；按全局规则，当前泛化验证计数为 `1`，属于 `假说`

### Step 17 `报告集中与代码现状落盘`
- 操作方向：把 legacy 报告、canonical 报告和核心代码实现现状集中写回唯一项目报告
- 代码编写目的：解决“报告仍然分散、主报告没有承接项目真实状态”的问题，让后续阅读者只看本文件就能恢复项目当前开发情况
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/doctor/report.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/release/release-readiness.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/security/security-report.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/translation/translation-audit.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/content/experience-polish.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/content/ecosystem-balance.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports/content/numeric-diff.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports/report_bundle.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/index.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/combat/combatSystem.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/CombatView.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/RewardView.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/launcher/SetupLauncher.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/UnifiedAppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/react/runtimeV2AppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/renderModel.ts`
- 执行与变更：新增“报告集中策略与当前开发情况”章节，按数值、战斗、UI、实时结算四层整理当前真值，并把 legacy 报告的长期有效结论折叠进 canonical 项目报告
- 得到的结果：`project-development-report.md` 现在已经承接项目当前主状态，不再只记录历史动作
- 检查点状态：已完成
- 验证：待执行文本级验证
- 风险/阻塞：当前结论来自 `1` 轮 fresh canonical 报告与代码交叉阅读，跨轮稳定性仍需继续累计
- 后续展望：后续每次 canonical 报告刷新后，都要继续只更新本文件对应章节，不再新增平行总结文件

### Step 18 `legacy 计划路径清理`
- 操作方向：把 `docs/plans` 中仍然指向已删除 legacy 报告的路径统一改回 canonical 文档
- 代码编写目的：避免后续执行旧计划时再跳转到已经不存在的 `docs/reports/development/*` 文件
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-combat-economy-calibration.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-06-numerics-domain-refactor.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/plans/2026-03-08-runtime-balance-content-next-steps.md`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- 执行与变更：把计划中的旧 development 报告路径替换成 `project-development-report.md`，并把 `README.md` 级别的说明替换成 `report_bundle.md` 刷新动作
- 得到的结果：legacy 计划文本不再依赖已删除路径，当前 canonical 文档链保持一致
- 检查点状态：已完成
- 验证：待执行路径检索验证
- 风险/阻塞：旧计划正文仍保留历史命令和旧时代上下文，这一层是历史记录，不再继续重写实现细节
- 后续展望：后续只要再删除 legacy 资产，都要同步清理 `docs/plans` 里的失效路径

## 后续展望

- 在后续 2 次以上同项目续做或规划任务中复验“先读单一项目报告”的模式
- 在后续 2 次以上其他项目的规划与续做任务中复验同一规则

### Step 12 `门禁覆盖面与新鲜度修复`
- 操作方向：继续修复全面审查发现的两条门禁可信度问题，补齐默认入口文本审校覆盖面，并为 `release readiness` 增加工件新鲜度约束
- 代码编写目的：避免 `translation_audit` 漏掉默认入口和错误页用户可见文本，避免 `check_release_readiness` 把旧绿灯报告误当成当前真相
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/translation_audit.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/main.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/WarpEye.tsx`
- 执行与变更：
  - 把 `translation_audit` 从固定白名单改成扫描 `src/ui/**/*.tsx` 与 `src/main.tsx`，并跳过注释行，避免 helper 文件误报
  - 为默认入口与错误页残留文案补中文化，包括初始化异常、重试、加载提示、默认入口标题和亚空间相关文案
  - 为 `check_release_readiness` 增加 workspace 基线时间与工件时间比较，忽略 `reports/`、`output/` 等生成目录，确保只接受源代码变更之后生成的 fresh 工件
  - 验证过一次 stale 失败路径：旧工件情况下 `check:release-readiness` 实际返回 `fail=3`
  - 在 fresh `ui-smoke`、`doctor` 和 `release-readiness` 后重新收绿
- 得到的结果：`translation_audit` 已覆盖默认入口链和错误页文本，`release readiness` 已能拒绝过期报告，全面审查指出的两条缺口都已收口
- 检查点状态：已完成
- 验证：
  - `npm run report:translation-audit`
  - `npm run check:release-readiness`（stale 失败一次，fresh 通过一次）
  - `npm run report:security`
  - `npm run test:ui-smoke:expansion`
  - `npm run doctor:game:full`
- 风险/阻塞：当前“门禁长期稳定”结论的 fresh 全链路验证计数为 `1`，按规则仍是 `假说`
- 后续展望：下一步最值钱的是给 `translation_audit` 和 `release_readiness` 各补一组 fixture 级自测，减少继续依赖业务文件现象驱动修规则

### Step 13 `报告固定路径覆盖`
- 操作方向：把报告生成脚本从时间戳命名切换到 canonical 固定路径覆盖，落实“所有报告只更新、不新建”的项目规则
- 代码编写目的：避免同类报告在 `reports/` 下不断堆积时间戳文件，同时让 `doctor`、`release readiness`、安全报告、审校报告都读取和覆盖同一条规范路径
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/translation_audit.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/vulnerability_scan_ast.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/security_report.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/code_health_report.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/doctor/gameDoctor.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/doctor/runScenarioMatrix.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_content_authoring.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_keyword_registry.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/contentBundleCheck.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/contentReachabilityCheck.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/deepReachabilityCheck.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/report_numeric_diff.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/report_ecosystem_balance.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_experience_polish.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_system_assertions.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/test_destructive.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/expansionAcceptance.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/gate.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/doctor/repeatTestSuite.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/generate_report_bundle.ts`
- 执行与变更：
  - 将主链报告输出统一改为固定路径，例如 `reports/doctor/report.json`、`reports/release/release-readiness.json`、`reports/security/security-report.json`、`reports/vulnerability/vulnerability-scan.json`
  - `translation_audit`、`security_report`、`code_health_report`、`check_release_readiness` 和 `generate_report_bundle` 全部对齐 canonical 报告路径，不再依赖“找最新时间戳文件”
  - `gameDoctor` 的 JSON/Markdown 报告改为固定文件覆盖，保留阶段日志为独立 log 文件
  - 验证过一次失败路径：在 canonical `doctor/report.json` 仍是失败态时，`check:release-readiness` 会正确返回失败
  - 在启动 dev server 后补跑 `ui-smoke:expansion`、`doctor:game:full` 和 standalone `check:release-readiness`，确认 canonical 路径 fresh 覆盖后全链恢复
- 得到的结果：同类报告当前只更新规范路径，不再新建时间戳报告；读取方也已改为读取规范路径，避免“最新文件”逻辑继续漂移
- 检查点状态：已完成
- 验证：
  - `npm run lint --silent`
  - `npm run check:vulnerability-scan`
  - `npm run report:translation-audit`
  - `npm run report:security`
  - `npm run report:code-health`
  - `npm run test:ui-smoke:expansion`
  - `npm run doctor:game:full`
  - `npm run check:release-readiness`
- 风险/阻塞：旧的时间戳报告文件还存在于历史目录中，这轮只收了“以后不再新建”与“读取 canonical 路径”两部分；如果要进一步收仓库形态，还需要单独清一次旧报告历史文件
- 后续展望：下一步最值钱的是补 canonical 报告路径的 fixture 级自测，再决定是否清理 `reports/` 下旧时间戳历史文件

### Step 14 `历史时间戳报告清理`
- 操作方向：删除 `reports/` 下旧的时间戳报告文件，只保留 canonical 报告路径
- 代码编写目的：让仓库形态和“所有报告只更新、不新建”的项目规则一致，避免历史时间戳报告继续干扰判断
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/reports`
- 执行与变更：
  - 先生成当前 canonical bundle：`docs/reports/report_bundle.md`
  - 删除 `reports/` 下所有时间戳报告文件
  - 删除旧的 `docs/reports/report_bundle_*.md` 与 `docs/reports/report_bundle_latest.md`
  - 保留 canonical 报告文件和历史 log 文件
- 得到的结果：当前 `reports/` 中只保留 canonical 报告文件，`docs/reports/` 中只保留 `report_bundle.md`
- 检查点状态：已完成
- 验证：
  - `find reports -type f | sort`
  - `find docs/reports -maxdepth 1 -type f | sort`
- 风险/阻塞：这轮没有清理历史 log 文件；如果后续还要继续收口磁盘占用，下一步该清的是 `reports/doctor/logs` 与 `reports/system/*tests-*.log`
- 后续展望：后续如需进一步清理，应该先定义日志保留策略，再统一处理历史 log 文件

### Step 15 `毒伤规则统一与 fresh 门禁复验`
- 操作方向：继续收口全面代码审查指出的三条问题，统一 `TriggerPoisonOnTarget` 与引擎毒伤规则，并补完 `runtime-v2 -> smoke -> doctor -> release` 的 fresh 验证链
- 代码编写目的：避免特殊毒伤分支和引擎常规毒伤出现不同结算语义，同时把默认入口/运行时文本检查和发布门禁的新鲜度判断真正落到 fresh 全绿
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runtimeV2ReactEntry.test.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/translation_audit.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/UnifiedAppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/react/runtimeV2AppShell.tsx`
- 执行与变更：
  - `TriggerPoisonOnTargetAction` 改为复用 `combatSystem.applyDamage(...)`，并对齐引擎毒伤规则：`isTrueDamage: true`、`ignoreBlock: true`
  - 该分支的 pulse 文本收口为中文：`毒蚀爆发：造成 X 点伤害。`
  - `translation_audit` 扩到 `src` 全扫描，并补运行时可见文案扫描，保持升级文案纳入审校
  - `check_release_readiness` 继续沿用 freshness 基线，这轮再次验证了 stale 状态会失败、doctor fresh 后会恢复通过
  - `runtimeV2ReactEntry` 断言同步当前中文 UI 真值，收掉旧英文断言造成的假失败
- 得到的结果：
  - 特殊毒伤与引擎常规毒伤现在共享同一条伤害规则与事件链
  - `runtime-v2` 单测链恢复全绿
  - `translation_audit` fresh 结果保持 `英文残留 0 / 术语冲突 0 / 表意警告 0`
  - `doctor:game:full` fresh 结果恢复 `26/26`
  - standalone `check:release-readiness` 在 doctor fresh 后恢复 `pass=18 warn=1 fail=0`
- 检查点状态：已完成
- 验证：
  - `npm run test:damage`
  - `npm run test:runtime-v2:ts`
  - `npm run report:translation-audit`
  - `npm run check:vulnerability-scan`
  - `npm run report:security`
  - `npm run test:ui-smoke:expansion`
  - `npm run doctor:game:full`
  - `npm run check:release-readiness`
- 风险/阻塞：
  - 当前 fresh 全链路验证计数为 `1`，按规则“这套门禁长期稳定”仍是 `假说`
  - 当前 `vulnerability-scan` fresh 基线为 `高危 0 / 中危 39 / 低危 45`，未阻塞当前这轮修复，但仍是后续治理对象
- 后续展望：下一步最值钱的是给 `translation_audit` 和 `check_release_readiness` 各补一组 fixture 级自测，同时为毒伤统一规则补一条不依赖 import cycle 的专项回归测试

### Step 16 `毒伤专项回归补齐`
- 操作方向：继续治理毒伤规则分叉问题，把已修复逻辑升级成专项回归测试并正式接入 supplemental 单测链
- 代码编写目的：避免 `TriggerPoisonOnTargetAction` 后续再次偏离引擎毒伤规则，同时补上类型层对该 action 的正式声明
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/triggerPoisonOnTargetAction.test.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/package.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/actions.ts`
- 执行与变更：
  - 新增 `triggerPoisonOnTargetAction.test.ts`
  - 通过 `ActionFactoryV2 + ActionQueue` 的真实业务入口验证：
    - 中毒爆发绕过格挡
    - 生命值按毒层数扣减
    - 毒层数清零
    - `DamageDealt` 事件按统一伤害管线发出
  - 把这条测试接入 `test:supplemental-units`
  - 修正 `ActionSpec.type` 漏掉 `TriggerPoisonOnTarget` 的类型漂移
- 得到的结果：
  - 这条毒伤规则现在有独立专项回归保护
  - supplemental 单测链继续保持全绿
  - 类型系统与真实 action 注册表重新对齐
- 检查点状态：已完成
- 验证：
  - `npx tsx --test tests/unit/triggerPoisonOnTargetAction.test.ts`
  - `npm run test:supplemental-units`
  - `npm run lint --silent`
- 风险/阻塞：
  - 当前“毒伤专项回归已稳定”验证计数为 `2`
  - 证据来自单测直跑和 supplemental 单测链
  - 这条结论已明显强于 `假说`，但还没有补到 `doctor:game:full` 的独立 fresh 验证
- 后续展望：下一步最值钱的是补一条以 `GameEngine.playCard` 为入口的更高层毒伤集成回归，把当前 action 级保护继续提升到引擎级保护

### Step 17 `Electron 桌面壳与桌面门禁接线`
- 操作方向：把 DeckRogue 从浏览器 localhost 运行形态推进到 Electron 桌面壳，并把桌面 build、桌面 smoke、release readiness 接进 canonical 门禁
- 代码编写目的：让项目具备“无需手动启动浏览器和本地服务器即可启动”的桌面运行基础，同时保持现有 Web 开发链不被替换
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/electron/main.mjs`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/electron/preload.cjs`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/electron-builder.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/desktop/hostPlatform.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/main.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/runtimeV2/react/runtimeV2App.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/UnifiedAppShell.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/components/MapIcon.tsx`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/components/assetHelpers.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/desktop/dev-electron.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/desktop/build_desktop.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/desktop/dist_win.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/playwright_electron_smoke.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/playwright_ui_smoke_expansion.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/doctor/gameDoctor.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/vite.config.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/package.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/desktopHost.test.ts`
- 执行与变更：
  - 新增 Electron 主进程与 preload，开发模式接 Vite，生产模式通过 `deckrogue://app` 自定义协议加载本地 `dist/`
  - 新增 renderer 桌面环境桥接 `window.deckrogueDesktop` 与统一 `hostPlatform` 解析
  - `main.tsx` 和 `runtimeV2App.tsx` 接入桌面环境识别，保存链不再硬编码 `web`
  - Vite 改为相对 `base: './'`，使打包资源可在桌面本地路径下正常加载
  - 新增桌面脚本：
    - `npm run dev:desktop`
    - `npm run build:desktop`
    - `npm run dist:win`
    - `npm run test:desktop-smoke`
    - `npm run test:desktop-smoke:dev`
  - 新增 `electron-builder.json`，固定 Windows NSIS x64 打包配置
  - 修复 `UnifiedAppShell` 的 hook 顺序问题，收掉 Electron 生产模式点击“开始新战区”后的黑屏
  - 修复地图图标仍指向不存在 PNG 的问题，统一切到现有 SVG 资源
  - `playwright_ui_smoke_expansion.ts` 改成自启 Vite，不再依赖外部预启动 dev server
  - `playwright_electron_smoke.ts` 改为：
    - 生产模式先 fresh `build:desktop`
    - dev/prod 分离固定报告路径
    - 生产模式报告继续写 canonical `reports/desktop/desktop-smoke.json`
    - 开发模式报告写 `reports/desktop/desktop-smoke-dev.json`
  - `check_release_readiness.ts` 增加桌面工件检查：
    - `desktop-build.json`
    - `desktop-smoke.json`
    - Windows 安装包报告策略
    - freshness 基线扩到 `electron/` 与 `electron-builder.json`
  - `doctor:game:full` 新增 `Desktop Build` 与 `Desktop Smoke` 两个阶段
- 得到的结果：
  - Electron dev/prod 都能启动启动器、教程、角色选择、地图和第一场战斗
  - 桌面 build、桌面 smoke、release readiness 都已有 canonical 固定报告路径
  - `doctor:game:full` fresh 结果提升为 `28/28`
  - 现阶段唯一未完成的桌面目标是 Windows 安装包实机或 CI 验证
- 检查点状态：已完成当前开发机可验证范围
- 验证：
  - `npx tsx --test tests/unit/desktopHost.test.ts`
  - `npm run build:desktop`
  - `npm run test:desktop-smoke`
  - `npm run test:desktop-smoke:dev`
  - `npm run test:ui-smoke:expansion`
  - `npm run check:release-readiness`
  - `npm run doctor:game:full`
- 风险/阻塞：
  - 当前开发机为 macOS，`dist:win` 只能完成脚本与 canonical 报告接线，不能完成 Windows 安装包实证
  - 当前“桌面化链路已长期稳定”验证计数为 `1`，按规则仍是 `假说`
  - 当前能确认的是：桌面 build、dev smoke、production smoke、release readiness、doctor 都在本机 fresh 跑通过一次
- 后续展望：下一步最值钱的是在 Windows 构建机或 CI 上跑 `npm run dist:win`，补齐安装包产物验证，并把安装后首次启动 smoke 继续接进桌面门禁

### Step 18 `数据驱动文本审校、元素反应伤害统一、Windows 安装包门禁阻塞`
- 操作方向：继续收口 review 发现的三条高价值问题，把文本审校覆盖扩到数据驱动可见文本，把 `TriggerAllReactionsAction` 收回统一伤害管线，并把 Windows 安装包缺失从 release warning 提升为真实阻塞
- 代码编写目的：消除图鉴与数据内容层的文本假绿灯，消除元素反应伤害与主战斗结算的规则分叉，并让“Windows EXE 交付”在发布门禁里有真实阻塞能力
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/translation_audit.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/check_release_readiness.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/releaseAndTranslationGate.test.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/triggerAllReactionsAction.test.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/actions.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/package.json`
- 执行与变更：
  - `translation_audit.ts` 新增通用 `auditDataRecords(...)`，把数据驱动可见文本纳入正式审校
  - 审校范围新增：
    - `src/content/data/relics.json`
    - `src/content/data/potions.json`
    - `src/content/data/achievements.json`
  - `check_release_readiness.ts` 抽出 `evaluateWindowsInstallerCheck(...)`
  - Windows 安装包 gate 规则改为：
    - 缺安装包报告 => `fail`
    - 报告不 fresh => `fail`
    - 报告 unhealthy 或工件缺失 => `fail`
    - 只有 verified installer artifact 才 `pass`
  - `TriggerAllReactionsAction` 改走 `combatSystem.applyDamage(...)`
    - 不再直接 `enemy.hp -= totalDamage`
    - 元素反应文案改成中文
  - 新增专项回归：
    - `triggerAllReactionsAction.test.ts`
    - `releaseAndTranslationGate.test.ts`
  - `ActionSpec.type` 补进 `TriggerAllReactions`
  - `test:supplemental-units` 正式纳入这两条回归
- 得到的结果：
  - 元素反应伤害现在会进入统一伤害事件链
  - 数据驱动可见英文残留首次被正式扫出
  - Windows 安装包缺失不再是 release warning，当前会真实阻塞 release
  - `doctor:game:full` 会因为：
    - `Translation Audit`
    - `Check Release Readiness`
    两个阶段而失败，当前结果为 `26/28`
- 检查点状态：已完成机制接线与 fresh 验证
- 验证：
  - `npx tsx --test tests/unit/releaseAndTranslationGate.test.ts`
  - `npx tsx --test tests/unit/triggerAllReactionsAction.test.ts`
  - `npm run test:supplemental-units`
  - `npm run lint --silent`
  - `npm run report:translation-audit`
  - `npm run check:release-readiness`
  - `npm run doctor:game:full`
- 风险/阻塞：
  - 当前 `translation-audit` fresh 结果为：
    - 总计 `254`
    - 英文残留 `234`
    - 术语冲突 `20`
    - 表意警告 `0`
  - 当前 `check:release-readiness` fresh 结果为：
    - `pass=13 warn=1 fail=8`
  - 当前“这三条 review 问题已修复”验证计数为 `1`，按规则仍是 `假说`
  - 当前能确认的是：这三条机制都已实际运行一次，并且会真实暴露遗留问题，不再给假绿灯
- 后续展望：下一步最值钱的是按 `translation-audit.json` 的高频项先清理遗物、药水、成就的英文残留和术语冲突，然后在 Windows 构建机或 CI 上补出首条 `windows-installer.json` 实证链

### Step 19 `数据驱动文本残留清理与 Windows CI 安装包接线`
- 操作方向：继续消化 `translation-audit.json` 中遗物、药水、成就的高频英文残留，并把 Windows 安装包从“本地缺口”推进到“CI 可触发的真实工件链”
- 代码编写目的：让扩展后的文本审校重新回到 `0/0/0`，并让 `windows-installer.json` 与 `.exe` 安装包具备真实生成路径，而不再停留在本地阻塞状态
- 相关文件：`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/relics.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/potions.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/achievements.json`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/content/terminology.ts`、`/Users/zhuhangcheng/Downloads/好玩/deckrogue/.github/workflows/windows-installer.yml`
- 执行与变更：
  - 清理了遗物、药水、成就数据里的高频英文残留和术语冲突，统一回现有 grimdark 中文词表
  - 修复 `terminology.ts` 中重复键导致的 lint 失败
  - 新增 GitHub Actions 工作流 `windows-installer.yml`，在 Windows runner 上执行 `npm run dist:win`
  - 工作流产出：
    - `dist-desktop/*.exe`
    - `reports/desktop/windows-installer.json`
- 得到的结果：
  - `translation-audit` fresh 重新回到：
    - 英文残留 `0`
    - 术语冲突 `0`
    - 表意警告 `0`
  - 本地 `lint`、桌面 smoke、UI smoke 都维持通过
  - Windows 安装包 CI 已具备可触发工作流，但当前还没有远端实跑证据
- 检查点状态：已完成本地收口，待补 CI 实证
- 验证：
  - `npm run report:translation-audit`
  - `npm run lint --silent`
  - `npx tsx --test tests/unit/triggerAllReactionsAction.test.ts tests/unit/releaseAndTranslationGate.test.ts`
  - `npm run test:ui-smoke:expansion`
  - `npm run test:desktop-smoke`
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/windows-installer.yml"); puts "yaml-ok"'`
- 风险/阻塞：
  - 当前 Windows 安装包实证仍缺失，`check:release-readiness` 和 `doctor:game:full` 会继续被这条 gate 拦住
  - 当前“Windows 安装包链已长期稳定”验证计数为 `0`，还没有达到最小验证门槛
- 后续展望：下一步最值钱的是提交当前分支并直接触发 Windows workflow，下载 `.exe` 与 `windows-installer.json`，再把 canonical 报告更新到本地工作区
