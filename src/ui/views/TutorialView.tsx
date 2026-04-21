import React from 'react';
import { BookOpen, Crosshair, Shield, Sparkles, X } from 'lucide-react';
import { GlossaryText } from '@/ui/components/GlossaryText';

type TutorialSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
  icon: React.ReactNode;
};

const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: 'resources',
    kicker: '资源术语',
    title: '先看资源，再决定这一轮能做什么',
    body: '战斗内最常见的术语是[生命值]、[护盾]、[能量]与[情报]。这些词决定你当前能承受多少伤害、能打出多少牌，以及某些牌是否会进入强化状态。',
    bullets: [
      '[生命值] 归零时，你这一局会立刻结束。',
      '[护盾] 会优先吸收直接伤害，通常只维持到当前轮次结束。',
      '[能量] 决定你这一轮还能再打几张牌。',
      '[情报] 属于高频职业资源，很多侦缉牌会要求你先持有它。'
    ],
    icon: <BookOpen size={18} className="text-amber-300" />
  },
  {
    id: 'status',
    kicker: '状态术语',
    title: '高频状态只需要先记住两正两负',
    body: '[易伤]、[虚弱]、[虔敬]、[腐化] 是主流程里最常见的状态与轴线词。看懂它们，很多卡牌和异端描述就能立刻读通。',
    bullets: [
      '[易伤] 会放大承受的攻击伤害。',
      '[虚弱] 会压低攻击输出，常见于控制和拖节奏效果。',
      '[虔敬] 与[腐化] 是阵营倾向与风险回报的轴线词，相关牌会围绕它们追加效果。'
    ],
    icon: <Crosshair size={18} className="text-rose-300" />
  },
  {
    id: 'targeting',
    kicker: '目标术语',
    title: '目标说明决定这张牌会落到谁身上',
    body: '卡牌描述里若出现[单体异端]、[全体异端]、[随机异端]或[自身]，这些都属于目标词。先读目标，再读效果，误操作会明显减少。',
    bullets: [
      '[单体异端] 需要你手动指定一名异端。',
      '[全体异端] 会同时覆盖全部敌对单位。',
      '[随机异端] 由系统在当前存活异端中随机选定目标。',
      '[自身] 只作用于你当前控制的执行体。'
    ],
    icon: <Shield size={18} className="text-cyan-300" />
  },
  {
    id: 'reading',
    kicker: '阅读规则',
    title: '术语、图鉴、教程三处必须保持同义',
    body: '当前教程只负责解释高频专业词，不负责代替整局流程教学。若你遇到不明白的描述，优先悬停术语泡泡，再去图鉴核对同一词条。',
    bullets: [
      '教程里的术语解释和图鉴、卡牌悬停说明来自同一套真值源。',
      '如果一个词在三个地方意思不一致，就属于需要继续修正的问题。',
      '准备开局前，只需要先把高频术语读熟，不需要背完整流程。'
    ],
    icon: <Sparkles size={18} className="text-fuchsia-300" />
  }
];

export function TutorialView({
  open,
  onClose,
  onStartRun
}: {
  open: boolean;
  onClose: () => void;
  onStartRun?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130]" data-screen="Tutorial">
      <div className="absolute inset-0 bg-black/78 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-3 overflow-hidden rounded-[28px] border border-white/12 bg-[#050608]/96 shadow-[0_32px_120px_rgba(0,0,0,0.55)] md:inset-6">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(circle at 14% 18%, rgba(95, 197, 255, 0.16), transparent 28%), radial-gradient(circle at 88% 24%, rgba(238, 180, 64, 0.14), transparent 26%), radial-gradient(circle at 52% 82%, rgba(138, 92, 246, 0.12), transparent 30%)'
          }}
        />
        <div className="relative z-10 flex h-full flex-col overflow-hidden">
          <header className="border-b border-white/8 px-6 py-5 md:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="text-[11px] uppercase tracking-[0.36em] text-stone-500">术语档案</div>
                <h2 className="mt-3 text-[clamp(2rem,4vw,3.3rem)] font-black tracking-[0.04em] text-stone-50">
                  新手战区教程
                </h2>
                <div className="mt-3 text-sm font-semibold tracking-[0.22em] uppercase text-emerald-300/75">
                  术语索引
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 md:text-base">
                  <GlossaryText text="这份教程只负责解释高频专业术语。你会在这里看到[生命值]、[护盾]、[能量]、[情报]、[易伤]、[虚弱]、[单体异端]等词的统一含义，方便你在战斗、图鉴和事件页里快速读懂描述。" />
                </p>
              </div>
              <button
                onClick={onClose}
                className="motion-interactive rounded-full border border-white/12 bg-white/5 p-2 text-stone-300 hover:text-white"
                aria-label="关闭教程"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-b border-white/8 bg-black/18 px-6 py-6 lg:border-b-0 lg:border-r lg:border-white/8 lg:px-7">
              <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">目录</div>
              <nav className="mt-5 space-y-3">
                {TUTORIAL_SECTIONS.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#tutorial-${section.id}`}
                    className="motion-interactive flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-stone-200"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                      {section.icon}
                    </span>
                    <span>
                      <span className="block text-[11px] uppercase tracking-[0.25em] text-stone-500">
                        0{index + 1}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-stone-100">{section.title}</span>
                    </span>
                  </a>
                ))}
              </nav>
            </aside>

            <main className="min-h-0 overflow-y-auto px-6 py-6 md:px-8 md:py-7">
              <div className="mx-auto max-w-4xl space-y-6">
                {TUTORIAL_SECTIONS.map((section) => (
                  <section
                    key={section.id}
                    id={`tutorial-${section.id}`}
                    className="rounded-[24px] border border-white/10 bg-white/[0.035] px-5 py-5 md:px-6 md:py-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25">
                        {section.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.32em] text-stone-500">{section.kicker}</div>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-50">{section.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-stone-300 md:text-[15px]">
                          <GlossaryText text={section.body} />
                        </p>
                        <ul className="mt-5 space-y-3 text-sm leading-7 text-stone-300">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-3">
                              <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                              <GlossaryText text={bullet} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                ))}

                <section className="rounded-[24px] border border-emerald-500/18 bg-emerald-950/14 px-5 py-5 md:px-6 md:py-6">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-emerald-300/70">使用建议</div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-50">把它当成术语索引，而不是流程手册</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
                    <GlossaryText text="如果你已经能读懂[能量]、[护盾]、[情报]、[易伤]与[单体异端]这些高频词，就可以关闭教程进入正式远征。以后再遇到陌生词条，直接回到教程或图鉴继续查阅即可。" />
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {onStartRun ? (
                      <button
                        onClick={onStartRun}
                        className="motion-interactive rounded-full border border-emerald-400/28 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-100"
                      >
                        直接开始新局
                      </button>
                    ) : null}
                    <button
                      onClick={onClose}
                      className="motion-interactive rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-stone-100"
                    >
                      返回当前界面
                    </button>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
