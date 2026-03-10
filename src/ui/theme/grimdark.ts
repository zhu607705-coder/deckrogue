/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 战锤40K 黑暗风格设计系统 (Grimdark Design System)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 设计哲学：
 * - grim-black: 深黑背景，代表宇宙的冷酷无情
 * - blood-red: 鲜血红色，代表战争的残酷
 * - rusted-brass: 锈蚀黄铜，代表机械神教的古老科技
 * - warp-purple: 亚空间紫色，代表混沌与灵能
 * - cogitator-green: 计算终端绿色，代表数据与扫描
 * - parchment: 羊皮纸色，代表古老的战术手册
 */

// 核心色彩系统
export const grimdarkColors = {
  // 主色调
  'grim-black': {
    900: '#0a0a0c', // 主背景
    800: '#121216', // 次级背景
    700: '#1a1a20', // 卡片背景
    600: '#25252e', // 边框/分隔线
    500: '#353545', // 悬停状态
  },
  
  // 鲜血红 - 伤害/危险/敌人
  'blood-red': {
    900: '#2d0a0a',
    700: '#5c1212',
    500: '#8b1a1a', // 主红色
    400: '#b52b2b',
    300: '#dc4444',
    100: '#ff6b6b', // 高亮
  },
  
  // 锈蚀黄铜 - 机械神教/古老科技
  'rusted-brass': {
    900: '#2a1f0d',
    700: '#4a3718',
    500: '#6b4e23', // 主黄铜色
    400: '#8b6914',
    300: '#b8860b',
    100: '#daa520', // 高亮
  },
  
  // 亚空间紫 - 灵能/混沌/扭曲
  'warp-purple': {
    900: '#1a0a2e',
    700: '#2d1b4e',
    500: '#4a2c7a',
    400: '#6b3d99',
    300: '#9d4edd',
    100: '#c77dff',
    glow: '#e0aaff',
  },
  
  // 计算终端绿 - 数据/扫描/科技
  'cogitator-green': {
    900: '#0a1f0a',
    700: '#0d3d0d',
    500: '#1a5c1a',
    400: '#2e8b2e',
    300: '#4caf50',
    100: '#7cfc00', // 终端绿
    scan: '#00ff41', // 扫描线
  },
  
  // 羊皮纸 - 古老知识/文本
  'parchment': {
    900: '#2a2520',
    700: '#4a4239',
    500: '#6b5d4f',
    400: '#8b7d6b',
    300: '#b8a88a',
    100: '#e8dcc0',
  },
  
  // 特殊效果色
  'effects': {
    toxic: '#39ff14',    // 毒性绿
    corruption: '#8b008b', // 腐化紫
    void: '#000000',     // 虚空黑
    warning: '#ff8c00',  // 警告橙
    info: '#00bfff',     // 信息蓝
  },
} as const;

// 字体系统
export const grimdarkTypography = {
  // 主要字体 - 机械感
  fontFamily: {
    primary: '"Cinzel", "Trajan Pro", "Times New Roman", serif',
    tech: '"Share Tech Mono", "Courier New", monospace',
    gothic: '"UnifrakturMaguntia", "Old English Text MT", serif',
  },
  
  // 字体大小
  sizes: {
    'text-xs': '0.75rem',    // 12px - 辅助文本
    'text-sm': '0.875rem',   // 14px - 次要文本
    'text-base': '1rem',     // 16px - 正文
    'text-lg': '1.125rem',   // 18px - 强调文本
    'text-xl': '1.25rem',    // 20px - 小标题
    'text-2xl': '1.5rem',    // 24px - 中标题
    'text-3xl': '1.875rem',  // 30px - 大标题
    'text-4xl': '2.25rem',   // 36px - 主标题
    'text-5xl': '3rem',      // 48px - 巨大标题
  },
  
  // 字重
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
} as const;

// 间距系统
export const grimdarkSpacing = {
  'space-1': '0.25rem',   // 4px
  'space-2': '0.5rem',    // 8px
  'space-3': '0.75rem',   // 12px
  'space-4': '1rem',      // 16px
  'space-5': '1.25rem',   // 20px
  'space-6': '1.5rem',    // 24px
  'space-8': '2rem',      // 32px
  'space-10': '2.5rem',   // 40px
  'space-12': '3rem',     // 48px
  'space-16': '4rem',     // 64px
  'space-20': '5rem',     // 80px
  'space-24': '6rem',     // 96px
} as const;

