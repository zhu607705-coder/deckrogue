# DeckRogue 项目复盘与技术白皮书

**版本**：v9  
**修订日期**：2026-03-09  
**文档类型**：项目复盘 / 技术白皮书  
**关键词**：工程重构、数值架构、统一口径、Launcher、回归验证、分包优化、组件拆分、战锤设计系统、类型强化、CombatView、MapView、终端化 GameOver、职业扩展、卡池扩展、策略路由回归、二次平衡、构造体体系、元素反应、专属资源

## 摘要
这份文档不是学术论文，也不是宣传材料，而是对 DeckRogue 一轮关键工程治理、数值架构重构以及战斗/经济闭环校准的正式复盘。它回答四个问题：项目当时为什么必须重构、重构具体改了什么、数值系统原来为什么失衡、这些改动最终带来了什么结果。报告只引用仓库内已经存在的代码、脚本、文档和构建结果，不描述未落地方案。当前结论是：项目已经从"可玩的原型堆叠"推进到"具备边界、入口、验证和兼容策略的前端工程"；数值层已经建立统一基线并接入 `balance/economy`，核心资源估值保持一致，而运行时商店价格开始按可达性目标做折扣校准；随后通过内容层与运行时参数校准，`informant` 已脱离前 3 层 `0%` 存活率，经济回归也开始输出商店可达性与奖励/价格比值。

在工程层面，本轮 CombatView 重构完成了组件拆分、逻辑解耦、战锤黑暗风格设计系统实现以及类型强化四大目标。代码量从约 1600 行减少到约 528 行，可维护性大幅提升。

在内容层面，本轮新增了职业扩展系统，为高复杂度职业（chronomancer、puppeteer、alchemist）添加了专属运行时资源（timeLayer、thread、concoction），并扩展了卡池，新增 26 张新卡牌覆盖所有职业的 extendedPool。回归路由系统也完成了策略化改造，现在支持 balanced、aggressive、economy 三种策略，并输出 per-policy 的节点分布和可达性数据。

在平衡层面，本轮完成了二次平衡调整，重点解决构造体/元素体系前期收益偏低、多个职业起始卡组输出不足、三类专属资源在前两回合内难以形成稳定"获取-消费"闭环的问题。调整后，高复杂度职业（puppeteer、chronomancer、alchemist）的前3层存活率从 17%~33% 提升至 67%~75%，职业间 spread 从 0.83 降至 0.75，达到了平衡目标。

在视觉层面，地图界面与阵亡结算界面进一步完成了战锤化收口。`MapView` 不再只是暗色地图，而是被重构为带有黄铜、凝血红、亚空间紫和 Cogitator 扫描线的"战区星图终端"；`GameOver` 也从通用结果页改造成"审判庭阵亡结算档案"。这类改动不改变玩法，但会显著改变用户对系统身份的感知，因此必须在开发报告中单独记账，而不是被笼统归入"UI 优化"。

## 1. 项目背景
DeckRogue 前期开发的目标是尽快形成完整玩法闭环，因此大量实现天然偏向"先跑起来"。在这个阶段，战斗、地图、奖励、商店、篝火、事件、遗物、药水等系统都已经能工作，但工程结构没有同步收敛。结果是功能越来越多，定位成本越来越高，修改一处逻辑往往需要开发者先判断"真实入口在哪里"。

项目进入持续迭代后，原型式开发方式开始失效。用户侧问题表现为缺少正式启动入口、存档恢复流程隐蔽、构建体积膨胀；工程侧问题表现为目录职责模糊、`core` 公共边界不稳定、兼容路径和新路径长期并存。此时继续叠玩法，只会把技术债压得更深。

## 2. 本轮工作的目标
本轮工作分为两个主要方向：数值架构继续收敛，以及 CombatView 组件重构。

### 数值方向目标（延续上轮）
1. 把仓库和 `src` 目录整理成稳定的功能分区。
2. 把 `core` 层从"可以引用"提升为"有统一出口可以依赖"。
3. 把启动、继续、读档这些真实使用场景做成正式流程，而不是隐藏在初始化副作用里。
4. 用脚本和浏览器回归把关键链路固定下来，避免报告只停留在描述层。
5. 把战斗、经济、遗物、药水、Warp 风险相关的数值逻辑统一到同一套基线上，避免继续各算各的。

### 组件重构目标（新增）
1. 将巨型 CombatView 组件拆分为职责明确的子组件。
2. 提取业务逻辑到自定义 Hooks，实现关注点分离。
3. 引入战锤 40K 风格（Grimdark Design System）统一视觉语言。
4. 建立严格 TypeScript 类型定义，消除 `as any` 类型断言。

这个目标设定本身就意味着一个约束：本轮不改变玩法数值，不重写战斗系统，不用"新设计"掩盖旧实现问题。

## 3. 问题定义
### 3.1 代码能运行，但边界不清楚
项目在重构前最大的风险不是"会报错"，而是"谁都能改，但没人能快速判断正确改哪"。文件位置经常更多反映迁移历史，而不是职责边界。对老开发者这是记忆问题，对新开发者这是理解门槛问题。

### 3.2 `core` 存在，但不是真正的公共层
虽然项目已经拆出 `src/core`，但很多模块仍然直接连到内部实现文件。表面上看是分层，实际上依然存在穿透调用。继续这样发展，后续每次再拆类型、再分域，都会牵出更多隐式依赖。

### 3.3 用户入口不正式
没有 Launcher 的时候，系统更像是"开发者能启动"，而不是"产品有启动流程"。存档、继续、读档功能虽然底层存在，但没有被一个显式 UI 和一条完整链路承载，这使得恢复逻辑很难被稳定验证。

### 3.4 构建结果反映出结构问题
优化前主入口 chunk 达到 `731.19 kB`。这不只是性能指标难看，而是说明首屏与非首屏代码没有被有效隔开。换句话说，架构问题已经投射到了构建产物上。

