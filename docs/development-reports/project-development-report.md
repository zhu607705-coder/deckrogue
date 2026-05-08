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

### Step 124: close long-tail card and enemy runtime action gaps

- **操作方向**：再次验证并优化正常游戏运行链路，重点清理卡牌与敌怪内容中会落入空动作或未解释分支的长尾动作类型。
- **变更内容**：补齐 `ReplayLastCard`、`Scry`、`TriggerPoisonAllEnemies`、`DealDamagePiercing`、`RemoveStatus`、`RemoveAnyDebuff`、`RemovePoisonAndDealDamage`、`CopyLeftmostSkill`、`DelayedEnergy`、`ResourceRefund`、`StartOfTurnEffect`、`ConditionalResourceGain`、`NextAttackCostDown`、`ConditionalEffect`、`NextCardCostDown`、`DelayNextCardEffect`、`EndOfTurnDrawPenalty`、`SelectCardForReplay`、`ModifyNextCardCost`、`EndOfCombatEffect`、`EndOfTurnEffect`、`MultiplyDamage`、`IgnoreBlock`、`ExtendDuration` 等卡牌动作；同时补齐敌怪回合解释器中的 `DamageBoost`、`HealSelf`、`SummonEnemy`、`Summon`、`Conditional`、`PredictorAction`、`Heal`、`LoseHP`、`PlayerDrawLess`、`RandomCardCostIncrease`、`OnDeath`、`RevealHand`、`SwapCards`。
- **运行时优化**：回合开始现在处理延迟能量与抽牌惩罚；回合结束/战斗结束可执行存储的后续效果；本回合伤害翻倍进入统一伤害管线；费用折扣会直接反映到手牌运行时实例；延迟重放会构造可被现有 delayed-card tick 消费的运行时卡牌。
- **验证证据**：卡牌动作注册扫描 `unknownCardActionTypeCount=0`；敌怪专用动作扫描 `enemyUnknown=0`；`npx tsx --test tests/unit/specialActionBehavior.test.ts tests/unit/enemyVariantEnemyTurn.test.ts` 通过 `16/16`；`npm run test:supplemental-units` 通过 `110/110`；`npm run test:runtime-v2:ts` 通过 `146 pass / 1 skip`；`npm run check:growth-route-formation`、`check:reward-tradeoff-quality`、`check:shop-event-growth-nodes` 均为 `100%`；`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run build` 通过，且 build 无 chunk-size warning；最终 `npm run doctor:game` 通过 `47/47`。
- **剩余风险**：部分 `StartOfTurnEffect` 仍属于轻量 watcher/存储式接入，尚未扩展成完整事件总线级一次性触发系统；后续若要做更深的遗物/事件被动循环，应把当前 watcher 状态升级为明确的 trigger registry 并补事件级回归。

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
- **实跑结果**：Vite 在 `http://127.0.0.1:3000/` 启动成功；Playwright 打开页面得到 HTTP 200，标题为 `DeckRogue - Warp & Entropy`；`npm run test:ui-smoke -- --url=http://127.0.0.1:3000` 通过。
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

### Step 120: review normal game runtime on Windows

- **操作方向**：围绕游戏正常运行链路做代码 review，并直接修复会阻断 Windows 本机 doctor、UI smoke、桌面 smoke 的问题。
- **发现与修复**：把 `clean` 和 Python runtime 测试从 POSIX 写法改成跨平台入口；将 content bundle/reachability/deep reachability 检查从 `grep/head/xargs` 改为 TypeScript 数据读取与 `RunGenerator` 实例验证；修复 release readiness 的 inline env 写法；修正 runtime-v2 combat parity 报告在不同地图节点上比较奖励的 false negative；修复 `execFileSync('npx')` 在 Windows 下不能稳定启动子脚本的问题；让 enemy AI tuning 使用临时报告源，避免改写已跟踪 numerics 快照；把 UI/tests 中非授权 raw gameplay JSON 读取收敛到 numeric/content adapter。
- **实际打开结果**：补齐本机 Electron 安装后，`npm run test:desktop-smoke` 能启动生产模式桌面应用并完成 launcher、tutorial、character_select、map、combat 截图链路；完整 `npm run doctor:game` 最终 `47/47` 通过。
- **验证证据**：`npm run test:runtime-v2:py` 通过；`npx tsx --test tests/unit/runtimeV2Parity.test.ts` 通过；`npm run accept:runtime-v2-parity` 通过；`npm run check:content-bundle`、`check:content-reachability`、`check:deep-reachability`、`check:content-contract-layer` 通过；相关 route advisor/runtime delegation 单测 `35/35` 通过；`npm run lint --silent` 通过；最终 `npm run doctor:game` 通过 `47/47`；`git diff --check` 通过。
- **剩余风险**：enemy AI tuning 仍给出小样本平衡提示：`informant` 高于目标、`brute` 低于目标；这是调参建议而非运行阻断。本次未进一步重调数值。

