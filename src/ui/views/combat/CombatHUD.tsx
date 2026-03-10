import React from 'react';
import { Shield, Zap, Eye, Heart, Layers, FlaskConical, Skull, Activity } from 'lucide-react';
import type { GameEngine } from '@/core';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { getPotionRuntimeConfig, potionsData, relicsData } from '@/content/narrative/numericSystem';
import { grimdarkTerminology, getResourceName } from '@/ui/theme';

interface CombatHUDProps {
  engine: GameEngine;
  showDeck: boolean;
  setShowDeck: (show: boolean) => void;
  GLOSSARY: any;
  cardBackThemes: any;
  characterToTheme: any;
  defaultTheme: string;
}

export function CombatHUD({
  engine,
  showDeck,
  setShowDeck,
  GLOSSARY,
  cardBackThemes,
  characterToTheme,
  defaultTheme
}: CombatHUDProps) {
  const state = engine.state.combat!;
  const player = state.player;
  const potionRuntime = getPotionRuntimeConfig();
  const intelNow = Math.max(0, engine.state.player.intel || 0);
  const playerHpNow = Math.max(0, Math.round(player.hp));
  const playerMaxHpNow = Math.max(0, Math.round(player.maxHp));
  const potionCountNow = (engine.state.player.potions || []).filter(Boolean).length;
  const relicIds = Array.isArray(engine.state.player.relics) ? [...engine.state.player.relics] : [];
  const equippedRelics = relicIds.map(id => {
    const def = (relicsData as any[]).find(r => r.id === id) as any;
    return def || { id, name: id, description: 'Unknown relic (missing data)' };
  });
  const resonanceCounts: Record<string, number> = equippedRelics.reduce((acc: Record<string, number>, relic: any) => {
    const key = relic.resonanceGroup || relic.tags?.[0];
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const resonanceValues = Object.values(resonanceCounts) as number[];
  const resonancePeak = Math.max(0, ...resonanceValues);
  const resonanceActive = resonanceValues.filter(n => n >= 2).length;
  const corruptionDmgBonusPct = Math.round((engine.getCorruptionDamageBonusMultiplier() - 1) * 100);

  const getPotionIconSrc = (id: string) => `/assets/potions/${id}.png`;
  const getRelicIconSrc = (id: string) => `/assets/relics/${id}.png`;

  // 战锤术语
  const terms = grimdarkTerminology;

  return (
    <div className="combat-hud grimdark-hud">
      {/* 扫描线效果 */}
      <div className="scanline-bar" />
      
      <div className="combat-hud__left">
        <button 
          onClick={() => setShowDeck(true)}
          className="combat-hud__deckBtn grimdark-btn"
        >
          <Layers size={16} /> 
          <span className="grimdark-text">{terms.game.deck.name}</span>
          <span className="grimdark-counter">({engine.state.player.deck.length})</span>
        </button>
        
        <div className="combat-hud__resources grimdark-resources">
          {/* 肉体承载力 (HP) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--hp" title={terms.resources.hp.description}>
            <Heart size={14} className="grimdark-icon grimdark-icon--blood"/> 
            <span className="grimdark-label">{terms.resources.hp.name}</span>
            <span key={`hudhp-${playerHpNow}-${playerMaxHpNow}`} className="grimdark-value">
              {playerHpNow}/{playerMaxHpNow}
            </span>
          </div>
          
          {/* 虚空盾 (Block) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--block" title={terms.resources.block.description}>
            <Shield size={14} className="grimdark-icon grimdark-icon--brass"/>
            <span className="grimdark-label">{terms.resources.block.name}</span>
            <span className="grimdark-value grimdark-value--brass">{player.block}</span>
          </div>
          
          {/* 机魂/指令点 (Energy) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--energy" title={terms.resources.energy.description}>
            <Zap size={14} className="grimdark-icon grimdark-icon--energy"/>
            <span className="grimdark-label">{terms.resources.energy.name}</span>
            <span className="grimdark-value grimdark-value--energy">{player.energy}/{engine.state.player.maxEnergy}</span>
          </div>
          
          {/* 鸟卜仪扫描 (Intel) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--intel" title={terms.resources.intel.description}>
            <Eye size={14} className="grimdark-icon grimdark-icon--warp"/>
            <span className="grimdark-label">{terms.resources.intel.name}</span>
            <span className={`grimdark-value ${intelNow > 0 ? 'grimdark-value--active' : 'grimdark-value--dim'}`}>
              {intelNow} {intelNow > 0 ? '[已连接]' : '[盲视]'}
            </span>
          </div>
          
          {/* 圣遗物 (Relics) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--relics" title={terms.resources.relics.description}>
            <Layers size={14} className="grimdark-icon grimdark-icon--gold"/>
            <span className="grimdark-label">{terms.resources.relics.name}</span>
            <span className="grimdark-value grimdark-value--gold">{relicIds.length}</span>
          </div>
          
          {/* 腐化值 (Corruption) */}
          <div 
            className={`combat-hud__pill grimdark-pill grimdark-pill--corruption ${engine.state.player.corruption > 0 ? 'grimdark-pill--active' : ''}`} 
            title={terms.resources.corruption.description}
          >
            <Skull size={14} className="grimdark-icon grimdark-icon--corruption"/>
            <span className="grimdark-label">{terms.resources.corruption.name}</span>
            <span className="grimdark-value grimdark-value--corruption">
              {engine.state.player.corruption}
              {engine.state.player.corruption > 0 ? ` [+${corruptionDmgBonusPct}% 创伤]` : ''}
            </span>
          </div>
          
          {/* 共鸣 (Resonance) */}
          <div 
            className={`combat-hud__pill grimdark-pill grimdark-pill--resonance ${resonancePeak >= 2 ? 'grimdark-pill--active' : ''}`} 
            title="圣遗物共鸣群组 (2+ 同组激活)"
          >
            <Activity size={14} className="grimdark-icon grimdark-icon--warp"/>
            <span className="grimdark-label">共鸣</span>
            <span className="grimdark-value grimdark-value--warp">
              {resonancePeak || 0}{resonanceActive > 0 ? ` [${resonanceActive}组激活]` : ''}
            </span>
          </div>
          
          {/* 炼金剂栏位 (Potions) */}
          <div className="combat-hud__pill grimdark-pill grimdark-pill--potions" title="炼金剂栏位">
            <FlaskConical size={14} className="grimdark-icon grimdark-icon--toxic"/>
            <span className="grimdark-label">炼金剂</span>
            <span className="grimdark-value grimdark-value--toxic">{potionCountNow}/{potionRuntime.slotLimit}</span>
          </div>
          
          {/* 毒性 (Toxicity) */}
          <div 
            className={`combat-hud__pill grimdark-pill grimdark-pill--toxicity ${(player.potionToxicity || 0) > potionRuntime.toxicityOverloadThreshold ? 'grimdark-pill--overload' : ''}`} 
            title={`${terms.resources.toxicity.description} / 超载阈值 ${potionRuntime.toxicityOverloadThreshold}`}
          >
            <FlaskConical size={14} className="grimdark-icon grimdark-icon--toxic"/>
            <span className="grimdark-label">{terms.resources.toxicity.name}</span>
            <span className="grimdark-value grimdark-value--toxic">
              {player.potionToxicity || 0}/{potionRuntime.toxicityOverloadThreshold}
            </span>
          </div>
          
          {/* 亚空间裂隙 (Warp Rift) */}
          {(state.warpRiftTurns || 0) > 0 && (
            <div
              className="combat-hud__pill grimdark-pill grimdark-pill--rift grimdark-pill--pulse"
              title={`亚空间裂隙激活: +${state.warpRiftCorruption || 0} 腐化/周期, 强度 x${state.warpRiftAlphaMultiplier || 1}, 危险阈值 ${Math.round(((state.warpRiftPerilFloor || 0) * 100))}%`}
            >
              <Skull size={14} className="grimdark-icon grimdark-icon--rift"/>
              <span className="grimdark-label">裂隙</span>
              <span className="grimdark-value grimdark-value--rift">{state.warpRiftTurns} 周期</span>
            </div>
          )}
        </div>
        
        {/* 炼金剂栏 */}
        <div className="combat-hud__potions grimdark-potions">
          <div className="combat-hud__potionsLabel grimdark-section-label">
            <FlaskConical size={12} />
            炼金剂栏 [{potionCountNow}/{potionRuntime.slotLimit}]
          </div>
          {Array.from({ length: potionRuntime.slotLimit }, (_, i) => i).map(i => {
            const potionId = engine.state.player.potions[i];
            const potionDef = potionId ? potionsData.find(p => p.id === potionId) as any : null;
            const tox = potionDef ? (typeof potionDef.toxicity === 'number'
              ? potionDef.toxicity
              : (potionDef.effect?.type === 'GainEnergy' ? 2 : potionDef.effect?.type === 'Heal' ? 1 : 1)) : 0;
            return (
              <div 
                key={i} 
                className={`combat-hud__potionSlot grimdark-potion-slot ${potionDef ? 'grimdark-potion-slot--filled' : 'grimdark-potion-slot--empty'}`}
                title={potionDef ? `${potionDef.name}: ${potionDef.description} (毒性 +${tox})` : '空置炼金剂槽'}
                onClick={() => potionDef && engine.usePotion(i)}
              >
                {potionDef && (
                  <>
                    <img
                      src={getPotionIconSrc(potionDef.id)}
                      alt={potionDef.name}
                      className="combat-hud__potionArt grimdark-potion-art"
                      onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.potion)}
                    />
                    <div className="grimdark-potion-toxicity">+{tox}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 圣遗物栏 */}
        {equippedRelics.length > 0 && (
          <div className="flex flex-col items-end gap-1 grimdark-relics-section">
            <div className="combat-hud__relicStrip grimdark-relic-strip" title="已装备圣遗物">
              {equippedRelics.slice(0, 10).map((relic: any) => (
                <div key={relic.id} className="combat-hud__relicSlot grimdark-relic-slot" title={`${relic.name}: ${relic.description}`}>
                  <img
                    src={getRelicIconSrc(relic.id)}
                    alt={relic.name}
                    className="combat-hud__relicArt grimdark-relic-art"
                    onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.relic)}
                  />
                </div>
              ))}
            </div>
            <div className="max-w-[360px] text-[10px] leading-tight text-slate-400 text-right grimdark-relic-descriptions">
              {equippedRelics.slice(0, 3).map((relic: any) => (
                <div key={`relicfx-${relic.id}`} title={`${relic.name}: ${relic.description}`}>
                  <span className="text-slate-200 grimdark-relic-name">{relic.name}</span>: {relic.description}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 回合指示器 */}
      <div className={`combat-hud__turn grimdark-turn ${state.isPlayerTurn ? 'grimdark-turn--player' : 'grimdark-turn--enemy'}`}>
        <span className="combat-hud__turnLabel grimdark-turn-label">
          {state.isPlayerTurn ? '指挥者阶段' : '敌袭阶段'}
        </span>
        <span className="combat-hud__turnValue grimdark-turn-value">
          周期 {state.turn}
        </span>
        <div className="grimdark-turn-indicator" />
      </div>
    </div>
  );
}
