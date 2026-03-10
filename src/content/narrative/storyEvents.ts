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
  }
];

export function getStoryEventDef(id: string): StoryEventDef | undefined {
  return STORY_EVENTS.find(event => event.id === id);
}
