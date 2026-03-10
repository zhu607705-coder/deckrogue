# public / Static Asset Root

## 1. 功能职责 (What / Why)
存放会被 Vite 原样发布的静态资源。

## 2. 核心边界 (In / Out)
- In: 图片、图标、静态素材。
- Out: 运行时逻辑与生成缓存。

## 3. 主要文件清单 (Key Files)
- `assets/`: 发布到客户端的素材。

## 4. 模块关系 (Dependencies)
- 上游：`scripts/assets/*`
- 下游：`src/ui/components/assetHelpers.ts`

## 5. 调用流
```mermaid
flowchart LR
  A["scripts/assets"] --> B["public/assets"] --> C["UI runtime"]
```

## 6. 对外接口
- 静态 URL 资源路径。

## 7. 约束与禁忌
- 不要把临时产物写到 `public/`。

## 8. 迁移与兼容
- 根级资源策略保持不变，仅文档补齐。

## 9. 测试入口与验证命令
- `npm run build`
