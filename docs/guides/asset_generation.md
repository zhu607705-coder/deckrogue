# DeckRogue 地图图标生成指南

## 概述
本文档提供为 DeckRogue 游戏生成地图房间图标的详细指南。

## 房间类型与图标规范

### 1. Combat (普通战斗)
- **文件名**: `map_combat.png`
- **颜色主题**: 红色 (#dc2626)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, crossed swords symbol, dark fantasy style, 
red glow effect, black background with red gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, sharp edges, glowing outline
```

### 2. Elite (精英战斗)
- **文件名**: `map_elite.png`
- **颜色主题**: 琥珀色 (#f59e0b)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, elite monster skull with horns, dark fantasy style, 
amber orange glow effect, black background with orange gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, dangerous aura, spiked border
```

### 3. Event (随机事件)
- **文件名**: `map_event.png`
- **颜色主题**: 紫色 (#a855f7)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, mysterious scroll with magic runes, dark fantasy style, 
purple glow effect, black background with purple gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, question mark symbol, magical particles
```

### 4. Shop (商店)
- **文件名**: `map_shop.png`
- **颜色主题**: 黄色 (#eab308)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, merchant bag with gold coins, dark fantasy style, 
golden yellow glow effect, black background with gold gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, coin sparkles, treasure chest elements
```

### 5. Rest (休息点)
- **文件名**: `map_rest.png`
- **颜色主题**: 橙色 (#f97316)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, campfire with tent silhouette, dark fantasy style, 
warm orange glow effect, black background with orange gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, smoke wisps, cozy atmosphere
```

### 6. Boss (Boss 战)
- **文件名**: `map_boss.png`
- **颜色主题**: 深红色 (#b91c1c)
- **尺寸**: 128x128px
- **背景**: 透明
- **AI 提示词**:
```
Game map node icon, dark crown with ominous skull, dark fantasy style, 
crimson red glow effect, black background with dark red gradient border, 
minimalist design, roguelike game UI, 128x128 pixels, 
PNG with transparent background, boss aura, intimidating presence
```

## 风格统一规范

### 视觉风格
- **艺术风格**: 暗色幻想 (Dark Fantasy)
- **设计原则**: 极简主义，高对比度
- **边框**: 2-3px 发光边框，与主题色一致
- **背景**: 深黑色 (#1a1a2e) 渐变到透明

### 技术规范
- **格式**: PNG
- **尺寸**: 128x128 像素
- **透明背景**: 是
- **色彩空间**: sRGB

## 生成工具推荐

### 1. Midjourney
```
/imagine prompt: [上方提示词] --v 6 --style raw --ar 1:1
```

### 2. DALL-E 3 (ChatGPT)
直接复制上方提示词即可

### 3. Stable Diffusion
- **模型**: Realistic Vision V5.1 或类似
- **CFG Scale**: 7-8
- **Steps**: 30-40
- **Sampler**: DPM++ 2M Karras

## 输出目录
生成后的图片应放置在:
```
/public/assets/map/
├── map_combat.png
├── map_elite.png
├── map_event.png
├── map_shop.png
├── map_rest.png
└── map_boss.png
```

## 代码集成

图标生成后，游戏代码会自动加载。确保文件名与 `MapView.tsx` 中的 `getNodeImage` 函数对应:

```typescript
const getNodeImage = (type: string): string => {
  switch (type) {
    case 'Combat': return '/assets/map/map_combat.png';
    case 'Elite': return '/assets/map/map_elite.png';
    case 'Event': return '/assets/map/map_event.png';
    case 'Shop': return '/assets/map/map_shop.png';
    case 'Rest': return '/assets/map/map_rest.png';
    case 'Boss': return '/assets/map/map_boss.png';
    default: return '/assets/map/map_combat.png';
  }
};
```

## 注意事项

1. 保持所有图标风格一致
2. 确保图标在小尺寸下依然清晰可辨
3. 发光效果不要过度，避免视觉疲劳
4. 测试图标的可访问性（色盲友好）
