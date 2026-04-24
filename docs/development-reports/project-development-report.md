# DeckRogue Runtime V2 开发报告

## 基本信息

| 字段 | 内容 |
|------|------|
| 任务目标 | 完成 runtime-v2 player-critical-path fidelity sprint，并继续收敛 PIXI covered-flow pointer proof、combat/reward fidelity 与 route distribution diagnostics |
| 工作区 | /Users/zhuhangcheng/Downloads/好玩/deckrogue |
| 开始时间 | 2026-04-10 |
| 当前阶段 | Runtime-v2 route distribution diagnostics complete; Ralph architect gate approved |
| 最近一次通过验证的检查点 | Step 113 closeout verification：architect `APPROVE`；growth route distribution report-only diagnostics 已落盘；formationRate `100%` 保持 green；distribution `warningCount=6`，alchemist/informant/puppeteer 单一路线集中被显式标记；targeted unit `5/5`；shop/event growth、route taxonomy、summary report、lint/typecheck/build/scoped diff 通过 |
| 当前状态 | done |
| 完成目标 | runtime-v2 map/shop/rest/event fidelity 已落地；PIXI covered flow 已无 bridge checks；本轮继续让 route/balance proof 从 aggregate green 增加 per-character distribution diagnostics |
| 当前风险或阻塞 | 当前无本地验证 blocker；route distribution 只是 report-only diagnostics，不声明 route/balance distribution solved |

## 当前结论

当前可保留的安全口径：

- `runtime-v2 core loop complete`
- `runtime-v2 parity further hardened across process + shipped wasm shared-command scope`

当前必须保留的边界：

- `pixi` 证据已到当前 Playwright covered flow 的 `pointer-covered-flow`
- 旧的 `bridge-assisted-semantic` 边界只适用于未覆盖的 PIXI 交互范围
- 不声明 `full pointer-level pixi parity`
- 不声明 `full parity complete`

最近 proof-gap review 包：

- 目录：[code_review_runtime_v2_proof_gap_fixes_20260417_step97](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/code_review_runtime_v2_proof_gap_fixes_20260417_step97)
- zip：[code_review_runtime_v2_proof_gap_fixes_20260417_step97.zip](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/code_review_runtime_v2_proof_gap_fixes_20260417_step97.zip)
- SHA-256：`c41be4e3f805c7f67ef3932aa8dbf4e1d3ad19ae1c77d6671b92efc3fdf7e483`

Step 108/109 当前已完成实现、验证和 architect approval；尚未刷新外发 review zip。

最新 GPT Pro post-sprint handoff 包：

- 目录：[gptpro_deckrogue_runtime_v2_fidelity_post_sprint_20260418_step109](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/gptpro_deckrogue_runtime_v2_fidelity_post_sprint_20260418_step109)
- zip：[gptpro_deckrogue_runtime_v2_fidelity_post_sprint_20260418_step109.zip](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/gptpro_deckrogue_runtime_v2_fidelity_post_sprint_20260418_step109.zip)
- SHA-256：见同目录 `.zip.sha256`

最新 GPT Pro hard-problems handoff 包：

- 目录：[gptpro_deckrogue_unsolved_hard_problems_20260418_step111](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/gptpro_deckrogue_unsolved_hard_problems_20260418_step111)
- zip：[gptpro_deckrogue_unsolved_hard_problems_20260418_step111.zip](/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/packages/gptpro_deckrogue_unsolved_hard_problems_20260418_step111.zip)
- SHA-256：见同目录 `.zip.sha256`

清理前完整原文已存为只读上下文快照：

- [project-development-report-pre-cleanup-20260417T152100Z.md](/Users/zhuhangcheng/Downloads/好玩/deckrogue/.omx/context/project-development-report-pre-cleanup-20260417T152100Z.md)

## 最新验证证据

