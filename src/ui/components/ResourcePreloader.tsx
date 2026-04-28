/**
 * @file ResourcePreloader.tsx
 * @description 资源预加载组件 - 预加载图片和字体资源
 *
 * 主要职责:
 * - 预加载图片资源
 * - 预加载字体资源
 * - 支持 Suspense 集成
 */

import React, { Suspense, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { localEventArt, localShopArt } from '@/content/assets/standeeArt';

interface PreloadableResource {
  type: 'image' | 'font';
  url: string;
  crossOrigin?: string;
}

interface ResourcePreloaderProps {
  resources: PreloadableResource[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onProgress?: (loaded: number, total: number) => void;
}

function preloadResource(resource: PreloadableResource): Promise<void> {
  return new Promise((resolve, reject) => {
    if (resource.type === 'image') {
      const img = new Image();
      img.crossOrigin = resource.crossOrigin || 'anonymous';
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${resource.url}`));
      img.src = resource.url;
    } else if (resource.type === 'font') {
      if ('fonts' in document) {
        document.fonts.load(`16px "${resource.url}"`).then(() => resolve()).catch(() => reject(new Error(`Failed to load font: ${resource.url}`)));
      } else {
        resolve();
      }
    }
  });
}

export function ResourcePreloader({
  resources,
  children,
  fallback = null,
  onProgress,
}: ResourcePreloaderProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    let completed = 0;

    const loadAll = async () => {
      try {
        await Promise.all(
          resources.map(async (resource) => {
            await preloadResource(resource);
            if (mounted) {
              completed++;
              setLoadedCount(completed);
              onProgress?.(completed, resources.length);
            }
          })
        );
        if (mounted) {
          setIsComplete(true);
        }
      } catch {
        if (mounted) {
          setIsComplete(true);
        }
      }
    };

    loadAll();

    return () => {
      mounted = false;
    };
  }, [resources, onProgress]);

  return (
    <Suspense fallback={fallback || <DefaultPreloadFallback progress={loadedCount / resources.length} />}>
      {children}
    </Suspense>
  );
}

function DefaultPreloadFallback({ progress }: { progress: number }) {
  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-gray-500 text-sm font-mono">
          正在预加载资源... {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}

export function usePreloadedImages(urls: string[]) {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadedSet = new Set<string>();

    const loadImages = async () => {
      await Promise.all(
        urls.map(
          (url) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                loadedSet.add(url);
                if (mounted) {
                  setLoaded(new Set(loadedSet));
                }
                resolve();
              };
              img.onerror = () => resolve();
              img.src = url;
            })
        )
      );
      if (mounted) {
        setLoading(false);
      }
    };

    loadImages();

    return () => {
      mounted = false;
    };
  }, [urls]);

  return { loaded, loading };
}

export function LazyImage({
  src,
  alt,
  className,
  placeholder,
  onLoad,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { placeholder?: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className || ''}`}>
      {!isLoaded && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          {placeholder}
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className || ''} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.({} as React.SyntheticEvent<HTMLImageElement>);
          }}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
}

export function preloadRouteAssets(screen: string): PreloadableResource[] {
  const assetBase = '/assets';
  const assets: PreloadableResource[] = [];

  const screenAssets: Record<string, string[]> = {
    Map: [
      `${assetBase}/backgrounds/bg_gemini_map.png`,
      `${assetBase}/map/map_combat.svg`,
      `${assetBase}/map/map_event.svg`,
      `${assetBase}/map/map_shop.svg`,
      `${assetBase}/map/map_rest.svg`,
    ],
    Combat: [
      `${assetBase}/backgrounds/battle_ancient_dungeon.png`,
      `${assetBase}/backgrounds/battle_dark_battlefield.png`,
      `${assetBase}/backgrounds/battle_fortified_checkpoint.png`,
      `${assetBase}/backgrounds/battle_twisted_corridor.png`,
      `${assetBase}/backgrounds/bg_reactor_cathedral.png`,
      `${assetBase}/backgrounds/bg_plague_catacombs.png`,
      `${assetBase}/backgrounds/bg_psychic_archive.png`,
    ],
    Shop: [
      localShopArt('shop_salvage_exchange'),
      localShopArt('shop_merchant_salvager'),
      `${assetBase}/shop/shop_merchant.png`,
      `${assetBase}/shop/shop_black.png`,
      `${assetBase}/shop/shop_forge.png`,
    ],
    Event: [
      localEventArt('event_rusting_medicae'),
      localEventArt('event_martyr_shrine'),
      localEventArt('npc_medicae_servitor'),
      localEventArt('npc_shrine_warden'),
      localEventArt('npc_inquisitor_interrogator'),
      localEventArt('npc_warp_oracle'),
      `${assetBase}/events/event_shrine.png`,
      `${assetBase}/events/event_chaos_gate.png`,
      `${assetBase}/events/event_forge.png`,
    ],
    Rest: [
      `${assetBase}/rest/rest_camp.png`,
      `${assetBase}/rest/rest_station.png`,
      `${assetBase}/rest/rest_wasteland.png`,
    ],
    Reward: [
      `${assetBase}/reward/reward_loot.png`,
      `${assetBase}/reward/reward_vault.png`,
    ],
  };

  const matchedAssets = screenAssets[screen] || [];
  matchedAssets.forEach((url) => {
    assets.push({ type: 'image', url });
  });

  return assets;
}

export default ResourcePreloader;
