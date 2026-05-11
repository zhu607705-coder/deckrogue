/**
 * @file BackgroundImage.tsx
 * @description 背景图片组件 - 支持渐变回退和遮罩层的图片渲染
 *
 * 主要职责:
 * - 加载并显示背景图片
 * - 提供渐变回退方案
 * - 支持遮罩层和透明度配置
 */

import React, { useState, useEffect } from 'react';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import { localEventArt, localShopArt } from '@/content/assets/standeeArt';

interface BackgroundImageProps {
  src: string;
  fallbackGradient?: string;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  children?: React.ReactNode;
}

export function BackgroundImage({
  src,
  fallbackGradient,
  className = '',
  overlay = true,
  overlayOpacity = 0.6,
  children
}: BackgroundImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;
  }, [src]);

  const defaultFallback = 'linear-gradient(135deg, #1a1f2e 0%, #0f1218 50%, #07080b 100%)';
  const gradient = fallbackGradient || defaultFallback;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 bg-image-layer bg-image-layer--responsive transition-opacity duration-500 ${
          !loaded || error ? 'bg-image-loading' : ''
        }`}
        style={{
          backgroundImage: error ? gradient : `url(${src})`,
          opacity: loaded && !error ? 1 : error ? 1 : 0.6
        }}
      />
      
      {overlay && (
        <div 
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: overlayOpacity }}
        />
      )}
      
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
}

interface ResponsiveBackgroundProps {
  sources: {
    mobile?: string;
    tablet?: string;
    desktop: string;
  };
  fallbackGradient?: string;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  children?: React.ReactNode;
}

export function ResponsiveBackground({
  sources,
  fallbackGradient,
  className = '',
  overlay = true,
  overlayOpacity = 0.6,
  children
}: ResponsiveBackgroundProps) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getBackgroundSrc = () => {
    if (windowWidth < 640 && sources.mobile) return sources.mobile;
    if (windowWidth < 1024 && sources.tablet) return sources.tablet;
    return sources.desktop;
  };

  return (
    <BackgroundImage
      src={getBackgroundSrc()}
      fallbackGradient={fallbackGradient}
      className={className}
      overlay={overlay}
      overlayOpacity={overlayOpacity}
    >
      {children}
    </BackgroundImage>
  );
}

export const VIEW_BACKGROUNDS = {
  characterSelect: {
    desktop: '/assets/char_select/char_select_hall.svg',
    tablet: '/assets/char_select/char_select_hall.svg',
    mobile: '/assets/char_select/char_select_hall.svg'
  },
  map: {
    desktop: '/assets/backgrounds/bg_gemini_map.png',
    tablet: '/assets/backgrounds/bg_gemini_map.png',
    mobile: '/assets/backgrounds/bg_gemini_map.png'
  },
  rest: [
    {
      desktop: '/assets/rest/rest_camp.svg',
      tablet: '/assets/rest/rest_camp.svg',
      mobile: '/assets/rest/rest_camp.svg'
    },
    {
      desktop: '/assets/rest/rest_wasteland.svg',
      tablet: '/assets/rest/rest_wasteland.svg',
      mobile: '/assets/rest/rest_wasteland.svg'
    },
    {
      desktop: '/assets/rest/rest_station.svg',
      tablet: '/assets/rest/rest_station.svg',
      mobile: '/assets/rest/rest_station.svg'
    }
  ],
  shop: [
    {
      desktop: localShopArt('shop_salvage_exchange'),
      tablet: localShopArt('shop_salvage_exchange'),
      mobile: localShopArt('shop_salvage_exchange')
    },
    {
      desktop: '/assets/shop/shop_forge.png',
      tablet: '/assets/shop/shop_forge.png',
      mobile: '/assets/shop/shop_forge.png'
    },
    {
      desktop: '/assets/shop/shop_trade.png',
      tablet: '/assets/shop/shop_trade.png',
      mobile: '/assets/shop/shop_trade.png'
    },
    {
      desktop: '/assets/shop/shop_black.png',
      tablet: '/assets/shop/shop_black.png',
      mobile: '/assets/shop/shop_black.png'
    }
  ],
  reward: [
    {
      desktop: '/assets/reward/reward_loot.svg',
      tablet: '/assets/reward/reward_loot.svg',
      mobile: '/assets/reward/reward_loot.svg'
    },
    {
      desktop: '/assets/reward/reward_vault.svg',
      tablet: '/assets/reward/reward_vault.svg',
      mobile: '/assets/reward/reward_vault.svg'
    }
  ],
  upgrade: {
    desktop: '/assets/upgrade/upgrade_forge.svg',
    tablet: '/assets/upgrade/upgrade_forge.svg',
    mobile: '/assets/upgrade/upgrade_forge.svg'
  },
  events: {
    forge: '/assets/events/event_forge.png',
    rustingMedicae: localEventArt('event_rusting_medicae'),
    shrine: '/assets/events/event_shrine.png',
    martyrShrine: localEventArt('event_martyr_shrine'),
    warp: '/assets/events/event_warp.png',
    trial: '/assets/events/event_trial.png',
    hereticAltar: '/assets/events/event_heretic_altar.png',
    chaosGate: '/assets/events/event_void_gate.png'
  }
};

export function getRandomBackground<T extends readonly { desktop: string }[]>(
  backgrounds: T
): T[number]['desktop'] {
  return backgrounds[systemRandomInt(backgrounds.length)].desktop;
}