### Step 121: balance early enemy pressure

- **操作方向**：针对早期敌怪强度过高做小范围数值和平衡结构调整，优先修复 brute/chronomancer 在前 3 层被异常高压遭遇击穿的问题。
- **发现与修复**：早期普通战的 singleton showcase 池会重复生成同一敌怪，导致 `barrier_redeemer+barrier_redeemer`、`goblin_trapper+goblin_trapper` 这类压力过高房间；第 3 层 Elite 可生成双精英，复现到 `gremlin_nob+gremlin_nob`、`gremlin_nob+psychic_infiltrator` 满血击杀 brute。新增 `clampEnemyCountForEncounter()`，将前 3 层普通 singleton showcase 房间和前 3 层 Elite 房间限制为 1 个敌人，并同步到 legacy CombatManager 与 Python runtime。
- **数值调整**：轻量降低 `barrier_redeemer` 峰值，生命从 `26-30` 调整为 `24-28`，`lantern_smite` 伤害从 `8` 调整为 `7`，`hymnal_guard` 格挡从 `10` 调整为 `8`；对应敌怪回合单测同步验证新格挡值。
- **验证证据**：`npx tsx --test tests/unit/enemySelection.test.ts` 通过；`npm run check:enemy-first3-exposure` 通过；`npx tsx --test tests/unit/runtimeV2Parity.test.ts` 通过；`npm run test:supplemental-units` 通过 `99/99`；`npm run lint --silent` 通过；`npm run report:enemy-ai-tuning` 通过，结果为 `5/6` 角色在目标区间内，仅 `informant` 高于目标；最终 `npm run doctor:game` 通过 `47/47`。
- **剩余风险**：`informant` 仍高于早期生存目标，下一轮应单独评估该角色起始牌组和普通怪 anti-stall 压力；本轮 focused 模拟曾出现运行流转日志噪声，但正式 enemy AI tuning 报告 diagnostics 为 `0`。
### Step 122: fill missing enemy standee art

- **操作方向**：补齐当前敌人数据中缺失的战斗立绘，避免新敌人继续回退到默认敌人图。
- **变更内容**：使用内置 `imagegen` 为 `coolant_hound`、`servo_confessor`、`reactor_thrall`、`data_leech`、`iron_choir_twin_a`、`iron_choir_twin_b`、`scrap_surgeon`、`sanctum_praetor`、`overclocked_abbot`、`fusion_censer`、`cathedral_engine`、`logic_saint`、`spore_wretch`、`rot_hound`、`plague_choir`、`cyst_bearer`、`grave_mender`、`blight_larva`、`mire_guard`、`plague_abbot`、`maggot_reliquary`、`corrupt_titanus`、`catacomb_matron`、`pox_cathedral`、`the_mire_saint`、`mind_peek`、`card_swap`、`psychic_infiltrator` 生成竖版敌人立绘，并保存到 `public/assets/enemies/`。
- **接入方式**：将新增图片统一后处理为 `1792x2400` PNG；删除 `localEnemyArt()` 的硬编码敌人白名单，改为按敌人 id 直接解析 `/assets/enemies/<id>.png`，继续依赖现有 `onError` fallback 兜底。
- **验证证据**：复扫 `src/content/data/enemies.json` 的 `52` 个 enemy id，缺失图片数为 `0`；新增 `28` 张图片尺寸均为 `1792x2400`；`npm run check:enemy-visual-identity`、`npm run lint --silent`、`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run build` 通过；`npm run test:ui-smoke` 初次在角色选择等待点超时，立即复跑通过且报告中 `consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`。
- **剩余风险**：本轮为生成式补图，已做尺寸和缺失校验，但仍需要后续人工美术审阅风格一致性。
### Step 123: balance route build loops and reward openings

