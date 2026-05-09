# Project Development Report

## Wave II Full-Scale Expansion Closure - 2026-05-09

- User requested that the plan's future multi-pass expansion be completed in this pass and asked for team execution.
- OMX `team` preflight found `omx` and `tmux`, but the current Codex App session was not inside tmux (`TMUX` unset), so the tmux team runtime could not be safely launched. I used Codex-native parallel lanes where available and completed the integration in the main thread.
- Implemented Wave II full-scale original content:
  - 24 new route cards, one for each of the 24 route tags across 8 characters.
  - 8 new route keystone relics, one per character, wired into all three routes for that character.
  - 8 new route-readable story events, one per character route set, with route choice roles.
  - 8 new midgame route-pressure enemy variants with AI profiles, intent policies, move sets, and local enemy art.
  - 24 new card WebP assets, 8 relic PNG assets, and 8 enemy PNG assets.
- Added `tests/unit/fullExpansionScale.test.ts` and wired it into `npm run test:supplemental-units`.
- Updated `.omx/plans/2026-05-08-sts-inspired-original-expansion.md` so the former future full-scale follow-up is marked as executed by Wave II; remaining work is tuning only.
- Verification completed:
  - `npx tsx --test tests/unit/fullExpansionScale.test.ts`: `4/4` passed.
  - `npx tsc --noEmit --pretty false --project tsconfig.json`: exit `0`.
  - `npm run check:content-authoring`: cards `354/354`, enemies `58/58`, relics `106/106`.
  - `npm run check:route-taxonomy-guardrails`: `24` routes, `failureCount=0`.
  - `npm run check:content-contract-layer`: OK.
  - `npm run check:content-bundle`: `7/7` passed.
  - `npm run check:enemy-visual-identity`: `14` variants OK.
  - `npm run check:enemy-variant-behavior`: `14` variants checked.
  - `npm run check:enemy-first3-exposure`: OK.
  - `npm run test:supplemental-units`: `152/152` passed.
  - `npm run check:growth-route-formation`: `160/160`, `formationRate=100%`.
  - `npm run check:reward-tradeoff-quality`: `160/160`, `tradeoffRate=100%`.
  - `npm run check:shop-event-growth-nodes`: `shopRate=100%`, `eventRate=100%`, `characterPassCount=8/8`.
  - `npm run check:content-reachability`: `11/11` reachable, broken edges `0`.
  - `npm run check:deep-reachability`: `22/22` reachable, broken edges `0`.
  - `npm run report:translation-audit`: total `0`.
  - `npm run accept:expansion-content`: `3/3` suites passed, `456` tests total.
  - `npm run build`: exit `0`.
  - `npm run test:event-flow-smoke`: exit `0`.
  - `npm run test:shop-flow-smoke`: exit `0`.
- Remaining risk:
  - Wave II uses existing local art as source variants for the new card/relic/enemy assets. They are valid local runtime assets, but future hand-authored visual polish can still improve uniqueness.
  - Longform balance remains an iterative tuning activity; current automated route, shop, event, authoring, and smoke gates are green.

## Plan Completion Audit - 2026-05-09

- Rechecked the user concern that the approved plans might still be incomplete.
- Current branch state:
  - local `codex/test-auto/ui-click-30` and `origin/codex/test-auto/ui-click-30` are synchronized.
  - `git rev-list --left-right --count HEAD...@{u}` returned `0/0`.
  - `git status --short --branch` showed a clean working tree.
- Current scoped completion evidence:
  - `.omx/state/sts-inspired-original-expansion-ralph-progress.json` marks Ralph inactive, `current_phase=complete`, architect verdict `APPROVE`, and `4/4` user-story items verified.
  - `npm run doctor:game`: `44/44` passed; report recorded `gitDirty=false`, `overallStatus=pass`.
  - `npm run check:release-readiness`: `41/41` passed, `warn=0`, `fail=0`.
- Scope clarification:
  - The approved Phase 1 / scoped execution plans are complete.
  - The former “full expansion scale needs multiple passes” note has been superseded by the Wave II closure above: the route-card, route-relic, route-event, and route-pressure enemy expansion was executed in this pass.
  - Remaining scope is iterative polish only: hand-authored unique art direction and longform numeric balance.
  - The older push-risk note below is resolved; current branch and upstream are synchronized.
- Post-push closure verification:
  - Latest pushed commit before this audit: `3d39ff0ef9190c8ebeed82c34748278e36d681e8`.
  - `npm run check:release-readiness`: `41` passed, `0` warned, `0` failed.
  - `reports/doctor/report.json`: `44/44` passed, `gitHead=3d39ff0e`, `gitDirty=false`.
  - `git rev-parse HEAD` matched `git rev-parse @{u}`.

## Map Responsive Smoke Pass - 2026-05-03

- Added `scripts/validation/playwright_map_responsive_smoke.ts` plus `npm run test:map-responsive-smoke` to audit the grimdark map at `390x844`, `768x1024`, and `1440x960`.
- Fixed the narrow mobile map layout exposed by the new smoke test:
  - compacted the map topbar, resource panel, HUD tiles, and zoom controls below `767px`,
  - preserved visible node-card route intel by reducing mobile-only card density,
  - added explicit `grimdark-map-screen` and `grimdark-map-controls` hooks instead of broad global overrides.
- Verification:
  - `npm run test:map-responsive-smoke`
  - `npm run lint --silent`
  - `npm run build`
  - `npm run test:ui-smoke`
- Visual evidence:
  - `output\playwright\map-responsive\mobile_390x844.png`
  - `output\playwright\map-responsive\tablet_768x1024.png`
  - `output\playwright\map-responsive\desktop_1440x960.png`
  - `output\playwright\map-responsive\map_responsive_report.json`
- Remaining risk:
  - Mobile now exposes node route intel in the checked narrow viewport; additional handset aspect ratios may still benefit from manual visual polish, but the automated responsive audit is green.

## Map Node Route Intel Pass - 2026-05-03

