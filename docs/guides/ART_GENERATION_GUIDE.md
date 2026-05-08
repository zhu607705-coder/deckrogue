# 新增卡牌与遗物立绘生成指南

本文档包含所有新增卡牌和遗物的 `art_prompt`，可用于 AI 图像生成工具生成原创黑暗哥特科幻风格的立绘。

---

## 新增卡牌立绘 (7张)

### 1. Gaze of the Abyss (深渊凝视)
```
A void-sensitive exile staring into a violet dimensional breach with a watchful abyssal eye, original grimdark gothic sci-fi style
```
**风格建议**：深紫色维度裂隙，深渊之眼，原创黑暗哥特科幻风格

### 2. Flesh Tentacle (血肉触手)
```
A grotesque mass of writhing flesh tendrils erupting from corrupted organic machinery, original body-horror gothic sci-fi style
```
**风格建议**：异化变异，血肉触须，原创身体恐怖风格

### 3. Chainsword Sweep (链锯剑轻扫)
```
A heavy industrial chain blade sweeping through smoke with spinning teeth, original cathedral-industrial sci-fi style
```
**风格建议**：工业链刃，旋转锯齿，教堂工业风格

### 4. Awaken Machine Chorus (机颂核心唤醒)
```
A dormant machine choir awakening with glowing optic cores inside a gothic industrial console
```
**风格建议**：机械圣歌，机颂核心觉醒，哥特式机械

### 5. Overheat (过载废热)
```
A mechanical component glowing red hot with steam venting, original gothic industrial sci-fi style
```
**风格建议**：过热机械，蒸汽喷射，原创工业机械风格

### 6. Oathbound Wrath (誓约之怒)
```
An anonymous oathbound champion in scorched ceremonial armor surrounded by sacred industrial fire
```
**风格建议**：仪式盔甲，神圣工业火焰，无名誓约怒火

### 7. Trial of Heretics (异端审判)
```
A masked tribunal judge holding a burning verdict blade inside a ruined cathedral court
```
**风格建议**：覆面审判者，火焰判决刃，废墟法庭

---

## 新增遗物立绘 (7个)

### 1. Rot Reliquary Blessing (腐败圣匣赐福)
```
A rotting green reliquary with flies, fungal blooms, and anonymous disease sigils
```
**风格建议**：腐败圣匣，腐烂绿色，苍蝇与疾病符号

### 2. Machine Canticle Coolant (机颂冷却液)
```
A vial of glowing blue coolant with original machine-liturgical markings
```
**风格建议**：蓝色发光液体，原创机械礼拜符号

### 3. Seal of Martyrdom (殉道者印记)
```
A red wax vow seal with a scorched parchment scroll attached, original gothic sci-fi relic
```
**风格建议**：红色蜡封，羊皮纸卷轴，誓约印记

### 4. Seal of Exterminatus (灭绝令印记)
```
A black wax verdict seal with abstract bone geometry and flames, original gothic sci-fi relic
```
**风格建议**：黑色蜡封，抽象骨纹，火焰

### 5. Seal of Defiance (不屈印记)
```
A golden wax resistance seal with a cracked shield symbol, original gothic sci-fi relic
```
**风格建议**：金色蜡封，盾牌符号

### 6. Seal of Machine Vow (万机誓印)
```
A copper wax machine-vow seal with an original cog sigil, cathedral-industrial relic
```
**风格建议**：铜色蜡封，齿轮符号，教堂工业风格

---

## 生成建议

### 图像尺寸
- **卡牌立绘**：建议 256x256 或 512x512 像素
- **遗物立绘**：建议 128x128 或 256x256 像素

### 风格关键词
- `grimdark` - 黑暗哥特风格
- `original gothic sci-fi` - 原创黑暗哥特科幻
- `cathedral industrial` - 教堂工业
- `body horror machinery` - 血肉机械异化
- `void reliquary` - 虚空圣匣

### 文件命名
生成后请将图片保存到以下目录：
- 卡牌：`assets/cards/[card_id].png`
- 遗物：`assets/relics/[relic_id].png`

例如：
- `assets/cards/gaze_of_the_abyss.png`
- `assets/relics/rot_reliquary_blessing.png`

---

## 使用 Stable Diffusion 示例

```bash
# 使用 Stable Diffusion WebUI 的 API
python scripts/txt2img.py --prompt "A void-sensitive exile staring into a violet dimensional breach with a watchful abyssal eye, original grimdark gothic sci-fi style" --outdir assets/cards --n_samples 1 --W 512 --H 512
```

## 使用 Midjourney 示例

```
/imagine prompt: A void-sensitive exile staring into a violet dimensional breach with a watchful abyssal eye, original grimdark gothic sci-fi style --ar 1:1 --v 5
```

---

## 缺失立绘清单（待生成）

### 缺失的卡牌立绘 (7张)

| 卡牌ID | 名称 | art_prompt |
|--------|------|------------|
| gaze_of_the_abyss | 深渊凝视 | A void-sensitive exile staring into a violet dimensional breach with a watchful abyssal eye, original grimdark gothic sci-fi style |
| flesh_tentacle | 血肉触手 | A grotesque mass of writhing flesh tendrils erupting from corrupted organic machinery, original body-horror gothic sci-fi style |
| chainsword_sweep | 链锯剑轻扫 | A heavy industrial chain blade sweeping through smoke with spinning teeth, original cathedral-industrial sci-fi style |
| awaken_machine_chorus | 机颂核心唤醒 | A dormant machine choir awakening with glowing optic cores inside a gothic industrial console |
| overheat | 过载废热 | A mechanical component glowing red hot with steam venting, original gothic industrial sci-fi style |
| oathbound_wrath | 誓约之怒 | An anonymous oathbound champion in scorched ceremonial armor surrounded by sacred industrial fire |
| trial_of_heretics | 异端审判 | A masked tribunal judge holding a burning verdict blade inside a ruined cathedral court |

### 缺失的遗物立绘 (7个)

| 遗物ID | 名称 | art_prompt |
|--------|------|------------|
| rot_reliquary_blessing | 腐败圣匣赐福 | A rotting green reliquary with flies, fungal blooms, and anonymous disease sigils |
| machine_canticle_coolant | 机械冷却液 | A vial of glowing blue coolant with original machine-liturgical markings |
| seal_of_martyrdom | 殉道者印记 | A red wax vow seal with a scorched parchment scroll attached, original gothic sci-fi relic |
| seal_of_exterminatus | 灭绝令印记 | A black wax verdict seal with abstract bone geometry and flames, original gothic sci-fi relic |
| seal_of_defiance | 不屈印记 | A golden wax resistance seal with a cracked shield symbol, original gothic sci-fi relic |
| seal_of_machine_vow | 万机誓印 | A copper wax machine-vow seal with an original cog sigil, cathedral-industrial relic |
| zealots_chain | 狂热者锁链 | A chain of oath beads glowing with sacred industrial light, original gothic sci-fi faith style |