// 边框与圆角
export const grimdarkBorders = {
  // 边框宽度
  widths: {
    thin: '1px',
    normal: '2px',
    thick: '3px',
    heavy: '4px',
  },
  
  // 圆角
  radius: {
    none: '0',
    sm: '2px',
    base: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    full: '9999px',
  },
  
  // 装饰性边框样式
  styles: {
    // 哥特式装饰边框
    gothic: `2px solid ${grimdarkColors['grim-black'][600]}`,
    // 机械神教边框
    mechanicus: `2px solid ${grimdarkColors['rusted-brass'][500]}`,
    // 亚空间扭曲边框
    warp: `2px solid ${grimdarkColors['warp-purple'][300]}`,
    // 警告边框
    warning: `2px solid ${grimdarkColors['blood-red'][500]}`,
  },
} as const;

// 阴影系统
export const grimdarkShadows = {
  // 基础阴影
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
  base: '0 2px 4px 0 rgba(0, 0, 0, 0.6)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.7)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.8)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.9)',
  
  // 特殊效果阴影
  glow: {
    red: '0 0 10px rgba(139, 26, 26, 0.6), 0 0 20px rgba(139, 26, 26, 0.3)',
    purple: '0 0 10px rgba(157, 78, 221, 0.6), 0 0 20px rgba(157, 78, 221, 0.3)',
    green: '0 0 10px rgba(124, 252, 0, 0.6), 0 0 20px rgba(124, 252, 0, 0.3)',
    gold: '0 0 10px rgba(184, 134, 11, 0.6), 0 0 20px rgba(184, 134, 11, 0.3)',
  },
  
  // 内阴影
  inner: {
    base: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
    deep: 'inset 0 4px 8px 0 rgba(0, 0, 0, 0.8)',
    terminal: `inset 0 0 20px rgba(0, 255, 65, 0.1)`,
  },
} as const;

// 动画系统
export const grimdarkAnimations = {
  // 持续时间
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '700ms',
  },
  
  // 缓动函数
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    mechanical: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
  
  // 关键帧动画
  keyframes: {
    // 扫描线
    scanline: `
      @keyframes scanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
    `,
    // 闪烁
    flicker: `
      @keyframes flicker {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
        25%, 75% { opacity: 0.9; }
      }
    `,
    // 脉冲
    pulse: `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }
    `,
    // 亚空间扭曲
    warpDistortion: `
      @keyframes warpDistortion {
        0% { filter: hue-rotate(0deg) blur(0px); }
        25% { filter: hue-rotate(15deg) blur(1px); }
        50% { filter: hue-rotate(-10deg) blur(0.5px); }
        75% { filter: hue-rotate(20deg) blur(1.5px); }
        100% { filter: hue-rotate(0deg) blur(0px); }
      }
    `,
    // 数据流
    dataStream: `
      @keyframes dataStream {
        0% { background-position: 0% 0%; }
        100% { background-position: 0% 100%; }
      }
    `,
    // 故障效果
    glitch: `
      @keyframes glitch {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
      }
    `,
  },
} as const;

// 视觉特效
export const grimdarkEffects = {
  // 噪点纹理
  noise: `
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.03;
  `,
  
  // 扫描线覆盖
  scanlines: `
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.1) 2px,
      rgba(0, 0, 0, 0.1) 4px
    );
    pointer-events: none;
  `,
  
  // 暗角效果
  vignette: `
    background: radial-gradient(
      ellipse at center,
      transparent 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.5) 100%
    );
    pointer-events: none;
  `,
  
  // 金属质感
  metallic: `
    background: linear-gradient(
      135deg,
      ${grimdarkColors['grim-black'][600]} 0%,
      ${grimdarkColors['grim-black'][500]} 50%,
      ${grimdarkColors['grim-black'][600]} 100%
    );
  `,
  
  // 亚空间波纹
  warpRipple: `
    background: radial-gradient(
      circle at var(--warp-x, 50%) var(--warp-y, 50%),
      ${grimdarkColors['warp-purple'][500]}40 0%,
      transparent 50%
    );
  `,
} as const;