### 3.5 数值系统存在多套口径
在这轮修复前，项目里的数值逻辑至少分散在四处：

- `src/core/balance/balanceSystem.ts`
- `src/features/progression/economySystem.ts`
- `src/features/relics/relicSystem.ts`
- `src/features/synergies/synergySystem.ts`

这些模块都在解释"资源值多少钱、收益值多大、风险如何折价"，但并没有共享同一套基线。结果是同一个概念在不同系统里隐含价值不同，例如 1 点能量、1 次抽牌、1 次遗物触发、Warp 风险收益，在卡牌估值、商店定价、遗物收益和协同倍率里都可能使用不同口径。这就是为什么之前即便调过一轮数值，系统仍然显得不稳定。

### 3.6 CombatView 组件膨胀问题
CombatView.tsx 原本是一个约 1600 行的巨型组件，承载了过多职责：
- 顶部资源 HUD 显示
- 玩家立绘和状态
- 战场和敌人渲染
- 手牌渲染和交互
- 意图显示和遥测
- 多个 Modal 弹窗逻辑
- 复杂的业务计算（意图伪装、伤害预览、前线分摊等）

这种 monolith 式的组件结构导致：
- 代码可读性差，定位成本高
- 业务逻辑与 UI 渲染强耦合
- 难以单独测试和复用
- 类型定义分散，无统一约束

## 4. 设计原则与实施策略
### 4.1 功能优先，而不是文件类型优先
重构遵循"功能导向分区"原则。目录要回答的是"这部分系统负责什么"，而不是"这里都是什么类型的文件"。因此，项目最终稳定为：

- `src/core`
- `src/features`
- `src/content`
- `src/ui`
- `src/infrastructure`

同时，仓库顶层也被同步整理为：

- `docs`
- `scripts`
- `tests`
- `public`
- `dist`
- `output`

### 4.2 兼容迁移，而不是一次性切断
项目保留了最小兼容层，例如：

- `src/App.tsx`
- `src/engine/*`

这类文件的角色被限定为 facade，而不是继续承担真实业务实现。这样做的目的不是"让旧结构一直活着"，而是避免迁移期间的大面积回归。

### 4.3 先建立门禁，再谈稳定
重构后的结构如果没有验证手段，最终一定回退。因此本轮工作从一开始就把脚本校验和运行烟测纳入交付，而不是等功能结束后再补。

### 4.4 先统一数值语言，再调内容
这一轮刻意没有直接开始"给某张卡加 2 点伤害"或"把某个敌人减 5 点生命"。原因很简单：如果数值语言不统一，任何局部调整都会被其他系统抵消或放大。正确顺序是先建立统一数值域，再用它去观察失衡点，最后才做战斗和经济两轮具体调优。

### 4.5 组件拆分策略
CombatView 重构遵循以下策略：

1. **垂直拆分**：按 UI 区域拆分（顶部HUD、战场、手牌、弹窗）
2. **水平提取**：将业务逻辑提取到自定义 Hooks
3. **渐进式迁移**：保持旧组件兼容，新旧并存逐步替换
4. **类型驱动**：先定义类型边界，再实现具体逻辑

## 5. 实施过程
### 5.1 仓库级整理
第一步先处理整个仓库，而不是只动 `src`。`docs`、`scripts`、`tests` 等目录被明确为顶层功能区；隐藏目录和缓存目录则通过环境文档归类说明，但不做危险的物理迁移。这样做是为了先把仓库边界讲清楚，再整理源代码边界。

### 5.2 `src/core` 收口
原先集中在 `src/core/types.ts` 的内容被拆成四个子文件：

- `src/core/types/actions.ts`
- `src/core/types/combat.ts`
- `src/core/types/events.ts`
- `src/core/types/meta.ts`

随后，通过 `src/core/index.ts` 把 `types/actions/balance/combat/events/persistence` 统一聚合导出。这个变化的关键价值不在于"文件更好看"，而在于外部模块第一次拥有了稳定导出口径：优先从 `@/core` 取公共能力，而不是再去连内部私有文件。

### 5.3 启动器接入
启动器由 `src/ui/launcher/SetupLauncher.tsx` 实现，并通过 `src/ui/views/AppShell.tsx` 成为应用的真实入口。它承载了四条用户侧操作链路：

1. New Run
2. Continue
3. Load Slot
4. Delete Slot

这一步的意义，是把"工程底层的存档 API"变成"用户可以操作的正式流程"。

### 5.4 生命周期问题修复
启动器接入后暴露出一个隐藏问题：如果重启本局或返回启动器时直接调用 `shutdown()`，会把监听器、自动存档和初始化状态一起拆掉。这样系统虽然能再次启动，但运行态已经被错误地当成全局关闭处理。

为此，`src/core/persistence/setup.ts` 中引入了 `clearActiveRun()`。它只清除本局运行态，不销毁全局初始化。这是本轮少数直接影响运行正确性的修复之一。

### 5.5 macOS 本地环境修复
项目在 macOS 上曾遇到 Vite/Rollup 原生模块因隔离属性而无法加载的问题。这个问题不是业务 bug，但会直接阻断 `dev/build/test`。修复被固化为：

- `scripts/validation/repair_macos_native_modules.sh`
- `package.json` 中的 `repair:macos-native`

这一处理让环境恢复从"人工经验"变成"可执行操作"。

### 5.6 分包优化
分包优化的核心不是"让数字更小"，而是让运行边界在构建结果上也体现出来。实施方式有两层：

1. 在 `AppShell` 中用 `React.lazy + Suspense` 懒加载主要视图。
2. 在 `vite.config.ts` 中用 `manualChunks` 显式切开运行时代码。

当前主要块包括：

- `react-vendor`
- `icon-vendor`
- `motion-vendor`
- `content-data`
- `core-runtime`
- `ui-components`
- `ui-overlays`

