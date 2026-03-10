# 新增卡牌与遗物立绘生成指南

本文档包含所有新增卡牌和遗物的 `art_prompt`，可用于 AI 图像生成工具（如 Midjourney、DALL-E、Stable Diffusion 等）生成战锤风格的立绘。

---

## 新增卡牌立绘 (7张)

### 1. Gaze of the Abyss (深渊凝视)
```
A psyker staring into a swirling purple warp portal with a demonic eye staring back, grimdark warhammer 40k style
```
**风格建议**：深紫色亚空间门户，恶魔之眼，战锤40K灵能者风格

### 2. Flesh Tentacle (血肉触手)
```
A grotesque mass of writhing flesh tentacles erupting from corrupted flesh, warhammer chaos mutation style
```
**风格建议**：混沌变异，血肉触手，战锤混沌风格

### 3. Chainsword Sweep (链锯剑轻扫)
```
A space marine chainsword sweeping through the air with teeth spinning, warhammer 40k style
```
**风格建议**：星际战士链锯剑，旋转锯齿，战锤40K风格

### 4. Awaken Machine Spirit (机魂唤醒)
```
A mechanical cogitator spirit awakening with glowing eyes in a gothic machine, warhammer mechanicus style
```
**风格建议**：机械神教风格，机魂觉醒，哥特式机械

### 5. Overheat (过载废热)
```
A mechanical component glowing red hot with steam venting, warhammer mechanicus style
```
**风格建议**：过热机械，蒸汽喷射，机械神教风格

### 6. Emperor's Wrath (帝皇之怒)
```
A space marine in golden armor surrounded by holy fire and wrath, warhammer 40k style
```
**风格建议**：金色盔甲星际战士，神圣火焰，帝皇之怒

### 7. Trial of Heretics (异端审判)
```
An inquisitor holding a flaming sword pronouncing judgment on heretics, warhammer 40k style
```
**风格建议**：审判官，火焰剑，异端审判

---

## 新增遗物立绘 (7个)

### 1. Nurgle's Blessing (纳垢的赐福)
```
A rotting green artifact with flies and disease symbols, warhammer nurgle style
```
**风格建议**：纳垢风格，腐烂绿色，苍蝇与疾病符号

### 2. Mechanicus Coolant (机械教冷却液)
```
A vial of glowing blue coolant with mechanicus symbols, warhammer 40k style
```
**风格建议**：蓝色发光液体，机械神教符号

### 3. Seal of Martyrdom (殉道者印记)
```
A red wax seal with a parchment scroll attached, purity seal warhammer 40k style
```
**风格建议**：红色蜡封，羊皮纸卷轴，纯洁印记

### 4. Seal of Exterminatus (灭绝令印记)
```
A black wax seal with skull symbol and flames, purity seal warhammer 40k style
```
**风格建议**：黑色蜡封，骷髅符号，火焰

### 5. Seal of Defiance (不屈印记)
```
A golden wax seal with shield symbol, purity seal warhammer 40k style
```
**风格建议**：金色蜡封，盾牌符号

### 6. Seal of Omnissiah (欧姆弥赛亚印记)
```
A copper wax seal with cog symbol, purity seal warhammer mechanicus style
```
**风格建议**：铜色蜡封，齿轮符号，机械神教风格

---

## 生成建议

### 图像尺寸
- **卡牌立绘**：建议 256x256 或 512x512 像素
- **遗物立绘**：建议 128x128 或 256x256 像素

### 风格关键词
- `grimdark` - 黑暗哥特风格
- `warhammer 40k` - 战锤40K风格
- `warhammer mechanicus` - 机械神教风格
- `warhammer chaos` - 混沌风格
- `warhammer nurgle` - 纳垢风格

### 文件命名
生成后请将图片保存到以下目录：
- 卡牌：`assets/cards/[card_id].png`
- 遗物：`assets/relics/[relic_id].png`

例如：
- `assets/cards/gaze_of_the_abyss.png`
- `assets/relics/nurgles_blessing.png`

---

## 使用 Stable Diffusion 示例

```bash
# 使用 Stable Diffusion WebUI 的 API
python scripts/txt2img.py --prompt "A psyker staring into a swirling purple warp portal with a demonic eye staring back, grimdark warhammer 40k style" --outdir assets/cards --n_samples 1 --W 512 --H 512
```

## 使用 Midjourney 示例

```
/imagine prompt: A psyker staring into a swirling purple warp portal with a demonic eye staring back, grimdark warhammer 40k style --ar 1:1 --v 5
```

---

## 缺失立绘清单（待生成）

### 缺失的卡牌立绘 (7张)

| 卡牌ID | 名称 | art_prompt |
|--------|------|------------|
| gaze_of_the_abyss | 深渊凝视 | A psyker staring into a swirling purple warp portal with a demonic eye staring back, grimdark warhammer 40k style |
| flesh_tentacle | 血肉触手 | A grotesque mass of writhing flesh tentacles erupting from corrupted flesh, warhammer chaos mutation style |
| chainsword_sweep | 链锯剑轻扫 | A space marine chainsword sweeping through the air with teeth spinning, warhammer 40k style |
| awaken_machine_spirit | 机魂唤醒 | A mechanical cogitator spirit awakening with glowing eyes in a gothic machine, warhammer mechanicus style |
| overheat | 过载废热 | A mechanical component glowing red hot with steam venting, warhammer mechanicus style |
| emperors_wrath | 帝皇之怒 | A space marine in golden armor surrounded by holy fire and wrath, warhammer 40k style |
| trial_of_heretics | 异端审判 | An inquisitor holding a flaming sword pronouncing judgment on heretics, warhammer 40k style |

### 缺失的遗物立绘 (7个)

| 遗物ID | 名称 | art_prompt |
|--------|------|------------|
| nurgles_blessing | 纳垢的赐福 | A rotting green artifact with flies and disease symbols, warhammer nurgle style |
| mechanicus_coolant | 机械教冷却液 | A vial of glowing blue coolant with mechanicus symbols, warhammer 40k style |
| seal_of_martyrdom | 殉道者印记 | A red wax seal with a parchment scroll attached, purity seal warhammer 40k style |
| seal_of_exterminatus | 灭绝令印记 | A black wax seal with skull symbol and flames, purity seal warhammer 40k style |
| seal_of_defiance | 不屈印记 | A golden wax seal with shield symbol, purity seal warhammer 40k style |
| seal_of_omnissiah | 欧姆弥赛亚印记 | A copper wax seal with cog symbol, purity seal warhammer mechanicus style |
| zealots_chain | 狂热者锁链 | A chain of prayer beads glowing with holy light, warhammer 40k faith style |
