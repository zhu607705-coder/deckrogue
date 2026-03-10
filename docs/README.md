# docs / Documentation Hub

## 1. 功能职责 (What / Why)
存放架构说明、实施计划、使用指南、审计报告、事故记录与设计参考，作为项目的非运行期知识库。

## 2. 核心边界 (In / Out)
- In: 文档、报告、设计说明。
- Out: 运行时代码与自动化测试。

## 3. 主要文件清单 (Key Files)
- `DEVELOPMENT.md`: 开发总规范。
- `architecture/`: 架构说明。
- `guides/`: 操作与实现指南。
- `plans/`: 阶段计划。
- `reports/`: 评审与平衡报告。
- `incidents/`: 事故记录。
- `design/`: 设计输入资料。

## 4. 模块关系 (Dependencies)
- 上游：项目实现与变更历史。
- 下游：开发者、策划、维护者阅读使用。

## 5. 调用流 / 关系流
```mermaid
flowchart LR
  A["Source + Runtime"] --> B["Docs"]
  B --> C["Developer decisions"]
```

## 6. 对外接口 (Public Interface)
- 面向人阅读，无代码接口。

## 7. 约束与禁忌 (Constraints)
- 文档应描述事实，不应替代代码实现。
- 报告文件需放入对应子分区。

## 8. 迁移与兼容 (Migration)
- 根目录散落 `.md` 已并入本目录的功能子分区。

## 9. 测试入口与验证命令
- `npm run check:readme-consistency`
