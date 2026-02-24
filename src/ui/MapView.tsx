import React, { useState } from 'react';
import { GameEngine } from '../engine/engine';
import { Eye, Image as ImageIcon } from 'lucide-react';
import { MapNode } from '../engine/types';
import { CardArtGenerator } from './CardArtGenerator';

export function MapView({ engine }: { engine: GameEngine }) {
  const [generatingArt, setGeneratingArt] = useState(false);
  const map = engine.state.map;
  const intel = engine.state.player.intel;
  const currentNodeId = engine.state.currentNodeId;

  // Group by floor (y)
  const floors: MapNode[][] = [];
  map.forEach(node => {
    if (!floors[node.y]) floors[node.y] = [];
    floors[node.y].push(node);
  });

  const isNodeSelectable = (node: MapNode) => {
    if (!currentNodeId) return node.y === 0; // Can select any starting node
    const currentNode = map.find(n => n.id === currentNodeId);
    return currentNode?.next.includes(node.id) ?? false;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center overflow-y-auto relative">
      <div className="mb-8 flex items-center justify-between w-full max-w-2xl sticky top-0 bg-slate-950/90 p-4 z-10 rounded-xl backdrop-blur-sm">
        <div className="text-2xl font-bold font-serif flex items-center gap-4">
          Act 1 Map
          <span className="text-emerald-400 text-lg flex items-center gap-1 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <Eye size={18}/> {intel} Intel
          </span>
        </div>
        <button 
          onClick={() => setGeneratingArt(true)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-600 transition-colors text-sm text-emerald-400"
        >
          <ImageIcon size={16} /> Generate Card Art
        </button>
      </div>
      
      <div className="flex flex-col-reverse gap-12 items-center w-full max-w-2xl relative pb-32">
        {/* Draw lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          {map.map(node => {
            return node.next.map(nextId => {
              const nextNode = map.find(n => n.id === nextId);
              if (!nextNode) return null;
              
              const isPathActive = currentNodeId === node.id && isNodeSelectable(nextNode);
              const isPathTaken = false; // We don't store history yet, but could highlight past paths

              return (
                <line
                  key={`${node.id}-${nextId}`}
                  x1={`${node.x * 100}%`}
                  y1={`${100 - (node.y / 9) * 100}%`}
                  x2={`${nextNode.x * 100}%`}
                  y2={`${100 - (nextNode.y / 9) * 100}%`}
                  stroke={isPathActive ? '#10b981' : '#334155'}
                  strokeWidth={isPathActive ? 3 : 2}
                  strokeDasharray={isPathActive ? 'none' : '4 4'}
                />
              );
            });
          })}
        </svg>

        {floors.map((floor, y) => (
          <div key={y} className="flex justify-around w-full relative z-10" style={{ height: '60px' }}>
            {floor.map(node => {
              const isCurrent = currentNodeId === node.id;
              const isSelectable = isNodeSelectable(node);
              
              let bgColor = 'bg-slate-800';
              let borderColor = 'border-slate-600';
              let textColor = 'text-slate-300';
              
              if (isCurrent) {
                bgColor = 'bg-emerald-900';
                borderColor = 'border-emerald-400';
                textColor = 'text-emerald-400';
              } else if (isSelectable) {
                bgColor = 'bg-slate-700 hover:bg-slate-600';
                borderColor = 'border-slate-400 hover:border-emerald-400';
                textColor = 'text-white';
              } else if (node.y < (map.find(n => n.id === currentNodeId)?.y ?? -1)) {
                bgColor = 'bg-slate-900';
                borderColor = 'border-slate-800';
                textColor = 'text-slate-600';
              }

              return (
                <div 
                  key={node.id} 
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${node.x * 100}%`, top: '50%' }}
                >
                  <button
                    onClick={() => isSelectable && engine.enterNode(node.id)}
                    disabled={!isSelectable}
                    className={`w-14 h-14 rounded-full border-2 font-bold transition-all shadow-lg flex items-center justify-center text-xs
                      ${bgColor} ${borderColor} ${textColor}
                      ${isSelectable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                    `}
                  >
                    {node.revealed ? node.type.substring(0, 3) : '?'}
                  </button>
                  {!node.revealed && intel > 0 && isSelectable && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); engine.revealNode(node.id); }}
                      className="absolute -bottom-6 text-emerald-400 hover:text-emerald-300 text-[10px] flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700"
                    >
                      <Eye size={10}/> Reveal
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {generatingArt && (
        <CardArtGenerator engine={engine} onClose={() => setGeneratingArt(false)} />
      )}
    </div>
  );
}
