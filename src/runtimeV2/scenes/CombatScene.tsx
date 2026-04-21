import React, { useState, useEffect, useRef } from 'react';
import type { CombatSceneProps } from '../sceneProps';

export interface CombatSceneComponentProps {
  scene: CombatSceneProps;
  onComplete: () => void;
}

export function CombatScene({ scene, onComplete }: CombatSceneComponentProps) {
  const { player, combat, room } = scene;

  const [bossAdaptationLevel, setBossAdaptationLevel] = useState<number>(0);
  const [bossArchetype, setBossArchetype] = useState<string>('unknown');
  const [victoryTriggered, setVictoryTriggered] = useState<boolean>(false);

  const hasTriggeredVictory = useRef<boolean>(false);

  useEffect(() => {
    const updateAdaptationUI = () => {
      if (!combat.enemies) return;

      const bossEnemy: any = combat.enemies.find((e: any) =>
        e.defId?.includes('boss') ||
        e.name?.toLowerCase().includes('boss') ||
        e.name?.toLowerCase().includes('king') ||
        e.name?.toLowerCase().includes('guardian')
      );

      if (bossEnemy?.adaptationProfile) {
        setBossAdaptationLevel(bossEnemy.adaptationProfile.adaptationLevel || 0);
        setBossArchetype(bossEnemy.adaptationProfile.playerArchetype || 'unknown');
      } else {
        setBossAdaptationLevel(0);
        setBossArchetype('unknown');
      }
    };

    updateAdaptationUI();
  }, [combat.enemies]);

  useEffect(() => {
    if (!combat.enemies || combat.enemies.length === 0) return;
    if (hasTriggeredVictory.current) return;

    const allEnemiesDead = combat.enemies.every(enemy => enemy.hp <= 0);

    if (allEnemiesDead) {
      hasTriggeredVictory.current = true;
      setVictoryTriggered(true);
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }, [combat.enemies, onComplete]);

  return (
    <div className="combat-scene" data-scene="combat" style={{
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1a1a2e',
      color: '#eee',
      padding: '16px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <div className="combat-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#2a2a3e',
        borderRadius: '8px',
      }}>
        <h2 style={{ margin: 0 }}>{room.title ?? 'Combat'}</h2>
        <span className="turn-indicator" style={{
          backgroundColor: '#4a4a6e',
          padding: '6px 12px',
          borderRadius: '4px',
          fontWeight: 'bold',
        }}>Turn {combat.turn}</span>
      </div>
      <div className="player-hud" style={{
        display: 'flex',
        gap: '16px',
        padding: '12px',
        backgroundColor: '#2a2a3e',
        borderRadius: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#ff6b6b' }}>HP: {player.hp}/{player.maxHp}</span>
        <span style={{ color: '#4ecdc4' }}>Energy: {combat.playerEnergy}</span>
        <span style={{ color: '#95a5a6' }}>Block: {combat.playerBlock}</span>
        <span>Hand: {combat.hand.length}</span>
        <span>Draw: {combat.drawPileCount}</span>
        <span>Discard: {combat.discardPileCount}</span>
      </div>
      {room.guidance && (
        <div className="combat-guidance" data-guidance="combat" style={{
          padding: '12px',
          backgroundColor: '#332f4a',
          border: '1px solid #6a5acd',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <strong>{room.guidance.headline}</strong>
          <p style={{ margin: '6px 0 0', color: '#c7c3e8' }}>
            {room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}{room.guidance.reason}
          </p>
        </div>
      )}
      <div className="enemies" style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '24px',
        justifyContent: 'center',
      }}>
        {combat.enemies.map((enemy) => (
          <div key={enemy.id} className="enemy" data-enemy-id={enemy.id} style={{
            backgroundColor: '#2a2a3e',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '150px',
            border: '1px solid #ff6b6b',
          }}>
            <div className="enemy-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}>
              <span className="enemy-name" style={{ fontWeight: 'bold', color: '#ff6b6b' }}>{enemy.defId}</span>
              <span className="enemy-block">Block: {enemy.block}</span>
            </div>
            <div className="enemy-hp-bar" style={{
              backgroundColor: '#333',
              borderRadius: '4px',
              height: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div className="hp-fill" style={{
                width: `${(enemy.hp / enemy.maxHp) * 100}%`,
                height: '100%',
                backgroundColor: '#ff6b6b',
                transition: 'width 0.3s',
              }} />
              <span className="hp-text" style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>{enemy.hp}/{enemy.maxHp}</span>
            </div>
            <div className="enemy-intent" style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span className="intent-label" style={{ color: '#888' }}>Next:</span>
              <span className="intent-value" style={{
                backgroundColor: '#4a4a6e',
                padding: '4px 8px',
                borderRadius: '4px',
              }}>{enemy.nextIntent ?? 'unknown'}</span>
            </div>
          </div>
        ))}
      </div>
      {victoryTriggered && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #4ecdc4',
          borderRadius: '12px',
          padding: '24px 48px',
          textAlign: 'center',
          zIndex: 100,
        }}>
          <div style={{ color: '#4ecdc4', fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
            ⚔️ 战斗胜利 ⚔️
          </div>
          <div style={{ color: '#888', fontSize: '14px' }}>
            正在进入奖励界面...
          </div>
        </div>
      )}
      <div className="hand-area" style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 'auto',
        padding: '16px',
        backgroundColor: '#2a2a3e',
        borderRadius: '8px',
        minHeight: '120px',
      }}>
        {combat.handCards.map((card, index) => (
          <div key={`${card.id}-${index}`} className="hand-card" data-card-id={card.id} style={{
            backgroundColor: '#4a4a6e',
            borderRadius: '8px',
            padding: '12px 16px',
            cursor: 'pointer',
            border: '2px solid #6a6a8e',
            maxWidth: '180px',
          }}>
            <div style={{ fontWeight: 'bold' }}>{card.name}</div>
            <div style={{ color: '#9fd3ff', fontSize: '12px' }}>{card.cost} energy · {card.type}</div>
            <div style={{ color: '#c7c3e8', fontSize: '11px', marginTop: '6px' }}>{card.playHint}</div>
          </div>
        ))}
      </div>
      {bossAdaptationLevel > 0 && (
        <div className="boss-adaptation-indicator" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          border: '1px solid #ff6600',
          padding: '8px 12px',
          borderRadius: '4px'
        }}>
          <div style={{ color: '#ff6600', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            ⚠ BOSS ADAPTING
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888', fontSize: '11px' }}>Lv {Math.round(bossAdaptationLevel * 100)}%</span>
            <div style={{
              width: '80px',
              height: '6px',
              background: '#333',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${bossAdaptationLevel * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff6600, #ff9900)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
          <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
            Against: {bossArchetype}
          </div>
        </div>
      )}
      <button onClick={onComplete} className="complete-combat-btn" style={{
        marginTop: '16px',
        padding: '12px 24px',
        backgroundColor: '#4ecdc4',
        color: '#1a1a2e',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '16px',
      }}>
        End Combat
      </button>
    </div>
  );
}
