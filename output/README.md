# output / Generated Outputs

## 1. 功能职责 (What / Why)
存放本地生成的调试截图、自动化运行输出和临时结果。

## 2. 核心边界 (In / Out)
- In: 过程性输出。
- Out: 源码、正式静态资源。

## 3. 主要文件清单 (Key Files)
- `playwright/`: 浏览器自动化相关输出。

## 4. 模块关系 (Dependencies)
- 上游：`scripts/*`, `.playwright-cli/*`
- 下游：人工排查与报告引用。

## 5. 调用流
```mermaid
flowchart LR
  A["automation/scripts"] --> B["output/"] --> C["manual inspection"]
```

## 6. 对外接口
- 无稳定接口。

## 7. 约束与禁忌
- 不要把运行时依赖文件放到这里。

## 8. 迁移与兼容
- 保持为工作输出目录，不纳入运行时模块。

## 9. 测试入口与验证命令
- 无固定命令；按工具链生成。
