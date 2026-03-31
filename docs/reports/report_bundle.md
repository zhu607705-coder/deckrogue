# DeckRogue Report Bundle

生成时间：2026-03-25
生成来源：自动脚本 `scripts/validation/generate_report_bundle.ts`
生成戳：`2026-03-25T10:11:04.951Z`
说明：本文件作为单点入口，集中汇总当前报告结论、最新自动化产物状态和全部报告清单。日志文件未内联，保留原路径引用。

## 1. 当前总览

### 1.1 跨报告结论

- 当前最新战斗回归来自 `output/numerics/combat_regression.json`，`powerSpread = 7.24`，`survivalSpreadFirst3 = 0.20`。
- 当前经济回归来自 `output/numerics/economy_regression.json`，训练诊断状态为：`illegalRunTransitions = 0`，`unknownActionTypes = 0`。
- 当前 `runtime_v2` 一致性报告来自 `output/runtime_v2/parity_report.json`，`30` 组样本在全部汇总场景均通过。
- 当前 UI 自动化存在分层差异：基础烟测 `6` 个布局问题，扩展烟测 `0` 个布局问题。
- 当前最新 doctor 总报告显示 `26` 个阶段里 `26` 个通过、`0` 个失败。
- 当前 release readiness 报告总体状态为 `pass`，warning 证据为：`reports/ present; manual log growth review still required (rough entry score=0.1)`。
- 当前安全扫描无 `critical/high`，但仍有 `84` 个中低级问题。
- 当前内容作者校验总体通过率 `98.97%`，当前无效敌人数量 `4`。

### 1.2 当前关键数字

| 维度 | 当前值 | 备注 |
|---|---:|---|
| 战斗 `powerSpread` | `7.24` | 来自最新 `combat_regression.json` |
| 战斗 `survivalSpreadFirst3` | `0.20` | 来自最新 `combat_regression.json` |
| 战斗强度顶部职业 | `alchemist` | 来自最新 `combat_regression.json` |
| 战斗强度底部职业 | `brute` | 来自最新 `combat_regression.json` |
| 经济诊断非法迁移 | `0` | 最新摘要 |
| 经济诊断未知动作 | `0` | 最新摘要 |
| UI 基础烟测布局问题 | `6` | 基础入口 |
| UI 扩展烟测布局问题 | `0` | 扩展覆盖 |
| baseline audit errors | `0` | 最新扫描 |
| baseline audit warnings | `15` | anomaly=9, drift=6 |
| scenario matrix | `7/7 pass` | 当前场景矩阵 |
| expansion acceptance | `198 tests` | 3/3 suites pass |
| translation audit | `0` 问题 | 当前语言检查 |

## 2. 当前自动化报告摘要

### 2.1 Doctor 总报告

来源：`reports/doctor/report.json`

- 总阶段数：`26`
- 通过：`26`
- 失败：`0`
- 跳过：`0`

### 2.2 战斗回归

来源：`output/numerics/combat_regression.json`

- `powerSpread = 7.24`
- `survivalSpreadFirst3 = 0.20`
- `powerBand.top = alchemist`
- `powerBand.bottom = brute`
- 当前 outlier：
  - `puppeteer`: `low_overall_score`
  - `chronomancer`: `high_early_survival`，`dominant_overall_score`
  - `alchemist`: `high_early_survival`

### 2.3 经济回归

来源：`output/numerics/economy_regression.json`

- 训练诊断：
  - `illegalRunTransitions = 0`
  - `unknownActionTypes = 0`
- 当前各职业 `nodeDistribution.totalVariationDistance`：
  - `informant = 0.8444`
  - `brute = 0.8005`
  - `tactician = 0.7775`
  - `puppeteer = 0.3368`
  - `chronomancer = 0.8689`
  - `alchemist = 0.8203`
- 当前统一奖励价格比：
  - `potion = 0.7672503648113405`
  - `relic = 0.370583226905066`
- 当前摘要层 `cardAffordability = null`，`floor3Removal = null`。

### 2.4 Baseline Audit

来源：`output/numerics/baseline_audit.json`

- `errors = 0`
- `warnings = 15`
- `anomalyWarnings = 9`
- `driftWarnings = 6`

### 2.5 Runtime V2 Parity

来源：`output/runtime_v2/parity_report.json`

