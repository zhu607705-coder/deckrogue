# 地图图标设置指南

## 图标配对

根据您提供的图片，配对如下：

| 顺序 | 图标内容 | 房间类型 | 文件名 |
|-----|---------|---------|--------|
| 1 | ⚔️ 交叉双剑 | Combat (战斗) | `map_combat.png` |
| 2 | 💀 恶魔骷髅 | Elite (精英) | `map_elite.png` |
| 3 | 📜 魔法卷轴 | Event (事件) | `map_event.png` |
| 4 | 💰 金币袋 | Shop (商店) | `map_shop.png` |
| 5 | 🔥 篝火帐篷 | Rest (休息) | `map_rest.png` |

## 缺少的图标

**Boss (领主)** 房间图标缺失。

建议：
- 使用 👑 皇冠或 ☠️ 骷髅王冠作为 Boss 图标
- 颜色：深红色 (#b91c1c)
- 风格：与其他图标一致

## 手动替换步骤

1. 右键点击您提供的图片
2. 选择 "图片另存为..."
3. 按顺序保存到以下路径：

```
/Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/map/
├── map_combat.png  (第1个图标 - 双剑)
├── map_elite.png   (第2个图标 - 恶魔骷髅)
├── map_event.png   (第3个图标 - 魔法卷轴)
├── map_shop.png    (第4个图标 - 金币袋)
├── map_rest.png    (第5个图标 - 篝火帐篷)
└── map_boss.png    (需要额外生成 - 建议皇冠)
```

## 代码已更新

MapView.tsx 已配置为使用 PNG 格式，替换文件后游戏会自动显示新图标。