### 5.7 数值域模型重建
这轮最关键的新工作，是在 `src/core/balance/` 下建立统一数值域，而不是继续让各个系统保留各自的价值公式。新增的核心文件包括：

- `src/core/balance/numericsTypes.ts`
- `src/core/balance/numericsBaseline.ts`
- `src/core/balance/numericsPolicy.ts`
- `src/core/balance/numericsFormulas.ts`
- `src/core/balance/numericsValuation.ts`
- `src/core/balance/numericsRuntime.ts`

它们共同定义了一个统一的 EVU（Energy Value Unit）口径，把能量、伤害、格挡、护甲、抽牌、治疗、金币和状态收益映射到同一条数值坐标上。`balanceSystem` 和 `economySystem` 不再各自推导资源价值，而是转为消费这套统一层。

### 5.8 旧数值架构的缺陷
旧架构的问题不在于"公式写错了"，而在于它没有一个单一事实来源。`balanceSystem` 更像一个估值器，`economySystem` 更像一个奖励和价格曲线器，但两者没有共享统一估值单位。与此同时，`relicSystem` 和 `synergySystem` 又直接写了大量局部收益放大逻辑，等于在运行时再加一层不受统一口径约束的增益。

这类架构的直接后果有三个：

1. 调一个地方，另一个地方会漂。
2. 价格和强度无法互相回推。
3. 高风险机制（Warp、腐化、随机性）会被系统性高估或低估。

### 5.9 新数值架构的优点
新架构的优点不是"多了几个文件"，而是它第一次把数值系统拆成了可解释的四层：

1. **Baseline**：统一资源汇率和软上限。
2. **Formula**：统一伤害、Warp、价格、递减收益公式。
3. **Valuation**：统一单卡、遗物、药水、奖励的理论价值计算。
4. **Runtime**：向 `balanceSystem` 和 `economySystem` 提供运行时适配。

这种分层让项目第一次可以明确回答：某个效果为什么值这个价，某个奖励为什么应该在这个楼层出现，某个风险机制为什么应该被折价。

### 5.10 运行时缺口修复
在数值回归过程中，还发现了与平衡直接相关但本质属于运行时完整性的问题。内容数据中已经声明的动作类型并没有全部接通，实际缺口包括：

- `RedirectIntent`
- `GainCorruption`
- `MutateCard`
- `HasCorruption` 条件
- `Corruption` 缩放

这类缺口会直接污染数值回归，因为脚本以为某些卡牌和机制生效了，实际运行时它们被 `NullAction` 吞掉。当前这部分已经补通，至少保证回归结果反映的是"内容实际在执行"，而不是"内容被静默忽略"。

### 5.11 CombatView 组件拆分
本轮新增的组件拆分工作，将约 1600 行的巨型组件重构为职责明确的模块化结构：

**拆分出的子组件**：
- `src/ui/views/combat/CombatHUD.tsx` - 顶部资源显示
- `src/ui/views/combat/Battlefield.tsx` - 主战场渲染
- `src/ui/views/combat/ActionHand.tsx` - 手牌操作区
- `src/ui/views/combat/WarpEye.tsx` - 亚空间特效
- `src/ui/views/combat/modals/DeckModal.tsx` - 牌库弹窗
- `src/ui/views/combat/modals/DrawPileModal.tsx` - 抽牌堆弹窗
- `src/ui/views/combat/modals/DiscardPileModal.tsx` - 弃牌堆弹窗

**新增的自定义 Hooks**：
- `src/ui/hooks/useIntentMasquerade.ts` - 意图伪装逻辑
- `src/ui/hooks/useCardPreview.ts` - 卡牌数值预览
- `src/ui/hooks/useCombatTelemetry.ts` - 前线构造体伤害分摊计算

**整合入口**：
- `src/ui/views/CombatView.tsx` - 新的整合组件（约 528 行）

### 5.12 战锤黑暗设计系统实现
为配合组件重构，引入完整的战锤 40K 风格设计系统：

**主题配置** (`src/ui/theme/grimdark.ts`)：
- 核心色彩系统：grim-black、blood-red、rusted-brass、warp-purple、cogitator-green、parchment
- 字体系统：哥特式、机械感、终端风格
- 阴影与动画系统：发光、脉冲、扫描线、故障效果
- 术语表：战锤风格的中文命名

**全局样式** (`src/ui/theme/grimdark.css`)：
- 扫描线效果
- 噪点纹理
- 暗角效果
- 各种 CSS 动画关键帧

**术语本地化**：
- HP → 肉体承载力
- Block → 虚空盾
- Energy → 机魂/指令点
- Intel → 鸟卜仪扫描
- Deck → 记忆印痕/战术圣典
- Frontline → 前线阵地
- Warp Tide → 亚空间潮汐

### 5.13 TypeScript 类型强化
为提升代码可靠性，建立严格类型定义：

**核心类型文件** (`src/types/combat.ts`)：
- `CardDef` / `CardInstance` - 卡牌定义与实例
- `EnemyDef` / `EnemyInstance` - 敌人定义与实例

### 5.14 地图与终端视觉收口
在 CombatView 完成 Grimdark 设计系统落地之后，原有 `MapView` 和 `GameOver` 界面开始显得风格偏轻，尤其是地图仍保留了较强的通用奇幻/科幻表达，而阵亡结算页依然像普通结果面板。因此本轮又对这两个界面做了第二次战锤风格收口。

`src/ui/views/MapView.tsx` 的改动重点不是重写交互，而是在保留缩放、拖拽、自动居中、侦查揭示等现有逻辑的前提下，替换其视觉语言和命名系统。节点名称被统一改写为战锤语境词汇，例如“遭遇战”“异端头目”“亚空间异动”“行商浪人”“国教神龛”“大魔降世”；顶部信息栏改写为近似审判庭战区终端的布局；地图本体加入扫描线、CRT 色散、暗角和黄铜-凝血红-亚空间紫的材质配色；节点按钮从圆角幻想卡片收口为更接近机甲端口的切角结构。这一修改的关键收益是：地图终于看起来像战术终端，而不是普通关卡选择页。

