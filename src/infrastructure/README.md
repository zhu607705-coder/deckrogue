# infrastructure 模块 / Technical Infrastructure

## 1. 功能职责
提供跨模块通用、与业务无关的技术能力，当前以 RNG 为主。

## 2. 核心边界
- In: 随机源、随机辅助函数。
- Out: 战斗公式、内容规则。

## 3. 主要文件清单
- `rng/` 子分区（详见 `rng/README.md`）

## 4. 模块关系
- 上游：无。
- 下游：`core`, `features`, `engine`。

## 5. 调用流
```mermaid
flowchart LR
  A["seed / state"] --> B["rng module"] --> C["combat/events/progression"]
```

## 6. 对外接口
通过 `@/infrastructure/rng/*` 提供。

## 7. 约束与禁忌
- 禁止在基础设施层引入业务逻辑。

## 8. 迁移与兼容
- 旧 `utils/systemRandom` 迁移为 `infrastructure/rng/systemRandom.ts`。

## 9. 测试入口与验证命令
- `npm run lint`