- 样本数：`30`
- 当前场景汇总：
  - `combat_reward_stable = 30/30 pass`
  - `map_full_bridge = 30/30 pass`
  - `map_native_metadata = 30/30 pass`
  - `map_native_topology = 30/30 pass`

### 2.6 UI Smoke

来源：

- `output/playwright/ui_smoke_report.json`
- `output/playwright/ui_smoke_expansion_report.json`

基础烟测：

- 审计页数：`7`
- 布局问题：`6`
- `consoleErrors = 0`
- `pageErrors = 0`
- `failedRequests = 0`

扩展烟测：

- 审计页数：`14`
- 布局问题：`0`
- `consoleErrors = 0`
- `pageErrors = 0`
- `failedRequests = 0`
- `tutorialChecked = true`
- 已验证存档位：
  - `UI Smoke Map`
  - `UI Smoke Reward`
  - `UI Smoke Shop`
  - `UI Smoke Event`
  - `UI Smoke Upgrade`
  - `UI Smoke Victory`

### 2.7 Release Readiness

来源：`reports/release/release-readiness.json`

- 总检查数：`19`
- `passed = 18`
- `warned = 1`
- `failed = 0`
- `overallStatus = pass`
- 唯一 warning：`reports/ present; manual log growth review still required (rough entry score=0.1)`

### 2.8 Scenario Matrix / Expansion / System Assertions

来源：

- `reports/scenarios/scenario-matrix.json`
- `reports/expansion/expansion.json`
- `reports/system/system-assertions.json`
- `reports/system/destructive-suite.json`

摘要：

- `scenario matrix = 7/7 pass`
- `expansion acceptance = 3/3 suites pass, 198 tests`
- `system assertions = 5 probes, 0 failing`
- `destructive suite = 6 cases, 0 failing`

### 2.9 Content / Security / Translation

来源：

- `reports/content/content-authoring.json`
- `reports/content/ecosystem-balance.json`
- `reports/content/experience-polish.json`
- `reports/security/security-report.json`
- `reports/vulnerability/vulnerability-scan.json`
- `reports/translation/translation-audit.json`

摘要：

- content authoring：`overallStatus = pass`，`passRate = 98.97%`
- 当前无效敌人：`4`
  - `cathedral_engine`
  - `logic_saint`
  - `pox_cathedral`
  - `the_mire_saint`
- ecosystem balance：`totalCharacters = 6`，`reportStatus = warn`
- experience polish：`命中反馈 = implemented`，`状态施加 = missing`
- security report：`84` 个问题，`critical = 0`，`high = 0`
- vulnerability scan：`84` 个问题，`critical = 0`，`high = 0`
- translation audit：`0` 项问题

## 3. 跨报告冲突与注意点

### 3.1 当前存在的冲突

- `release-readiness` 为 `pass`，但最新 doctor 报告仍有 `0` 个失败。发布判断应以时间更晚的总报告为准。
- `runtime_v2 parity`、`scenario matrix`、`system assertions` 全绿，但 `combat_regression` 和 `economy_regression` 仍是独立状态线。
- 基础 UI 烟测仍有 `6` 个布局问题，而扩展 UI 烟测为 `0`，页面覆盖范围并不一致。

### 3.2 当前最需要继续跟进的点

- `combat_regression.json` 中 `powerSpread` 和 `survivalSpreadFirst3` 的变化
- `economy_regression.json` 摘要层的 `cardAffordability` / `floor3Removal` 空值
- `content-authoring` 暴露的 `4` 个敌人缺失 move 引用
- `security` / `vulnerability` 中累计的 `84` 个中低级问题

## 4. 人工维护报告目录

### 4.1 `docs/reports/`

| 文件 | 类型 | 说明 |
|---|---|---|
| `docs/reports/report_bundle.md` | 报告 | 人工维护文档 |

### 4.2 事故与快照

| 文件 | 类型 | 说明 |
|---|---|---|
| `docs/incidents/incident_report_2026-02-25.md` | 故障报告 | 事故诊断与修复 |
| `output/numerics/pre_refactor_snapshot.md` | 快照 | runtime 重构前基线快照 |

## 5. 最新自动化报告目录

### 5.1 当前最新文件