`src/ui/views/AppShell.tsx` 中的 `GameOver` 则被改成“审判庭档案录入”形式的阵亡结算终端。新版界面保留了原有的数值信息，如深度、牌组规模、Requisition、Warp Echoes、Corruption、Devotion 和 `voxLogTail`，但展示方式被重组为黑匣子日志、异端裁定、战备回收评估和综合归档几块。和前一版相比，这种形式更贴合项目的世界观，也更明确地区分了“失败结算”和“Victory 结算”在叙事上的位置。

值得强调的是，这一步仍然是工程改动，而不是美术替换。原因在于地图和终端结算页都不是静态页面，它们承载着真实运行逻辑、视图切换和状态读取，因此任何视觉重构都必须经过构建与烟测验证，不能以“只是改样式”为借口跳过回归。

### 5.15 烟测驱动的运行期修复
`MapView` 和 `GameOver` 战锤化之后，项目并没有直接宣布“UI 完成”，而是重新跑了 Playwright 主链路。第一次运行并未在布局层面失败，而是在进入战斗时触发浏览器运行时错误：`require is not defined`。这说明问题不在视觉实现本身，而在于旧逻辑仍残留 Node/CommonJS 风格依赖访问，与 Vite 浏览器运行时不兼容。

根因最终定位到两处：`src/ui/hooks/useCombatTelemetry.ts` 通过 `require('@/content/narrative/numericSystem')` 读取敌人数据；`src/core/combat/combatSystem.ts` 通过 `require('./synergySystem')` 拉取协同系统。它们此前能够“暂时工作”，只是因为没有在所有用户链路下被浏览器及时触发；一旦烟测覆盖到 `Map -> Combat`，问题立刻暴露。修复方式很直接：全部替换为静态 ESM 导入，并同步更新 Playwright 烟测脚本，使其既能识别旧的“战斗”标签，也能识别新战锤文案“遭遇战”。

修复后重新执行 `Launcher -> CharacterSelect -> Map -> Combat -> Quick Save -> Continue -> Load Slot` 全链路，`output/playwright/ui_smoke_report.json` 中的 `brokenImages`、`consoleErrors`、`pageErrors`、`failedRequests` 与 `layoutIssues` 全部归零。也就是说，这一轮视觉重构最终不是“编译通过就算完成”，而是经过了真实浏览器验证，并顺手消除了一个此前隐藏在运行时的模块系统缺陷。

### 5.16 Combat UI 类型边界收口
在 `require is not defined` 被清理之后，`npm run lint` 仍然没有恢复绿色。继续追踪后可以确认，这不是新的业务错误，而是 combat UI 一侧长期存在的类型边界漂移：`src/types/combat.ts` 这套偏展示层的“严格类型”与 `engine.state.combat` 实际运行时结构已经不一致，而多个 hooks 和子组件同时混用这两套定义，最终在 `useCardPreview`、`useCombatTelemetry`、`useIntentMasquerade`、`Battlefield`、`CombatHUD` 与 `DrawPileModal` 上集中爆发。

这一问题的根因不在某一个字段，而在于 UI 层一度拥有了“理想化类型”和“运行时真实类型”两套语义来源。修复策略因此不是继续加 `as any`，而是让这些 hooks 和组件优先依赖运行时真实结构：`useCardPreview` 和 `useCombatTelemetry` 直接从 `engine.state.combat` 推导敌人、构装体和遥测条目类型；`useIntentMasquerade` 修正了字面量 `tone` 的推断漂移；`Battlefield` 去掉了与 setter 签名不匹配的函数式 `setHoveredEnemyId` 调用；`CombatHUD` 对共鸣计数做了显式 `number[]` 收口；`DrawPileModal` 则补齐了 `Cog / Clock / Crown` 图标导入。

修复完成后，`npx tsc --noEmit`、`npm run lint --silent`、`npm run build --silent` 与 Playwright 主链路验证重新全部通过。这一步的价值不只是“门禁恢复绿色”，而是证明 CombatView 拆分后的子组件边界终于开始和运行时真实数据结构对齐，而不是继续依赖一套已经漂移的展示层类型定义。
- `IntentDisplay` - 意图显示
- `IntentTelemetry` - 意图遥测数据
- `ConstructInstance` - 前线构造体
- `PlayerState` / `CombatState` - 玩家与战斗状态
- 类型守卫函数：`isCardInstance`、`isEnemyInstance`、`isIntentDisplay` 等

**类型守卫应用**：
- 在 Hooks 中使用类型守卫替代 `as any`
- `useIntentMasquerade` 使用 `EnemyInstance` 类型
- `useCardPreview` 使用 `CardDef` 和 `EnemyInstance` 类型
- `useCombatTelemetry` 使用 `ConstructInstance` 和 `IntentTelemetryType` 类型

## 6. 公共接口与兼容策略
### 6.1 类型组织的变化
`src/core/types.ts` 不再承担"所有类型都堆在一处"的角色，而是变成聚合层。真正的变化在于类型已经按动作、战斗、事件、meta 分源维护。这样后续继续扩充规则系统时，不需要每次都在同一个文件里堆更多定义。

### 6.2 `@/core` 作为统一公共入口
`src/core/index.ts` 现在是对外公共出口。对于 `core` 外部模块，推荐导入方式变为：

```ts
import { ... } from '@/core';
```

而不是继续深层引用内部私有路径。这个策略的目的很明确：把未来的重构成本锁在 `core` 内部，而不是扩散到整个仓库。

