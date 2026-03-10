# DeckRogue 仓库开发手册 / Repository Development Manual

## 1. Purpose / 目标
本手册定义整个仓库的开发规则、目录边界、提交流程、兼容策略与维护责任。目标是让仓库在持续迭代中保持：
- 功能导向分区清晰
- 导入边界稳定
- 兼容层可控
- 文档和实现同步

## 2. Top-Level Directory Ownership / 顶层目录职责
### `/src`
运行时代码。只放会参与应用构建和运行的实现。

### `/docs`
非运行期知识库。包括架构、计划、指南、事故、报告、设计输入。

### `/scripts`
仓库操作工具。必须继续分为：
- `scripts/analysis`: 数值、模拟、诊断
- `scripts/validation`: 结构、边界、CI 门禁
- `scripts/assets`: 资源生成与处理

### `/tests`
自动化测试。当前主分区是 `tests/unit`，后续如有集成测试应新增 `tests/integration`。

### `/public`
正式静态资源发布目录。

### `/dist`
构建产物目录。
- 由 `npm run build` 生成
- 不承载源码
- 仅用于本地验证或发布产物检查

### `/output`
临时输出与自动化生成结果目录，不作为正式源码输入。

### Root Config Files
以下文件必须保留在仓库根目录，不得下沉：
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `metadata.json`
- `.gitignore`
- `.env.example`

原因：这些是工具链与运行环境的约定入口。

### Root Metadata File
`metadata.json` 归类为“运行容器/应用元数据声明”，用于描述应用基础信息与权限请求，不属于业务内容数据，因此保留在根目录。

## 3. Runtime Layer Rules / 运行时代码分层规则
### `src/core`
系统规则与引擎机制。
- `combat`: 伤害/状态/目标结算
- `actions`: 动作管线
- `balance`: 数值模型与常量
- `events`: 引擎事件、地图生成、GameEngine
- `persistence`: 存档、meta、codex、setup
- `types/`: 类型拆分源文件
- `types.ts`: 聚合出口

### `src/features`
玩法系统。
- `achievements`
- `relics`
- `synergies`
- `progression`

### `src/content`
内容层。
- `data`: 纯 JSON
- `narrative`: 数据装配、故事事件

### `src/ui`
UI 层。
- `views`
- `components`
- `overlays`
- `theme`

### `src/infrastructure`
底层技术基础设施。
- 当前主要为 `rng`

### `src/engine`
兼容层。
- 只允许 re-export / facade
- 不允许新增业务实现

## 4. Hidden Directories / 隐藏目录分类与规则
这些目录同样被分类管理，但不按业务代码方式迁移。

### `.git/` — Source Control System Data
- 归类：版本控制系统目录
- 维护者：Git
- 规则：禁止手动移动、重命名、清理内部对象文件
- 文档化方式：仅在本手册和 `docs/environment/` 中说明

### `node_modules/` — Dependency Installation Cache
- 归类：依赖安装结果目录
- 维护者：npm / package manager
- 规则：禁止手工整理包内部结构；需要时通过 `npm install` / `npm prune` 重建
- 文档化方式：仅文档说明，不做文件内维护

### `.playwright-cli/` — Browser Automation Workspace
- 归类：浏览器自动化缓存与输出目录
- 内容：console logs、page yml、png 等
- 规则：可清理历史产物；不得作为源码依赖

### `.minimax/` — Local Skill Workspace
- 归类：本地 AI/技能辅助目录
- 内容：skills 和环境相关材料
- 规则：按工具需求维护；不参与应用构建

### `.trae/` — IDE/Planning Workspace
- 归类：IDE 侧工作文档目录
- 内容：规划文档、草稿、临时说明
- 规则：不作为正式文档主源，正式内容应迁入 `docs/`

## 5. Import Rules / 导入规则
### Canonical Imports
新代码必须优先使用：
- `@/core/*`
- `@/features/*`
- `@/content/*`
- `@/ui/*`
- `@/infrastructure/*`

### Deprecated Imports
以下路径只允许保留在兼容层：
- `@/engine/*`

### Relative Imports
- `src/` 内禁止使用相对导入
- 检查脚本：`npm run check:import-boundaries`

## 6. Type Organization / 类型组织规则
`src/core/types.ts` 是聚合出口；真实类型源文件分拆为：
- `src/core/types/actions.ts`
- `src/core/types/combat.ts`
- `src/core/types/events.ts`
- `src/core/types/meta.ts`

新增类型时遵循：
- 动作描述与内容实体 -> `actions.ts`
- 战斗态和全局状态 -> `combat.ts`
- 地图、事件、活动事件 -> `events.ts`
- meta progression / run summary -> `meta.ts`

## 7. Documentation Policy / 文档维护规则
### Every Functional Partition Needs a README
`src/`、`docs/`、`scripts/`、`tests/`、`public/`、`output/` 及其核心子分区都应有 README。

### README Required Sections
1. 功能职责
2. 核心边界
3. 主要文件清单
4. 模块关系
5. 数据流/调用流
6. 对外接口
7. 约束与禁忌
8. 迁移与兼容
9. 测试入口与验证命令

### Validation
- `npm run check:readme-consistency`

## 8. Change Workflow / 提交流程
### A. 结构调整类改动
1. 先创建目标功能目录
2. 再移动文件
3. 更新导入路径
4. 更新 README 与映射表
5. 执行边界检查和构建

### B. 运行时代码改动
1. 先判断归属到 `core/features/content/ui/infrastructure`
2. 不得把实现塞回兼容层
3. 保持 `src/engine/*` 只做转发

### C. 文档/报告改动
1. 草稿可先放 `.trae/`
2. 定稿必须迁入 `docs/` 对应子分区

## 9. Submission Checklist / 提交前检查
必须通过：
- `npm run lint`
- `npm run build`
- `npm run check:import-boundaries`
- `npm run check:deprecated-imports`
- `npm run check:readme-consistency`

建议通过：
- `npm run test:damage`
- `npm run diag:numeric`

## 10. Compatibility Strategy / 兼容策略
### Allowed Compatibility Shells
- `src/App.tsx`
- `src/engine/index.ts`
- `src/engine/engine.ts`

### Forbidden Compatibility Expansion
不允许再新增其他兼容目录或兼容文件，除非明确进入下一轮迁移计划。

## 11. Maintenance Ownership / 维护责任
- 架构与分层：`docs/architecture`, `docs/plans`, `docs/DEVELOPMENT.md`
- 质量门禁：`scripts/validation/*`
- 数值分析：`scripts/analysis/*`
- 运行时代码：`src/*`
- 临时 IDE/自动化缓存：`.trae`, `.playwright-cli`, `.minimax`

## 12. Repo Hygiene / 仓库卫生
- `.DS_Store` 不应进入正式提交
- `output/` 只保留必要结果
- `dist/` 只保留最近一次构建结果，禁止手工编辑
- `.playwright-cli/` 的历史截图与 yml 可定期清理
- `.trae/documents/` 的定稿应迁入 `docs/`
