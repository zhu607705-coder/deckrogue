/**
 * @file RewardView.tsx
 * @description 奖励视图 - 战斗胜利后的卡牌奖励选择界面
 *
 * 主要职责:
 * - 展示奖励卡牌供玩家选择
 * - 显示卡牌方向标签（输出/生存/资源/控制）
 * - 处理卡牌选择和跳过操作
 * - 支持 RenderModel 的奖励数量配置
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { CardView } from '@/ui/views/CardView';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import type { RunCardInstance, ActionSpec } from '@/core/types/actions';
import { GlossaryText } from '@/ui/components/GlossaryText';
import { getCardNameZh, getUiLabelZh } from '@/ui/content/terminology';
import { uiWorldLore } from '@/ui/content/worldLore';

interface WorldLore {
  viewAtmosphere?: {
    Reward?: string;
    Shop?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

function getCardDirectionTags(card: RunCardInstance): string[] {
  const tags: string[] = [];

  if (card.type === 'Attack') {
    tags.push('输出');
  }

  if (card.type === 'Skill') {
    const actions = card.actions || [];
    if (actions.some((a: ActionSpec) => a.type === 'GainBlock')) {
      tags.push('生存');
    }
    if (actions.some((a: ActionSpec) => a.type === 'Draw' || a.type === 'GainEnergy')) {
      tags.push('资源');
    }
    if (actions.some((a: ActionSpec) => a.type === 'ApplyStatus')) {
      tags.push('控制');
    }
  }

  if (card.type === 'Power') {
    tags.push('构筑转折');
  }

  if (card.rarity === 'Rare') {
    if (!tags.includes('构筑转折')) {
      tags.push('构筑转折');
    }
  }

  if (tags.length === 0) {
    tags.push('通用');
  }

  return tags.slice(0, 2);
}

export function RewardView({ engine, renderModel }: { engine: GameEngine; renderModel?: RenderModel | null }) {
  const WORLD_LORE = uiWorldLore as WorldLore;
  const cards = engine.state.rewardCards.slice(0, 3);
  const rewardOfferCount = renderModel?.room?.kind === 'reward' ? (renderModel.room.offerCount ?? cards.length) : (renderModel?.reward?.offerCount ?? cards.length);
  const [backgroundIndex] = useState(() =>
    VIEW_BACKGROUNDS.reward.length > 0 ? systemRandomInt(VIEW_BACKGROUNDS.reward.length) : 0
  );
  const backgroundSrc = VIEW_BACKGROUNDS.reward[backgroundIndex]?.desktop || '';

  return (
    <BackgroundImage
      src={backgroundSrc}
      className="campaign-shell reward-view flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8 text-slate-200 md:px-8"
      overlayOpacity={0.68}
    >
      <div className="w-full max-w-5xl reward-view__frame">
        <motion.div
          className="mb-8 border-b border-white/10 pb-6 text-center reward-view__hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
        >
          <div className="campaign-kicker">{getUiLabelZh('Recovery Draft')}</div>
          <h1 className="campaign-title campaign-poster-title mt-4 text-[clamp(2.4rem,4vw,4.4rem)] leading-[0.94] text-yellow-100">
            选取一张记忆印痕
          </h1>
          <p className="campaign-copy mx-auto mt-4 max-w-2xl text-sm md:text-base">
            奖励页只负责一件事：决定这次战斗之后，你的构筑要继续加深哪一种倾向。
          </p>
        </motion.div>

        <motion.div
          className="campaign-section reward-view__brief mb-8 grid gap-4 p-4 md:grid-cols-[1.2fr_0.8fr] md:p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
        >
          <div>
            <div className="campaign-kicker">{getUiLabelZh('Atmosphere')}</div>
            <p className="campaign-copy mt-2 text-sm md:text-base">
              <GlossaryText text={WORLD_LORE?.viewAtmosphere?.Reward || ''} />
            </p>
          </div>
          <div className="campaign-decision-column md:pl-5">
            <div className="campaign-kicker">{getUiLabelZh('Decision Rule')}</div>
            <div className="mt-3 space-y-2 text-sm text-stone-300">
              <div className="campaign-ledger-row flex items-center justify-between px-3 py-2">
                <span>可选印痕</span>
                <span className="font-semibold text-stone-100">{rewardOfferCount}</span>
              </div>
              <div className="campaign-ledger-row px-3 py-2 text-stone-300/80">
                优先挑选能够明确推动输出、生存、资源或构筑转折的牌。
              </div>
            </div>
          </div>
        </motion.div>

        {rewardOfferCount === 0 ? (
          <div className="campaign-section flex min-h-[16rem] items-center justify-center p-10 text-center text-xl text-slate-400">
            没有可回收的战术残片
          </div>
        ) : (
          <div className="reward-view__draftStage mx-auto grid max-w-4xl grid-cols-1 justify-items-center gap-5 md:grid-cols-3">
            {cards.map((card: RunCardInstance, index: number) => {
              const directionTags = getCardDirectionTags(card);
              return (
                <motion.div
                  key={card.instanceId}
                  className="campaign-choice reward-view__choice flex w-full max-w-[13rem] flex-col items-center gap-3 p-4"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28, delay: 0.08 + index * 0.06, ease: 'easeOut' }}
                >
                  <div className="campaign-kicker w-full text-center">{getUiLabelZh('Option')} {index + 1}</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {directionTags.map((tag, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs font-bold rounded border ${
                          tag === '生存' ? 'bg-green-900/60 border-green-500/50 text-green-300' :
                          tag === '输出' ? 'bg-red-900/60 border-red-500/50 text-red-300' :
                          tag === '控制' ? 'bg-purple-900/60 border-purple-500/50 text-purple-300' :
                          tag === '资源' ? 'bg-blue-900/60 border-blue-500/50 text-blue-300' :
                          tag === '构筑转折' ? 'bg-yellow-900/60 border-yellow-500/50 text-yellow-300' :
                          'bg-slate-700/60 border-slate-500/50 text-slate-300'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <CardView
                    card={card}
                    size="compact"
                    onClick={() => engine.pickRewardCard(card.instanceId)}
                    rootProps={{
                      'data-keyboard-option': String(index + 1),
                      'data-keyboard-focus': 'true',
                      'aria-label': `${index + 1}. ${getCardNameZh(card)}`
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          className="mt-8 flex justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.22, ease: 'easeOut' }}
        >
          <button
            onClick={() => engine.skipReward()}
            className="campaign-action px-8 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-100"
            data-keyboard-option="4"
            data-keyboard-focus="true"
          >
            保持当前构筑
          </button>
        </motion.div>
      </div>
    </BackgroundImage>
  );
}