| 检查项 | 结果 |
|---|---|
| targeted unit | `31/31` |
| process differential parity | `18/18` |
| wasm browser differential parity | `18/18` on `http://127.0.0.1:3100` |
| process/wasm negative entries | semantic match、无 `unknown`、rollback stable |
| wasm negative rollback | `liveSnapshotObservedAfterError=true` |
| runtime-v2 TS bundle | `145 pass / 1 skip` |
| supplemental units | `98/98` |
| DOM runtime-v2 smoke | `55 checks`，`failed=0`，`actionSources=[derived,pointer]`，`bridgeChecks=[]`，`explicitMissingActionSource=0` |
| PIXI runtime-v2 smoke | `59 checks`，`failed=0`，`actionSources=[derived,pointer]`，`bridgeChecks=[]`，`interactionMode=pointer-covered-flow` |
| shop-event growth nodes | pass，`shopRate=100%`，`eventRate=100%` |
| growth route formation | pass，`formationRate=100%`；distribution report-only `warningCount=6`，alchemist/informant/puppeteer `uniqueTagCount=1` |
| route taxonomy guardrails | pass，`failureCount=0` |
| lint | 通过 |
| typecheck | 通过 |
| build | 通过，仅保留既有 chunk-size warning |
| current architect gate | Step 113 Ralph architect gate `APPROVE`；report-only distribution diagnostics 无 completion blocker |

## 当前关键实现点

- `free_remove` strict payload 使用判别式投影：`{ state: 'missing' | 'invalid' | 'valid', value: number | null }`。
- 只有字段缺失 `undefined` 是 `missing`；显式 `null`、`NaN`、小数、字符串、负数都是 `invalid`。
- negative parity 使用 scenario-declared `expectedSemanticCode`，并拒绝 `unknown`。
- wasm negative rollback proof 必须读取 live browser snapshot，pass 条件要求 `liveSnapshotObservedAfterError=true`。
- Playwright smoke 的 `actionSource` 在 check 记录时显式写入，报告同时输出 `missingActionSource`、`explicitMissingActionSource`、`inferredActionSourceCount`、`actionSources`。
- Runtime-v2 read-side contract 现在把 route guidance、event choice route role、shop offer hints 和 map route dossiers 暴露给 DOM/PIXI scenes。
- PIXI covered-flow scenes 发布 canvas hit-target telemetry，Playwright 用真实 canvas pointer 坐标验证 map/event/rest/shop/surface/combat/reward/shop relic/shop potion；当前 `report_pixi.json` 已无 `bridge` action source。
- Combat/reward runtime-v2 scene props 现在提供 read-side guidance、hand-card play hints、reward route reasons，并由 DOM/PIXI scenes 共同消费。
- Shop/event route selection 现在优先近期路线信号，早中期 shop card offers 加强当前路线卡牌，同时保留 generic/pivot counterweight。
- Growth route formation report 现在输出 per-character route distribution diagnostics，包括 `uniqueTagCount`、`maxTagShare`、`minNonzeroTagShare`、dominant tag counts 和 report-only warnings。
- package 每次源码修复后必须刷新 `files/`、`diffs/`、`FILE_MANIFEST.json`、zip 和 checksum。

## 近期步骤日志

### Step 97: close latest four proof gaps

- **操作方向**：按 GPT Pro review 修 runtime-v2 proof gap。
- **代码编写目的**：保持 safe claim 不变，同时加厚 missing-vs-zero、semantic negative、wasm live rollback、raw action-source 证据。
- **执行与变更**：修改 `activeEventOutcome.ts`、legacy oracle、parity utils/cases、process/wasm validators、Playwright smoke、unit tests。
- **得到的结果**：process/wasm parity 扩到 `18/18`，negative classes 覆盖 selector/shop/phase/surface，DOM/PIXI report 写入 explicit action-source summary。
- **验证**：unit、process parity、wasm parity、DOM/PIXI smoke、lint、typecheck、build 均通过。
- **升级候选**：negative parity hardening 最小标准是 expected semantic code、non-unknown、live rollback snapshot。

### Step 98: refresh local evidence after hook

- **操作方向**：补 fresh evidence，并把 architect quota blocker 写清楚。
- **代码编写目的**：避免代码已绿但 Ralph 状态持续空转。
- **执行与变更**：重新读 wasm report、DOM/PIXI report，跑 scoped `git diff --check`，同步 Ralph state。
- **得到的结果**：本地证据继续成立，唯一 blocker 收敛为 architect subagent quota。
- **验证**：wasm negative entries、DOM/PIXI action-source summary、scoped diff check 通过。
- **升级候选**：Ralph 只剩外部 review blocker 时，先补 fresh local evidence，再同步 state/report。

### Step 99: package Step 97 proof-gap fixes

- **操作方向**：滚动生成新的 GPT Pro review package。
- **代码编写目的**：避免旧 `step95` package 误导后续审阅。
- **执行与变更**：生成 README、REVIEW_TAGS、FILE_LIST、FILE_MANIFEST、FILE_TREE、scoped diffs、selected files。
- **得到的结果**：新包覆盖 proof fixes、reports、context snapshot 和 architect quota caveat。
- **验证**：manifest parse、`20/20 copied`、`14` diffs、`6` tags、zip test、checksum 通过。
- **升级候选**：proof-gap fix 后必须同步滚动 review package。