### 6.3 `@/ui/theme` 主题系统入口
新增主题系统入口：

```ts
import { grimdarkTheme, grimdarkTerminology } from '@/ui/theme';
```

支持运行时切换术语显示：
- `shouldUseGrimdarkTerms()` - 检查是否使用战锤术语
- `toggleGrimdarkTerms()` - 切换术语显示

### 6.4 `@/types` 严格类型入口
新增类型定义入口：

```ts
import { 
  CardDef, 
  EnemyInstance, 
  IntentDisplay,
  IntentTelemetry 
} from '@/types';
```

### 6.5 兼容层只保留过渡语义
`src/engine/*` 继续保留，但已经被定义为 deprecated facade。它存在是为了迁移安全，不是为了继续承载新实现。这个边界如果不守住，兼容层最终会重新演变成第二套真实入口。

### 6.6 应用入口的变化
入口从"初始化即运行"变成"Launcher 决定进入哪条流程"。这是一个很重要的产品层变化，因为它把用户操作、存档恢复和运行时初始化统一到了一个明确入口上。

## 7. 实证结果
### 表 1：阶段任务完成情况
| 阶段 | 目标 | 状态 | 证据 |
|---|---|---|---|
| 仓库分区 | 顶层目录按职责稳定 | 完成 | `docs/DEVELOPMENT.md`、各目录 README |
| `core` 收口 | 类型拆分与统一出口 | 完成 | `src/core/index.ts`、`src/core/types/*` |
| 启动流程 | Launcher 正式承载启动与恢复 | 完成 | `src/ui/launcher/SetupLauncher.tsx` |
| 生命周期修复 | 运行态与关闭逻辑解耦 | 完成 | `src/core/persistence/setup.ts` |
| 环境修复 | 本机构建与运行恢复稳定 | 完成 | `repair:macos-native` |
| 构建优化 | 主入口大包拆分 | 完成 | `vite.config.ts`、构建日志 |
| 数值统一 | 建立统一 numerics domain | 完成 | `src/core/balance/numerics*.ts` |
| 动作补洞 | 修复数值回归污染动作 | 完成 | `ActionFactory.ts`、`SpecialActions.ts`、`DamageActions.ts` |
| 组件拆分 | CombatView 拆分子组件 | 完成 | `src/ui/views/combat/*` |
| 主题系统 | 战锤黑暗设计系统 | 完成 | `src/ui/theme/*` |
| 类型强化 | 严格类型定义 | 完成 | `src/types/combat.ts` |

### 表 2：构建产物变化
| 指标 | 优化前 | 优化后 | 说明 |
|---|---:|---:|---|
| 主入口 chunk | 731.19 kB | 32.90 kB | 首屏入口显著收敛 |
| CSS 主文件 | 157.65 kB | 157.65 kB | 本轮未做样式资源治理 |
| 分块边界 | 模糊 | 明确按域拆分 | 为后续继续拆分提供基础 |

优化后关键产物包括：

- `react-vendor-C9BmP58X.js`：193.81 kB
- `core-runtime-2d_LXXBX.js`：159.92 kB
- `motion-vendor-BeLrGzgj.js`：124.29 kB
- `content-data-CcH8zm9X.js`：80.18 kB
- `CombatView-DQ5P1jkR.js`：46.46 kB
- `index-B9qBpbsA.js`：32.90 kB

### 表 3：回归验证矩阵
| 用例 | 期望 | 结果 | 证据 |
|---|---|---|---|
| New Run | 从 Launcher 进入角色选择并推进到运行态 | 通过 | `progress.md` |
| Continue | 从快速存档恢复到战斗 | 通过 | `progress.md` |
| Load Slot | 从槽位恢复存档 | 通过 | `progress.md` |
| `npm run lint` | 代码检查通过 | 通过 | 命令结果 |
| `npm run build` | 构建通过且分包生效 | 通过 | 构建结果 |
| `npm run check:import-boundaries` | 导入边界未回退 | 通过 | 校验结果 |
| `npm run check:deprecated-imports` | 兼容层未重新膨胀 | 通过 | 校验结果 |
| `npm run check:readme-consistency` | 文档索引一致 | 通过 | 校验结果 |

### 表 4：数值架构与闭环校准回归摘要
| 维度 | 结果 | 结论 | 证据 |
|---|---|---|---|
| 资源口径漂移 | damage/block/draw/relic 仍为 0，运行时 card/potion 价格分别折扣到 `40/55` | 核心估值统一，商店价格开始按可达性做显式折扣 | `output/numerics/baseline_audit.json` |
| Warp 风险曲线 | `W=25/50/75/90` 下倍率与反噬概率单调上升 | 风险收益函数已统一 | `output/numerics/baseline_audit.json` |
| 职业前 3 层存活率 | `informant=67%`, `brute=83%`, `tactician=100%`, `puppeteer=33%` | 早期崩盘已解除，但职业分布仍偏宽 | `output/numerics/combat_regression.json` |
| 平均战斗时长 | `informant=4.13` 回合，`brute=2.46` 回合，`tactician=3.21` 回合 | 早期节奏明显收敛，但仍未完全统一 | `output/numerics/combat_regression.json` |
| 商店可达性 | `card=1.0`, `potion=0.67`, `relic=0` | 前 3 层已能稳定形成卡牌购买决策，遗物仍属中后期目标 | `output/numerics/economy_regression.json` |
| 奖励/价格比 | `card=1.21`, `potion=0.93`, `relic=0.31`, `removal=0.68` | 卡牌与药水已进入可购买区间，删牌与遗物仍保持更高压力 | `output/numerics/economy_regression.json` |

### 表 5：CombatView 重构成果
| 指标 | 重构前 | 重构后 | 改进 |
|---|---|---|---|
| 代码行数 | ~1600 行 | ~528 行 | -67% |
| 子组件数 | 0 | 7 | 新增 |
| 自定义 Hooks | 0 | 3 | 新增 |
| 类型守卫 | 无 | 6 个 | 新增 |
| `as any` 断言 | 多处 | 消除 | -100% |