- Reduced the remaining map readability risk by moving more route judgment into each revealed selectable node card:
  - status chips now include route title plus compact route summary instead of only short state copy,
  - node cards show challenge / sustain / mystery meters directly in the card,
  - preview chips now focus on true downstream nodes and fall back to a terminal marker when no future node exists.
- Kept the HUD as global context while making the node card itself sufficient for first-pass route comparison.
- Verification:
  - `npm run lint --silent`
  - `npm run build`
  - `npm run test:ui-smoke`
- Visual evidence:
  - `output\playwright\map.png`
  - `output\playwright\map_after_reward.png`
  - `output\playwright\ui_smoke_report.json`
- Remaining risk:
  - No known layout or smoke-test issue in the checked desktop route. Very small mobile widths may still prefer zoom/pan over dense card reading.

## Route Briefing Strip Removal - 2026-05-02

- Removed the remaining multi-card route briefing strip from `MapView` after the node cards themselves were expanded to carry route title, fit label, summary, and preview types.
- The map now relies on the four-tile HUD for global state and on each node card for route detail, which keeps the center playfield cleaner and reduces repeated messaging.
- Verification:
  - `npm run lint --silent`
  - `npm run build`
  - `npm run test:ui-smoke`
- Visual evidence:
  - `output\playwright\map.png`
  - `output\playwright\ui_smoke_report.json`
- Remaining risk:
  - The node cards are denser than before; if route copy grows again, the card copy may need one more trim pass.

## Map Route Info Refinement - 2026-05-02

- Tightened the patrol map so route detail no longer leans on the HUD/cards alone:
  - node chips now carry a two-line status summary,
  - revealed nodes show route title, fit label, and preview types directly inside the card,
  - the large route dossier grid was compressed into a slim tactical briefing strip.
- Added `data-node-type` to map node buttons and updated Playwright combat selection helpers to prefer combat nodes by type, which keeps smoke tests stable even when node text gains extra route metadata.
- Verification:
  - `npm run lint --silent`
  - `npm run build`
  - `npm run test:ui-smoke`
- Visual evidence:
  - `output\playwright\map.png`
  - `output\playwright\ui_smoke_report.json`
- Remaining risk:
  - The map is denser by design; if future route copy grows much longer, the briefing strip may need another compacting pass.

## Map View Grimdark Polish - 2026-05-02

- Upgraded `src/ui/views/MapView.tsx` to carry the grimdark lane through the patrol map: added a tactical HUD strip for current node, patrol state, route hints, and operation feedback; tightened node cards with a status chip; and added directional path markers with animated dash flow.
- Extended `src/ui/theme/grimdark.css` with map HUD panel styles, hovered node treatment, status chip styling, and active path dash animations so the page reads as one composed interface instead of separate widgets.
- Kept gameplay logic unchanged. The work is visual and interaction-layer only.
- Verification:
  - `npm run lint --silent`
  - `npm run build`
  - `npm run test:ui-smoke`
- Visual evidence:
  - `output\playwright\map.png`
  - `output\playwright\ui_smoke_report.json`
- Remaining risk:
  - Node status chip text is intentionally compact; longer route descriptions still rely on the HUD and route dossier cards for detail.

## Launcher Vertical Centering

- Adjusted the legacy setup launcher hero section so the title and action panel align around the first viewport center instead of sitting low on large desktop screens.
- Changed the large-screen hero grid from bottom alignment to center alignment while preserving a small archive-section hint below the fold.
- Browser measurement at `1440x900`: launcher group center offset is `-31.9px` from viewport center.
- Screenshot evidence: `output\playwright\launcher-centered-1440x900.png`.

## Runtime UI Decommission

- Removed the public new-engine UI entry and query-parameter launch path.
- Removed the unified shell, Runtime UI scenes, Pixi runtime scenes, and associated browser/unit checks.
- Removed unused Pixi dependencies after deleting the Pixi scene layer.
- Main app startup now always enters the legacy visual AppShell path.
- Desktop launch and EA release-channel metadata now resolve only to the legacy UI entry.
- Verification:
  - `npm run lint --silent`
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npm run build`
  - `npm run test:supplemental-units --silent`: `145/145` passed
  - New-engine UI and Pixi residue scan over `src`, `tests`, `scripts`, `electron`, `package.json`, and `package-lock.json`: no matches
  - `git diff --check`: no whitespace errors; Git reported only LF-to-CRLF working-copy warnings

## Actual Play Combat Stability Fix - 2026-04-28

- Fixed the Penitent Judge combat soft-lock reported in real play: when `judgement_cut` killed one symbiote and the linked symbiote was reduced to 0 HP by the death-side effect, combat now resolves victory from the final enemy state even if the second enemy did not emit a separate `EnemyDeath` event.
- Added a regression test for the exact `penitent_judge` + `symbiote_a`/`symbiote_b` case. The test plays the real `judgement_cut` run-card instance and asserts the screen advances to `Reward`, combat is cleared, and reward cards are generated.
- Fixed missing card faces for runtime delayed replay cards by normalizing IDs such as `judgement_cut_delayed_replay` back to their base card art path.
- Reduced combat targeting shake by removing infinite transform-scale animation from enemy target feedback and target rings while keeping static/opacity feedback visible.
- Removed transform-scale pulsing from enemy intent warning badges so warning feedback no longer creates constant combat HUD motion.
- Restored the launcher root `data-screen="Launcher"` marker so desktop smoke and future UI automation can reliably confirm tutorial close returns to the launcher.
- Hardened save-slot loading in Playwright flow helpers so launcher panel motion/overlap cannot block deterministic smoke fixture entry.
- Fixed tutorial and launcher overflow found by the real UI run: hidden glossary bubbles no longer widen the page, launcher decorative orbs are disabled, and the mobile launcher brand now fits a 390px viewport without horizontal scroll.
- Restored the current 30-click scenario count after Runtime UI decommission by replacing the removed Runtime V2 map scenario with a Boss Terminal legacy path.
- Verification:
  - `npx tsx --test tests/unit/combatVictoryFromEnemyDeath.test.ts tests/unit/cardExpansionPack.test.ts`
  - `npm run lint --silent`
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npm run test:supplemental-units`: `145/145` passed
  - `npm run test:ui-smoke`
  - `npm run test:ui-smoke:expansion`: clean report, `0` failed requests, `0` broken images, `0` layout issues
  - `npm run test:real-ui-30-clicks`: `30/30` scenarios passed, `0` console errors, `0` page errors, `0` failed requests
  - `npm run test:desktop-smoke`
  - `npm run build`
  - `npm run dist:win`: rebuilt `release\win\DeckRogue-0.0.0-x64.exe`, size `262,214,517` bytes, SHA256 `2B9325A8D4DCA674A8DA7BD1DA8C0B8DFCCD96D5F6FE63B905D6A147E1709F12`
  - `npm run doctor:game:full`: `44/44` stages passed
  - `npm run check:release-readiness`: `pass=41`, `warn=0`, `fail=0`
