import type { StoryEventDef } from '@/core';

export const STORY_EVENTS: StoryEventDef[] = [
  {
    id: 'rusting_medicae',
    title: '腐朽的医疗伺服站',
    imagePath: '/assets/events/event_forge.png',
    floorMin: 1,
    floorMax: 3,
    weight: 1.2,
    loreText: [
      '空气中弥漫着防腐剂与陈年血块的恶臭。一台医疗伺服机甲被生锈的链条半吊在天花板上，半边机械脑壳闪烁着惨绿色的光。',
      '地上散落着几具基因排异后扭曲的尸体。机械臂夹着一管浑浊药剂，破碎的合成音不断重复：“血肉苦弱……需要替换……”'
    ],
    options: [
      {
        id: 'medicae_implant',
        text: '[接受植入手术]',
        description: '让生锈的锯条切开你的骨血。',
        gains: ['最大生命值 +10', '获得奇物《锈蚀植入体》（每场战斗开始时 +1 力量）'],
        costs: ['失去 25% 当前生命值', '牌库加入诅咒《排异反应》'],
        danger: 'high'
      },
      {
        id: 'medicae_extract',
        text: '[抽取它的精华]',
        description: '将药剂抽干，不要管里面的杂质。',
        gains: ['获得 2 瓶随机强力药水', '恢复 30% 最大生命值'],
        costs: ['最大生命值 -5', '腐化值 +20'],
        danger: 'medium'
      },
      {
        id: 'medicae_salvage',
        text: '[拆解伺服机甲]',
        description: '敲碎它的脑壳，搜刮有价值的零件。',
        gains: ['获得 100 金币', '获得 1 件随机普通奇物'],
        costs: ['随后必须选择：迎战精英 或 承受 15 点不可减免伤害撤离'],
        danger: 'high'
      }
    ]
  },
  {
    id: 'nameless_martyr_shrine',
    title: '殉道者的骨龛',
    imagePath: '/assets/events/event_shrine.png',
    floorMin: 2,
    floorMax: 5,
    weight: 1.0,
    loreText: [
      '神龛隐藏在巢都下水道深处。没有名字，只有一具穿着精工动力甲的骸骨跪在祭坛前，胸口被高能射线贯穿。',
      '骨骸双手仍死死握着一把链锯剑。祭坛上的哥特语被鲜血涂抹得支离破碎：“献上你所珍视之物，证明你的虔诚。”'
    ],
    options: [
      {
        id: 'martyr_offer_blood',
        text: '[献上鲜血]',
        description: '在祭坛前割开手腕，让鲜血浇灌骸骨。',
        gains: ['获得稀有奇物《殉道者之印》（生命越低伤害越高）'],
        costs: ['永久失去 33% 最大生命值'],
        danger: 'high'
      },
      {
        id: 'martyr_offer_wealth',
        text: '[献上财富]',
        description: '把钱袋倒在祭坛前，铜臭味或许能买来救赎。',
        gains: ['移除 2 张牌（事件免费移除）'],
        costs: ['失去所有金币；若金币 < 50，额外加入诅咒《贪婪之罪》'],
        danger: 'medium'
      },
      {
        id: 'martyr_desecrate',
        text: '[亵渎与掠夺]',
        description: '死人不需要武器。把那把剑掰下来。',
        gains: ['获得升级攻击牌《处决斩击》'],
        costs: ['虔诚值清零', '下场战斗亚空间潮汐 +30'],
        danger: 'high'
      }
    ]
  },
  {
    id: 'warp_tear_whispers',
    title: '亚空间裂隙的低语',
    imagePath: '/assets/events/event_warp.png',
    floorMin: 4,
    floorMax: 7,
    weight: 0.9,
    loreText: [
      '现实的帷幕在这里像湿透的羊皮纸一样被撕裂。裂隙边缘闪烁着违背物理法则的紫色闪电。',
      '你听不到声音，但脑海里却响起千万人同时哀嚎与欢愉的回声。某个不可名状的意志正在翻阅你的记忆。'
    ],
    options: [
      {
        id: 'tear_embrace',
        text: '[拥抱亚空间]',
        description: '将你的基础技艺交给虚空，换取扭曲后的毁灭。',
        gains: ['牌库中所有基础牌（打击/防御）转化为随机非基础牌（非普通）'],
        costs: ['腐化值立刻达到 100', '接下来 3 场战斗开局获得恐惧与脆弱'],
        danger: 'high'
      },
      {
        id: 'tear_bargain',
        text: '[虚空交易]',
        description: '闭着眼伸手进去，摸索有价值的残骸。',
        gains: ['获得 1 件强大的亚空间/混沌奇物'],
        costs: ['随机永久摧毁 1 张非基础牌'],
        danger: 'medium'
      },
      {
        id: 'tear_seal',
        text: '[以纯洁之名封印]',
        description: '用意志把裂隙硬生生缝合。',
        gains: ['虔诚值 +50', '清除待结算的亚空间潮汐增幅'],
        costs: ['牌库加入诅咒《灵能反噬》'],
        danger: 'medium'
      }
    ]
  },
  {
    id: 'inquisitor_legacy',
    title: '异端审判官的遗物',
    imagePath: '/assets/events/event_trial.png',
    floorMin: 5,
    floorMax: 9,
    weight: 0.8,
    loreText: [
      '一具穿着黑色风衣的尸体倚靠在墙角，胸口挂着审判庭玫瑰念珠。他的致命伤来自背后，匕首沿着肋骨缝隙直入心脏。',
      '他手里攥着一本人皮装订的密码本，旁边放着被重重封印的静滞匣。墙上的血字只写到一半：“真相是毒药……不要打开……”'
    ],
    options: [
      {
        id: 'legacy_open_casket',
        text: '[破除静滞匣的封印]',
        description: '好奇心是异端的温床，但这力量太诱人了。',
        gains: ['获得奇物《混沌圣物》（每打出一张牌随机伤害敌人）'],
        costs: ['立刻失去 50% 当前生命值', '后续遭遇敌人获得追杀增幅（生命/伤害更高）'],
        danger: 'high'
      },
      {
        id: 'legacy_read_codex',
        text: '[阅读人皮密码本]',
        description: '翻开浸满血污的书页，直视深渊。',
        gains: ['Intel +30', '揭示地图全部未知节点'],
        costs: ['最大生命值 -10', '牌库加入诅咒《妄想狂》（移除费用翻倍）'],
        danger: 'medium'
      },
      {
        id: 'legacy_take_rosary',
        text: '[只拿走玫瑰念珠]',
        description: '不去触碰禁忌，只带走信仰的象征。',
        gains: ['获得奇物《审判官玫瑰》（战斗开始获得格挡）'],
        costs: ['受到 10 点伤害'],
        danger: 'low'
      }
    ]
  },
  {
    id: 'coolant_crypt',
    title: '冷却井骨库',
    imagePath: '/assets/events/coolant_crypt.webp',
    floorMin: 11,
    floorMax: 13,
    weight: 1,
    loreText: [
      '古老的冷却井中堆满了历代机械朝圣者的残骸。井中的冷却液仍然有效，只是混杂了太多不应存在的东西。',
      '井壁上刻着古老的铭文：冷却是救赎，冻结是解脱。'
    ],
    options: [
      {
        id: 'coolant_crypt_purify',
        text: '[净化冷液]',
        description: '恢复 25% 最大生命，最大生命 -4',
        gains: ["Heal 25% Max HP"],
        costs: ["-4 Max HP"],
        danger: 'low'
      },
      {
        id: 'coolant_crypt_steal',
        text: '[窃取冷凝芯]',
        description: '获得遗物 coolant_spine，失去 14 当前生命',
        gains: ["coolant_spine"],
        costs: ["14 HP"],
        danger: 'medium'
      },
      {
        id: 'coolant_crypt_valve',
        text: '[拆取阀门]',
        description: '获得 90 金，下场战斗开局 1 Frail',
        gains: ["90 gold"],
        costs: ["Next combat start with 1 Frail"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'logic_tribunal',
    title: '逻辑裁决庭',
    imagePath: '/assets/events/logic_tribunal.webp',
    floorMin: 12,
    floorMax: 15,
    weight: 1,
    loreText: [
      '巨大的机械法庭中，逻辑圣者的代理人正在审判着闯入者。证据在这里具有绝对的分量。',
      '问题是：你愿意为什么样的真相付出代价？'
    ],
    options: [
      {
        id: 'logic_tribunal_prove',
        text: '[自证清白]',
        description: '移除 1 张牌，失去所有金币',
        gains: ["Remove 1 card"],
        costs: ["Lose all gold"],
        danger: 'medium'
      },
      {
        id: 'logic_tribunal_forge',
        text: '[伪造证词]',
        description: '获得 140 金，加入诅咒伪证烙印',
        gains: ["140 gold", "Curse: Perjury Stigma"],
        costs: ["Curse"],
        danger: 'high'
      },
      {
        id: 'logic_tribunal_seize',
        text: '[夺取判例卷轴]',
        description: '任选 1 张共享控制牌，最大生命 -8',
        gains: ["1 shared control card"],
        costs: ["-8 Max HP"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'servo_reliquary',
    title: '伺服圣髑库',
    imagePath: '/assets/events/servo_reliquary.webp',
    floorMin: 13,
    floorMax: 16,
    weight: 1,
    loreText: [
      '伺服圣髑库中陈列着历代院长的机械圣髑。每一件遗物都蕴含着独特的力量。',
      '但圣髑库的管理者警告你：带走圣髑的代价往往是无法预见的。'
    ],
    options: [
      {
        id: 'servo_reliquary_open',
        text: '[开启圣柜]',
        description: '三选一新遗物',
        gains: ["Choose 1 of 3 relics"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'servo_reliquary_search',
        text: '[谨慎搜刮]',
        description: '获得 1 药水和 80 金',
        gains: ["1 potion", "80 gold"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'servo_reliquary_burn',
        text: '[焚毁遗物]',
        description: '升级 1 张牌，失去 10 生命',
        gains: ["Upgrade 1 card"],
        costs: ["10 HP"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'reactor_chapel',
    title: '反应炉礼拜堂',
    imagePath: '/assets/events/reactor_chapel.webp',
    floorMin: 14,
    floorMax: 17,
    weight: 1,
    loreText: [
      '反应炉礼拜堂是机械圣所最神圣的地方。熔融的能量在祭坛周围循环，为信徒提供力量。',
      '祭司警告你：神圣的能量总是有代价的。'
    ],
    options: [
      {
        id: 'reactor_chapel_sacrifice',
        text: '[献上血肉]',
        description: '获得 sacred_reactor_shard，失去 18% 最大生命',
        gains: ["sacred_reactor_shard"],
        costs: ["18% Max HP"],
        danger: 'high'
      },
      {
        id: 'reactor_chapel_shutdown',
        text: '[关闭反应炉]',
        description: '清除 1 张诅咒，恢复 18 生命',
        gains: ["Remove 1 curse", "Heal 18 HP"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'reactor_chapel_steal',
        text: '[偷取燃料棒]',
        description: '获得 1 稀有共享牌，后续 2 战开局 1 Vulnerable',
        gains: ["1 rare shared card"],
        costs: ["Next 2 combats start with 1 Vulnerable"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'machine_psalm_archive',
    title: '机颂档案馆',
    imagePath: '/assets/events/machine_psalm_archive.webp',
    floorMin: 11,
    floorMax: 15,
    weight: 1,
    loreText: [
      '机颂档案馆中收藏着机械圣所的全部历史。数据流在书架间穿梭，记录着每一个真理。',
      '档案馆的管理者可以向你揭示真相，代价是历史本身的完整性。'
    ],
    options: [
      {
        id: 'machine_psalm_copy',
        text: '[抄录圣歌]',
        description: '揭示第 2 章全部节点，获得 60 金',
        gains: ["Reveal all Chapter 2 nodes", "60 gold"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'machine_psalm_alter',
        text: '[篡改记录]',
        description: '获得 25 Intel 或角色主资源等值收益，最大生命 -6',
        gains: ["25 Intel or primary resource equivalent"],
        costs: ["-6 Max HP"],
        danger: 'medium'
      },
      {
        id: 'machine_psalm_tear',
        text: '[撕毁残卷]',
        description: '移除 1 个 debuff 型 relic 负面状态一次',
        gains: ["Remove 1 relic debuff once"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'flesh_replacement_cradle',
    title: '血肉替换摇篮',
    imagePath: '/assets/events/flesh_replacement_cradle.webp',
    floorMin: 12,
    floorMax: 16,
    weight: 1,
    loreText: [
      '血肉替换摇篮是机械与肉体融合的圣地。朝圣者在这里将脆弱的血肉替换为冰冷的机械。',
      '但这种替换并非没有代价：新的机械总是需要某种形式的维护。'
    ],
    options: [
      {
        id: 'flesh_replacement_accept',
        text: '[接受置换]',
        description: '最大生命 +8，加入 1 诅咒',
        gains: ["+8 Max HP"],
        costs: ["1 curse"],
        danger: 'medium'
      },
      {
        id: 'flesh_replacement_dismantle',
        text: '[强行拆解]',
        description: '获随机普通遗物，失去 20 生命',
        gains: ["Random common relic"],
        costs: ["20 HP"],
        danger: 'medium'
      },
      {
        id: 'flesh_replacement_refuse',
        text: '[拒绝仪式]',
        description: '获得 1 药水和 40 金',
        gains: ["1 potion", "40 gold"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'sacred_overclock',
    title: '神圣超频台',
    imagePath: '/assets/events/sacred_overclock.webp',
    floorMin: 14,
    floorMax: 17,
    weight: 1,
    loreText: [
      '神圣超频台可以让任何卡牌突破极限。但超频的代价是卡牌本身以及使用者身体的透支。',
      '祭司警告你：超频不是没有风险的。'
    ],
    options: [
      {
        id: 'sacred_overclock_attack',
        text: '[超频攻击牌]',
        description: '升级并赋予本章 +2 伤害，失去 8 生命',
        gains: ["Upgrade 1 attack card, +2 damage this chapter"],
        costs: ["8 HP"],
        danger: 'medium'
      },
      {
        id: 'sacred_overclock_skill',
        text: '[超频技能牌]',
        description: '首次使用费用 -1，失去 8 生命',
        gains: ["First use this chapter costs 1 less"],
        costs: ["8 HP"],
        danger: 'medium'
      },
      {
        id: 'sacred_overclock_resist',
        text: '[保持克制]',
        description: '获得 70 金',
        gains: ["70 gold"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'cooling_vault_breach',
    title: '冷却库破口',
    imagePath: '/assets/events/cooling_vault_breach.webp',
    floorMin: 15,
    floorMax: 17,
    weight: 1,
    loreText: [
      '冷却库的破口处，珍贵的能量正在泄漏。守卫的缺位意味着机会，但也有危险。',
      '你可以选择立即行动，或者安全撤离。'
    ],
    options: [
      {
        id: 'cooling_vault_fight',
        text: '[立即战斗]',
        description: '对战 reactor_thrall + coolant_hound，胜利获 1 稀有遗物',
        gains: ["Fight for 1 rare relic"],
        costs: ["Immediate combat"],
        danger: 'high'
      },
      {
        id: 'cooling_vault_smuggle',
        text: '[偷运离开]',
        description: '获得 110 金，承受 12 不可减免伤害',
        gains: ["110 gold"],
        costs: ["12 unblockable damage"],
        danger: 'medium'
      },
      {
        id: 'cooling_vault_seal',
        text: '[封闭缺口]',
        description: '恢复 10 生命，升级 1 张技能牌',
        gains: ["Heal 10 HP", "Upgrade 1 skill card"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'abbot_confession',
    title: '院长忏悔所',
    imagePath: '/assets/events/abbot_confession.webp',
    floorMin: 13,
    floorMax: 17,
    weight: 1,
    loreText: [
      '院长忏悔所是机械圣所最私密的地方。每一个忏悔都会被记录，但也会被保密。',
      '院长愿意倾听你的忏悔，并给予你救赎或惩罚。'
    ],
    options: [
      {
        id: 'abbot_confession_listen',
        text: '[聆听忏悔]',
        description: '移除 2 张牌，失去所有金币',
        gains: ["Remove 2 cards"],
        costs: ["Lose all gold"],
        danger: 'medium'
      },
      {
        id: 'abbot_confession_interrogate',
        text: '[逼问秘密]',
        description: '三选一新共享牌，失去 12 生命',
        gains: ["Choose 1 of 3 shared cards"],
        costs: ["12 HP"],
        danger: 'medium'
      },
      {
        id: 'abbot_confession_expose',
        text: '[公开其罪]',
        description: '下场精英战敌人开局 1 Weak',
        gains: ["Next elite starts with 1 Weak"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'terminal_silence',
    title: '终端静默室',
    imagePath: '/assets/events/terminal_silence.webp',
    floorMin: 16,
    floorMax: 17,
    weight: 1,
    loreText: [
      '终端静默室是机械圣所最神圣的地方。在这里，沉默比言语更有力量。',
      '终端正在等待你的选择。'
    ],
    options: [
      {
        id: 'terminal_silence_connect',
        text: '[接入终端]',
        description: '三选一章节稀有牌，加入 1 诅咒',
        gains: ["Choose 1 of 3 chapter rare cards"],
        costs: ["1 curse"],
        danger: 'medium'
      },
      {
        id: 'terminal_silence_disconnect',
        text: '[切断电源]',
        description: '获得 penitent_cooling_mask，失去 1 药水',
        gains: ["penitent_cooling_mask"],
        costs: ["Lose 1 potion"],
        danger: 'medium'
      },
      {
        id: 'terminal_silence_leave',
        text: '[无声离开]',
        description: '无收益，但清除待结算章节 debuff 一次',
        gains: ["Clear 1 chapter debuff once"],
        costs: [],
        danger: 'low'
      },
    ]
  }
,
  {
    id: 'spore_cathedral',
    title: '孢子礼拜堂',
    imagePath: '/assets/events/spore_cathedral.webp',
    floorMin: 19,
    floorMax: 21,
    weight: 1,
    loreText: [
      '孢子礼拜堂是一个被巨大蘑菇覆盖的废墟。空气中弥漫着孢子和腐败的气息。',
      '朝圣者在这里寻找治愈，但往往得到的更多是诅咒。'
    ],
    options: [
      {
        id: 'spore_cathedral_inhale',
        text: '[吸入圣雾]',
        description: '恢复 22% 最大生命但加入 1 诅咒',
        gains: ["Heal 22% Max HP"],
        costs: ["1 curse"],
        danger: 'medium'
      },
      {
        id: 'spore_cathedral_pick',
        text: '[摘取菌冠]',
        description: '获遗物 spore_lantern 并失去 12 当前生命',
        gains: ["spore_lantern"],
        costs: ["12 HP"],
        danger: 'medium'
      },
      {
        id: 'spore_cathedral_burn',
        text: '[焚烧祭坛]',
        description: '获得 90 金',
        gains: ["90 gold"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'blood_mill',
    title: '腐血磨坊',
    imagePath: '/assets/events/blood_mill.webp',
    floorMin: 19,
    floorMax: 22,
    weight: 1,
    loreText: [
      '腐血磨坊是一个巨大的机械结构，用于碾碎血肉并提取有价值的液体。',
      '这里的机器仍在运转，尽管操作者早已消亡。'
    ],
    options: [
      {
        id: 'blood_mill_donate',
        text: '[献血换药]',
        description: '恢复 18 生命并移除 1 debuff',
        gains: ["Heal 18 HP", "Remove 1 debuff"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'blood_mill_steal',
        text: '[强取萃取液]',
        description: '获得 2 药水，最大生命 -5',
        gains: ["2 potions"],
        costs: ["-5 Max HP"],
        danger: 'medium'
      },
      {
        id: 'blood_mill_destroy',
        text: '[拆毁磨坊]',
        description: '获得 110 金并下场战斗开局 1 Weak',
        gains: ["110 gold"],
        costs: ["Next combat start with 1 Weak"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'husk_orphanage',
    title: '空壳育幼所',
    imagePath: '/assets/events/husk_orphanage.webp',
    floorMin: 20,
    floorMax: 22,
    weight: 1,
    loreText: [
      '空壳育幼所曾经是照顾流民幼儿的地方，现在只剩下空壳和废墟。',
      '但仍有生命迹象...'
    ],
    options: [
      {
        id: 'husk_orphanage_purify',
        text: '[净化幼体]',
        description: '升级 1 张技能牌',
        gains: ["Upgrade 1 skill card"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'husk_orphanage_keep',
        text: '[保留样本]',
        description: '获得 1 稀有共享牌并加入 1 诅咒',
        gains: ["1 rare shared card"],
        costs: ["1 curse"],
        danger: 'medium'
      },
      {
        id: 'husk_orphanage_burn',
        text: '[全部焚毁]',
        description: '失去 10 生命但下场精英战敌人开局 1 Weak',
        gains: ["Next elite starts with 1 Weak"],
        costs: ["10 HP"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'septic_archive',
    title: '腐毒档案窖',
    imagePath: '/assets/events/septic_archive.webp',
    floorMin: 20,
    floorMax: 23,
    weight: 1,
    loreText: [
      '腐毒档案窖收藏着这片土地的所有历史和秘密。',
      '档案管理员已经变成了某种腐败的存在，但仍愿意交易。'
    ],
    options: [
      {
        id: 'septic_archive_copy',
        text: '[抄录禁书]',
        description: '揭示地图并获 Intel +20 或角色主资源等值收益',
        gains: ["Reveal map", "20 Intel or primary resource"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'septic_archive_sell',
        text: '[贩卖档案]',
        description: '获得 140 金',
        gains: ["140 gold"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'septic_archive_destroy',
        text: '[毁掉卷宗]',
        description: '移除 1 张牌并失去所有金币',
        gains: ["Remove 1 card"],
        costs: ["Lose all gold"],
        danger: 'high'
      },
    ]
  },
  {
    id: 'mire_wedding',
    title: '泥沼婚仪',
    imagePath: '/assets/events/mire_wedding.webp',
    floorMin: 21,
    floorMax: 24,
    weight: 1,
    loreText: [
      '泥沼婚仪是一种古老的仪式，新人会在泥沼中结合，以获得永恒的力量。',
      '但这力量是有代价的...'
    ],
    options: [
      {
        id: 'mire_wedding_accept',
        text: '[接受婚契]',
        description: '获 relic marsh_vows 并加入 1 诅咒',
        gains: ["marsh_vows"],
        costs: ["1 curse"],
        danger: 'medium'
      },
      {
        id: 'mire_wedding_grab',
        text: '[抢夺供品]',
        description: '获得 1 药水 + 80 金',
        gains: ["1 potion", "80 gold"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'mire_wedding_interrupt',
        text: '[打断仪式]',
        description: '立即战斗，胜利获升级',
        gains: ["Immediate combat for upgrade"],
        costs: ["Immediate combat"],
        danger: 'high'
      },
    ]
  },
  {
    id: 'blessing_of_flies',
    title: '蝇群赐礼',
    imagePath: '/assets/events/blessing_of_flies.webp',
    floorMin: 22,
    floorMax: 24,
    weight: 1,
    loreText: [
      '蝇群是腐败的象征，但在瘟疫中，它们也带来了某种祝福。',
      '只要你能承受它们的伴随...'
    ],
    options: [
      {
        id: 'blessing_of_flies_accept',
        text: '[承受赐礼]',
        description: '获 1 稀有 relic 并在后续 3 战开局 1 Poison',
        gains: ["1 rare relic"],
        costs: ["Next 3 combats start with 1 Poison"],
        danger: 'high'
      },
      {
        id: 'blessing_of_flies_reject',
        text: '[拒绝]',
        description: '恢复 10 生命',
        gains: ["Heal 10 HP"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'blessing_of_flies_dispel',
        text: '[驱散]',
        description: '失去 8 生命并移除 1 诅咒',
        gains: ["Remove 1 curse"],
        costs: ["8 HP"],
        danger: 'medium'
      },
    ]
  },
  {
    id: 'rotted_operatory',
    title: '腐烂手术室',
    imagePath: '/assets/events/rotted_operatory.webp',
    floorMin: 21,
    floorMax: 25,
    weight: 1,
    loreText: [
      '腐烂手术室曾经是进行生命延续实验的地方。',
      '现在只剩下残骸和一些仍在运作的机器。'
    ],
    options: [
      {
        id: 'rotted_operatory_suture',
        text: '[接受缝合]',
        description: '最大生命 +7，随机删去 1 张普通牌',
        gains: ["+7 Max HP"],
        costs: ["Remove 1 common card"],
        danger: 'medium'
      },
      {
        id: 'rotted_operatory_steal',
        text: '[偷取器械]',
        description: '三选一共享卡',
        gains: ["Choose 1 of 3 shared cards"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'rotted_operatory_escape',
        text: '[逃离]',
        description: '无收益但清除待结算章节 debuff 一次',
        gains: ["Clear 1 chapter debuff once"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'grave_choir',
    title: '墓池圣歌队',
    imagePath: '/assets/events/grave_choir.webp',
    floorMin: 22,
    floorMax: 25,
    weight: 1,
    loreText: [
      '墓池圣歌队是由不死生物组成的合唱团，它们用歌声来纪念死者。',
      '它们愿意与活人分享一些力量...'
    ],
    options: [
      {
        id: 'grave_choir_listen',
        text: '[聆听圣歌]',
        description: '获得 1 relic grave_resonator',
        gains: ["grave_resonator"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'grave_choir_join',
        text: '[加入合唱]',
        description: '失去 15 生命换 1 稀有牌',
        gains: ["1 rare card"],
        costs: ["15 HP"],
        danger: 'medium'
      },
      {
        id: 'grave_choir_leave',
        text: '[沉默离开]',
        description: '获得 70 金',
        gains: ["70 gold"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'larval_pit',
    title: '幼体孵化池',
    imagePath: '/assets/events/larval_pit.webp',
    floorMin: 23,
    floorMax: 25,
    weight: 1,
    loreText: [
      '幼体孵化池是一个充满病斑幼体的巨大泥沼。',
      '它们正在等待被孵化...'
    ],
    options: [
      {
        id: 'larval_pit_stomp',
        text: '[踩碎卵囊]',
        description: '获得 100 金并立刻受 10 伤害',
        gains: ["100 gold"],
        costs: ["10 HP"],
        danger: 'medium'
      },
      {
        id: 'larval_pit_keep',
        text: '[保留母株]',
        description: '下场战斗更难但胜利获 relic',
        gains: ["Next combat harder but victory grants relic"],
        costs: [],
        danger: 'high'
      },
      {
        id: 'larval_pit_refine',
        text: '[提炼样本]',
        description: '获得 1 药水与 1 共享卡',
        gains: ["1 potion", "1 shared card"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'eaten_sanctum',
    title: '被吞噬的圣所',
    imagePath: '/assets/events/eaten_sanctum.webp',
    floorMin: 23,
    floorMax: 25,
    weight: 1,
    loreText: [
      '被吞噬的圣所曾经是瘟疫炼狱最神圣的地方，现在被某种巨大的生物所吞噬。',
      '但内部的圣火仍未熄灭...'
    ],
    options: [
      {
        id: 'eaten_sanctum_reignite',
        text: '[重新点燃圣火]',
        description: '升级 1 张牌并恢复 12 生命',
        gains: ["Upgrade 1 card", "Heal 12 HP"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'eaten_sanctum_plunder',
        text: '[搜刮残骸]',
        description: '获得 1 relic 但加入 2 诅咒',
        gains: ["1 relic"],
        costs: ["2 curses"],
        danger: 'high'
      },
      {
        id: 'eaten_sanctum_pray',
        text: '[祈祷离开]',
        description: '获得 40 金',
        gains: ["40 gold"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'corruption_well',
    title: '腐化井',
    imagePath: '/assets/events/corruption_well.webp',
    floorMin: 24,
    floorMax: 25,
    weight: 1,
    loreText: [
      '腐化井中的水已经被瘟疫完全腐化，但它仍具有某种力量。',
      '饮用它需要勇气...'
    ],
    options: [
      {
        id: 'corruption_well_drink',
        text: '[饮下井水]',
        description: '获强力短期 buff relic，后续 2 战敌人伤害 +10%',
        gains: ["Strong temporary buff relic", "Next 2 combats enemies deal +10% damage"],
        costs: [],
        danger: 'medium'
      },
      {
        id: 'corruption_well_seal',
        text: '[封井]',
        description: '获得 1 稀有共享牌',
        gains: ["1 rare shared card"],
        costs: [],
        danger: 'low'
      },
      {
        id: 'corruption_well_leave',
        text: '[弃井而去]',
        description: '清除 1 debuff',
        gains: ["Remove 1 debuff"],
        costs: [],
        danger: 'low'
      },
    ]
  },
  {
    id: 'silent_plague',
    title: '寂静疫潮',
    imagePath: '/assets/events/silent_plague.webp',
    floorMin: 24,
    floorMax: 25,
    weight: 1,
    loreText: [
      '寂静疫潮是一个巨大的瘟疫漩涡，它会吞噬一切生命。',
      '但它也蕴含着巨大的力量...'
    ],
    options: [
      {
        id: 'silent_plague_face',
        text: '[直面疫潮]',
        description: '立即战斗，胜利获章节稀有 relic',
        gains: ["Immediate combat for chapter rare relic"],
        costs: ["Immediate combat"],
        danger: 'high'
      },
      {
        id: 'silent_plague_dodge',
        text: '[躲避]',
        description: '承受 14 不可减免伤害',
        gains: [],
        costs: ["14 unblockable damage"],
        danger: 'high'
      },
      {
        id: 'silent_plague_sacrifice',
        text: '[献祭牌库]',
        description: '删除 1 张牌并恢复 15 生命',
        gains: ["Remove 1 card", "Heal 15 HP"],
        costs: [],
        danger: 'medium'
      },
    ]
  }

];

export function getStoryEventDef(id: string): StoryEventDef | undefined {
  return STORY_EVENTS.find(event => event.id === id);
}
