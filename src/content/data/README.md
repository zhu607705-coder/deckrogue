# content/data / 静态数据层

## 1. 功能职责
提供纯 JSON 静态定义，不包含业务执行逻辑。

## 2. 核心边界
- In: 实体定义（cards/enemies/relics/potions/...）。
- Out: 任何函数、事件执行、UI 状态。

## 3. 主要文件清单
- `cards.json`, `enemies.json`, `characters.json`
- `relics.json`, `potions.json`, `achievements.json`
- `bossPhases.json`, `battleBackgrounds.json`, `worldLore.json`
- `metaBalance.json`, `numericConfig.json`

## 4. 模块关系
- 下游：`content/narrative/numericSystem.ts` 统一读取。

## 5. 数据流
```mermaid
flowchart LR
  A["JSON files"] --> B["numericSystem"] --> C["runtime systems"]
```

## 6. 对外接口
通过 `numericSystem.ts` 聚合后间接对外。

## 7. 约束与禁忌
- 禁止直接在 JSON 中存放执行代码。

## 8. 迁移与兼容
- 兼容期可读取旧索引，但新代码必须引用 `@/content/data/*`。

## 9. 测试入口与验证命令
- `npm run lint`（JSON import type check）