- Latest 30-click screenshots and JSON evidence are under `output\playwright\real-ui-30-clicks` and `reports\flows\real-ui-30-clicks.json`.

## Prelaunch Full Game Test Pass - 2026-04-28

- Ran the Game Studio playtest pass and Build Web Apps frontend verification pass for the current Windows release candidate.
- Fixed `scripts\validation\manual_long_combat_review.tsx` after it timed out during prelaunch testing:
  - Uses the shared Playwright smoke server helper and default `http://127.0.0.1:3200` port instead of assuming port `3000`.
  - Boots from a deterministic combat save fixture instead of relying on map RNG to expose a combat node.
  - Limits the script to stable visual-review evidence: battle start, post-end-turn combat state, and themed card readability screenshots.
  - Exits explicitly after browser/server cleanup so the CLI command does not hang after writing its report.
- Browser and playtest evidence:
  - `npm run test:ui-smoke`
  - `npm run test:ui-smoke:expansion`
  - Flow smoke matrix passed: reward, terminal, shop, event, rest, upgrade, remove-card, boss-phase, boss-terminal.
  - `npm run test:real-ui-30-rounds`: `30/30` browser rounds passed.
  - `npm run test:real-ui-30-clicks`: `30/30` scenarios passed, including desktop/tablet/mobile layout checks.
  - `npm run review:long-combat`: passed and wrote screenshots under `output\playwright\manual_long_combat_review`.
- Core verification evidence:
  - `npm run lint --silent`
  - `npm run test:supplemental-units`: `142/142` passed.
  - `npm run check:content-bundle`: `7/7` passed.
  - `npm run build`
- Release evidence:
  - `npm run dist:win`: rebuilt `release\win\DeckRogue-0.0.0-x64.exe`, size `262,371,205` bytes.
  - `npm run doctor:game:full`: `47/47` stages passed.
  - `npm run check:release-readiness`: `pass=41`, `warn=0`, `fail=0`.
- Manual screenshot review notes:
  - Battle start and post-end-turn screenshots are non-blank and show combat HUD, player/enemy standees, hand cards, enemy intent, and first-combat guide panel.
  - Theme card readability screenshot shows wood, tactic, mirror, and acid card variants. Reward presentation is covered by the dedicated reward flow smoke.

## Lossless Card Face Compression - 2026-04-28

- Converted all `364` card face PNG assets under `public\assets\cards` to lossless WebP.
- Verified every converted card face by decoding WebP back to RGBA and comparing a SHA-256 pixel hash with the original PNG from git before removing the PNG.
- Removed `38` duplicate card JPG files after confirming runtime and test references no longer target `public/assets/cards/*.jpg`.
- Card PNG weight changed from `51,159,278` bytes to `41,284,828` bytes, saving `9,874,450` bytes (`19.3%`) without pixel loss.
- Duplicate JPG removal saved another `6,623,313` bytes, for `16,497,763` bytes total card directory reduction.
- `public\assets\cards` now contains `364` WebP files, about `39.37 MiB`.
- Added `localCardArt()` to the shared optimized art helper so runtime model conversion, codex card lookup, placeholders, and card asset tests all use the same WebP path.
- Rebuilt `release\win\DeckRogue-0.0.0-x64.exe`; size is now `262,371,206` bytes, down `15,330,098` bytes from the standee-compressed package.
- Verification:
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npx tsx --test tests/unit/gothicExpansionContent.test.ts tests/unit/cardExpansionPack.test.ts`
  - `npm run check:content-bundle`
  - `npm run build`
  - `npm run test:ui-smoke:expansion`
  - `npm run dist:win`
  - `npm run doctor:game:full`: `47/47` stages passed
  - `npm run check:release-readiness`: `pass=41`, `warn=0`, `fail=0`
- Asset verification:
  - `rg -n "assets/cards/.+\.(png|jpg)" src scripts tests public`: no runtime or test references remain.
  - Pixel round-trip check verified `364` PNG/WebP pairs and confirmed `9,874,450` bytes of lossless PNG replacement savings.

## Lossless Standee Artwork Compression - 2026-04-28

- Converted 64 readable standee PNG assets to lossless WebP without resizing or lossy quantization.
- Verified each converted file by decoding the WebP back to RGBA and comparing a SHA-256 pixel hash with the source PNG before deleting the PNG.
- Scope converted: 8 character portraits, 48 enemy standees, 6 event/NPC standees, and 2 shop standees/backgrounds.
- Source standee asset weight changed from `111,221,566` bytes to `84,265,756` bytes for the converted set, saving `26,955,810` bytes (`24.24%`).
- The combined `characters/enemies/events/shop` standee directories now hold `64` WebP files plus `16` untouched legacy PNG files, about `81.97 MiB` total.
- The Windows installer was rebuilt at `release\win\DeckRogue-0.0.0-x64.exe`; size is now `277,701,304` bytes.
- Added `src/content/assets/standeeArt.ts` as the canonical path switch so converted art uses WebP while untouched legacy assets still use PNG.
- Verification:
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npm run check:content-bundle`
  - `npm run check:enemy-visual-identity`
  - `npm run build`
  - `npm run test:ui-smoke:expansion`
  - `npm run dist:win`
  - `npm run doctor:game:full`
  - `npm run check:release-readiness`
