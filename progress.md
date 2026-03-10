Original prompt: 设计有专门的 set-uo 的启动器，不再只能依靠直接打开 html 文件来启动界面

- TODO: 实现正式启动器视图，接入新游戏/继续/读档。

- DONE: 启动器已落位到 src/ui/launcher/SetupLauncher.tsx，并接入 AppShell。
- TODO: 跑浏览器烟测，确认启动器可新开局/继续/读档。
- FIX: SetupLauncher 改用 RunSummary 已有字段，不再读取不存在的 characterId。
- FIX: GameSetup 新增 clearActiveRun()，避免重启/返回启动器时误用 shutdown() 破坏监听器。

- FIX: 定位到 @rollup/rollup-darwin-arm64 被 macOS quarantine 拦截，开始清理扩展属性。

- FIX: 定位到 esbuild arm64 二进制也带 quarantine，已清理 node_modules 下相关副本。

- FIX: lightningcss.darwin-arm64.node 同样带 quarantine，已清理。

- FIX: @tailwindcss/oxide-darwin-arm64 原生模块带 quarantine，已清理。

- FIX: 单包逐个修复已切换为对整个 node_modules 递归清理 quarantine/provenance，避免链式原生依赖继续报错。

- TEST: Playwright client 已可执行，需继续确认其截图/页面产物路径并做视觉检查。