| 类别 | 最新文件 | 结论 |
|---|---|---|
| doctor | `reports/doctor/report.json` | 26 pass / 0 failed |
| content bundle | `reports/content/bundle-check.json` | 当前 bundle check 产物 |
| content authoring | `reports/content/content-authoring.json` | 98.97% 通过，4 个敌人问题 |
| deep reachability | `reports/content/deep-reachability.json` | 最新深度可达性产物 |
| ecosystem balance | `reports/content/ecosystem-balance.json` | warn |
| experience polish | `reports/content/experience-polish.json` | 体验检查产物 |
| keyword registry | `reports/content/keyword-registry.json` | 关键词校验产物 |
| numeric diff | `reports/content/numeric-diff.json` | 数值变更审计产物 |
| reachability | `reports/content/reachability.json` | 最新可达性产物 |
| release readiness | `reports/release/release-readiness.json` | pass with 1 warn |
| security report | `reports/security/security-report.json` | 无高危，84 项中低级问题 |
| scenario matrix | `reports/scenarios/scenario-matrix.json` | 7/7 pass |
| destructive suite | `reports/system/destructive-suite.json` | 6/6 pass |
| system assertions | `reports/system/system-assertions.json` | 5/5 pass |
| translation audit | `reports/translation/translation-audit.json` | 0 问题 |
| vulnerability scan | `reports/vulnerability/vulnerability-scan.json` | 无高危，84 项中低级问题 |
| expansion acceptance | `reports/expansion/expansion.json` | 3 suites pass |
| ui smoke | `output/playwright/ui_smoke_report.json` | 6 布局问题 |
| ui smoke expansion | `output/playwright/ui_smoke_expansion_report.json` | 0 布局问题 |
| runtime parity | `output/runtime_v2/parity_report.json` | 30 样本全量对比 |
| combat regression | `output/numerics/combat_regression.json` | 当前战斗回归产物 |
| economy regression | `output/numerics/economy_regression.json` | 当前经济回归产物 |
| baseline audit | `output/numerics/baseline_audit.json` | 0 error / 15 warnings |

### 5.2 历史数量

- `docs/reports/*.md` 与子目录：`1` 份
- incident report：`1` 份
- `output/` 下 report 与 numerics 快照：`10` 份
- `reports/` 下自动化 JSON 报告：`17` 份
- `reports/doctor/*.md`：`1` 份

## 6. 全部报告清单

### 6.1 人工报告与事故报告

- `docs/reports/report_bundle.md`
- `docs/incidents/incident_report_2026-02-25.md`

### 6.2 `output/` 当前 report 产物

- `output/numerics/baseline_audit.json`
- `output/numerics/baseline_audit.pre_runtime_refactor.json`
- `output/numerics/combat_regression.json`
- `output/numerics/combat_regression.pre_runtime_refactor.json`
- `output/numerics/economy_regression.json`
- `output/numerics/economy_regression.pre_runtime_refactor.json`
- `output/numerics/pre_refactor_snapshot.md`
- `output/playwright/ui_smoke_expansion_report.json`
- `output/playwright/ui_smoke_report.json`
- `output/runtime_v2/parity_report.json`

### 6.3 `reports/` 自动生成报告

- `reports/content/bundle-check.json`
- `reports/content/content-authoring.json`
- `reports/content/deep-reachability.json`
- `reports/content/ecosystem-balance.json`
- `reports/content/experience-polish.json`
- `reports/content/keyword-registry.json`
- `reports/content/numeric-diff.json`
- `reports/content/reachability.json`
- `reports/doctor/report.json`
- `reports/expansion/expansion.json`
- `reports/release/release-readiness.json`
- `reports/scenarios/scenario-matrix.json`
- `reports/security/security-report.json`
- `reports/system/destructive-suite.json`
- `reports/system/system-assertions.json`
- `reports/translation/translation-audit.json`
- `reports/vulnerability/vulnerability-scan.json`
- `reports/doctor/report.md`

## 7. 使用建议

- 读当前状态，先看本文件第 `1` 到第 `3` 节。
- 查人工结论，优先看第 `4` 节里的 `docs/reports/*.md`。
- 查自动化现状，优先看第 `5` 节里的最新文件。
- 查历史演进，直接从第 `6` 节跳到具体原始 report 文件。

## 8. 生成说明

- 生成命令：`npm run report:bundle`
- 输出文件：`docs/reports/report_bundle.md`