- Note: 16 legacy PNG files in the same folders could not be decoded by Pillow and were intentionally left unchanged for this no-quality-loss pass.

## Release Readiness Stale Report Cleanup - 2026-04-28

- Re-ran the full doctor gate after the Windows package work to refresh stale release artifacts.
- Fixed the only non-stale doctor failure: `Translation Audit` flagged 4 relic terminology conflicts in `src/content/data/relics.json`.
- Updated `blackened_gavel`, `void_anchor_litany`, and `cage_bell_clapper` visible relic copy from enemy wording to the project-standard combat term.
- Verified `npm run doctor:game:full`: `47/47` stages passed.
- Verified `npm run check:release-readiness`: `pass=40`, `warn=1`, `fail=0`.
- Replaced the manual `reports_dir` growth warning with an automated threshold check in `scripts/validation/check_release_readiness.ts`.
- Current automated report growth limits: `2000` files and `50 MiB`, overrideable with `RELEASE_READINESS_REPORT_MAX_FILES` and `RELEASE_READINESS_REPORT_MAX_BYTES`.
- Verified after the warning fix:
  - `npm run doctor:game:full`: `47/47` stages passed.
  - `npm run check:release-readiness`: `pass=41`, `warn=0`, `fail=0`.

## Windows EXE And Performance Packaging - 2026-04-28

