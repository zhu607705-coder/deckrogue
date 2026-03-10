import React, { useState, useEffect, useMemo } from 'react';

interface MapIconProps {
  type: string;
  className?: string;
  alt?: string;
}

const DEFAULT_ICON = '/assets/map/map_event.png';

const getIconPaths = (type: string): { png: string; svg: string } => {
  const baseName = `map_${type.toLowerCase()}`;
  return {
    png: `/assets/map/${baseName}.png`,
    svg: `/assets/map/${baseName}.svg`
  };
};

export function MapIcon({ type, className = '', alt }: MapIconProps) {
  const paths = useMemo(() => getIconPaths(type), [type]);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackCount, setFallbackCount] = useState(0);
  
  useEffect(() => {
    setIsLoading(true);
    setFallbackCount(0);
    
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(paths.png);
      setIsLoading(false);
    };
    img.onerror = () => {
      setCurrentSrc(paths.svg);
      setIsLoading(false);
    };
    img.src = paths.png;
  }, [paths]);
  
  if (isLoading) {
    return (
      <div className={`animate-pulse bg-stone-800 rounded ${className}`} />
    );
  }
  
  return (
    <img
      src={currentSrc}
      alt={alt || `${type} icon`}
      className={className}
      onError={(e) => {
        const target = e.currentTarget;
        if (fallbackCount === 0 && target.src.endsWith('.png')) {
          setFallbackCount(1);
          target.src = paths.svg;
        } else if (fallbackCount === 1) {
          setFallbackCount(2);
          target.src = DEFAULT_ICON;
        } else {
          target.style.opacity = '0.3';
        }
      }}
    />
  );
}
