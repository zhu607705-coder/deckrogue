# Project Development Report

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
- `npx tsx --test tests/unit/gothicExpansionContent.test.ts tests/unit/growthRoutePhase2.test.ts tests/unit/combatViewModel.test.ts tests/unit/specialActionBehavior.test.ts tests/unit/runtimeV2ContentBundle.test.ts tests/unit/cardExpansionPack.test.ts`
- `npm run test:supplemental-units`
- `npm run test:runtime-v2:ts`
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

## Remaining Risks

- 批量补齐的旧卡图和旧遗物图是本地生成的风格化 PNG，占位质量稳定，但没有逐张手绘精修。
- 长局数平衡已用 10 runs/build 覆盖 24 条路线，当前无脚本级 findings；仍未做人工长时间手动调参。