- Added `scripts/desktop/dist_win.ts` as the Windows packaging entry used by `npm run dist:win`.
- Generated `release\win\DeckRogue-0.0.0-x64.exe`; final installer size is `304,471,571` bytes.
- Staged a minimal Electron app under `.desktop-build\win-app`, copying only `dist`, `electron`, and a minimal `package.json`, so the installer no longer bundles root development dependencies.
- Disabled unsigned executable editing in the Windows builder config to avoid the local non-admin symlink failure from `winCodeSign`.
- Optimized 428 PNG assets used by cards, characters, enemies, events, and shop scenes. The optimized pass reduced the processed source images from about `362.39 MB` to `154.86 MB` and cut the public PNG total from about `403.23 MB` to `195.7 MB`.
- Added `release/` and `.desktop-build/` to `.gitignore`; the local installer remains available but generated package output is not tracked in git.
- Verified with:
  - `npm run check:content-bundle`
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npm run test:ui-smoke:expansion`
  - `npm run dist:win`
  - `npm run test:desktop-smoke`
- Remaining release gate note: `npm run check:release-readiness` still reports stale historical flow/report files outside this packaging slice, so it is not used as the completion claim for this targeted EXE/performance task.

## Scope

本轮完成哥特科幻扩展内容、战斗资源机制接入、图鉴叙事增强和缺失图片补齐。

## Follow-up Fix - ResourceAmount

- Added `ResourceAmount` condition support for route resources using the JSON-authored `minimum` field.
- Changed generic JSON relic triggering to forward the full `effect` object so conditions and effect-specific fields stay intact.
- Updated the relic utility unit test to load `fractured hourglass` through `getRelicDefById` and trigger its real `StartTurn` effect shape.
- Verified with `npx tsx --test tests/unit/specialActionBehavior.test.ts`, `npx tsc --noEmit --pretty false --project tsconfig.json`, and `git diff --check`.

## Manual Victory Runs - 3 Passes

- Fixed Playwright fixture unlocks to derive all selectable character ids from `src/content/data/characters.json`, so newly added characters are covered by real UI runs.
- Completed three long UI-driven victory runs through `scripts/validation/playwright_manual_victory_run.ts`:
  - `alchemist`, seed `1777217199075`: `roomsVisited=10`, `combatsWon=7`, `cardsClicked=155`, `turnsEnded=36`.
  - `penitent_judge`, seed `1777217199075`: `roomsVisited=10`, `combatsWon=7`, `cardsClicked=125`, `turnsEnded=22`.
  - `void_sanctioner`, seed `1777217199075`: `roomsVisited=10`, `combatsWon=7`, `cardsClicked=120`, `turnsEnded=36`.
- Preserved per-run evidence under `reports/flows/manual-victory-run-01-alchemist.json`, `reports/flows/manual-victory-run-02-penitent-judge.json`, `reports/flows/manual-victory-run-03-void-sanctioner.json` and matching `output/playwright/manual-victory-run-*` screenshot folders.
- Ran `npm run report:longform-balance -- --pass=4 --runs-per-build=3`: covered 8/8 characters, 24/24 route builds, 330/330 cards, 98/98 relics, 87/87 event options, with `findingCount=0`.
- Observed two non-blocking harsh-seed deaths on alternate seeds before the three pass set: `penitent_judge` seed `2777217199075` died to early floor-4 elite pressure; `void_sanctioner` seed `3777217199075` died to floor-6 elite pressure. Treat as future tuning data, not a runtime blocker.

## Manual Victory Runs - Additional 10 Passes

- Re-ran the real browser UI victory workflow through `scripts/validation/playwright_manual_victory_run.ts`.
- Completed 10 additional Victory runs from the extended batch:
  - `brute` x2, `puppeteer` x1, `chronomancer` x2, `alchemist` x1, `penitent_judge` x2, `void_sanctioner` x2.
  - Every successful run reached `roomsVisited=10`, `combatsWon=7`, `rewardsTaken=7`, and final screen `Victory`.
- Preserved the additional per-run evidence under `reports/flows/manual-victory-run-05-brute.json` through `reports/flows/manual-victory-run-15-chronomancer.json`, with matching `output/playwright/manual-victory-run-*` screenshot folders.
- Wrote aggregate evidence to `reports/flows/manual-victory-run-15-attempt-summary.json`: 15 total stored reports, 13 Victory runs, 2 GameOver samples.
- Harsh-seed tuning samples from this batch:
  - `informant`, seed `1777217199075`: reached 10 rooms and 6 combat wins, then GameOver before Victory.
  - `tactician`, seed `1777217199075`: reached 10 rooms and 6 combat wins, then GameOver before Victory.
- Interpretation: the requested 10 additional successful long UI clears are complete; the two failures should be treated as future balance/route-choice tuning data for final-boss or late-route pressure.

## Completed

- 追加平衡与 review 收口：
  - `ConditionalEnergyGain` 与 `DrawAndHeal` 已注册为可执行动作，避免遗物效果落入 NullAction。
  - `void_sanctioner:suppression` 压制链补强护盾与基础伤害，并把 `nullglass_lens` 纳入路线支援遗物。
  - `penitent_judge:verdict` 判令链削弱最后拘票爆发，降低过快清场风险。
  - 战斗胜利转场改为幂等处理，重复 `COMBAT_WON` 不再污染 Reward 阶段日志。
- 新增 2 个原创角色：
  - `penitent_judge`：判令资源，围绕易伤、处刑、供述和判令消耗构筑。
  - `void_sanctioner`：封印资源，围绕虚弱、群体压制、零费抽牌和封印消耗构筑。
- 新增 22 张角色专属卡牌，全部包含升级效果、背景、碎片叙事、遗言和路线标签。
- 新增 6 个角色专属遗物，并接入判令/封印获得与消耗事件。
- 原有 6 个角色补齐背景、机制叙事、碎片叙事和统一机制摘要。
- 主界面图鉴数据源增强：卡牌/遗物/敌人条目可展示背景、升级效果和 lore fragments。
- 补齐运行时图片资源：
  - 新增 2 张角色立绘。
  - 新增 22 张新卡图。
  - 新增 6 个新遗物图。
  - 为既有缺失资源补齐 102 张卡图和 73 个遗物图。
- 战斗逻辑接入：
  - `verdict`、`seal` 纳入通用路线资源增减和消耗事件。
  - 判令/封印显示到战斗 HUD。
  - Start-of-turn watcher 触发链可消费资源、抽零费牌、获得护盾等事件。
  - `blackened_gavel` 伤害改走动作队列，保留死亡结算路径。
  - 遗物事件监听绑定当前 `GameState`，CardPlayed/资源获得/资源消耗类遗物可即时 flush；无当前 ActionManager 的测试/诊断上下文会安静退出。
- 修复 review 中指出的机制缺陷：
  - Kill 条件可读取刚死亡目标。
  - StartOfTurnEffect 已由 CombatManager 消费触发。
  - 敌方目标解析补齐 AllEnemies/AllAllies 语义。
  - 指挥分支不再重复抽牌。
  - NoAttackYet 改为检查本回合攻击牌计数。
  - 死亡敌人不再作为攻击牌可选目标。

## Verification

- `npm run lint --silent`
- `npx tsc --noEmit --pretty false --project tsconfig.json`
- `npx tsx --test tests/unit/gothicExpansionContent.test.ts tests/unit/growthRoutePhase2.test.ts tests/unit/combatViewModel.test.ts tests/unit/specialActionBehavior.test.ts`
- `npm run test:supplemental-units`
- `npm run check:content-bundle`
- `npm run check:content-reachability`
- `npm run check:deep-reachability`
- `npm run check:route-taxonomy-guardrails`
- `npm run check:content-authoring`
- `npm run accept:expansion-content`
- `npm run build`
- `npm run report:longform-balance -- --pass=17 --runs-per-build=10`
- `npx tsx scripts/validation/playwright_real_ui_30_rounds.ts --rounds=10`
- `git diff --check`
- Asset scan: `missingCards=0`, `missingRelics=0`, `badCards=0`, `badRelics=0`
- Build output confirmed no `pixi-vendor` chunk-size warning; `pixi-vendor` remains split at 508.41 kB.

## Tuanjie Placeholder Art Pass - 2026-05-03

- Replaced the current Tuanjie modeling-gap placeholder PNG set with generated production art in `public/assets`.
- Completed 24 workspace-bound assets for this pass: 8 backgrounds, 6 enemy portraits, 6 event scenes, and 4 shop scenes.
- Generated the remaining shop scenes for `shop_forge.png`, `shop_merchant.png`, and `shop_trade.png` with the built-in image generation path; the source batch was then migrated into the E-drive project archive below.
- Migrated the generation source batch to `E:\deckrogue\deckrogue\output\generated_images\019de61d-1ba5-7cf1-9228-d6c6a47bc6a5` after SHA256 verification and removed the original C drive cache copy.
- Migrated the 4 earlier generated image source batches from `C:\Users\123\.codex\generated_images` to `E:\deckrogue\deckrogue\output\generated_images`, covering 85 files and `173691708` bytes after SHA256 verification; removed the original C drive batch directories.
- Copied the already generated enemy, event, and `shop_black.png` assets into their final `public/assets` paths without deleting generation sources.
- Verification:
  - `npm run check:tuanjie-assets`: passed with 34 manifest entries and wrote `reports/content/tuanjie-asset-manifest.json`.
  - Target asset scan: `Count=24`, `Missing=0`, `PlaceholderSized=0`, `MinBytes=2149435`; all checked PNGs now have real image dimensions instead of 1KB placeholders.

## Remaining Risks

- 批量补齐的旧卡图和旧遗物图是本地生成的风格化 PNG，占位质量稳定，但没有逐张手绘精修。
- 长局数平衡已用 10 runs/build 覆盖 24 条路线，当前无脚本级 findings；仍未做人工长时间手动调参。

## STS-Inspired Original Expansion Planning - 2026-05-08

- 响应 `$ralplan` 请求，为“参考成熟卡牌构筑游戏设计来强化 DeckRogue”建立合规计划。
- 明确边界：不解包、不反编译、不复制第三方商业游戏代码、数据、文本、立绘、音频或资产；仅做机制层分析和原创重写。
- 已确认当前内容入口：
  - `src/content/data/cards.json`：330 张卡。
  - `src/content/data/enemies.json`：52 个敌人。
  - `src/content/data/relics.json`：98 件奇物。
  - `src/content/data/potions.json`：12 个药水。
  - `src/content/narrative/storyEvents.ts`：故事事件定义。
- 已确认系统触点：
  - 商店：`src/ui/views/ShopView.tsx`。
  - 事件：`src/core/events/EventManager.ts`。
  - 敌人意图：`src/core/ai/intentSelector.ts`。
  - 数值聚合：`src/content/narrative/numericSystem.ts`。
- 新增上下文快照：`.omx/context/sts-inspired-original-expansion-20260508T051239Z.md`。
- 新增计划：`.omx/plans/2026-05-08-sts-inspired-original-expansion.md`。
- 计划采用分阶段原创内容包：先设计转译，再小批量卡牌/敌人/事件/奇物落地，然后验证和调参。

## Original Expansion Execution Follow-up - 2026-05-08

- 新增设计转译文档与人工表达审查清单：
  - `docs/design/sts-inspired-original-expansion.md`
  - `docs/design/original-gothic-expansion-review.md`
- 将事件选项预览标签收敛到 `src/content/narrative/numericSystem.ts`，输出 `commit`、`pivot`、`payoff`、`burden`、`debt`、`recovery`，`EventView.tsx` 只渲染适配层提供的标签。
- 将路线验证脚本从 6 角色扩展到 8 角色，包含 `penitent_judge` 与 `void_sanctioner`。
- 补充音乐资源清单测试，验证 `musicManifest.ts` 声明的场景、角色、事件 MP3 均存在且非空。
- 清理运行时文案、卡牌 `art_prompt` 和旧设计指南中的第三方 IP 专名表述，统一改为原创黑暗哥特科幻/教堂工业方向。
- 修复音乐系统接入问题：
  - `AudioManager.crossfade()` 先初始化音频上下文再读取 layer，避免场景音乐实际不播放。
  - `MusicDispatcher` 记录并释放全局事件订阅，`GameEngine.dispose()` 会同步清理音乐调度器。

## Verification

- `npm run lint --silent`
- `npx tsx --test tests/unit/eventManagerContract.test.ts tests/unit/musicManifest.test.ts tests/unit/growthRoutePhase2.test.ts`
- `npm run check:content-contract-layer`
- `npm run check:content-bundle`
- `npm run check:route-taxonomy-guardrails`
- `npm run check:shop-event-growth-nodes`
- `npm run check:growth-route-formation`
- `npm run check:reward-tradeoff-quality`
- `npx tsx scripts/validation/check_shop_route_reinforcement.ts`
- `npx tsx scripts/validation/check_rest_route_reinforcement.ts`
- `npm run check:content-authoring`
- `npm run check:enemy-ai-profiles`
- `npm run check:content-reachability`
- `npm run check:deep-reachability`
- `npm run report:translation-audit`
- `npm run check:readme-consistency`
- `npm run accept:expansion-content`
- `npm run test:supplemental-units`
- `npx tsx --test tests/unit/saveManagerSecurity.test.ts tests/unit/musicManifest.test.ts`
- `npm run build`
- `git diff --check`
- `npm run test:event-flow-smoke`
- `npm run test:shop-flow-smoke`
- `npm run test:ui-smoke:expansion`
- IP 表述扫描：对运行时内容、脚本、测试、计划和文档执行第三方 IP 专名检索，除本报告记录外无匹配；同时检查文件名无相关专名残留。
- Dev server health check: `http://127.0.0.1:3000/` returned HTTP 200.