### Step 100: handle Ralph stale hook state

- **操作方向**：处理 hook 看到 stale `starting` state 的问题。
- **代码编写目的**：让 global/session Ralph state 与真实 blocked-by-quota 状态一致。
- **执行与变更**：重新校验 package 和 reports，同步 `.omx/state/ralph-state.json`。
- **得到的结果**：global state 不再停在 stale `starting`。
- **验证**：manifest、zip、checksum、process/wasm JSON、DOM/PIXI summary、state check 通过。
- **升级候选**：hook 看到 stale state 时先补证据，再同步 global/session state。

### Step 101: fix code-review findings

- **操作方向**：修复 thorough code review 找到的两个 HIGH blocker。
- **代码编写目的**：关闭 `free_remove` strict payload false negatives 和 wasm package stale live-read proof。
- **执行与变更**：`freeRemovalsRemaining` 改为 `{ state, value }`；wasm validator 不再把 cached snapshot 计为 live proof。
- **得到的结果**：missing/invalid/decimal/string/negative/0 状态被区分，wasm rollback pass 必须有 live evidence。
- **验证**：unit `30/30`、process `18/18`、wasm `18/18`、lint、typecheck、build 通过。
- **升级候选**：payload proof 需要三态以上时，不能用 `number | null`。

### Step 102: refresh package after code-review fixes

- **操作方向**：把 Step 101 的 source fixes 同步进 package。
- **代码编写目的**：关闭 workspace/package drift。
- **执行与变更**：重新复制 `20` 个 files、生成 `14` 个 diff artifacts、刷新 manifest/tree/zip。
- **得到的结果**：package 内包含 fixed wasm live-read 和 fixed discriminated strict payload projection。
- **验证**：`20/20 copied`、`14` diffs、manifest parse、`unzip -tq`、checksum 通过。
- **升级候选**：修 source 后必须重打包再复审。

### Step 103: fix explicit null edge case

- **操作方向**：修复 blockers-only code review 的 explicit `null` finding。
- **代码编写目的**：严格区分 field missing 与 malformed explicit value。
- **执行与变更**：`undefined` 是 `missing`；显式 `null` 是 `invalid`；补 missing-vs-null test。
- **得到的结果**：`free_remove` strict projection 区分 missing、explicit null、NaN、小数、字符串、负数、0、有效整数。
- **验证**：unit `31/31`、process `18/18`、wasm `18/18`、lint、typecheck、build 通过。
- **升级候选**：JSON/WASM proof 中显式 `null` 应默认视为 malformed value。

### Step 104: previous proof-gap gate approval

- **操作方向**：完成上一轮 runtime-v2 proof-gap fixes 的 blockers-only review。
- **代码编写目的**：确认 Step 97-103 的 proof-gap blocker 已关闭；这是历史 gate，不代表 Step 108 当前 sprint 的 architect gate。
- **执行与变更**：运行 blockers-only code review、architect review、scoped deslop inspection，并在当时清理上一轮 Ralph state。
- **得到的结果**：上一轮 proof-gap gate 获得 code-review `APPROVE` 和 architect `APPROVE`。
- **验证**：unit `31/31`、process `18/18`、wasm `18/18`、lint、typecheck、build、package unzip/checksum、scoped diff check 全部通过。
- **升级候选**：Ralph review gate 发现 blocker 时，必须修源码、扩测试、重打包、复审。

### Step 105: report cleanup

- **操作方向**：清理 canonical development report 的历史噪音。
- **代码编写目的**：让后续接手者能快速看到当前结论、最新证据、关键实现点和历史索引。
- **执行与变更**：将清理前全文保存到 `.omx/context/project-development-report-pre-cleanup-20260417T152100Z.md`，并把本报告重构为当前结论、验证证据、近期步骤、历史索引和后续展望。
- **得到的结果**：报告从旧流水账压缩为可读的 canonical 当前状态文件；详细历史仍可从 context snapshot 追溯。
- **验证**：Markdown heading check、关键 claim/package/SHA/Step 104/Step 105 grep check 通过。
- **升级候选**：canonical report 应保留当前事实和索引，长历史流水账进入只读 context snapshot。

### Step 106: package GPT Pro next development and optimization planning handoff

