import React, { useState } from 'react';
import { GameEngine } from '../engine/engine';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface CardArtGeneratorProps {
  engine: GameEngine;
  onClose: () => void;
}

export function CardArtGenerator({ engine, onClose }: CardArtGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const player = engine.state.player;
  const deck = player?.deck || [];
  
  // 获取玩家未拥有的卡牌用于生成艺术
  const availableCards = [
    { id: 'strike', name: 'Strike', prompt: 'A fierce sword slash attack, dynamic combat pose, vibrant red energy trail, dark fantasy art style' },
    { id: 'defend', name: 'Defend', prompt: 'A defensive stance with glowing blue shield, protective barrier, heroic posture, fantasy art' },
    { id: 'gather_intel', name: 'Gather Intel', prompt: 'A mysterious spy collecting secret intelligence, glowing blue orb of information, shadowy cloak, noir fantasy' },
    { id: 'precision_strike', name: 'Precision Strike', prompt: 'A perfect aimed attack hitting a weak point, deadly precision, glowing targeting reticle, action art' },
    { id: 'bash', name: 'Bash', prompt: 'A powerful heavy attack with a mace, crushing blow impact, intense anger, dark fantasy combat' },
    { id: 'flex', name: 'Flex', prompt: 'A muscular warrior showing off strength, powerful pose, heroic bodybuilding, fantasy illustration' },
    { id: 'quick_slash', name: 'Quick Slash', prompt: 'A rapid sword slash with motion blur, fast attack, agile assassin, dynamic action art' },
    { id: 'acrobatics', name: 'Acrobatics', prompt: 'A nimble fighter doing acrobatic flip, graceful movement, martial arts, dynamic pose' },
    { id: 'expose_weakness', name: 'Expose Weakness', prompt: 'Revealing enemy weaknesses with magical sight, glowing x-ray vision, tactical analysis, sci-fi fantasy' },
    { id: 'cleave', name: 'Cleave', prompt: 'A wide swinging sword attack hitting multiple enemies, powerful arc, devastating blow, dark fantasy' },
  ];

  const handleGenerate = async (cardPrompt: string) => {
    setGenerating(true);
    
    try {
      // 使用 fetch 调用后端 API 生成图片
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cardPrompt })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) {
          setGeneratedImages(prev => [...prev, data.imageUrl]);
        }
      }
    } catch (error) {
      console.error('Failed to generate art:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <Sparkles size={24} /> Card Art Generator
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-slate-400 text-sm">
            Select a card to generate custom art for your deck. This feature uses AI to create unique card illustrations.
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableCards.map(card => (
              <div 
                key={card.id}
                className="bg-slate-800 rounded-lg border border-slate-600 p-4 hover:border-emerald-500 transition-colors cursor-pointer group"
                onClick={() => setSelectedCard(card.prompt)}
              >
                <div className="aspect-[3/4] bg-slate-700 rounded-md mb-2 flex items-center justify-center text-slate-500 group-hover:bg-slate-600 transition-colors">
                  {generatedImages.includes(`/api/images/${card.id}.png`) ? (
                    <img 
                      src={`/api/images/${card.id}.png`} 
                      alt={card.name}
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <Sparkles size={32} />
                  )}
                </div>
                <div className="text-center font-medium text-white">{card.name}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerate(card.prompt);
                  }}
                  disabled={generating}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm py-1 px-2 rounded transition-colors flex items-center justify-center gap-1"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate
                </button>
              </div>
            ))}
          </div>
          
          {/* Custom prompt section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-3">Generate Custom Card Art</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your custom card art description..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => handleGenerate(prompt)}
                disabled={generating || !prompt.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                {generating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