## Review Fix Follow-up - 2026-05-08

- 修复 8 角色商店/事件成长节点检查的假通过：`check_shop_event_growth_nodes.ts` 现在要求每个角色的 `shopRate` 与 `eventRate` 都达到阈值，并在报告中输出逐角色失败明细。
- 补齐 `penitent_judge` 与 `void_sanctioner` 的事件路线覆盖：早期事件可覆盖判令/处刑/供述与封印/压制/代价路线，后续裂隙、裁决庭和终端事件也补上相应支撑标签。
- 修复事件选项标签误判：UI 预览只用显式选项提交标签或选项角色生成 `commit`，中立 follow-up 不再继承事件级路线标签。
- 修复音频状态问题：`AudioManager` 会缓存初始化前设置的 master/layer 音量；`MusicEngine.unmute()` 恢复用户配置音量；`crossfade()` 增加 transition id，快速切屏时旧延迟回调不会覆盖新曲。
- 新增 `tests/unit/audioManager.test.ts` 覆盖初始化前音量缓存、crossfade 竞态取消和 mute/unmute 音量恢复。

## Verification

- `npx tsx --test tests/unit/eventManagerContract.test.ts tests/unit/audioManager.test.ts`
- `npm run check:shop-event-growth-nodes`: `shopRate=100.0%`, `eventRate=100.0%`, `characterPassCount=8/8`
- `npm run check:growth-route-formation`: `formationRate=100.0%`
- `npm run check:reward-tradeoff-quality`: `tradeoffRate=100.0%`
- `npx tsx scripts/validation/check_shop_route_reinforcement.ts`: primary/service semantic alignment `100.0%`
- `npx tsx scripts/validation/check_rest_route_reinforcement.ts`: semantic alignment `100.0%`
- `npm run lint --silent`
- `npx tsc --noEmit --pretty false --project tsconfig.json`
- `npm run check:route-taxonomy-guardrails`
- `npx tsx scripts/validation/check_event_choice_reinforcement.ts`: `passCount=5/5`
- `npx tsx --test tests/unit/growthRoutePhase2.test.ts tests/unit/musicManifest.test.ts tests/unit/audioManager.test.ts tests/unit/eventManagerContract.test.ts`
- `npx tsx --test tests/unit/growthRouteFormation.test.ts`
- `npm run build`
- `npm run test:supplemental-units`: `147/147` passed
- `npm run test:event-flow-smoke`
- `npm run test:shop-flow-smoke`
- `git diff --check` passed with existing LF/CRLF normalization warnings only.

## Ralph Closure - Original Expansion - 2026-05-08

- 按 `$ralph` 门禁补齐执行工件：
  - `.omx/plans/prd-sts-inspired-original-expansion.md`
  - `.omx/plans/test-spec-sts-inspired-original-expansion.md`
  - `.omx/state/sts-inspired-original-expansion-ralph-progress.json`
- 以既有批准计划为基线完成收口：原创机制转译、表达审查、8 角色路线覆盖、事件/商店决策标签、哥特扩展内容、音乐与音频运行时均进入可验证状态。
- 当前 Ralph 状态进入 architect review，等待只读复核签收。