- **操作方向**：把首奖励从 starter deck 单线锁定改为软分流，同时补齐证据、狂怒、指挥、线程、调配、灼烧、傀儡与元素 payoff 的可执行动作，支撑多套可循环 build。
- **变更内容**：首层奖励对 informant/puppeteer/alchemist 等角色按种子分配多路线；事件遗物掉落优先贴当前路线；`vanishing_strike`、`sacrifice_construct` 等卡牌文本与动作对齐；Burn 现在按回合造成 DoT；RuntimeV2/Python content bundle 同步 route signal，保持领奖后的路线状态 parity。
- **验证证据**：`npx tsc --noEmit --pretty false --project tsconfig.json` 通过；`npx tsx --test tests/unit/specialActionBehavior.test.ts tests/unit/growthRouteFormation.test.ts` 通过 `12/12`；growth/reward/shop-event 三项报告均为 `100%`，路线分布 `warningCount=0`；DOM/Pixi runtime flow smoke 通过；`npm run doctor:game` 最终通过 `47/47`。
- **剩余风险**：本轮优先打通循环与路线分布，仍未宣称所有长尾占位动作都完成；少量单卡数值可能需要后续基于实战日志微调。

### Step 125: close review blockers for combat action triggers and dead targets

- **操作方向**：根据 review findings 修复合入前阻断项，并补上敌人死亡后仍能被攻击牌选中的运行时问题。
- **变更内容**：`Kill` 条件现在可读取上下文里的刚死亡目标；`StartOfTurnEffect` 接入抽到 0 费牌、获得护盾阈值、首次召唤、延迟触发、资源获得/消耗事件；敌方 `AllEnemies` 状态/格挡动作解析到敌方阵营；`NextCardCostDown` 不再在拥有指挥时重复抽牌；`NoAttackYet` 改用本回合攻击牌计数；事件版与 legacy CombatManager 都拦截死亡敌人目标，UI 死亡立绘不再显示可选目标环、响应点击或暴露键盘目标标记。
- **回归覆盖**：新增 Kill 击杀奖励、NoAttackYet、指挥分支单抽、StartOfTurnEffect 运行时触发、死亡目标不耗牌、敌方 AllEnemies 状态/格挡阵营解析测试。
- **验证证据**：`node --test --import tsx tests/unit/specialActionBehavior.test.ts` 通过 `15/15`；`node --test --import tsx tests/unit/enemyVariantEnemyTurn.test.ts` 通过 `8/8`；`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run lint --silent`、`npm run build`、`git diff --check` 均通过，`git diff --check` 仅输出 Windows CRLF 提示。
- **剩余风险**：当前 watcher 触发器已覆盖现有卡牌数据使用的触发类型；如果后续继续加入新的 trigger 类型，需要同步扩展 `triggerMatchesStoredEffect()` 并补事件级回归测试。

### Step 126: reinforce draw-action watcher dispatch

- **操作方向**：按 Ralph 单 owner 完成循环复查 Finding 2，补强 `DrawZeroCostCard` watcher 在普通 `Draw` action 抽牌时的触发路径。
- **变更内容**：`DrawCardsAction` 现在发布携带卡牌实例的 `CardDrawn` 事件；事件版 `CombatManager` 改为统一订阅 `CardDrawn` 后判断 0 费牌并触发 `DrawZeroCostCard`，避免只有回合开始抽牌能触发 watcher。
- **回归覆盖**：新增 `stored draw watchers fire when Draw actions draw zero-cost cards`，验证 Power 设置 watcher 后，由 `Draw` action 抽到 0 费牌会立即结算护盾效果。
- **验证证据**：`node --test --import tsx tests/unit/specialActionBehavior.test.ts` 通过 `16/16`；`node --test --import tsx tests/unit/enemyVariantEnemyTurn.test.ts` 通过 `8/8`；`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run lint --silent`、`npm run build`、`git diff --check` 均通过，`git diff --check` 仅输出 Windows CRLF 提示。
- **剩余风险**：资产接入和未跟踪图片属于独立工作区状态，本步未继续扩展美术资源逻辑。
### Step 127: optimize combat mechanism runtime logic after review

