import React from 'react';
import { GameEngine } from '../engine/engine';
import charactersData from '../content/characters.json';
import { Heart, Zap, Play } from 'lucide-react';

export function CharacterSelectView({ engine }: { engine: GameEngine }) {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center relative">
      <h1 className="text-4xl font-serif mb-12 text-emerald-400">Select Your Character</h1>
      
      <div className="flex flex-wrap justify-center gap-8 max-w-5xl">
        {charactersData.map(char => {
          const isSelected = engine.state.character?.id === char.id;
          return (
            <div 
              key={char.id}
              onClick={() => engine.selectCharacter(char.id)}
              className={`w-64 bg-slate-900 border-2 rounded-xl p-6 flex flex-col items-center cursor-pointer transition-all shadow-xl
                ${isSelected ? 'border-emerald-500 scale-105 bg-slate-800' : 'border-slate-700 hover:border-emerald-400 hover:-translate-y-2'}
              `}
            >
              <div className="w-24 h-24 bg-slate-800 rounded-full mb-4 flex items-center justify-center border border-slate-600 overflow-hidden">
                <img 
                  src={`/assets/characters/${char.id}.png`} 
                  alt={char.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-2xl font-bold">${char.name[4]}</span>`;
                  }}
                />
              </div>
              <h2 className="text-xl font-bold mb-2">{char.name}</h2>
              <div className="flex gap-4 mb-4 text-sm">
                <span className="flex items-center gap-1 text-red-400"><Heart size={16}/> {char.maxHp}</span>
                <span className="flex items-center gap-1 text-yellow-400"><Zap size={16}/> {char.maxEnergy}</span>
              </div>
              <p className="text-sm text-slate-400 text-center">
                {char.description}
              </p>
            </div>
          );
        })}
      </div>

      {engine.state.character && (
        <div className="mt-12">
          <button 
            onClick={() => engine.startGame()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-bold text-white transition-colors shadow-lg shadow-emerald-900/50"
          >
            <Play size={20} fill="currentColor" /> Start Game
          </button>
        </div>
      )}
    </div>
  );
}