- **操作方向**：基于清理后的 report 和最新 proof package，生成给 GPT Pro 的 forward-planning handoff。
- **代码编写目的**：让 GPT Pro 直接产出后续开发与优化计划，而不是重新做代码审阅。
- **执行与变更**：新建 `gptpro_deckrogue_next_dev_optimization_plan_20260418_step105` package，包含 README、GPT Pro 起始说明、输出要求、当前 report、清理前全文快照、runtime-v2 核心源码、UI/PIXI 文件、validators、unit tests、JSON reports、最新 review package 元数据和 git status/diff stat。
- **得到的结果**：GPT Pro 可以基于 `126` 个精选文件直接做后续 roadmap、sprint、proof boundary、UX/product 和 technical debt 计划。
- **验证**：package inventory `126/126 copied`、manifest parse、zip integrity、SHA-256 `0ce408c4f7e990e8e47087a677e8ea7373e46b05948db0815b32bae61452b5f7`、关键文件存在性检查通过。
- **升级候选**：planning handoff 与 code-review handoff 要分开；planning 包应强调 roadmap、验收标准和 Codex-ready task queue。

### Step 107: ingest GPT Pro next-development plan into executable sprint plan

- **操作方向**：把 GPT Pro 返回的后续开发与优化计划转成仓库内可执行 sprint plan。
- **代码编写目的**：解决 GPT Pro 提出的 blocking question：后续执行应基于 full repository，而不是 curated planning snapshot；planning package 只作为上下文。
- **执行与变更**：新增 `docs/plans/2026-04-18-runtime-v2-critical-path-fidelity-sprint.md`，明确 runtime-v2 player-critical-path fidelity sprint、PIXI proof slice、shop alignment retune、执行顺序、非目标、验收标准和验证命令。
- **得到的结果**：下一轮 Codex/Ralph 可直接从 Task 1 `Enrich Runtime-V2 Read-Side Contracts` 开始，不需要重新解释 GPT Pro 计划。
- **验证**：Markdown 文件存在、关键任务名、验证命令、PIXI 边界、full repository execution target 检查通过。
- **升级候选**：GPT Pro planning output 进入执行前，应先落成 repo-local plan artifact，再开始代码修改。

### Step 108: implement runtime-v2 critical-path fidelity sprint

- **操作方向**：按 `docs/plans/2026-04-18-runtime-v2-critical-path-fidelity-sprint.md` 全量实施 runtime-v2 player-critical-path fidelity sprint。
- **代码编写目的**：让 runtime-v2 map/shop/rest/event 具备玩家可读的 route/action guidance，同时给 PIXI critical path 建立真实 pointer 证据，并提升 shop/event route alignment。
- **执行与变更**：扩展 `RenderModelRoom` / `sceneProps` 的 guidance payload；DOM/PIXI map、event、rest、shop scenes 消费同一份 decision-support 数据；PIXI scenes 发布 canvas hit-target telemetry；Playwright PIXI flow 用 canvas pointer 点击验证 event choice、rest/surface、shop card/remove 等 critical steps；shop/event route selection 改为优先近期路线信号，shop card offers 增加当前路线补强。
- **得到的结果**：runtime-v2 critical-path UI 不再只显示 placeholder-level room data；PIXI report 顶层仍诚实保留 `bridge-assisted-semantic`，但 critical-path checks 记录 pointer evidence；shop/event growth nodes 从红变绿，shop/event rate 均为 `100%`。
- **验证**：`npm run test:runtime-v2:ts` -> `145 pass / 1 skip`；`npm run test:supplemental-units` -> `98/98`；`npm run test:runtime-v2-entry-smoke -- --renderer=dom|pixi` 通过；`npm run test:runtime-v2-flow-smoke -- --renderer=dom` -> `55 checks failed=0`；`npm run test:runtime-v2-flow-smoke -- --renderer=pixi` -> `59 checks failed=0`；`npm run check:shop-event-growth-nodes` -> `shopRate=100% eventRate=100%`；`npm run check:growth-route-formation` -> `100%`；`npm run check:route-taxonomy-guardrails` -> pass；`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run build` 通过，build 仅保留既有 chunk-size warning。
- **后续展望**：下一步不要把当前证据升级成 full PIXI parity；如果要继续升级 claim，只能写成 `PIXI critical-path pointer proof slice`，并先补 combat/reward/relic/potion pointer 覆盖。
- **升级候选**：PIXI pointer proof 可以用 canvas hit-target telemetry + report actionSource 分层记录，避免把局部 pointer slice 误写成 full renderer parity。

### Step 109: Ralph architect approval and closeout