## Verification

- `npm run lint --silent`
- `npx tsc --noEmit --pretty false --project tsconfig.json`
- `npm run check:content-contract-layer`
- `npm run check:content-bundle`: `7/7` passed
- `npm run check:content-authoring`: cards `330/330`, enemies `46/52`, relics `98/98`, pass rate `98.75%`
- `npm run check:enemy-ai-profiles`: OK
- `npm run check:content-reachability`: `11/11` reachable, broken edges `0`
- `npm run check:deep-reachability`: `22/22` reachable, broken edges `0`
- `npm run report:translation-audit`: total `0`
- `npm run check:shop-event-growth-nodes`: `shopRate=100%`, `eventRate=100%`, `characterPassCount=8/8`
- `npm run check:route-taxonomy-guardrails`: `24` routes, `failureCount=0`
- `npm run check:growth-route-formation`: `formationRate=100%`
- `npm run check:reward-tradeoff-quality`: `tradeoffRate=100%`
- `npx tsx scripts/validation/check_shop_route_reinforcement.ts`: primary/service semantic alignment `100%`
- `npx tsx scripts/validation/check_rest_route_reinforcement.ts`: semantic alignment `100%`
- `npx tsx scripts/validation/check_event_choice_reinforcement.ts`: `passCount=5/5`
- `npx tsx --test tests/unit/eventManagerContract.test.ts tests/unit/musicManifest.test.ts tests/unit/audioManager.test.ts tests/unit/growthRoutePhase2.test.ts tests/unit/growthRouteFormation.test.ts tests/unit/gothicExpansionContent.test.ts tests/unit/cardExpansionPack.test.ts`: `32/32` passed
- `npm run test:supplemental-units`: `147/147` passed
- `npm run accept:expansion-content`: `3/3` suites passed, `441` tests total
- `npm run build`
- `npm run test:event-flow-smoke`
- `npm run test:shop-flow-smoke`
- `git diff --check`: exit `0`, only existing LF/CRLF warnings

## Ralph Architect Reject Fix - 2026-05-08

- 处理 architect 复核拒绝项：4 个 boss 的 `intentPolicy` 指向未定义 `moves`，导致敌人 authoring 并未真正全绿。
- 为 `cathedral_engine`、`logic_saint`、`pox_cathedral`、`the_mire_saint` 补齐 8 个缺失意图动作，动作语义对齐既有 `bossPhases.json` 阶段设计，并只使用当前战斗引擎已支持的动作类型。
- 删除 `mind_peek` 与 `card_swap` 的顶层伪敌人条目；它们仍作为 `psychic_infiltrator` 的 move 存在，不再污染敌人 authoring 总数。
- 强化 `check_content_authoring.ts`：任意 card/enemy/relic authoring issue 都会硬失败，不再用整体 90% 通过率掩盖局部错误。
- 强化 `check_enemy_ai_profiles.ts` 与 `enemyAiProfileCoverage.test.ts`：`intent_policy`、`intentBiases`、`antiStall.suppressedIntents` 必须能解析到声明的 move。

## Verification

- `npm run lint --silent`
- `npx tsc --noEmit --pretty false --project tsconfig.json`
- `npm run check:content-contract-layer`: OK
- `npm run check:content-bundle`: `7/7` passed
- `npm run check:content-authoring`: cards `330/330`, enemies `50/50`, relics `98/98`, pass rate `100%`
- `npm run check:enemy-ai-profiles`: OK
- `npx tsx --test tests/unit/enemyAiProfileCoverage.test.ts`: `3/3` passed
- `npm run check:content-reachability`: `11/11` reachable, broken edges `0`
- `npm run check:deep-reachability`: `22/22` reachable, broken edges `0`
- `npm run report:translation-audit`: total `0`
- `npm run check:shop-event-growth-nodes`: `shopRate=100%`, `eventRate=100%`, `characterPassCount=8/8`
- `npm run check:route-taxonomy-guardrails`: `24` routes, `failureCount=0`
- `npm run check:growth-route-formation`: `formationRate=100%`
- `npm run check:reward-tradeoff-quality`: `tradeoffRate=100%`
- `npm run check:enemy-variant-behavior`: OK, 6 variants checked
- `npm run check:enemy-first3-exposure`: OK
- `npm run accept:expansion-content`: `3/3` suites passed, `444` tests total
- `npm run test:supplemental-units`: `148/148` passed
- `npm run build`
- `npm run test:event-flow-smoke`
- `npm run test:shop-flow-smoke`
- `git diff --check`: exit `0`, LF/CRLF normalization warnings only

## Ralph Architect Approval - 2026-05-08

- Architect recheck verdict: `APPROVE`.
- 此前拒绝项已关闭：
  - 4 个 boss 的 `intentPolicy` 与 `moves` 已对齐。
  - `mind_peek` / `card_swap` 不再作为顶层敌人污染 authoring。
  - `check_content_authoring.ts` 已改为任一 authoring issue 硬失败。
  - `check_enemy_ai_profiles.ts` 和 `enemyAiProfileCoverage.test.ts` 已覆盖 intent/move 解析。
- Ralph 状态已关闭：`.omx/state/sts-inspired-original-expansion-ralph-progress.json` 标记 `active=false`、`current_phase=complete`。
- 剩余风险为非阻断：工作区仍含大量既有未提交改动；Windows LF/CRLF 归一化警告存在，但 `git diff --check` 退出码为 `0`。

## All Approved Plans Execution Closure - 2026-05-08

- 按“执行完所有计划”重新核对并执行 `.omx/plans` 下 3 份已批准实施计划：
  - `2026-04-10-deckrogue-enemy-expression-phase1.md`
  - `2026-04-11-deckrogue-growth-route-formation-phase1.md`
  - `2026-05-08-sts-inspired-original-expansion.md`