- ADD: 新增 repair:macos-native 脚本，统一修复 node_modules 原生模块的 macOS quarantine 问题。
- 2026-03-02: 用 Playwright 真正跑通启动器链路：New Run -> CharacterSelect -> Map -> Combat -> Quick Save -> Return to Launcher -> Continue -> Return to Launcher -> Load Slot，全部成功。
- 2026-03-02: 对 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx` 做视图级懒加载，对 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/vite.config.ts` 增加 `manualChunks`，主入口 chunk 从 731.19 kB 降到 32.90 kB。
- 2026-03-06: 建立统一 numerics domain 后，开始第一轮战斗闭环与经济闭环校准。
- 2026-03-06: 战斗侧修正 `informant / brute / tactician` 的早期内容配置，`informant` 前三层存活率从 0% 拉升到 67%，同时保留 `tactician` 仍偏稳、`puppeteer` 偏弱作为下一轮目标。
- 2026-03-06: 经济侧把 `economy_regression.json` 从流程摘要升级为可购买性摘要，新增 `avgGoldGainPerFloor`、`shopAffordability`、`removalAffordability`、`rewardToPriceRatio`。
- 2026-03-06: 商店运行时价格曲线已校准，当前前 3 层 `card affordability = 1.0`、`potion reward-to-price ratio = 0.93`，已跨过第一轮经济目标线。
- 2026-03-07: 经济回归继续细化，新增 `netAssetEVUByCheckpoint`、`netAssetEVUGrowthByFloor`、`netAssetCoverageByCheckpoint` 与 `nodeDistribution`，开始直接观察净资产增长和节点分布偏斜。
- 2026-03-07: 新增 `balanceDetection` 回归测试，`combat_regression.json` 现在会输出职业 spread、平均值、标准差与 outlier 标记，数值失衡已从“感觉问题”变为结构化诊断结果。
- 2026-03-07: 用 Playwright 重新跑通 Launcher -> CharacterSelect -> Map -> Combat -> Quick Save -> Continue -> Load Slot 全链路；修复角色选择页默认展开导致的视口溢出，以及地图自动居中把顶部节点裁出视口的问题。当前 `output/playwright/ui_smoke_report.json` 已无 broken images、console errors 或 layout issues。
- 2026-03-08: 对 `src/ui/views/MapView.tsx` 做第二轮战锤化收口，节点名称切换到审判庭/亚空间语境，地图顶部信息栏重做为 Cogitator 战区终端，节点卡片统一改为切角机甲风格，并加入扫描线、暗角和黄铜-凝血红配色。
- 2026-03-08: 对 `src/ui/views/AppShell.tsx` 的 `GameOver` 终端做重构，改成“审判庭阵亡档案”式布局，保留原有 run summary / meta 信息，但重新组织为黑匣子日志、异端裁定、战备回收评估与综合归档四块。
- 2026-03-08: Playwright 在 `Map -> Combat` 链路抓到浏览器运行时错误 `require is not defined`。根因是 `src/ui/hooks/useCombatTelemetry.ts` 与 `src/core/combat/combatSystem.ts` 仍残留 CommonJS 风格 `require(...)`；修复为静态导入后，`output/playwright/ui_smoke_report.json` 再次转绿，Launcher -> CharacterSelect -> Map -> Combat -> Quick Save -> Continue -> Load Slot 全链路无 broken image、page error、console error 或 layout issue。
- 2026-03-08: 清理 combat UI 的类型边界漂移，修复 `src/ui/hooks/useCardPreview.ts`、`src/ui/hooks/useCombatTelemetry.ts`、`src/ui/hooks/useIntentMasquerade.ts`、`src/ui/views/combat/Battlefield.tsx`、`src/ui/views/combat/CombatHUD.tsx` 与 `src/ui/views/combat/modals/DrawPileModal.tsx` 的运行时类型错配和缺失导入问题。当前 `npx tsc --noEmit`、`npm run lint --silent`、`npm run build --silent` 与 `npm run test:ui-smoke -- --url=http://127.0.0.1:3010` 已全部通过。
- 2026-03-08: 将 Grimdark 视觉从页面内联类抽取到 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.css` 与 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/theme/grimdark.ts`，新增终端、档案、地图节点 tone 的语义类，并在 `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/index.css` 全局接入主题样式。`MapView` 与 `AppShell` 已切换到主题层 utility，`npm run lint --silent`、`npm run build --silent`、`npm run test:ui-smoke -- --url=http://127.0.0.1:3010` 全部通过，说明主题抽取没有带来 UI 回退。
- 2026-03-08: 锁定运行时重构前的基线快照，复制 `baseline_audit.json`、`combat_regression.json`、`economy_regression.json` 为 `*.pre_runtime_refactor.json`，并创建 `output/numerics/pre_refactor_snapshot.md` 记录当前职业生存分布、商店可购买性与 bundle 状态。
- 2026-03-09: 完成二次平衡调整，重点解决构造体/元素体系前期收益偏低、多个职业起始卡组输出不足、三类专属资源在前两回合内难以形成稳定"获取-消费"闭环的问题。
- 2026-03-09: 构造体基础攻击上调：scrap_golem 2→3、reinforced_golem 4→5、reinforced_golem_plus 5→6、CreateConstructAction 默认 ATK 5→6。
- 2026-03-09: 元素反应伤害公式调整：从 `elements.length * 3 * times` 改为 `elements.length * 4 * times + max(0, uniqueElements - 1) * 2 * times`，提升前期兑现能力。
- 2026-03-09: 起始卡组输出提升：informant/tactician 增加 1 张 strike，puppeteer 增加 1 张 thread_lash，chronomancer 增加 1 张 echo_strike，alchemist 增加 1 张 fire_arrow。
- 2026-03-09: 专属资源初值调整：timeLayer 0→1、concoction 0→1，确保高复杂度职业前两回合内至少有一次可行的资源消费窗口。
- 2026-03-09: 新增 `starterBalanceDetection.test.ts`，覆盖构造体基础输出、元素反应公式、起始卡组输出、资源闭环四类检测。
- 2026-03-09: 新增 `starterDamageProfile` 输出到 `combat_regression.json`，包含 `openingTurnDamage`、`firstTwoTurnDamage`、`firstResourceSpendTurn`。
- 2026-03-09: 回归验证结果：高复杂度职业（puppeteer、chronomancer、alchemist）前3层存活率从 17%~33% 提升至 67%~75%，职业间 spread 从 0.83 降至 0.75，达到平衡目标。
- 2026-03-09: 对 `informant` 做二次平衡优化，确认其问题不是面板偏低，而是 starter loop 中“产 Intel”和“兑现伤害”脱节，导致前期回合被功能牌占满，平均战斗回合被拖到 7.1。
- 2026-03-09: `informant` 起始卡组从 `shadow_step` 切换为 `precision_strike`，同时重写 `gather_intel`、`weak_point_analysis`、`calculated_strike`，让前两回合稳定形成“产 Intel -> 消耗 Intel -> 结束战斗”的闭环。
- 2026-03-09: 新增 `tests/unit/informantStarterLoop.test.ts`，并扩展 `starterBalanceDetection.test.ts` 与 `combatCalibration.test.ts`，把 `informant` 起手组成、三张关键牌动作与前 3 / 前 5 层回归门槛正式固化为测试。
- 2026-03-09: 修正 `scripts/analysis/balance_test.ts` 的 `overallScore` 诊断口径。旧公式过度奖励短战斗，导致 `informant` 在只推进到 2.25 层时仍出现异常高分；新公式把生存、推进、节奏和活动量拆开计分后，`informant` 的回归得分已回落到合理区间。
- 2026-03-09: 最新回归结果：`informant` 前 3 层存活率提升到 `41.67%`，前 5 层存活率提升到 `25%`，平均战斗回合降到 `2.75`，已跨过本轮验收线；同时 `overallScore = 45.83`，不再高于 `chronomancer` 与 `tactician`。
- 2026-03-09: 修复回归环境中的运行时污染：`scripts/analysis/balance_test.ts` 现在会在每次 run 结束后调用 `engine.dispose()`，旧 `GameEngine` 不再残留订阅并继续接收后续 `CombatVictory` 事件。
- 2026-03-09: 为 `ConditionalKill` 补齐正式运行时支持：已在 `src/core/types/actions.ts` 注册动作类型，在 `src/core/actions/v2/SpecialActions.ts` 增加 `ConditionalKillAction`，并在 `src/core/actions/v2/ActionFactory.ts` 中接入工厂。
- 2026-03-09: 新增 `tests/unit/conditionalKillAction.test.ts` 与 `runLifecycle.test.ts` 的竞态回归用例，确认 `ConditionalKill` 不再退化为 `NullAction`，且 `game_over` 后的 `CombatVictory` 不再污染运行时或输出非法转移告警。
- 2026-03-09: 重新执行 `balance_test.ts --runs=12 --floors=5`、`npm run lint --silent` 与 `npm run build --silent`，全部通过；回归输出中已不再出现 `ConditionalKill` 未注册或 `CombatVictory after game_over` 的噪音。