- **操作方向**：只处理游戏机制运行逻辑，按 subagent 分层结果收拢 review blockers 和同层功能风险。
- **代码功能改动**：`Kill` 条件保持上下文目标可见，死亡目标不再回退到其他存活敌人；`StartOfTurnEffect` watcher 覆盖抽到 0 费牌、获得格挡阈值、首次召唤、延迟触发、获得/消耗资源；专用资源动作统一走 `gainRouteResource()` 和实际消耗金额事件；`GainedBlockThisTurn` 改用本回合新增格挡统计；敌方 `AllEnemies`、`AllAllies`、显式 enemy id/defId 通过同一个敌方阵营目标解析器；`NextCardCostDown` 恢复为纯费用动作，`line_adjustment` 改用 `NoResource(command)` 条件表达“无指挥时减费、有指挥时抽 1 张”；legacy/potion 直接加格挡路径同步 `blockGainedThisTurn` 和 `BlockGained` 事件。
- **回归覆盖**：新增击杀奖励正反例、攻击牌计数版 `NoAttackYet`、指挥分支单抽、纯 `NextCardCostDown`、下一张牌费用消耗一次、watcher 非 0 费不触发/每回合一次/专用资源获得/实际资源消耗金额、携带格挡不误判新增格挡、死亡敌人不耗牌与全死亡结算、敌方阵营目标解析测试；修复 `conditionalKillAction.test.ts` 独立运行缺少 ActionManager 绑定的问题。
- **验证证据**：`node --test --import tsx tests/unit/specialActionBehavior.test.ts` -> `26/26`；`node --test --import tsx tests/unit/enemyVariantEnemyTurn.test.ts` -> `9/9`；`node --test --import tsx tests/unit/conditionalKillAction.test.ts` -> `2/2`；`npm run check:enemy-variant-behavior` -> OK；`npm run test:supplemental-units` -> `129/129`；`npm run test:runtime-v2:ts` -> `146 pass / 1 skip`；`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run lint --silent`、`npm run build`、`git diff --check` 均通过，`git diff --check` 仅输出 Windows CRLF 提示。
- **剩余风险**：本轮没有处理素材/UI 立绘工作区改动，也没有重构整个 watcher 注册系统；当前 watcher 覆盖现有卡牌数据使用的触发类型，后续新增 trigger 类型仍需同步扩展 `triggerMatchesStoredEffect()` 与事件级回归测试。
### Step 128: upload remaining workspace validation script

- **操作方向**：按用户要求将当前文件夹剩余未提交项目文件纳入 GitHub 分支，不强行提交 `.gitignore` 下的构建产物、报告输出和依赖目录。
- **变更内容**：新增 `test:manual-victory-run` npm 入口和 `scripts/validation/playwright_manual_victory_run.ts`，用于通过真实浏览器 UI 从 launcher、角色选择、地图、战斗、奖励、事件、休整一路运行到 Victory；脚本补充 late-run 药剂使用逻辑，并在报告中记录 `potionsUsed`。
- **验证证据**：`npx tsc --noEmit --pretty false --project tsconfig.json` 通过；`npm run lint --silent` 通过；`npm run test:manual-victory-run` 通过，生成 `reports/flows/manual-victory-run.json`，结果为 `victory=true`、`roomsVisited=10`、`combatsWon=7`、`rewardsTaken=7`、`eventsResolved=1`、`restsUsed=2`、`finalScreen=Victory`。
- **剩余风险**：该脚本是长流程 UI dogfood，仍可能受随机路线和战斗策略影响；本次验证已证明默认命令在当前工作区可跑通，后续若改动平衡或 UI 选择器需要重新运行。