- **操作方向**：完成 Ralph final architect gate、deslop hygiene 和 post-deslop regression evidence。
- **代码编写目的**：把 Step 108 从本地验证状态收口为已审批完成状态，同时避免 report wording 把 PIXI 局部 pointer slice 误升级。
- **执行与变更**：最终 architect 只读审查返回 `APPROVE`；报告顶部从 pending 改为 complete/done；保留 PIXI 总口径 `bridge-assisted-semantic`；重跑 scoped overclaim scan、DOM/PIXI JSON summary 读取和 scoped `git diff --check`。
- **得到的结果**：当前无 completion blocker；runtime-v2 critical-path fidelity sprint 可作为完成态进入下一轮工作。
- **验证**：architect fresh evidence 确认 `npm run test:runtime-v2:ts`、`npm run test:supplemental-units`、`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json` 通过；本地 scoped `git diff --check` 通过；DOM flow JSON 为 `55 checks failed=0`；PIXI flow JSON 为 `59 checks failed=0` 且 `interactionMode=bridge-assisted-semantic`。
- **升级候选**：Ralph 收口报告应在 architect approval 后再把状态改成 `done`；在 approval 前保持 `in_progress` 是正确状态。

### Step 110: package GPT Pro post-sprint handoff

- **操作方向**：按 Step105 同类结构，重新打包一份基于 Step108/109 完成态的 GPT Pro handoff。
- **代码编写目的**：让 GPT Pro 能从最新实现和验证证据出发，评估 post-sprint 状态并给出下一轮开发与优化计划。
- **执行与变更**：生成 `README_FIRST.md`、`GPTPRO_START_HERE.md`、`REQUESTED_OUTPUT.md`、`CONTEXT_NOTES.md`、`context/current_report_excerpt.md`、`evidence/validation_summary.txt`、DOM/PIXI report summary、selected diff patch、完整 `FILE_MANIFEST.json`、zip 和 SHA-256。
- **得到的结果**：包名为 `gptpro_deckrogue_runtime_v2_fidelity_post_sprint_20260418_step109`，包含 runtime-v2 contract/scene/proof/alignment 关键源码、报告、计划、测试、growth reports、Playwright JSON 和前序 GPT Pro planning 包入口文件。
- **验证**：`unzip -l` 可列出包结构；`jq` 可解析 `FILE_MANIFEST.json`；`.zip.sha256` 已生成；`MISSING_FILES.txt` 无缺失清单。
- **升级候选**：post-sprint planning 包应和 code-review 包分开；前者要求 GPT Pro 输出 roadmap 和 Codex task queue，后者才要求逐行 blocker review。

### Step 111: package GPT Pro unsolved hard-problems handoff

- **操作方向**：按用户要求，从 GPT Pro handoff 中剔除已解决问题，把任务改成寻找更难的未解决问题。
- **代码编写目的**：避免 GPT Pro 继续消耗输出预算复盘 Step97-110 已关闭事项，转向 full PIXI pointer、combat/reward fidelity、full-run dogfood、route/balance distribution、read-side truth-source simplification、release/desktop hardening 和 report/package automation 等更难问题。
- **执行与变更**：新增 `SOLVED_SCOPE_EXCLUSIONS.md` 和 `HARD_PROBLEMS_SEED.md`；重写 `README_FIRST.md`、`GPTPRO_START_HERE.md`、`REQUESTED_OUTPUT.md`、`CONTEXT_NOTES.md`；保留源码、报告、验证证据和 selected diff 作为事实基线。
- **得到的结果**：包名为 `gptpro_deckrogue_unsolved_hard_problems_20260418_step111`，GPT Pro 读取后会先排除已解决范围，再输出 harder unsolved problems ranking、weaker-agent-miss list、next sprint queue 和 claim boundary plan。
- **验证**：`unzip -t` 通过；`jq` 可解析 `FILE_MANIFEST.json`；`.zip.sha256` 已生成；`MISSING_FILES.txt` 无缺失清单；scoped `git diff --check` 通过。
- **升级候选**：当目标是“找更难问题”时，handoff 必须显式列出 solved exclusions，否则外部模型会自然回到已经完成的 proof/UX 事项。

### Step 112: remove PIXI covered-flow bridge checks and lift combat/reward guidance

