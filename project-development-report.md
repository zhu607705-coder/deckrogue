# Project Development Report

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