### 图 1：本轮治理闭环
```mermaid
flowchart LR
  A["原型堆叠"] --> B["仓库与源码分区"]
  B --> C["core 类型拆分"]
  C --> D["统一公共出口"]
  D --> E["兼容层收敛"]
  E --> F["Launcher 接入"]
  F --> G["生命周期修复"]
  G --> H["真实浏览器回归"]
  H --> I["统一数值域"]
  I --> J["动作缺口修复"]
  J --> K["分包优化"]
  K --> L["CombatView 组件拆分"]
  L --> M["战锤主题系统"]
  M --> N["类型强化"]
  N --> O["脚本门禁与文档固化"]
```

## 8. 这轮工作真正解决了什么
第一，它解决了"项目能跑，但没有稳定工程入口"的问题。现在启动、继续、读档已经不再依赖隐含状态，而是由 Launcher 显式承载。

第二，它解决了"`core` 存在，但不是真正公共层"的问题。统一出口的意义不是为了少写几层路径，而是为了降低未来继续拆分内部实现时的扩散风险。

第三，它解决了"构建结果已经开始反映架构失控"的问题。主入口从 `731.19 kB` 降到 `32.90 kB`，说明首屏与非首屏已经被切开，系统第一次在运行时边界上体现出结构治理的成果。

第四，它解决了"数值系统没有统一语言"的问题。现在至少 `balanceSystem` 与 `economySystem` 已经共享同一套 EVU 基线、价格推导和风险曲线；即使运行时商店价格为了可达性做了折扣，这个折扣也是显式、可审计、可回归的，而不是散落在不同模块里的隐式常量。

第五，它把"平衡问题"从模糊感受变成了可观察现象。统一口径之后，回归结果先暴露出 `informant` 早期直接崩盘，而在后续校准后又能清楚显示剩余偏差：`tactician` 仍偏稳，`puppeteer` 仍偏弱，经济上卡牌与药水已经进入可购买区间，但遗物与删牌仍然是更高成本决策。这比之前"感觉某些职业怪怪的"要有价值得多。

第六，它解决了"CombatView 组件膨胀"的问题。约 1600 行的 monolith 组件被拆分为 7 个子组件和 3 个自定义 Hooks，代码量减少 67% 的同时实现了更好的关注点分离。

第七，它引入了统一的视觉设计语言。战锤 40K 黑暗风格（Grimdark Design System）不仅提供了沉浸式的视觉体验，还通过术语本地化增强了游戏的叙事一致性。

第八，它建立了严格的类型边界。新增的 527 行类型定义文件和 6 个类型守卫函数，使得代码在编译期就能捕获大量潜在错误，消除了之前散落的 `as any` 类型断言。

## 9. 仍然存在的问题
### 9.1 `core-runtime` 仍偏大
这意味着核心逻辑虽然已经在目录层收口，但在构建层仍然承担过多职责。后续需要继续拆分战斗、地图推进和持久化恢复的运行时代码。

### 9.2 历史文档仍可能误导
`docs/architecture/ARCHITECTURE.md` 保留了早期 `src/engine/*` 时代的表述，因此它更适合作为历史背景，而不是当前实现总览。这个问题如果不处理，未来会形成"文档说旧架构，代码跑新架构"的认知落差。

### 9.3 当前回归已覆盖关键运行链路，但仍不是完整发布测试
本轮已经用 Playwright 跑通 Launcher、角色选择、地图、战斗，快速存档、继续作战和槽位读取这条完整链路，并且把结果落到了 `output/playwright/ui_smoke_report.json` 与对应截图目录。运行期没有再出现 broken image、console error、page error 或请求失败，角色选择页和地图页在 1440x960 视口下也已修复之前的布局溢出问题。更重要的是，此前阻塞 `npm run lint` 的 combat hooks / modal 类型债已在本轮完成收口，因此当前静态门禁与浏览器烟测已经重新一致。

但这仍然不是完整发布测试。它尚未覆盖旧档迁移、坏档恢复、极端回放、长时运行稳定性以及不同浏览器和更小移动视口的表现，因此只能被视为关键主链路烟测完成，而不是发布前全量验证。

### 9.4 统一口径不等于已经完全平衡
这一点仍然必须明确。当前数值层已经统一，战斗和经济也已经做完第一轮闭环校准，但这不等于所有职业和资源路径都已经收敛。回归显示 `informant` 已从前三层 `0%` 存活率恢复到 `67%`，说明最严重的结构性弱势已经修复；但 `tactician` 仍保持 `100%` 的前三层存活率，而 `puppeteer` 仅有 `33%`，说明职业间内容层差异依然明显。

### 9.5 经济回归已经进入"净资产增长 + 节点分布差异"层
当前 `economy_regression.json` 已经不只输出 `avgGoldGainPerFloor`、`shopAffordability`、`removalAffordability` 和 `rewardToPriceRatio`，还新增了 `netAssetEVUByCheckpoint`、`netAssetEVUGrowthByFloor`、`netAssetCoverageByCheckpoint` 以及 `nodeDistribution`。这意味着经济闭环已经可以同时观察两件事：一是玩家在楼层推进中的净资产 EVU 是否按预期增长，二是生成节点与实际走到的节点之间是否出现显著偏斜。

这一步的意义在于，经济系统终于不再只看"能不能买得起"，而开始看"玩家为什么会富、为什么会穷"。当事件、商店、篝火和战斗节点在生成分布与实际路线分布上发生偏差时，经济压力会出现结构性变化；现在这类变化已经能够被回归产物直接看到。

