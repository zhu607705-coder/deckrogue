/**
 * @file MapIcon.tsx
 * @description 地图图标组件 - 根据节点类型渲染对应的地图图标
 *
 * 主要职责:
 * - 根据节点类型选择图标
 * - 提供默认图标回退
 * - 支持自定义样式和替代文本
 */

import React, { useState, useEffect, useMemo } from 'react';

interface MapIconProps {
  type: string;
  className?: string;
  alt?: string;
}

const DEFAULT_ICON = '/assets/map/map_event.svg';

const getIconPath = (type: string): string => {
  const baseName = `map_${type.toLowerCase()}`;
  return `/assets/map/${baseName}.svg`;
};

export function MapIcon({ type, className = '', alt }: MapIconProps) {
  const iconSrc = useMemo(() => getIconPath(type), [type]);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(true);
    
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(iconSrc);
      setIsLoading(false);
    };
    img.onerror = () => {
      setCurrentSrc(DEFAULT_ICON);
      setIsLoading(false);
    };
    img.src = iconSrc;
  }, [iconSrc]);
  
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
        if (target.src !== DEFAULT_ICON) {
          target.src = DEFAULT_ICON;
        } else {
          target.style.opacity = '0.3';
        }
      }}
    />
  );
}