- **操作方向**：按 hard-problems 反馈，优先收敛 PIXI covered flow 中剩余 `bridge` action source，并补 combat/reward 玩家可读性。
- **代码编写目的**：让当前 Playwright complete-run covered path 不再依赖 bridge 完成 combat、reward、shop relic、shop potion，同时让 combat/reward 不只证明“可点”，也能显示基础决策说明。
- **执行与变更**：`MapScenePixi` 将 map node `y` 按最大 floor 归一化，修复第三层 combat node 被画到 canvas 外的问题；`CombatScenePixi`/`RewardScenePixi` 发布 `complete_combat`、`take_reward`、`skip_reward` hit targets；`ShopScenePixi` 用双列 offer 布局渲染全部 relic/potion pointer targets；Playwright flow 将 combat enter、complete combat、take reward、shop relic/potion purchase 全部改为 `clickPixiTarget`；`sceneProps` 为 combat/reward 增加 guidance、hand-card hints 和 reward route reasons，DOM/PIXI scenes 共同消费；report 顶层显式输出 `bridgeChecks`。
- **得到的结果**：PIXI flow 从 `actionSources=[bridge,derived,pointer]` 收敛为 `actionSources=[derived,pointer]`，`bridgeChecks=[]`；`interactionMode` 自动改为 `pointer-covered-flow`。这只证明当前 covered flow，不升级为 full PIXI pointer parity。
- **验证**：`npm run test:runtime-v2-flow-smoke -- --renderer=pixi` -> `59 checks failed=0`、`bridgeChecks=[]`；`npm run test:runtime-v2-flow-smoke -- --renderer=dom` -> `55 checks failed=0`、`bridgeChecks=[]`；`npm run test:runtime-v2-entry-smoke -- --renderer=dom|pixi` 通过；`npm run test:runtime-v2:ts` -> `145 pass / 1 skip`；`npm run test:supplemental-units` -> `98/98`；`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run build`、LSP diagnostics、scoped `git diff --check` 通过；architect gate `APPROVE`。
- **升级候选**：可以新增局部 claim：`PIXI runtime-v2 Playwright covered flow is pointer-covered`；仍不能写 `full pointer-level pixi parity`，因为未覆盖所有 scene-local action 与 RuleCommand matrix。

### Step 113: add route distribution report-only diagnostics

- **操作方向**：按 hard-problems 队列，给 growth route formation 增加 per-character distribution diagnostics，避免 aggregate `formationRate=100%` 掩盖路线集中。
- **代码编写目的**：在不立刻调数值、不把 gate 改红的前提下，让报告显式指出哪些角色路线形成过度集中，为下一轮 balance tuning 提供可操作证据。
- **执行与变更**：`check_growth_route_formation.ts` 导出 `summarizeRouteDistribution()` 并在 report 中写入 `distribution`；`report_growth_route_formation.ts` 汇总该字段；`growthRouteFormation.test.ts` 增加 collapsed tag summary 单测。
- **得到的结果**：`reports/growth/growth-route-formation.json` 继续 `pass=true`、`formationRate=100%`，同时输出 report-only `distribution.warningCount=6`；alchemist、informant、puppeteer 均被标记为 `uniqueTagCount=1`、`maxTagShare=1`，说明当前 green aggregate 下仍存在角色内路线集中。
- **验证**：`npx tsx --test tests/unit/growthRouteFormation.test.ts` -> `5/5`；`npm run check:growth-route-formation` -> `100% (120/120)`；`npm run check:shop-event-growth-nodes` -> `100%/100%/100%`；`npm run check:route-taxonomy-guardrails` -> `failureCount=0`；`npm run report:growth-route-formation` 通过并写入 `growth-route-summary.json`；`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run build`、scoped `git diff --check` 通过；architect gate `APPROVE`。
- **升级候选**：当前只能 claim `route/balance validators include report-only distribution diagnostics`；不能 claim `route/balance distribution solved`，也不应直接把 warning 变成 fail gate。

### Step 114: stabilize legacy character-select proof selectors

