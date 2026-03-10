# docs/design / Design Inputs

## 1. 功能职责 (What / Why)
保存设计输入与外部数值/机制说明文档。

## 2. 核心边界
- In: 策划输入、设计草案。
- Out: 已落地的实现文档。

## 3. 主要文件清单
- `skills.md`

## 4. 模块关系
- 上游：策划需求。
- 下游：数值调整与脚本分析。

## 5. 调用流
```mermaid
flowchart LR
  A["Design input"] --> B["Implementation / analysis"]
```

## 6. 对外接口
- 无。

## 7. 约束与禁忌
- 不直接当作运行时配置使用。

## 8. 迁移与兼容
- 从根目录 `skills.md` 迁入。

## 9. 测试入口与验证命令
- `npm run check:readme-consistency`