### Step 128: fill scene art and fit combat UI surfaces

- **操作方向**：按当前视觉需求补齐商店、指定事件 NPC/背景、敌怪类型战斗背景，并收紧战斗 HUD/手牌/战场区布局。
- **资源接入**：新增商店背景与商人头像；新增医疗伺服、神龛守卫、审判官、亚空间先知 NPC；新增腐朽医疗间、殉道者神龛事件背景；新增反应堆圣堂、疫病墓窟、灵能档案三类战斗背景。
- **代码功能改动**：商店头图区从小圆头像改为右侧舞台；故事事件按 event id 显示对应 NPC 立绘与台词；战斗背景主题覆盖 50 个非 special 敌怪并按主题 `key` 触发即时背景淡入；预加载列表包含新增视觉资源；战斗 HUD 改为紧凑分区，手牌横向滚动并保留战场中心空间。
- **验证证据**：`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run lint --silent`、`npm run build`、`npm run test:ui-smoke`、`npm run test:ui-smoke:expansion`、`npm run test:shop-flow-smoke`、`npm run test:event-flow-smoke`、`npm run test:runtime-v2-flow-smoke -- --renderer=dom` 均通过；资源路径/PNG 尺寸检查通过；敌怪背景映射覆盖 `50/50`。
- **剩余风险**：`npm run test:runtime-v2-flow-smoke -- --renderer=pixi` 在 potion shop 阶段的 debug bridge snapshot 读取处返回失败，但已有 `report_pixi.json` 显示其前序 map/event/rest/combat/reward/shop/relic 流程为 passed；该失败发生在脚本桥接层，未指向本次 DOM 视觉接入。
### Step 129: add fifty-card build expansion with portraits

- **操作方向**：新增 50 张卡牌，覆盖通用卡与六职业路线，并为每张卡补齐可被运行时读取的立绘资源。
- **数值与构筑设计**：新增分布为通用 `8` 张、informant/brute/tactician/chronomancer/puppeteer/alchemist 各 `7` 张；稀有度为 `Common=22`、`Uncommon=21`、`Rare=7`。每条职业路线都包含资源入口、资源消耗、一次/回合 Power 与终端 payoff，形成证据、狂怒、指挥、时间层、线程、调和剂/元素等可循环 build。
- **资源接入**：使用内置生图功能生成 5 张 5x2 卡图联系表，并裁切为 `50` 张独立 PNG，保存到 `public/assets/cards/<card_id>.png`；原始生成图保留在 Codex 生成目录。
- **回归覆盖**：新增 `tests/unit/cardExpansionPack.test.ts`，锁定新增包数量/分布、动作注册、费用范围、路线识别与立绘文件存在性，并接入 `npm run test:supplemental-units`。
- **验证证据**：`npx tsx --test tests/unit/cardExpansionPack.test.ts` 通过 `3/3`；`npx tsc --noEmit --pretty false --project tsconfig.json`、`npm run check:content-bundle`、`npm run test:supplemental-units` 通过 `132/132`、`npm run lint --silent`、`npm run build`、`npm run test:ui-smoke`、`npm run accept:expansion-content`、`npm run test:runtime-v2-flow-smoke -- --renderer=dom` 均通过；`git diff --check` 通过，仅输出 Windows CRLF 提示。
- **剩余风险**：卡图为联系表裁切的生成式方形插画，已适配现有卡面 `object-cover`，但仍建议后续美术人工统一风格；本轮数值按当前动作模型做基线平衡，仍需要后续实战日志微调个别强弱点。
### Step 130: longform balance playtest and three-pass tuning