- **操作方向**：修复角色选择到地图路径的验证断点，停止基于旧英文角色名推断“无法跳转地图”。
- **代码编写目的**：让 legacy 角色卡和 Playwright/Electron smoke 使用稳定 `data-character-id`，避免内容中文化后自动化仍寻找 `The Brute` / `The Informant` 导致未点击角色卡。
- **执行与变更**：`CharacterSelectView` 为每个角色卡输出 `data-character-id`；UI smoke、Electron smoke、victory flow、combat helper、real-ui 30-clicks、expansion smoke、manual long-combat review 改为按角色 id 点击；fallback start button 文案匹配补充 `开始战区部署`；顺手修复新增 `src/core/events/SaveManager.ts` 的 `GameState` clone fallback 与 `seed` 类型，恢复 TypeScript 编译。
- **得到的结果**：`npm run test:ui-smoke` 能完成 launcher、character_select、map、combat、reward、map_after_reward、launcher_after_save、after_continue、after_load_slot 全链路；此次复现证明实际断点是 proof selector drift，不是 `GameEngine.selectCharacter()` 状态转换失败。
- **验证**：`npm run test:ui-smoke` 通过，`output/playwright/ui_smoke_report.json` 中 `consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`；`npm run lint --silent` 通过；3200/3000 dev server 端口无遗留进程。
- **升级候选**：角色/内容文案可继续本地化，但自动化 proof 必须绑定稳定 id 或 telemetry target，不能绑定玩家可见文案。

## 历史索引

### Runtime V2 主线

| 阶段 | 范围 | 结果 |
|---|---|---|
| Steps 81-86 | Shop contract、deep surfaces、dual renderer smoke、Enchant/RelicUpgrade | runtime-v2 core loop 完成，DOM/PIXI 双 lane semantic smoke 通过 |
| Steps 87-91 | handoff、shared-command parity、restore matrix、event tradeoff | process + shipped wasm shared-command parity 初步加厚 |
| Steps 92-96 | GPT Pro review fixes、negative parity、raw summary、package refresh | proof hygiene 加厚，形成 step95 package |
| Steps 97-104 | 最新 proof gaps、code-review fixes、architect approval | 当前 safe claim 与 package 进入已审阅状态 |
| Steps 105-113 | report cleanup、GPT Pro next-plan handoff、sprint plan 落地、critical-path fidelity 实施、hard-problems handoff、PIXI covered-flow pointer 收敛、route distribution diagnostics | runtime-v2 player-critical-path fidelity sprint 已落地，PIXI covered flow 已无 bridge checks，route distribution 已有 report-only diagnostics |

### 早期工程主线

| 阶段 | 范围 | 保留结论 |
|---|---|---|
| Steps 1-25 | legacy combat/event/reward 基础修复 | 早期 bug 已修，细节见清理前 context snapshot |
| Steps 26-34 | action queue、Boss phase、UI smoke、content contracts | 核心战斗与 UI runtime 边界逐步加固 |
| Steps 35-40 | Notion/Windows package/doctor cleanup | 多数属于工具链与外部流程历史，不作为当前 runtime-v2 proof 前置 |
| Steps 41-56 | enemy AI、route taxonomy、RoomSession 引入 | RoomSession 成为后续 restore/surface proof 的基础 |
| Steps 57-80 | real UI 30 rounds、growth route、stale RoomSession、runtime-v2 shop save/load/replay | 形成 runtime-v2 parity hardening 的前置证据 |

## 后续展望

1. 下一步如果继续 runtime-v2，应优先把 `pointer-covered-flow` 扩展为明确的 RuleCommand/scene action matrix，而不是直接写 full parity。
2. 当前 claim 只能升级到 `PIXI runtime-v2 Playwright covered flow is pointer-covered`，不能写 full pointer-level PIXI parity。
3. route/balance 下一步应先解释 alchemist/informant/puppeteer 的单一路线集中，再决定是否把 distribution warning 升级成 fail gate。
4. 当前工作树仍很脏；进入下一轮前应先打包/提交本轮 scoped changes，避免与既有未提交工作继续混杂。

### Step 115: adapt AGENTS contract for Windows

- **操作方向**：把工作区代理说明落成 Windows-native 版本，避免后续执行继续继承 POSIX/tmux/macOS 路径假设。
- **变更内容**：新增 `E:\deckrogue\AGENTS.md`，明确 PowerShell、Windows 路径、`$env:USERPROFILE\.codex`、OMX runtime gate、Windows 验证命令、Python `PYTHONPATH` 写法和 Lore commit 约定。
- **边界**：未触碰现有业务源码；`package.json` 中仍存在的 POSIX 脚本只在说明中标记处理方式，未在本步扩大修改。
- **验证**：检查 `AGENTS.md` 文件存在、关键 Windows 规则和 `$env:USERPROFILE\.codex` 路径可检索；运行文档级 diff whitespace 检查。
- **剩余风险**：如果后续要让 npm scripts 全量 Windows-native，需要单独修改并验证 `clean`、`test:runtime-v2:py` 等脚本。

### Step 116: run Windows dev server and UI smoke

