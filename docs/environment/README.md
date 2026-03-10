# docs/environment / Environment Directories

## 1. 功能职责 (What / Why)
记录仓库内环境目录、隐藏目录、缓存目录的分类和维护规则。

## 2. 核心边界 (In / Out)
- In: `.git`, `node_modules`, `.playwright-cli`, `.minimax`, `.trae` 等说明。
- Out: 应用业务逻辑。

## 3. 主要文件清单 (Key Files)
- `hidden_directories.md`: 隐藏/缓存目录说明。

## 4. 模块关系 (Dependencies)
- 上游：本地工具链和 IDE。
- 下游：仓库维护流程。

## 5. 调用流
```mermaid
flowchart LR
  A["tooling / IDE / Git / npm"] --> B["hidden directories"] --> C["maintenance rules"]
```

## 6. 对外接口
- 无代码接口。

## 7. 约束与禁忌
- 不要把工具目录误当作业务目录重构。

## 8. 迁移与兼容
- 这类目录保留原位，通过文档分类管理。

## 9. 测试入口与验证命令
- `npm run check:readme-consistency`