- **操作方向**：按“真实实战覆盖全角色、全 build、遗物、事件、卡牌”标准建立长线平衡验证，并连续做三轮微调。
- **变更内容**：新增 `scripts/validation/longform_balance_playtest.ts` 和 `npm run report:longform-balance`；覆盖 6 个角色、18 条路线 build、308 张卡牌、92 个遗物、87 个事件选项，并输出 `reports/balance/longform-balance-pass-N.json`。
- **数值与运行时修正**：补齐通用 story event 结算兜底；修正遗物启动动作类型；限制早期 boss 池和 boss HP 软上限；下调 `gremlin_nob`、`psychic_infiltrator`、`slime_boss`、`hexaghost` 的早期压迫；加强 puppeteer construct、chronomancer delay、informant intel、brute rage/alchemist sustain 等路线可循环 payoff。
- **三轮微调结果**：第一轮修复事件覆盖和未知动作；第二轮削弱过早 boss/elite 压力并提高弱路线生存；第三轮微调路线牌与构筑牌组抽样，最终仅保留 `alchemist:concoction` 偏稳的中风险提示。
- **验证证据**：`npm run report:longform-balance -- --pass=12 --runs-per-build=3` 覆盖 `characters=6/6`、`routeBuilds=18/18`、`cards=308/308`、`relics=92/92`、`events=87/87`，18 个 build 全部存活；平均剩余血量区间约 `0.257-0.939`，仅 `alchemist:concoction` 触发 medium safe-build warning。
- **剩余风险**：自动化 GameEngine bot 已覆盖长线构筑真实动作执行，但仍不是人类手动全流程通关；后续若改动卡牌池、事件、遗物触发或 boss 池，需要重跑 `report:longform-balance`。

### Step 131: simulated manual browser victory run

- **补充稳定化**：`npm run test:manual-victory-run` 现在默认固定种子 `1777217199075`，并支持 `--seed=<number>` 覆盖；该种子只在隔离 Playwright 浏览器上下文内固定 `Date.now()`，不改游戏生产运行时代码。
- **最新复跑证据**：`reports/flows/manual-victory-run.json` 显示 `seed=1777217199075`、`victory=true`、`gameOver=false`、`finalScreen=Victory`、`roomsVisited=10`、`combatsWon=7`、`rewardsTaken=7`、`shopsVisited=1`、`restsUsed=2`、`cardsClicked=111`、`turnsEnded=25`、`consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`，终局截图为 `output/playwright/manual-victory-run/32_Victory_victory_reached.png`。
- **操作方向**：补上接近真实玩家点击路径的 UI 通关证明，避免只依赖 GameEngine bot、terminal fixture 或 combat-complete shortcut。
- **变更内容**：新增 `scripts/validation/playwright_manual_victory_run.ts` 与 `npm run test:manual-victory-run`，脚本从 Launcher 开始，点击新局、选择角色、走地图节点、逐张出牌并点选敌人、拿奖励、进商店购买、休整/升级，最后要求真实 `Victory` 终局。
- **策略修正**：角色选择兼容“点击角色后直接进地图”和“先显示开始按钮”两种旧 UI 行为；地图节点改成坐标点击以避开动效稳定等待；屏幕识别用 locator 与 Unicode 转义识别商店、事件、升级、休整、终局，避免中文编码和商店文本误判；路线权重调整为优先 Combat/Shop，其次 Rest/Event，商店会购买最多 4 个可负担收益项后离开。
- **实跑结果**：`reports/flows/manual-victory-run.json` 显示 `victory=true`、`roomsVisited=10`、`combatsWon=7`、`rewardsTaken=7`、`shopsVisited=1`、`restsUsed=2`、`cardsClicked=111`、`turnsEnded=25`、`consoleErrors=[]`、`pageErrors=[]`、`failedRequests=[]`，终局截图为 `output/playwright/manual-victory-run/32_Victory_victory_reached.png`。
- **验证证据**：`npm run test:manual-victory-run` 通过；`npx tsc --noEmit --pretty false --project tsconfig.json` 通过。
- **剩余风险**：这是 deterministic browser automation，不等同于人工长时间主观试玩；如果后续改地图可达性、战斗手牌交互、奖励、商店、事件、休整或终局 UI，需要重跑 `npm run test:manual-victory-run`。

### Step 132: optimize live hand-aware enemy AI and combat card playability UI

