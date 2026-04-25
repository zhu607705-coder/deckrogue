/**
 * @file RelicUpgradeView.tsx
 * @description 遗物升级视图 - 遗物升级选择界面
 *
 * 主要职责:
 * - 展示可升级遗物列表
 * - 显示升级等级和费用
 * - 处理遗物升级操作
 * - 按路线偏好排序遗物
 */
import React, { useState } from 'react';
import { GameEngine } from '@/core';
import {
  getPreferredRouteTagFromState,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteTaxonomy,
  relicsData,
  sortRelicIdsByRouteAffinity,
} from '@/content/narrative/numericSystem';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { Coins, ArrowUp, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';
import { uiWorldLore } from '@/ui/content/worldLore';

interface RelicUpgradeCardProps {
  engine: GameEngine;
  relicId: string;
  onUpgrade: (relicId: string) => void;
  preferredRouteTag: string | null;
}

function RelicUpgradeCard({ engine, relicId, onUpgrade, preferredRouteTag }: RelicUpgradeCardProps) {
  const relic = relicsData.find(r => r.id === relicId);
  const upgradeInfo = engine.getRelicUpgradeInfo(relicId);
  
  if (!relic || !upgradeInfo) return null;

  const isMaxLevel = upgradeInfo.currentLevel >= upgradeInfo.maxLevel;
  const canUpgrade = upgradeInfo.canUpgrade && upgradeInfo.canAfford;
  const relicIconSrc = `/assets/relics/${relicId}.png`;
  const matchedRouteTag = preferredRouteTag && getRelicRouteTags(relicId).includes(preferredRouteTag) ? preferredRouteTag : null;
  const matchedRouteLabel = matchedRouteTag ? getRouteTaxonomy(matchedRouteTag)?.label ?? matchedRouteTag : null;

  const handleUpgrade = () => {
    if (canUpgrade) {
      onUpgrade(relicId);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`relative flex flex-col items-center p-4 rounded-2xl border-2 backdrop-blur-sm transition-all
        ${isMaxLevel 
          ? 'bg-slate-900/80 border-yellow-500/50' 
          : canUpgrade 
            ? 'bg-slate-900/80 border-amber-500/50 hover:border-amber-400 hover:scale-105 cursor-pointer' 
            : 'bg-slate-900/80 border-slate-700/50 opacity-70'
        }
      `}
      onClick={handleUpgrade}
    >
      <div className="relative mb-3">
        <img
          src={relicIconSrc}
          alt={relic.name}
          className="w-20 h-20 object-contain rounded-xl bg-slate-800/80 shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/relics/corrupted_relic.png';
          }}
        />
        {isMaxLevel && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <Star size={18} className="text-yellow-900" fill="currentColor" />
          </motion.div>
        )}
      </div>

      <h3 className="text-lg font-bold text-amber-200 text-center mb-2">{relic.name}</h3>

      {matchedRouteLabel && (
        <div className="mb-2 rounded-full border border-emerald-400/40 bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-200">
          当前路线强化：{matchedRouteLabel}
        </div>
      )}
      
      <div className="flex gap-1 mb-3">
        {[...Array(upgradeInfo.maxLevel)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`w-6 h-2 rounded-full ${
              i < upgradeInfo.currentLevel 
                ? 'bg-amber-400 shadow-lg shadow-amber-400/50' 
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {!isMaxLevel && (
        <div className={`text-center mb-3 ${!upgradeInfo.canAfford ? 'text-red-400' : 'text-emerald-400'}`}>
          <div className="flex items-center justify-center gap-1 text-sm">
            <Coins size={14} />
            <span>{upgradeInfo.nextLevelCost}</span>
          </div>
          <p className="text-xs mt-1 text-slate-400">{upgradeInfo.effectDescription}</p>
        </div>
      )}

      {isMaxLevel && (
        <div className="text-center mb-3">
          <span className="text-yellow-400 text-sm font-bold flex items-center justify-center gap-1">
            <Star size={14} fill="currentColor" />
            已满级
            <Star size={14} fill="currentColor" />
          </span>
        </div>
      )}

      {!isMaxLevel && (
        <button
          disabled={!canUpgrade}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all
            ${canUpgrade 
              ? 'bg-amber-600 hover:bg-amber-500 text-amber-100 shadow-lg shadow-amber-600/30' 
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          {canUpgrade ? (
            <>
              <ArrowUp size={16} />
              升级
            </>
          ) : !upgradeInfo.canAfford ? (
            <>
              <X size={16} />
              金币不足
            </>
          ) : (
            '已达满级'
          )}
        </button>
      )}
    </motion.div>
  );
}

function UpgradeSuccessAnimation({ relicName }: { relicName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="bg-gradient-to-br from-amber-600 to-orange-600 p-8 rounded-3xl shadow-2xl flex flex-col items-center"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="mb-4"
        >
          <Star size={64} className="text-yellow-300" fill="currentColor" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-amber-100 mb-2"
        >
          升级成功！
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-amber-200"
        >
          {relicName}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

export function RelicUpgradeView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = uiWorldLore as any;
  const player = engine.state.player;
  const playerGold = player.gold;
  const routeTagsForCharacter = engine.state.character?.id ? getKnownRouteTagsForCharacter(engine.state.character.id) : [];
  const preferredRouteTag = getPreferredRouteTagFromState(
    player.deck,
    routeTagsForCharacter,
    engine.state.routeState ?? null,
  );
  
  const upgradableRelics = sortRelicIdsByRouteAffinity(
    RELIC_UPGRADE_CONFIGS
    .filter(config => player.relics.includes(config.relicId))
    .map(config => config.relicId),
    preferredRouteTag,
  );

  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const handleUpgrade = (relicId: string) => {
    const relic = relicsData.find(r => r.id === relicId);
    if (engine.upgradeRelic(relicId)) {
      setShowSuccess(relic?.name || relicId);
      setTimeout(() => setShowSuccess(null), 1500);
    }
  };

  const backgroundSrc = VIEW_BACKGROUNDS.rest[0]?.desktop || '';

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center overflow-y-auto"
      overlayOpacity={0.6}
    >
      <div className="absolute top-6 right-6 bg-slate-900/80 px-4 py-2 rounded-xl border border-yellow-600/50 flex items-center gap-2">
        <Coins size={20} className="text-yellow-400" />
        <span className="text-xl font-bold text-yellow-300">{playerGold}</span>
      </div>

      <h1 className="text-4xl font-serif text-amber-400 mb-4 drop-shadow-lg">遗物升级</h1>
      <div className="max-w-3xl text-center text-sm leading-6 text-amber-100/80 mb-8 px-4">
        {WORLD_LORE?.viewAtmosphere?.Rest}
      </div>

      <div className="text-center mb-8">
        <p className="text-slate-300">选择一件遗物进行升级，增强其效果</p>
        <p className="text-xs text-slate-500 mt-2">升级会消耗信用筹码，效果永久生效</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-6 mb-12 max-w-5xl">
        <AnimatePresence mode="popLayout">
          {upgradableRelics.map((relicId) => (
            <RelicUpgradeCard
              key={relicId}
              engine={engine}
              relicId={relicId}
              onUpgrade={handleUpgrade}
              preferredRouteTag={preferredRouteTag}
            />
          ))}
        </AnimatePresence>
        
        {upgradableRelics.length === 0 && (
          <div className="text-slate-500 text-xl py-12">
            <p>当前没有可升级的遗物</p>
            <p className="text-sm mt-2">击败异端获取更多遗物后再来吧</p>
          </div>
        )}
      </div>

      <motion.button 
        onClick={() => engine.cancelRelicUpgrade()}
        className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto backdrop-blur-sm flex items-center gap-2"
        data-keyboard-close="true"
        data-keyboard-focus="true"
        data-keyboard-option="10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <X size={18} />
        返回
      </motion.button>

      <AnimatePresence>
        {showSuccess && (
          <UpgradeSuccessAnimation relicName={showSuccess} />
        )}
      </AnimatePresence>
    </BackgroundImage>
  );
}
