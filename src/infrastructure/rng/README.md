# infrastructure/rng / 随机数系统

## 1. 功能职责
提供可复现随机源与基于 GameState 的随机辅助。

## 2. 核心边界
- In: seed RNG、状态绑定 RNG、系统随机。
- Out: 业务分支决策。

## 3. 主要文件清单
- `rng.ts`: 通用可播种 RNG。
- `stateRandom.ts`: 与 `GameState` 绑定的随机函数。
- `systemRandom.ts`: 系统级随机工具。

## 4. 模块关系
- 上游：`core/types`。
- 下游：`engine`, `core/events/runGenerator`, `features/*`。

## 5. 调用流
```mermaid
flowchart LR
  A["seed"] --> B["createRNG"] --> C["bindStateRng/stateRandom*"] --> D["runtime systems"]
```

## 6. 对外接口
- `createRNG`
- `bindStateRng`, `stateRandomInt`, `stateRandomChoice`, `stateShuffle`, `stateRandomId`
- `systemRandomInt`

## 7. 约束与禁忌
- 所有战斗内随机必须优先使用 `stateRandom*` 保证可回放性。

## 8. 迁移与兼容
- 原 `utils` 随机工具已归并到本目录。

## 9. 测试入口与验证命令
- `npm run lint`
- `npm run diag:numeric -- --runs=1`
