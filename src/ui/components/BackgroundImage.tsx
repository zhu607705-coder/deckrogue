import React, { useState, useEffect } from 'react';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';

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
    desktop: '/assets/char_select/char_select_hall.png',
    tablet: '/assets/char_select/char_select_hall.png',
    mobile: '/assets/char_select/char_select_hall.png'
  },
  map: {
    desktop: '/assets/backgrounds/bg_gemini_map.png',
    tablet: '/assets/backgrounds/bg_gemini_map.png',
    mobile: '/assets/backgrounds/bg_gemini_map.png'
  },
  rest: [
    {
      desktop: '/assets/rest/rest_camp.png',
      tablet: '/assets/rest/rest_camp.png',
      mobile: '/assets/rest/rest_camp.png'
    },
    {
      desktop: '/assets/rest/rest_wasteland.png',
      tablet: '/assets/rest/rest_wasteland.png',
      mobile: '/assets/rest/rest_wasteland.png'
    },
    {
      desktop: '/assets/rest/rest_station.png',
      tablet: '/assets/rest/rest_station.png',
      mobile: '/assets/rest/rest_station.png'
    }
  ],
  shop: [
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
      desktop: '/assets/reward/reward_loot.png',
      tablet: '/assets/reward/reward_loot.png',
      mobile: '/assets/reward/reward_loot.png'
    },
    {
      desktop: '/assets/reward/reward_vault.png',
      tablet: '/assets/reward/reward_vault.png',
      mobile: '/assets/reward/reward_vault.png'
    }
  ],
  upgrade: {
    desktop: '/assets/upgrade/upgrade_forge.png',
    tablet: '/assets/upgrade/upgrade_forge.png',
    mobile: '/assets/upgrade/upgrade_forge.png'
  },
  events: {
    forge: '/assets/events/event_forge.png',
    shrine: '/assets/events/event_shrine.png',
    warp: '/assets/events/event_warp.png',
    trial: '/assets/events/event_trial.png',
    hereticAltar: '/assets/events/event_heretic_altar.png',
    chaosGate: '/assets/events/event_chaos_gate.png'
  }
};

export function getRandomBackground<T extends readonly { desktop: string }[]>(
  backgrounds: T
): T[number]['desktop'] {
  return backgrounds[systemRandomInt(backgrounds.length)].desktop;
}
