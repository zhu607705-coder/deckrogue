# Deckrogue 背景音乐资源目录

此目录存放游戏所有背景音乐文件（.mp3 格式）。

## 目录结构

```
public/assets/music/
├── scene/                      # 场景背景音乐
│   ├── char_select.mp3         # 角色选择界面
│   ├── map_explore.mp3         # 地图探索
│   ├── combat_normal.mp3       # 普通战斗
│   ├── combat_elite.mp3       # 精英战斗
│   ├── combat_boss.mp3        # Boss战
│   ├── event.mp3              # 随机事件（通用）
│   ├── shop.mp3               # 商店
│   ├── rest.mp3               # 休息站点
│   ├── reward.mp3             # 奖励选择
│   ├── victory.mp3            # 胜利
│   └── game_over.mp3          # 失败
├── character/                   # 角色主题音乐
│   ├── char_informant.mp3     # 情报员
│   ├── char_brute.mp3         # 蛮战士
│   ├── char_tactician.mp3     # 战术家
│   ├── char_puppeteer.mp3     # 操控师
│   ├── char_chronomancer.mp3  # 织时者
│   ├── char_alchemist.mp3     # 炼金术士
│   ├── char_judge.mp3         # 忏罪裁断官
│   └── char_void.mp3          # 虚空封印师
├── event/                      # 事件专用音乐
│   ├── event_medicae.mp3      # 腐朽的医疗伺服站
│   ├── event_martyr.mp3       # 殉道者的骨龛
│   ├── event_warp.mp3         # 亚空间裂隙的低语
│   ├── event_inquisitor.mp3   # 异端审判官的遗物
│   ├── event_crypt.mp3        # 冷却井骨库
│   ├── event_logic.mp3        # 逻辑裁决庭
│   ├── event_servo.mp3        # 伺服圣髑库
│   ├── event_reactor.mp3      # 反应炉礼拜堂
│   ├── event_psalm.mp3        # 机颂档案馆
│   ├── event_flesh.mp3        # 血肉替换摇篮
│   ├── event_overclock.mp3    # 神圣超频台
│   ├── event_vault.mp3        # 冷却库破口
│   ├── event_confession.mp3   # 院长忏悔所
│   ├── event_terminal.mp3     # 终端静默室
│   ├── event_spore.mp3        # 孢子礼拜堂
│   ├── event_bloodmill.mp3    # 腐血磨坊
│   ├── event_orphanage.mp3    # 空壳育幼所
│   ├── event_septic.mp3       # 腐毒档案窖
│   ├── event_wedding.mp3      # 泥沼婚仪
│   ├── event_flies.mp3        # 蝇群赐礼
│   ├── event_operatory.mp3    # 腐烂手术室
│   ├── event_grave.mp3        # 墓池圣歌队
│   ├── event_larval.mp3       # 幼体孵化池
│   ├── event_sanctum.mp3      # 被吞噬的圣所
│   ├── event_corruption.mp3   # 腐化井
│   ├── event_plague.mp3       # 寂静疫潮
│   ├── event_warp_gate.mp3    # 亚空间传送门
│   ├── event_passage.mp3      # 隐藏通道
│   └── event_oracle.mp3       # 先见之神龛
└── ambient/                    # 环境音（可选）
    └── ambient_*.mp3          # 各种环境音
```

## 音乐设计说明

### 场景音乐风格要求

| 场景 | 风格 | BPM | 情绪 |
|------|------|-----|------|
| 角色选择 | 空灵神秘 | 80 | 未知感、探索 |
| 地图探索 | 紧张压抑 | 90 | 危险潜伏 |
| 普通战斗 | 激烈打击 | 140 | 紧迫感 |
| 精英战斗 | 史诗合唱 | 155 | 庄严危险 |
| Boss战 | 末日管弦 | 170 | 压倒性恐惧 |
| 随机事件 | 神秘氛围 | 70 | 未知、选择 |
| 商店 | 温暖平和 | 85 | 安慰、交易 |
| 休息 | 宁静安详 | 60 | 安全、恢复 |
| 胜利 | 凯旋高扬 | 130 | 成就感 |
| 失败 | 悲怆低鸣 | 50 | 死亡、终结 |

### 角色主题音乐风格

| 角色 | 风格 | BPM | 主题元素 |
|------|------|-----|----------|
| 情报员 | 暗影电子 | 90 | 窃听器、神秘 |
| 蛮战士 | 重金属 | 160 | 愤怒、战锤 |
| 战术家 | 军乐庄严 | 110 | 号角、阵列 |
| 操控师 | 不和谐弦乐 | 95 | 木偶线、悬疑 |
| 织时者 | 电子氛围 | 100 | 时钟、扭曲 |
| 炼金术士 | 炼金铜管 | 100 | 坩埚、反应 |
| 忏罪裁断官 | 哥特管风琴 | 120 | 审判、赎罪 |
| 虚空封印师 | 虚空低鸣 | 85 | 封印、虚无 |

### 事件音乐情绪对照

| 事件ID | 情绪 | 音乐元素 |
|--------|------|----------|
| rusting_medicae | horror | 医疗仪器声、金属摩擦 |
| nameless_martyr_shrine | devotional | 圣歌、跪拜 |
| warp_tear_whispers | chaotic | 亚空间扭曲、不和谐音 |
| inquisitor_legacy | ominous | 审判庭、钟声 |
| coolant_crypt | cold | 制冷、机械 |
| logic_tribunal | mechanical | 逻辑运算、电子音 |
| reactor_chapel | sacred | 圣诗、机械圣所 |
| spore_cathedral | organic | 霉菌、有机脉动 |
| oracle_shrine | prophetic | 水晶球、预言 |

## 技术规格

- **格式**: MP3
- **采样率**: 44.1kHz
- **比特率**: 192kbps（背景音乐）/ 320kbps（Boss战）
- **时长**: 场景音乐建议 60-120 秒循环
- **音轨**: 立体声

## 合成说明

所有背景音乐通过 Web Audio API 混合到单一主音轨：
- 每个音频层（scene/character/event/ambient/combat）有独立增益节点
- 所有层最终汇入 master gain 节点输出
- 可通过 crossfade 实现平滑过渡