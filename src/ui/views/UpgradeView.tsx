import React from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import worldLoreData from '@/content/data/worldLore.json';
import { ArrowUp, Zap, Coins, Target } from 'lucide-react';

function getUpgradeDiff(card: any): { type: string; before: any; after: any; label: string }[] {
  const diffs: { type: string; before: any; after: any; label: string }[] = [];
  
  if (!card.upgrade) return diffs;
  
  const upgraded = { ...card, ...card.upgrade, isUpgraded: true };
  
  if (card.cost !== upgraded.cost) {
    diffs.push({
      type: 'cost',
      before: card.cost,
      after: upgraded.cost,
      label: upgraded.cost < card.cost ? '费用降低' : '费用变化'
    });
  }
  
  if (card.upgrade?.damage && card.damage) {
    const beforeDmg = card.damage || 0;
    const afterDmg = card.upgrade.damage || beforeDmg;
    if (beforeDmg !== afterDmg) {
      diffs.push({
        type: 'damage',
        before: beforeDmg,
        after: afterDmg,
        label: '伤害提升'
      });
    }
  }
  
  if (card.upgrade?.block && card.block) {
    const beforeBlock = card.block || 0;
    const afterBlock = card.upgrade.block || beforeBlock;
    if (beforeBlock !== afterBlock) {
      diffs.push({
        type: 'block',
        before: beforeBlock,
        after: afterBlock,
        label: '格挡提升'
      });
    }
  }
  
  if (card.text && card.upgrade?.text) {
    diffs.push({
      type: 'effect',
      before: card.text,
      after: card.upgrade.text,
      label: '效果增强'
    });
  }
  
  if (diffs.length === 0) {
    diffs.push({
      type: 'general',
      before: '',
      after: '',
      label: '卡牌强化'
    });
  }
  
  return diffs;
}

function UpgradeCardPreview({ card, onUpgrade }: { card: any; onUpgrade: () => void }) {
  const diffs = getUpgradeDiff(card);
  
  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="flex gap-1 flex-wrap justify-center max-w-[180px]">
        {diffs.map((diff, i) => (
          <span 
            key={i}
            className={`px-2 py-0.5 text-xs font-bold rounded border flex items-center gap-1 ${
              diff.type === 'cost' ? 'bg-blue-900/60 border-blue-500/50 text-blue-300' :
              diff.type === 'damage' ? 'bg-red-900/60 border-red-500/50 text-red-300' :
              diff.type === 'block' ? 'bg-green-900/60 border-green-500/50 text-green-300' :
              diff.type === 'effect' ? 'bg-purple-900/60 border-purple-500/50 text-purple-300' :
              'bg-yellow-900/60 border-yellow-500/50 text-yellow-300'
            }`}
          >
            {diff.type === 'cost' && <Coins size={10} />}
            {diff.type === 'damage' && <Target size={10} />}
            {diff.type === 'block' && <Zap size={10} />}
            {diff.type === 'effect' && <ArrowUp size={10} />}
            {diff.label}
            {diff.type !== 'effect' && diff.type !== 'general' && (
              <span className="ml-1">
                {diff.before}→{diff.after}
              </span>
            )}
          </span>
        ))}
      </div>
      <CardView 
        card={card} 
        onClick={onUpgrade}
        rootProps={{
          'data-keyboard-focus': 'true'
        }}
      />
    </div>
  );
}

export function UpgradeView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = worldLoreData as any;
  const deck = engine.state.player.deck;
  const upgradableCards = deck.filter(c => !c.isUpgraded && c.upgrade);
  const backgroundSrc = VIEW_BACKGROUNDS.upgrade.desktop;

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center overflow-y-auto"
      overlayOpacity={0.6}
    >
      <h1 className="text-4xl font-serif text-emerald-400 mb-4 drop-shadow-lg">选择一张记忆印痕进行强化</h1>
      <div className="max-w-3xl text-center text-sm leading-6 text-emerald-100/80 mb-8 px-4">
        {WORLD_LORE?.viewAtmosphere?.Upgrade}
      </div>
      
      <div className="flex flex-wrap justify-center gap-6 mb-12 max-w-5xl">
        {upgradableCards.map((card, index) => (
          <UpgradeCardPreview 
            key={card.instanceId}
            card={card}
            onUpgrade={() => engine.upgradeCard(card.instanceId!)}
          />
        ))}
        {upgradableCards.length === 0 && (
          <div className="text-slate-500 text-xl">记忆印痕库中没有可强化的卡牌。</div>
        )}
      </div>

      <button 
        onClick={() => engine.cancelUpgrade()}
        className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto backdrop-blur-sm"
        data-keyboard-close="true"
        data-keyboard-focus="true"
        data-keyboard-option="10"
      >
        取消
      </button>
    </BackgroundImage>
  );
}
