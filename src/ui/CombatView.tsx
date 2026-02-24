import React, { useState } from 'react';
import { GameEngine } from '../engine/engine';
import { CardView } from './CardView';
import { Shield, Zap, Eye, Heart, Sword, Skull, Activity, Layers, FlaskConical } from 'lucide-react';
import enemiesData from '../content/enemies.json';
import potionsData from '../content/potions.json';
import relicsData from '../content/relics.json';

export function CombatView({ engine }: { engine: GameEngine }) {
  const state = engine.state.combat!;
  const player = state.player;
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showDeck, setShowDeck] = useState(false);

  const handleCardClick = (card: any) => {
    if (card.targeting === 'Enemy') {
      setSelectedCard(card.instanceId);
    } else {
      engine.playCard(card.instanceId);
      setSelectedCard(null);
    }
  };

  const handleEnemyClick = (enemyId: string) => {
    if (selectedCard) {
      engine.playCard(selectedCard, enemyId);
      setSelectedCard(null);
    }
  };

  const handlePotionClick = (index: number) => {
    engine.usePotion(index);
  };

  const renderStatuses = (statuses: Record<string, number>) => {
    return (
      <div className="flex gap-1 mt-1">
        {Object.entries(statuses).map(([status, amount]) => {
          if (amount <= 0) return null;
          let icon = <Activity size={12} />;
          let color = 'text-slate-400';
          if (status === 'Vulnerable') { icon = <Skull size={12} />; color = 'text-purple-400'; }
          if (status === 'Weak') { icon = <Activity size={12} />; color = 'text-blue-400'; }
          if (status === 'Strength') { icon = <Sword size={12} />; color = 'text-red-400'; }
          if (status === 'Poison') { icon = <Activity size={12} />; color = 'text-green-400'; }
          if (status === 'Stealth') { icon = <Eye size={12} />; color = 'text-slate-400'; }
          if (status === 'Burn') { icon = <Activity size={12} />; color = 'text-orange-500'; }
          
          return (
            <div key={status} className={`flex items-center text-xs ${color} bg-slate-900 px-1 rounded border border-slate-700`} title={status}>
              {icon} {amount}
            </div>
          );
        })}
      </div>
    );
  };

  const getEnemyStandeeClass = (enemy: any) => {
    const def = enemiesData.find(e => e.id === enemy.defId) as any;
    const keywords: string[] = def?.keywords || [];
    if (enemy.defId === 'goblin') return 'enemy-standee--goblin';
    if (enemy.defId === 'alchemy_master') return 'enemy-standee--plague';
    if (enemy.defId === 'hexaghost') return 'enemy-standee--void';
    if (enemy.defId === 'time_guardian') return 'enemy-standee--clockwork';
    if (enemy.defId === 'slime_small' || enemy.defId === 'slime_boss' || enemy.defId === 'fission' || enemy.defId === 'fission_small') {
      return 'enemy-standee--slime';
    }
    if (enemy.defId === 'jaw_worm') return 'enemy-standee--worm';
    if (enemy.defId === 'lagavulin') return 'enemy-standee--stone';
    if (enemy.defId === 'predictor') return 'enemy-standee--clockwork';
    if (enemy.defId === 'puppet_queen') return 'enemy-standee--clockwork';
    if (enemy.defId === 'cultist' || enemy.defId === 'intelligence_officer') return 'enemy-standee--void';
    if (enemy.defId === 'barrier') return 'enemy-standee--guard';
    if (enemy.defId.startsWith('symbiote')) return 'enemy-standee--void';
    if (keywords.includes('boss')) return 'enemy-standee--boss';
    if (keywords.includes('elite')) return 'enemy-standee--elite';
    return 'enemy-standee--guard';
  };

  const getIntentDisplay = (enemy: any) => {
    const def = enemiesData.find(e => e.id === enemy.defId) as any;
    const move = def?.moves[enemy.nextIntent];
    if (!move) {
      return {
        icon: '…',
        text: enemy.nextIntent || 'Intent',
        tone: 'neutral' as const,
        breakdown: { totalDamage: 0, hits: [] as number[], block: 0, statuses: [] as any[], extras: [] as string[] }
      };
    }

    const breakdown = {
      totalDamage: 0,
      hits: [] as number[],
      block: 0,
      statuses: [] as { status: string; amount: number; target: 'self' | 'player' | 'allies' }[],
      extras: [] as string[]
    };
    const attackSuppressedByStealth = Boolean(player.statuses['Stealth']) && move.some((a: any) => a.type === 'DealDamage');

    move.forEach((action: any) => {
      if (action.type === 'DealDamage') {
        const perHit = attackSuppressedByStealth ? 0 : engine.calculateDamage(action.amount || 0, enemy.statuses, player.statuses);
        breakdown.hits.push(perHit);
        breakdown.totalDamage += perHit;
      } else if (action.type === 'GainBlock') {
        breakdown.block += action.amount || 0;
      } else if (action.type === 'ApplyStatus' && action.status) {
        const target =
          action.target === 'Self' ? 'self' :
          action.target === 'AllEnemies' ? 'player' :
          action.target === 'RandomEnemy' ? 'player' :
          'player';
        breakdown.statuses.push({ status: action.status, amount: action.amount || 0, target });
      } else if (action.type === 'HealSelf') {
        breakdown.extras.push(`Heal ${action.amount || 0}`);
      } else if (action.type === 'SummonEnemy') {
        breakdown.extras.push(`Summon ${action.unit || 'Minion'}`);
      } else if (action.type === 'BuffAllEnemies') {
        breakdown.extras.push(`Allies +${action.amount || 0} STR`);
      } else if (action.type === 'PredictorAction') {
        breakdown.extras.push('Adaptive: 8 DMG or +10 Block');
      }
    });

    if (attackSuppressedByStealth) {
      breakdown.extras.unshift('Misses into Stealth');
    }

    const primaryStatus = breakdown.statuses[0]?.status;
    if (attackSuppressedByStealth && breakdown.block > 0) {
      return { icon: '◌', text: `Miss +${breakdown.block}🛡`, tone: 'hybrid' as const, breakdown };
    }
    if (attackSuppressedByStealth) {
      return { icon: '◌', text: 'Miss', tone: 'neutral' as const, breakdown };
    }
    if (breakdown.totalDamage > 0 && breakdown.block > 0) {
      return { icon: '⚔️', text: `${breakdown.totalDamage} +${breakdown.block}🛡`, tone: 'hybrid' as const, breakdown };
    }
    if (breakdown.totalDamage > 0) {
      return { icon: '⚔️', text: String(breakdown.totalDamage), tone: 'attack' as const, breakdown };
    }
    if (breakdown.block > 0) {
      return { icon: '🛡️', text: String(breakdown.block), tone: 'block' as const, breakdown };
    }
    if (primaryStatus) {
      return { icon: '✦', text: primaryStatus, tone: 'status' as const, breakdown };
    }
    if (breakdown.extras.length > 0) {
      return { icon: '✦', text: breakdown.extras[0], tone: 'status' as const, breakdown };
    }
    return { icon: '…', text: enemy.nextIntent || 'Intent', tone: 'neutral' as const, breakdown };
  };

  const formatHitBreakdown = (hits: number[]) => {
    if (hits.length <= 1) return '';
    const groups: string[] = [];
    for (const hit of hits) {
      const last = groups[groups.length - 1];
      if (!last) {
        groups.push(`${hit}`);
        continue;
      }
      const match = last.match(/^(\d+)(x(\d+))?$/);
      if (match && Number(match[1]) === hit) {
        const count = match[3] ? Number(match[3]) + 1 : 2;
        groups[groups.length - 1] = `${hit}x${count}`;
      } else {
        groups.push(`${hit}`);
      }
    }
    return groups.join(' + ');
  };

  const renderEnemyStatuses = (statuses: Record<string, number>) => {
    const iconMap: Record<string, { icon: string; color: string }> = {
      Vulnerable: { icon: '💀', color: '#c084fc' },
      Weak: { icon: '🌀', color: '#60a5fa' },
      Strength: { icon: '⚔️', color: '#f87171' },
      Poison: { icon: '☣', color: '#4ade80' },
      Stealth: { icon: '👁', color: '#cbd5e1' },
      Burn: { icon: '🔥', color: '#fb923c' },
      BlockBlocked: { icon: '⛓', color: '#fca5a5' }
    };

    const active = Object.entries(statuses).filter(([, amount]) => amount > 0);
    if (active.length === 0) return null;

    return (
      <div className="enemy-standee__statusRow">
        {active.map(([status, amount]) => {
          const meta = iconMap[status] || { icon: '✧', color: '#e2e8f0' };
          return (
            <div
              key={status}
              className="enemy-standee__statusIcon"
              title={status}
              style={{ color: meta.color, borderColor: meta.color }}
            >
              <span>{meta.icon}</span>
              <span className="enemy-standee__statusStack">{amount}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const playerPortrait = engine.state.player.portraitUrl || engine.loadCharacterPortrait();
  const playerName = engine.state.character?.name || 'Player';
  const playerHpPct = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0;
  const equippedRelics = engine.state.player.relics
    .map(id => (relicsData as any[]).find(r => r.id === id))
    .filter(Boolean) as any[];
  const resonanceCounts = equippedRelics.reduce((acc: Record<string, number>, relic: any) => {
    const key = relic.resonanceGroup || relic.tags?.[0];
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const resonanceValues = Object.values(resonanceCounts) as number[];
  const resonancePeak = resonanceValues.reduce((max, n) => Math.max(max, n), 0);
  const resonanceActive = resonanceValues.filter(n => n >= 2).length;
  const selectedCardPreview = selectedCard
    ? state.hand.find((c: any) => c.instanceId === selectedCard) || null
    : null;
  const getPreviewCost = (card: any) => {
    let cost = card.cost;
    if (card.type === 'Attack' && player.statuses['NextAttackDiscount']) {
      cost = Math.max(0, cost - player.statuses['NextAttackDiscount']);
    }
    if ((card as any).tempCost !== undefined) {
      cost = (card as any).tempCost;
    }
    return cost;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-4 relative">
      {/* Top Bar */}
      <div className="combat-hud">
        <div className="combat-hud__left">
          <button 
            onClick={() => setShowDeck(true)}
            className="combat-hud__deckBtn"
          >
            <Layers size={16} /> Deck ({engine.state.player.deck.length})
          </button>
          <div className="combat-hud__resources">
            <div className="combat-hud__pill is-hp">
              <Heart size={14}/> {player.hp}/{player.maxHp}
            </div>
            <div className="combat-hud__pill is-block">
              <Shield size={14}/> {player.block}
            </div>
            <div className="combat-hud__pill is-energy">
              <Zap size={14}/> {player.energy}/{engine.state.player.maxEnergy}
            </div>
            <div className="combat-hud__pill is-intel">
              <Eye size={14}/> Intel {engine.state.player.intel}
            </div>
            <div className="combat-hud__pill is-relics" title="Equipped relic count">
              <Layers size={14}/> Relics {engine.state.player.relics.length}
            </div>
            <div className={`combat-hud__pill is-corruption ${engine.state.player.corruption > 0 ? 'is-active' : ''}`} title="Corruption from relics and effects">
              <Skull size={14}/> Corr {engine.state.player.corruption}
            </div>
            <div className={`combat-hud__pill is-resonance ${resonancePeak >= 2 ? 'is-active' : ''}`} title="Relic resonance groups (2+ same group)">
              <Activity size={14}/> Res {resonancePeak || 0}{resonanceActive > 0 ? ` (${resonanceActive})` : ''}
            </div>
            <div className={`combat-hud__pill is-toxicity ${(player.potionToxicity || 0) > 3 ? 'is-overload' : ''}`} title="Potion Toxicity / Overload threshold 3">
              <FlaskConical size={14}/> Tox {player.potionToxicity || 0}/3
            </div>
          </div>
          
          {/* Potions */}
          <div className="combat-hud__potions">
            <div className="combat-hud__potionsLabel">Potions [{engine.state.player.potions.length}/3]</div>
            {[0, 1, 2].map(i => {
              const potionId = engine.state.player.potions[i];
              const potionDef = potionId ? potionsData.find(p => p.id === potionId) as any : null;
              const tox = potionDef ? (typeof potionDef.toxicity === 'number'
                ? potionDef.toxicity
                : (potionDef.effect?.type === 'GainEnergy' ? 2 : potionDef.effect?.type === 'Heal' ? 1 : 1)) : 0;
              return (
                <div 
                  key={i} 
                  className={`combat-hud__potionSlot ${potionDef ? 'is-filled' : 'is-empty'}`}
                  title={potionDef ? `${potionDef.name}: ${potionDef.description} (Toxicity +${tox})` : 'Empty Potion Slot'}
                  onClick={() => potionDef && handlePotionClick(i)}
                >
                  {potionDef && <FlaskConical size={15} className="combat-hud__potionIcon" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className={`combat-hud__turn ${state.isPlayerTurn ? 'is-player' : 'is-enemy'}`}>
          <span className="combat-hud__turnLabel">{state.isPlayerTurn ? 'PLAYER PHASE' : 'ENEMY PHASE'}</span>
          <span className="combat-hud__turnValue">Turn {state.turn}</span>
        </div>
      </div>

      {/* Battlefield */}
      <div className="flex-1 flex items-center justify-between px-12">
        {/* Player */}
        <div className="flex flex-col items-center">
          <div className={`player-standee ${state.isPlayerTurn ? 'is-player-turn' : 'is-enemy-turn'}`}>
            <div className="player-standee__intent">
              <div className="player-standee__intentIcon">{state.isPlayerTurn ? '✦' : '⏳'}</div>
              <div className="player-standee__intentValue">{state.isPlayerTurn ? 'Your Turn' : 'Enemy Turn'}</div>
            </div>
            {selectedCardPreview && (
              <div className="player-standee__castPreview">
                <div className="player-standee__castName">{selectedCardPreview.name}</div>
                <div className="player-standee__castMeta">
                  <span>Target: {selectedCardPreview.targeting === 'AllEnemies' ? 'All Enemies' : selectedCardPreview.targeting}</span>
                  <span>Cost: {getPreviewCost(selectedCardPreview)}</span>
                  <span>After: {Math.max(0, player.energy - getPreviewCost(selectedCardPreview))} EN</span>
                </div>
              </div>
            )}

            <div className="player-standee__frame">
              {playerPortrait ? (
                <img src={playerPortrait} alt={playerName} className="player-standee__art" />
              ) : (
                <div className="player-standee__fallback">Player</div>
              )}
              <div className="player-standee__shade" />
              <div className="player-standee__nameplate">{playerName}</div>
              {player.block > 0 && (
                <div className="player-standee__armorBadge" title={`Block ${player.block}`}>
                  <Shield size={12} />
                  <span>{player.block}</span>
                </div>
              )}
            </div>

            <div className="player-standee__hud">
              <div className="player-standee__hpBar">
                <div className="player-standee__hpFill" style={{ width: `${playerHpPct}%` }} />
                <div className="player-standee__hpText">{Math.max(0, player.hp)}/{player.maxHp}</div>
              </div>

              <div className="player-standee__resources">
                <div className="player-standee__resource player-standee__resource--energy" title="Energy">
                  <Zap size={12} /> {player.energy}/{engine.state.player.maxEnergy}
                </div>
                <div className="player-standee__resource player-standee__resource--intel" title="Intel">
                  <Eye size={12} /> {engine.state.player.intel}
                </div>
              </div>

              {renderEnemyStatuses(player.statuses)}
            </div>
          </div>
          
          {/* Elements */}
          {player.elements && player.elements.length > 0 && (
            <div className="flex gap-1 mt-2">
              {player.elements.map((el, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${el === 'Fire' ? 'bg-red-500' : el === 'Frost' ? 'bg-blue-300' : el === 'Lightning' ? 'bg-yellow-400' : el === 'Acid' ? 'bg-green-500' : 'bg-purple-500'}`} title={el} />
              ))}
            </div>
          )}

          {/* Constructs */}
          {player.constructs && player.constructs.length > 0 && (
            <div className="flex gap-2 mt-4">
              {player.constructs.map((c, i) => (
                <div key={i} className="w-16 h-20 bg-slate-700 rounded border border-slate-500 flex flex-col items-center justify-center text-xs relative">
                  <span className="text-[10px] text-center">{c.name}</span>
                  <span className="text-red-400"><Heart size={10} className="inline"/> {c.hp}/{c.maxHp}</span>
                  <span className="text-yellow-400"><Sword size={10} className="inline"/> {c.atk}</span>
                  {c.taunt && <Shield size={10} className="absolute top-1 right-1 text-blue-400" />}
                </div>
              ))}
            </div>
          )}

          {/* Delayed Cards */}
          {player.delayedCards && player.delayedCards.length > 0 && (
            <div className="flex gap-1 mt-4">
              {player.delayedCards.map((d, i) => (
                <div key={i} className="bg-slate-800 border border-yellow-600 rounded px-2 py-1 text-xs flex items-center gap-1" title={d.card.name}>
                  <span>{d.card.name}</span>
                  <span className="bg-yellow-600 text-black rounded-full w-4 h-4 flex items-center justify-center font-bold">{d.turns}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enemies */}
        <div className="flex gap-8">
          {state.enemies.map(enemy => (
            (() => {
              const intent = getIntentDisplay(enemy);
              const standeeClass = getEnemyStandeeClass(enemy);
              const isDead = enemy.hp <= 0;
              const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
              const imageUrl = `/assets/enemies/${enemy.defId}.png`;
              const toneClass =
                intent.tone === 'attack' ? 'is-attack' :
                intent.tone === 'block' ? 'is-block' :
                intent.tone === 'status' ? 'is-status' :
                intent.tone === 'hybrid' ? 'is-hybrid' : 'is-neutral';
              return (
            <div 
              key={enemy.id} 
              className={[
                'enemy-standee',
                standeeClass,
                selectedCard ? 'is-targetable' : '',
                selectedCard ? 'is-targeting' : '',
                isDead ? 'is-dead' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => handleEnemyClick(enemy.id)}
            >
              <div className={`enemy-standee__intent ${toneClass}`}>
                <div className="enemy-standee__intentIcon">{intent.icon}</div>
                <div className="enemy-standee__intentValue">{intent.text}</div>
                {(intent.breakdown.totalDamage > 0 || intent.breakdown.block > 0 || intent.breakdown.statuses.length > 0 || intent.breakdown.extras.length > 0) && (
                  <div className="enemy-standee__intentBreakdown">
                    {intent.breakdown.totalDamage > 0 && (
                      <div className="enemy-standee__intentChip is-damage" title="Estimated total incoming damage after Strength/Weak/Vulnerable">
                        <span>DMG</span>
                        <strong>{intent.breakdown.totalDamage}</strong>
                        {intent.breakdown.hits.length > 1 && <em>{formatHitBreakdown(intent.breakdown.hits)}</em>}
                      </div>
                    )}
                    {intent.breakdown.block > 0 && (
                      <div className="enemy-standee__intentChip is-block" title="Expected block gain">
                        <span>BLK</span>
                        <strong>+{intent.breakdown.block}</strong>
                      </div>
                    )}
                    {intent.breakdown.statuses.slice(0, 2).map((s: any, idx: number) => (
                      <div
                        key={`${s.status}_${idx}`}
                        className="enemy-standee__intentChip is-status"
                        title={`Status: ${s.status} ${s.amount > 0 ? `+${s.amount}` : ''} (${s.target})`}
                      >
                        <span>{s.target === 'self' ? 'SELF' : 'YOU'}</span>
                        <strong>{s.status}</strong>
                        {s.amount > 0 && <em>+{s.amount}</em>}
                      </div>
                    ))}
                    {intent.breakdown.extras.slice(0, 2).map((extra: string, idx: number) => (
                      <div key={`${extra}_${idx}`} className="enemy-standee__intentChip is-extra" title={extra}>
                        <span>FX</span>
                        <strong>{extra}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="enemy-standee__frame">
                <img src={imageUrl} alt={enemy.name} className="enemy-standee__art" />
                <div className="enemy-standee__shade" />
                <div className="enemy-standee__nameplate">{enemy.name}</div>
                {enemy.block > 0 && (
                  <div className="enemy-standee__armorBadge" title={`Block ${enemy.block}`}>
                    <Shield size={12} />
                    <span>{enemy.block}</span>
                  </div>
                )}
                {selectedCard && <div className="enemy-standee__targetRing" />}
              </div>

              <div className="enemy-standee__hud">
                <div className="enemy-standee__hpBar">
                  <div className="enemy-standee__hpFill" style={{ width: `${hpPct}%` }} />
                  <div className="enemy-standee__hpText">{Math.max(0, enemy.hp)}/{enemy.maxHp}</div>
                </div>
                {renderEnemyStatuses(enemy.statuses)}
              </div>
            </div>
              );
            })()
          ))}
        </div>
      </div>

      {/* Hand & Controls */}
      <div className="h-64 flex flex-col justify-end relative">
        <div className="absolute right-4 top-0">
          <button 
            onClick={() => engine.endTurn()}
            disabled={!state.isPlayerTurn}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-xl border border-slate-600 shadow-lg"
          >
            End Turn
          </button>
        </div>
        
        <div className="flex justify-center gap-2 mb-4">
          {state.hand.map((card: any) => (
            <div key={card.instanceId} className={selectedCard === card.instanceId ? '-translate-y-8' : ''}>
              <CardView 
                card={card} 
                disabled={!state.isPlayerTurn || (card.tags || []).includes('Unplayable') || player.energy < ((card as any).tempCost ?? card.cost)}
                onClick={() => handleCardClick(card)}
              />
            </div>
          ))}
        </div>
        
        <div className="flex justify-between px-8 text-slate-500 font-mono text-sm">
          <div>Draw: {state.drawPile.length}</div>
          <div>Discard: {state.discardPile.length}</div>
        </div>
      </div>

      {/* Deck Modal */}
      {showDeck && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col p-8 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Your Deck ({engine.state.player.deck.length} Cards)</h2>
            <button onClick={() => setShowDeck(false)} className="text-slate-400 hover:text-white px-4 py-2">Close</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-wrap gap-4 justify-center">
              {engine.state.player.deck.map((card: any, idx: number) => (
                <CardView key={idx} card={card} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