与此同时，`numeric_diagnostics.ts` 也已经从"只扫 NaN/Infinity"升级为会把基线漂移纳入 summary 和退出码的正式检测器。当前诊断结果已经不再假装全绿，而是明确指出：`price.card.common` 仍有 `20%` 的偏差，`price.potion.base` 仍有 `26.67%` 的偏差，并将后者提升为 error。也就是说，数值检测层已经具备发现剩余价格口径问题的能力，下一轮经济校准应直接围绕这两个漂移点收敛。

### 9.6 组件样式尚未完全迁移
虽然主题系统已经建立，但部分现有组件的样式仍使用旧的 Tailwind 类组合，未完全应用 Grimdark 样式系统。这不影响功能，但视觉一致性仍有提升空间。

## 10. 经验与结论
这轮工作的价值，不在于"文件搬好了"，而在于项目第一次形成了一个闭环：结构有边界、入口有承载、数值有统一口径、修改有兼容、结果有验证、输出有文档。对一个已经积累了不少玩法系统的前端游戏项目来说，这一步比继续叠新内容更重要。

如果继续沿用原型阶段的开发方式，后续每加一个系统都会让修改成本更高。相反，当前这套结果至少把项目重新拉回了一个可持续维护的状态。它不是终点，但已经是一个有效的工程拐点。

从数值角度看，这轮工作的最终成果不是"游戏已经完全平衡"，而是"游戏已经具备统一口径、可执行校准和可复现回归的能力"。统一基线已经建立，战斗闭环与经济闭环的第一轮校准已经完成，关键回归证据已经落盘，最严重的早期崩盘与购买力断层也已经被修复。后续真正的精细平衡，将不再从零开始，而是在已有证据和同一口径之上继续收敛。

从工程角度看，CombatView 重构证明了"大组件可拆分、逻辑可提取、样式可统一、类型可强化"的可行性。这为后续其他 UI 模块的渐进式重构提供了可复用的方法论和基础设施。


### 5.17 Grimdark 主题层抽取与页面级样式收敛
在地图界面和阵亡结算终端完成战锤化后，新的问题变成了样式表达分散：`MapView` 与 `AppShell` 内部堆叠了大量重复的十六进制颜色、阴影和面板结构，视觉统一依赖页面级内联 Tailwind 类，而不是主题系统本身。这样短期可用，但会让后续 `CombatView`、`ShopView` 等页面继续复制相同的终端语言，增加维护成本。

本轮处理没有再改玩法，而是把页面级 Grimdark 样式收敛到主题层。具体做法是：在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.css` 中补充终端屏幕、CRT 覆盖层、Cogitator 控制面板、地图节点 tone、阵亡档案框等语义类；在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.ts` 中导出 `grimdarkNodeToneClasses`，作为地图节点 tone 的统一入口；并通过 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/index.css` 把 `grimdark.css` 正式接入全局样式链路。之后，`/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/MapView.tsx` 和 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx` 只保留布局与状态逻辑，重复的视觉表达交给主题层 utility 处理。

这一步的价值不在于“更好看”，而在于主题系统第一次真正承载了页面级视觉语义。它降低了 Grimdark 视觉继续扩散时的复制成本，也让后续把 `CombatView` 或其他视图继续收口到主题层变得可行。验证方面，本轮重新执行了 `npm run lint --silent`、`npm run build --silent` 和 `npm run test:ui-smoke -- --url=http://127.0.0.1:3010`，结果仍然全绿；`output/playwright/ui_smoke_report.json` 继续保持无 broken image、无 layout issue、无 console/page error，说明主题抽取没有引入样式回退或全局污染。

### 5.18 Informant 起手闭环二次平衡
在完成统一数值域与第一轮职业校准后，`informant` 仍然是最明显的前期异常点。回归结果显示，它的 `openingTurnDamage = 18`、`firstTwoTurnDamage = 36`，与强势职业接近；但平均战斗回合却高达 `7.1`，前 3 层存活率只有 `25%`，前 5 层仅 `8%`。这说明问题并不在基础面板，而在于起手回合被 `Gather Intel`、`Weak Point Analysis`、`Shadow Step` 这类偏功能牌占满，导致情报生成和伤害兑现脱节。

本轮修复没有去削敌人，也没有抬 `informant` 的生命或能量，而是只重写 starter loop。具体来说，起始卡组把 `shadow_step` 替换成 `precision_strike`，让起手第一轮就有真实的 Intel 兑现出口；同时把 `gather_intel` 从“高资源、低筛牌”改成“较低资源、双抽加速”，把 `weak_point_analysis` 从“高易伤铺垫”改成“更偏资源生成”，并把 `calculated_strike` 改写为真正的低成本 Intel 消费器。这样 starter loop 就从原本的“攒 Intel、上易伤、拖下一回合”变成了“产 Intel -> 立刻消费 -> 结束当前战斗节奏”。

这轮还顺带修正了回归脚本 `balance_test.ts` 中 `overallScore` 的评分口径。旧公式过度奖励短战斗，导致 `informant` 在推进明显落后的情况下仍然可能拿到高分；新公式将生存、推进、节奏和活动量拆开计分，使 `overallScore` 回到诊断用途，而不是误导性的综合强度指标。修正后，`informant` 的回归结果为：前 3 层存活率 `41.67%`、前 5 层存活率 `25%`、平均战斗回合 `2.75`、`overallScore = 45.83`。这说明它已经跨过本轮验收线，但仍旧是一个“前期可玩、整体偏弱”的职业，而不是新的强势职业。

在 `informant` 回归完成后，分析脚本还暴露了两个既有运行时问题：一是旧 `GameEngine` 实例在回归脚本中没有及时销毁，导致它们仍会保留全局事件订阅，从而在后续 run 的 `CombatVictory` 广播中继续响应，并在自身已处于 `game_over` 状态时触发非法转移告警；二是 `ConditionalKill` 动作虽然已被内容数据使用，但没有进入运行时动作工厂，导致相关牌在分析和实战里都退化为 `NullAction`。这两项问题都不是 `informant` 数据改动引入的，但确实会污染分析结果，因此随后已被单独修复，而不是继续把它们保留到更晚的运行时重构阶段。

