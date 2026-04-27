# Project Development Report

## Scope

本轮完成哥特科幻扩展内容、战斗资源机制接入、图鉴叙事增强和缺失图片补齐。

## Completed

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
- `git diff --check`
- Asset scan: `missingCards=0`, `missingRelics=0`, `badCards=0`, `badRelics=0`
- Build output confirmed no `pixi-vendor` chunk-size warning; `pixi-vendor` remains split at 508.41 kB.

## Remaining Risks

- 批量补齐的旧卡图和旧遗物图是本地生成的风格化 PNG，占位质量稳定，但没有逐张手绘精修。
- 本轮未做长局数平衡仿真，强度先通过费用、稀有度、资源门槛和路线测试约束。
