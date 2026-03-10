import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { systemRandom, systemRandomInt } from '@/infrastructure/rng/systemRandom';

type WarpDeceptionTextType = 'damage' | 'block' | 'cost';

interface WarpDeceptionTextProps {
  realValue: number;
  warpTide?: number;
  type?: WarpDeceptionTextType;
  className?: string;
}

export const WarpDeceptionText: React.FC<WarpDeceptionTextProps> = ({
  realValue,
  warpTide = 0,
  type = 'damage',
  className = ''
}) => {
  const normalizedReal = useMemo(() => {
    if (!Number.isFinite(realValue)) return 0;
    return Math.max(0, Math.floor(realValue));
  }, [realValue]);

  const [displayValue, setDisplayValue] = useState<string>(String(normalizedReal));
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    setDisplayValue(String(normalizedReal));
    if (warpTide < 50) {
      setIsGlitching(false);
      return;
    }

    const chaosFactor = Math.max(0, Math.min(1, (warpTide - 50) / 50));
    const glitchInterval = Math.max(120, 2000 - chaosFactor * 1800);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const intervalId = setInterval(() => {
      if (systemRandom() >= chaosFactor * 0.8) return;

      setIsGlitching(true);
      const lieTypeRoll = systemRandom();
      if (lieTypeRoll < 0.2) {
        setDisplayValue('???');
      } else if (lieTypeRoll < 0.45) {
        setDisplayValue('666');
      } else {
        const delta = systemRandomInt(21) - 10;
        const fakeNum = Math.max(0, normalizedReal + delta);
        setDisplayValue(String(fakeNum));
      }

      timeoutId = setTimeout(() => {
        setDisplayValue(String(normalizedReal));
        setIsGlitching(false);
      }, 140 + systemRandomInt(220));
    }, glitchInterval);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [normalizedReal, warpTide]);

  const baseClasses = isGlitching
    ? 'text-fuchsia-400 font-extrabold tracking-wider'
    : type === 'damage'
      ? 'text-red-400'
      : type === 'block'
        ? 'text-sky-300'
        : 'text-amber-300';

  return (
    <motion.span
      className={`inline-block ${baseClasses} ${className}`.trim()}
      animate={isGlitching
        ? {
            x: [0, -2, 2, -3, 3, 0],
            filter: [
              'drop-shadow(0 0 0 rgba(0,0,0,1))',
              'drop-shadow(-2px 0 0 rgba(255,0,0,0.6)) drop-shadow(2px 0 0 rgba(0,255,255,0.65))',
              'drop-shadow(0 0 0 rgba(0,0,0,1))'
            ]
          }
        : { x: 0, filter: 'drop-shadow(0 0 0 rgba(0,0,0,1))' }}
      transition={{ duration: 0.18, type: 'tween' }}
      style={{
        textShadow: isGlitching ? '0 0 6px rgba(168,85,247,0.65)' : 'none',
        fontFamily: isGlitching ? '"Courier New", monospace' : 'inherit'
      }}
    >
      {displayValue}
    </motion.span>
  );
};