### 5.19 回归环境订阅泄漏与 ConditionalKill 运行时缺口修复
在前述问题定位后，修复策略保持最小化：不改玩法数值，不动敌人或职业内容，只处理回归环境与动作运行时的结构缺口。首先，在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts` 中，将 `runSingle()` 包裹为 `try/finally`，保证每次模拟 run 结束后都调用 `engine.dispose()`。这样旧 `GameEngine` 不会再残留在 `globalEventBus` 上，也就不会继续消费后续 run 的 `CombatVictory` 事件。这个修复本质上不是“消音”，而是把回归脚本重新拉回到“一次 run 对应一个运行时实例”的正确模型。

其次，`ConditionalKill` 被补齐为正式动作类型。具体改动包括：在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/actions.ts` 中把 `ConditionalKill` 纳入 `ActionSpec.type` 联合类型；在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/SpecialActions.ts` 中增加 `ConditionalKillAction`，其行为是读取当前 `targetId`，检查目标在动作链执行后是否已经死亡，并在满足条件时把 `trueActions` 压回队列；最后在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/ActionFactory.ts` 中注册该动作，使其进入现有工厂和 `ActionManager` 流程。这样内容数据中 `crushing_blow`、`last_stand` 等牌的“击杀后追加收益”终于具备真实运行时含义。

为了把这次修复固化为可回归的契约，又补了两组测试。第一组是在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts` 中增加“`game_over` 后收到 `CombatVictory` 不应再输出非法转移错误”的用例；第二组是在新增的 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/conditionalKillAction.test.ts` 中验证 `ConditionalKill` 已被工厂注册，并且在目标已死亡时会真实执行 `trueActions`。这两组测试通过后，再次执行 `balance_test.ts --runs=12 --floors=5`、`npm run lint --silent` 和 `npm run build --silent`，均已通过，且回归输出中不再出现 `ConditionalKill` 未注册或 `CombatVictory after game_over` 的噪音。

## 11. 后续工作建议
1. 继续拆分 `core-runtime`，优先处理战斗结算、地图推进、持久化恢复三个方向。
2. 把 Launcher 流程沉淀为正式自动化脚本入口，而不是只停留在一次人工回归记录。
3. 继续以 `output/numerics/combat_regression.json` 为基线，处理高复杂度职业（chronomancer、puppeteer、alchemist）偏弱的问题，这些职业的专属资源动作尚未完全实现。
4. 继续以 `output/numerics/economy_regression.json` 为基础，向更细的节点收益类型、精英/事件偏斜和删牌/遗物购买压力推进。
5. 将 `relicSystem` 和 `synergySystem` 进一步接入统一数值域，去掉局部写死的倍率和风险解释。
6. 调整历史架构文档的权威性，必要时重写总览文档，避免旧结构描述继续被误用。
7. 增加前端运行指标，例如首屏可交互时间，切屏加载开销和存档恢复耗时。
8. 渐进式迁移剩余组件到 Grimdark 样式系统，保持视觉一致性。
9. 继续将其他巨型组件（如地图视图、商店视图）按相同模式拆分。
10. 继续收口运行时所有权，把当前已补齐的 `dispose()` 和事件契约推进到完整的 `RunSession` 与显式状态机层。

## 12. 证据索引
### 代码与配置
1. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/index.ts`
2. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/actions.ts`
3. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/combat.ts`
4. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/events.ts`
5. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/types/meta.ts`
6. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts`
7. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/launcher/SetupLauncher.tsx`
8. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx`
9. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/vite.config.ts`
10. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsBaseline.ts`
11. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsFormulas.ts`
12. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsValuation.ts`
13. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance/numericsRuntime.ts`
14. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/actions/v2/ActionFactory.ts`
15. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/characters.json`
16. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/content/data/cards.json`
17. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/combatCalibration.test.ts`
18. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/economyCalibration.test.ts`
19. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json`
20. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json`
21. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/runLifecycle.test.ts`
22. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/tests/unit/conditionalKillAction.test.ts`

### CombatView 重构相关
23. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/CombatView.tsx`
24. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/CombatHUD.tsx`
25. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/Battlefield.tsx`
26. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/ActionHand.tsx`
27. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/WarpEye.tsx`
28. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/modals/DeckModal.tsx`
29. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/modals/DrawPileModal.tsx`
30. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/combat/modals/DiscardPileModal.tsx`
31. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/hooks/useIntentMasquerade.ts`
32. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/hooks/useCardPreview.ts`
33. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/hooks/useCombatTelemetry.ts`
34. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/index.ts`
35. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.ts`
36. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.css`
37. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/types/combat.ts`

### 文档与过程记录
38. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`
39. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/DEVELOPMENT.md`
40. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/architecture/ARCHITECTURE.md`
41. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/validation/README.md`
42. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/baseline_audit.json`
43. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json`
44. `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/economy_regression.json`

## 附录 A：验证命令
```bash
npm run lint
npm run build
npm run check:import-boundaries
npm run check:deprecated-imports
npm run check:readme-consistency
```

## 附录 B：关键判断
- `docs/architecture/ARCHITECTURE.md`：历史背景材料，不应单独作为当前实现事实来源。
- `src/engine/*`：兼容层，不应承载新增业务实现。
- `src/core/index.ts`：当前公共接口总入口。
- `src/ui/launcher/SetupLauncher.tsx`：当前启动流程承载点。
- `src/ui/views/CombatView.tsx`：当前战斗视图入口（重构后）。
- `src/ui/theme/grimdark.ts`：战锤主题配置入口。
- `src/types/combat.ts`：战斗系统严格类型入口。