- 补齐 4 月 10 日计划缺失的 `test:runtime-v2:ts` npm 验收入口，将现有 runtime-v2 / Python bridge / delegation 单测聚合为可复用脚本。
- 修复 release gate 阻断：`SaveManager.prepareLoadedSaveData()` 现在在解析点内部捕获无效 JSON，发布 `LoadFailed` 后返回 `null`；`check:vulnerability-scan` 高危项从 `1` 降为 `0`。
- 刷新 release-readiness 依赖的所有 canonical artifacts：desktop build/smoke、doctor、security、UI expansion smoke、reward/terminal/shop/event/rest/upgrade/remove-card/boss-phase/boss-terminal flow smoke。
- 执行 30 轮真实 UI harness，`30/30` 全部通过。

## Verification

- Enemy expression plan:
  - `npm run lint --silent`
  - `npm run check:content-authoring`: cards `330/330`, enemies `50/50`, relics `98/98`
  - `npm run check:enemy-ai-profiles`: OK
  - `npm run check:content-bundle`: `7/7` passed
  - `npm run check:enemy-visual-identity`: OK, 6 variants
  - `npm run check:enemy-variant-behavior`: OK, 6 variants checked
  - `npm run check:enemy-first3-exposure`: OK
  - `npm run test:runtime-v2:ts`: `93` passed, `1` skipped
  - `npm run build`
  - `npm run check:release-readiness`: `41/41` passed
- Growth route formation plan:
  - `npm run check:growth-route-formation`: `160/160`, `formationRate=100%`
  - `npm run check:reward-tradeoff-quality`: `160/160`, `tradeoffRate=100%`
  - `npm run check:shop-event-growth-nodes`: `shopRate=100%`, `eventRate=100%`, `characterPassCount=8/8`
  - `npm run check:route-taxonomy-guardrails`: `24` routes, `failureCount=0`
  - `npm run test:real-ui-30-rounds`: `30/30` rounds passed
  - `npm run report:growth-route-formation`: wrote `reports/growth/growth-route-summary.json`
- Original expansion plan:
  - `npx tsc --noEmit --pretty false --project tsconfig.json`
  - `npm run check:content-contract-layer`: OK
  - `npm run check:content-reachability`: `11/11` reachable, broken edges `0`
  - `npm run check:deep-reachability`: `22/22` reachable, broken edges `0`
  - `npm run report:translation-audit`: total `0`
  - `npm run accept:expansion-content`: `3/3` suites passed
  - `npm run test:supplemental-units`: passed in doctor run
  - `npm run test:event-flow-smoke`
  - `npm run test:shop-flow-smoke`
- Release and safety closure:
  - `npm run doctor:game`: `44/44` passed
  - `npm run report:security`: `HEALTHY`, risk `LOW`
  - `npm run check:vulnerability-scan`: critical `0`, high `0`
  - `git diff --check`: exit `0`, LF/CRLF normalization warnings only

## Dirty Workspace Resolution - 2026-05-08

- 将前述已验证成果收敛为 Git checkpoint：`Close validated DeckRogue expansion plans`。
- 保留但忽略本地配置与源图归档：`.claude/`、`output/generated_images/`，避免机器本地状态和大体积生成源批次继续污染工作区。
- 提交运行时需要的成果文件：原创哥特科幻设计文档、音乐系统与 `public/assets/music/`、Tuanjie manifest、公开运行资源、验证脚本、音频/存档安全/敌人 AI 覆盖测试。
- 当前收敛验证：
  - `git diff --check`: exit `0`
  - `git diff --cached --check`: exit `0`
  - `npm run lint --silent`: exit `0`
  - `npx tsc --noEmit --pretty false --project tsconfig.json`: exit `0`
  - `npm run build`: exit `0`
  - `git status --short --branch`: clean, branch ahead `origin/codex/test-auto/ui-click-30` by local commits
- 当时剩余风险：
  - 已解决：分支曾未 push 到远端；当前分支已同步到 upstream。
  - `public/assets/music/` 属于大体积运行资源，已提交到 Git；后续若远端体积策略严格，应单独评估 LFS 或资源分发方案。

## One-by-one Change Trace - 2026-05-08

- 已按用户要求逐项追踪查看最新提交 `c2d51ca` 的文件变更，并生成明细报告：`docs/design/change-trace-2026-05-08.md`。
- 追踪中发现并处理原创化边界风险：
  - 重命名旧 IP 风格背景与事件资源文件：`bg_void_breach`、`bg_starless_archive`、`bg_oathbound_palace`、`bg_iron_chapel_forge`、`bg_ancient_machine_tomb`、`bg_plague_garden`、`bg_martyr_chapel`、`event_void_gate`。
  - 将用户可见和内部引用中的直接残留替换为原创表达，例如 `oathbound_wrath`、`oathbound_mercy`、`rot_reliquary_blessing`、`machine_canticle_coolant`、`seal_of_machine_vow`、`mark_of_entropy`。
  - 扫描确认活跃源码、内容数据和运行文档中未残留直接第三方 IP 关键词；追踪报告仅保留历史删除路径作为审计证据。
  - 密钥扫描未发现真实 `sk-*` 或 API key 实值；`secret` 命中均为普通玩法/变量词。
- 本轮追踪验证：
  - `git diff --check`: exit `0`
  - `npm run lint --silent`: exit `0`
  - `npx tsc --noEmit --pretty false --project tsconfig.json`: exit `0`
  - `npm run check:content-contract-layer`: OK
  - `npm run check:content-authoring`: cards `330/330`, enemies `50/50`, relics `98/98`
  - `npm run check:content-bundle`: `7/7` passed
  - `npm run check:tuanjie-assets`: passed
  - `npx tsx --test tests/unit/eventManagerContract.test.ts tests/unit/actionManagerAndRoomFlow.test.ts tests/unit/growthRoutePhase2.test.ts tests/unit/roomSessionLifecycle.test.ts`: `25/25` passed
  - `npx tsx --test tests/unit/musicManifest.test.ts tests/unit/tuanjieModelManifest.test.ts tests/unit/audioManager.test.ts`: `8/8` passed
  - `npm run build`: exit `0`
  - `npm run doctor:game`: `44/44` passed
  - `npm run check:release-readiness`: `41/41` passed after doctor refreshed generated artifacts
