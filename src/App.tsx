import React, { useEffect, useState, useMemo } from 'react';
import { GameEngine } from './engine/engine';
import { CombatView } from './ui/CombatView';
import { MapView } from './ui/MapView';
import { CharacterSelectView } from './ui/CharacterSelectView';
import { RewardView } from './ui/RewardView';
import { ShopView } from './ui/ShopView';
import { RestView } from './ui/RestView';
import { EventView } from './ui/EventView';
import { UpgradeView } from './ui/UpgradeView';
import { RemoveCardView } from './ui/RemoveCardView';

export default function App() {
  const engine = useMemo(() => new GameEngine(Date.now()), []);
  const [, setTick] = useState(0);

  useEffect(() => {
    return engine.subscribe(() => setTick(t => t + 1));
  }, [engine]);

  return (
    <div className="w-full h-screen bg-black font-sans overflow-hidden">
      {engine.state.screen === 'CharacterSelect' && <CharacterSelectView engine={engine} />}
      {engine.state.screen === 'Map' && <MapView engine={engine} />}
      {engine.state.screen === 'Combat' && <CombatView engine={engine} />}
      {engine.state.screen === 'Reward' && <RewardView engine={engine} />}
      {engine.state.screen === 'Shop' && <ShopView engine={engine} />}
      {engine.state.screen === 'Rest' && <RestView engine={engine} />}
      {engine.state.screen === 'Upgrade' && <UpgradeView engine={engine} />}
      {engine.state.screen === 'RemoveCard' && <RemoveCardView engine={engine} />}
      {engine.state.screen === 'Event' && <EventView engine={engine} />}
      {engine.state.screen === 'GameOver' && (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <h1 className="text-4xl mb-8 text-red-500">Game Over</h1>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-800 rounded-lg border border-slate-600 hover:bg-slate-700"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