- **操作方向**：按 Windows 环境真实启动并打开项目，验证不是只停留在文档适配。
- **变更内容**：修复 `scripts/validation/flow_smoke_helpers.ts` 的 Windows 兼容问题：server check 改为无 shell 的 `curl` 参数调用，dev server 启动在 Windows 下使用 `npm.cmd`。
- **实跑结果**：Vite 在 `http://127.0.0.1:3000/` 启动成功；Playwright 打开页面得到 HTTP 200，标题为 `DeckRogue - Warp & Chaos`；`npm run test:ui-smoke -- --url=http://127.0.0.1:3000` 通过。
- **验证证据**：`output/playwright/ui_smoke_report.json` 显示 `consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`，覆盖 launcher、character_select、map、combat、reward、map_after_reward、launcher_after_save、after_continue、after_load_slot。
- **剩余风险**：`npm install` 首次用于修复 Windows `.bin` shim 时超时，但已生成 `vite.cmd`/`tsx.cmd`；需要后续单独清理依赖安装耗时问题。

### Step 117: review and harden Windows smoke helper

- **操作方向**：对本轮代码改动做 review，并直接修复 review 中发现的 Windows 稳定性问题。
- **发现与修复**：`checkServer()` 不再依赖外部 `curl`，改用当前 Node 进程执行内置 `fetch` probe；`spawnDevServer()` 不再通过 `cmd.exe/npm.cmd` 间接启动，改为直接启动本地 `node_modules/vite/bin/vite.js`，避免 Windows `spawn EINVAL` 和 smoke 结束后遗留 Vite 子进程。
- **验证证据**：无现成 dev server 时运行 `npm run test:ui-smoke -- --url=http://127.0.0.1:3000` 通过；完成后 3000 端口释放；`npm run lint --silent`、`npm run build`、scoped `git diff --check` 通过。
- **剩余风险**：build 仍保留既有 `pixi-vendor` chunk-size warning；不属于本次 Windows smoke helper 修复范围。

### Step 118: organize and commit pending Windows workspace changes

- **操作方向**：梳理当前工作区未提交改动，并按审查边界拆成可回溯提交。
- **变更内容**：提交 Python runtime snapshot normalization 抽取、Windows `py -3` 启动器适配、未引用 UI shell helper 删除，并保留剩余大批量模块文件头说明为独立文档性提交。
- **验证证据**：`npx tsx --test tests/unit/pythonInterop.test.ts tests/unit/pythonWasmAdapter.test.ts tests/unit/runtimeV2Parity.test.ts` 通过 `31/31`；UI 删除用 `rg -n "ThemeAndBackgroundProvider|useUnifiedAppShellKeybinds" src tests scripts` 确认无引用；每个暂存提交执行 `git diff --cached --check`；剩余批量提交执行 `npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`py -m unittest discover -s python_runtime/tests -p "test_*.py"`、`npm run build`。
- **剩余风险**：build 仍保留既有 `pixi-vendor` chunk-size warning；大批量文件头说明没有逐文件人工复核语义，只验证了语法、类型和构建。

### Step 119: review bulk file headers and settle Pixi vendor chunk warning

- **操作方向**：补上 Step 118 的剩余风险，逐文件复核大批量文件头语义，并处理 `pixi-vendor` 构建体积提示。
- **变更内容**：复核 `714b4a4` 涉及的 `369` 个 TS/TSX/PY 文件头；修正 `BranchingOutcomeModal.tsx` 将“事件结果”改为“战斗分支结果”；补充 `pluginSystem.ts` 的 `VersionManager`/UI 模型版本迁移职责；`vite.config.ts` 对 chunk id 做 Windows 路径归一化，并把 Pixi umbrella vendor 的稳定 508KB 基线纳入 `chunkSizeWarningLimit=550`，避免用内部目录强拆造成 circular chunk warning。
- **验证证据**：文件头结构检查输出 `reviewedHeaderFiles=369`、`structuralIssues=0`；尝试拆分 Pixi 内部 chunk 时 build 暴露 circular chunk warning，已回退为稳定 vendor chunk；`npm run build` 通过且无 chunk-size/circular warning；生产 `vite preview` 上运行 `npm run test:runtime-v2-entry-smoke -- --url=http://127.0.0.1:4173` 通过，报告中 `consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`，覆盖 `python_pixi_map`。
- **剩余风险**：Pixi vendor 仍是单一 vendor chunk；后续若要进一步降低体积，需要改为更细粒度 Pixi API import 或场景级懒加载，而不是按 `pixi.js/lib/*` 强拆。