// 术语表 - 战锤风格命名
export const grimdarkTerminology = {
  // 资源
  resources: {
    hp: { name: '肉体承载力', icon: '❤️', description: '生物组织的完整度' },
    maxHp: { name: '肉体上限', icon: '💪', description: '生物组织的最大承载能力' },
    block: { name: '虚空盾', icon: '🛡️', description: '能量护盾的剩余强度' },
    energy: { name: '机魂/指令点', icon: '⚡', description: '机械神赐福的行动力' },
    intel: { name: '鸟卜仪扫描', icon: '🔍', description: '战术情报的完整度' },
    relics: { name: '圣遗物', icon: '👑', description: '帝皇赐予的神圣遗物' },
    corruption: { name: '腐化值', icon: '☠️', description: '混沌侵蚀的程度' },
    toxicity: { name: '毒性', icon: '☣️', description: '生物毒素的积累' },
  },
  
  // 游戏元素
  game: {
    deck: { name: '记忆印痕', subtitle: '战术圣典', description: '被封印的战斗记忆' },
    drawPile: { name: '待唤醒印痕', description: '等待被唤醒的战术记忆' },
    discardPile: { name: '已消耗印痕', description: '已使用并消耗的战术记忆' },
    hand: { name: '当前战术', description: '可立即执行的战术指令' },
    turn: { name: '战术周期', description: '一个完整的战术执行周期' },
    floor: { name: '深渊层级', description: '混沌深渊的当前深度' },
  },
  
  // 战斗
  combat: {
    enemy: { name: '异端/异形', description: '必须被净化的敌人' },
    intent: { name: '敌意图', description: '敌人的战术意图预测' },
    masquerade: { name: '意图伪装', description: '亚空间扭曲导致的虚假意图' },
    frontline: { name: '前线阵地', description: '最前沿的防御工事' },
    wreckage: { name: '前线残骸', description: '前线阵地的损毁程度' },
    damage: { name: '创伤', description: '对肉体承载力的伤害' },
    damageShare: { name: '创伤分摊', description: '前线阵地分担的伤害' },
  },
  
  // 特殊机制
  mechanics: {
    timeLayer: { name: '时层', description: '操控时间流速的奥术层' },
    thread: { name: '线索', description: '命运之线的编织' },
    concoction: { name: '炼金剂', description: '机械神教的神秘炼金产物' },
    warpTide: { name: '亚空间潮汐', description: '亚空间能量的波动强度' },
    warpEye: { name: '亚空间之眼', description: '窥视亚空间的危险窗口' },
  },
} as const;

// 导出完整主题对象
export const grimdarkTheme = {
  colors: grimdarkColors,
  typography: grimdarkTypography,
  spacing: grimdarkSpacing,
  borders: grimdarkBorders,
  shadows: grimdarkShadows,
  animations: grimdarkAnimations,
  effects: grimdarkEffects,
  terminology: grimdarkTerminology,
} as const;

export const grimdarkNodeToneClasses = {
  Combat: {
    tone: 'grimdark-node-tone--combat',
    icon: 'grimdark-node-icon-tone--combat',
  },
  Elite: {
    tone: 'grimdark-node-tone--elite',
    icon: 'grimdark-node-icon-tone--elite',
  },
  Event: {
    tone: 'grimdark-node-tone--event',
    icon: 'grimdark-node-icon-tone--event',
  },
  Shop: {
    tone: 'grimdark-node-tone--shop',
    icon: 'grimdark-node-icon-tone--shop',
  },
  Rest: {
    tone: 'grimdark-node-tone--rest',
    icon: 'grimdark-node-icon-tone--rest',
  },
  Boss: {
    tone: 'grimdark-node-tone--boss',
    icon: 'grimdark-node-icon-tone--boss',
  },
  default: {
    tone: 'grimdark-node-tone--default',
    icon: 'grimdark-node-icon-tone--default',
  },
} as const;

// 类型导出
export type GrimdarkColors = typeof grimdarkColors;
export type GrimdarkTypography = typeof grimdarkTypography;
export type GrimdarkSpacing = typeof grimdarkSpacing;
export type GrimdarkBorders = typeof grimdarkBorders;
export type GrimdarkShadows = typeof grimdarkShadows;
export type GrimdarkAnimations = typeof grimdarkAnimations;
export type GrimdarkEffects = typeof grimdarkEffects;
export type GrimdarkTerminology = typeof grimdarkTerminology;
export type GrimdarkTheme = typeof grimdarkTheme;
export type GrimdarkNodeToneClasses = typeof grimdarkNodeToneClasses;
