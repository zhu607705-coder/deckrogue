# 地图背景设置指南

## 如何添加地图背景

1. 将您的地图背景图片保存为:
   ```
   /Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/backgrounds/bg_dark_map.png
   ```

2. 图片已设置为:
   - 背景覆盖整个地图界面 (`bg-cover`)
   - 居中对齐 (`bg-center`)
   - 添加了黑色渐变叠加层以提高文字可读性
   - 添加了装饰性光晕效果
   - 添加了羊皮纸纹理效果

3. 刷新游戏即可看到新背景！

## 已有的背景图片

项目中已经包含以下原创黑暗哥特科幻背景:

| 文件名 | 风格 |
|--------|------|
| `bg_void_breach.png` | 熵变扭曲 |
| `bg_starless_archive.png` | 无星档案库 |
| `bg_gothic_battlefield.png` | 哥特战场 |
| `bg_oathbound_palace.png` | 誓约宫庭 |
| `bg_iron_chapel_forge.png` | 铁礼拜锻炉 |
| `bg_ancient_machine_tomb.png` | 远古机械墓室 |
| `bg_plague_garden.png` | 瘟疫花园 |
| `bg_martyr_chapel.png` | 殉道者礼拜堂 |

## 修改背景

如需使用其他背景，修改 `src/ui/MapView.tsx` 第 129 行:

```typescript
backgroundImage: 'url("/assets/backgrounds/你的背景图片.png")',
```

## 调整效果

您可以在 `MapView.tsx` 中调整:

- 背景不透明度: 调整 `bg-gradient-to-b from-black/70 via-black/50 to-black/80` 中的数值
- 光晕位置: 修改 `absolute top-0 left-1/4` 等位置
- 光晕大小: 修改 `w-[600px] h-[600px]` 等尺寸