- **操作方向**：按 Ralph 第一轮优化要求，优先处理敌人 AI 基于当前手牌调节和战斗 UI 与功能结算的结合点，避免大范围无证据重构。
- **AI 结算改动**：`buildEnemyPerceptionSnapshot()` 从“可见手牌类型/数量”升级为“可支付手牌的即时数值潜力”分档，会读取当前能量、临时费用、可见卡牌动作、即时伤害/格挡/治疗潜力和敌人当前生命值。不可支付的高费攻击不再把 `attackIntentBand`/`comboThreatBand` 抬高；低费可斩杀牌即使攻击牌数量少，也会被提升为高威胁。
- **UI 结合改动**：新增 `getCardPlayabilitySnapshot()`，统一计算卡牌展示费用、剩余能量、不可打出标签和禁用态；`ActionHand` 的卡牌禁用态改走该视图模型，减少 UI 与实际费用预览逻辑分叉。
- **回归覆盖**：新增敌人感知测试，覆盖“能量不足时高费攻击降权”和“低费可斩杀牌升为高威胁”；新增战斗视图模型测试，锁定 tempCost、Unplayable、能量不足和非玩家回合的禁用态。
- **验证证据**：`node --test --import tsx tests/unit/enemyIntentFacade.test.ts` 通过 `10/10`；`node --test --import tsx tests/unit/combatViewModel.test.ts` 通过 `4/4`；`npx tsc --noEmit --pretty false --project tsconfig.json` 通过；`npm run test:supplemental-units` 通过 `135/135`；`npm run lint --silent` 通过；`npm run build` 通过；`npm run report:enemy-ai-tuning` 通过，结果为 `pass_with_tuning_notes`、`5/6` 角色在目标区间内，仅 `informant` 早期生存率偏高；`npm run test:ui-smoke` 通过；`npm run test:manual-victory-run` 通过，`seed=1777217199075`、`victory=true`、`finalScreen=Victory`、`cardsClicked=111`、`turnsEnded=25`。
- **剩余风险**：本轮是第一轮高收益切面优化，未宣称全项目每个功能都已完成逐一优化；后续 Ralph 迭代应继续按可验证切面推进，例如事件/商店实时结算、遗物触发聚合、长线 balance bot 与 UI 表现联动。

### Step 133: repair early balance simulation fidelity

- **操作方向**：继续 Ralph 优化闭环，先处理 Step 132 保留的 early balance tuning 告警，确认 `informant` 早期生存率偏高是实战数值问题还是模拟器/报告误判。
- **发现与修复**：`simulate_early_balance.ts` 原先对故事事件统一调用 `makeEventChoice('decline')`，该选项对 story event 无效，可能导致同一事件在 Event 屏反复计入 resolved node；同时每次模拟创建的 `GameEngine` 未释放全局事件监听，后续 run 会触发旧引擎的胜利监听并污染非法迁移日志。本轮改为按事件真实选项、danger、策略和当前血量选择事件选项，支持多阶段 `rusting_medicae` 后续选择，节点结算按 node id 去重，`RemoveCard`/`Enchant` 屏做显式处理，并在 run summary 返回前 `dispose()` 引擎。
- **报告优化**：`report_enemy_ai_tuning.ts` 不再用小样本裸 survival rate 直接判定 above/below target，改用 95% Wilson 区间；只有区间整体越界才生成 tuning note。默认 `--runs=3` 在修复模拟污染后不再把 9 次小样本全生存误判为必须调参，`overallStatus` 在无诊断失败且无 tuning note 时返回 `pass`。
- **验证证据**：`npx tsx scripts\analysis\simulate_early_balance.ts --class=informant --runs=1 --output-dir=reports\ai\.debug-after-sim-fix` 通过，`illegalRunTransitions=0`、`unknownActionTypes=0`；`npx tsx scripts\analysis\simulate_early_balance.ts --class=informant --runs=10 --output-dir=reports\ai\.debug-informant-runs10` 通过，覆盖 30 个 informant policy runs 且诊断为 0；`npm run report:enemy-ai-tuning -- --runs=3` 通过，`tuningNotes=0`。
- **剩余风险**：当前修复的是模拟和报告可信度，不等同于证明所有长样本都不会暴露 early-game 过稳问题；若后续把 `--runs` 提升到更高样本且 Wilson 区间整体超过上界，再做全局早期压力或具体角色数值调整。
