import React, { useEffect, useMemo, useState } from 'react';
import type { BackgroundVisualMode } from '@/ui/components/backgroundVisuals';
import type { ThemeMode } from '@/ui/theme/ThemeContext';

export type ScreenId =
  | 'Launcher'
  | 'CharacterSelect'
  | 'Map'
  | 'Combat'
  | 'Reward'
  | 'Event'
  | 'Shop'
  | 'Rest'
  | 'Upgrade'
  | 'RelicUpgrade'
  | 'RemoveCard'
  | 'Enchant'
  | 'GameOver'
  | 'Victory';

type ViewBackgroundConfig = {
  primary: string[];
  secondary?: string[];
  primaryPosition?: string;
  secondaryPosition?: string;
  opacity?: number;
  secondaryOpacity?: number;
};

const VIEW_BACKGROUNDS: Partial<Record<ScreenId, ViewBackgroundConfig>> = {
  CharacterSelect: {
    primary: ['/assets/backgrounds/menu_throne_room.png', '/assets/backgrounds/menu_war_room.png', '/assets/backgrounds/bg_imperium_palace.png'],
    secondary: ['/assets/backgrounds/ui_cracked_stained_glass.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center top',
    opacity: 0.52,
    secondaryOpacity: 0.18
  },
  Launcher: {
    primary: ['/assets/backgrounds/menu_throne_room.png', '/assets/backgrounds/menu_war_room.png'],
    secondary: ['/assets/backgrounds/ui_cracked_stained_glass.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center top',
    opacity: 0.5,
    secondaryOpacity: 0.16
  },
  Reward: {
    primary: ['/assets/backgrounds/ui_glowing_rune_circle.png', '/assets/backgrounds/battle_ancient_dungeon.png'],
    secondary: ['/assets/backgrounds/bg_ancient_ruins.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.38,
    secondaryOpacity: 0.14
  },
  Shop: {
    primary: ['/assets/backgrounds/menu_cogitator_terminal.png', '/assets/backgrounds/battle_fortified_checkpoint.png', '/assets/backgrounds/bg_mech_factory.png'],
    secondary: ['/assets/backgrounds/ui_worn_metal_panel.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.42,
    secondaryOpacity: 0.18
  },
  Rest: {
    primary: ['/assets/backgrounds/bg_sisters_chapel.png', '/assets/backgrounds/ui_cracked_stained_glass.png'],
    secondary: ['/assets/backgrounds/battle_ancient_dungeon.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.4,
    secondaryOpacity: 0.12
  },
  Upgrade: {
    primary: ['/assets/backgrounds/ui_mechanical_gears.png', '/assets/backgrounds/bg_mech_factory.png'],
    secondary: ['/assets/backgrounds/bg_time_rift.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.36,
    secondaryOpacity: 0.12
  },
  Enchant: {
    primary: ['/assets/backgrounds/ui_mechanical_gears.png', '/assets/backgrounds/bg_mech_factory.png'],
    secondary: ['/assets/backgrounds/bg_time_rift.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.36,
    secondaryOpacity: 0.12
  },
  GameOver: {
    primary: ['/assets/backgrounds/battle_twisted_corridor.png', '/assets/backgrounds/bg_chaos_warp.png'],
    secondary: ['/assets/backgrounds/ui_rusted_iron_door.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.5,
    secondaryOpacity: 0.14
  },
  Victory: {
    primary: ['/assets/backgrounds/bg_imperium_palace.png', '/assets/backgrounds/menu_throne_room.png'],
    secondary: ['/assets/backgrounds/ui_glowing_rune_circle.png'],
    primaryPosition: 'center center',
    secondaryPosition: 'center center',
    opacity: 0.42,
    secondaryOpacity: 0.14
  }
};

function useResolvedImage(sources: string[] | undefined, enabled = true) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
  }, [enabled, sources?.join('|')]);

  const src = enabled && sources && sources.length > 0 ? sources[Math.min(index, sources.length - 1)] : null;

  const onError = () => {
    setLoaded(false);
    setIndex((prev) => {
      const next = prev + 1;
      if (!sources || next >= sources.length) return prev;
      return next;
    });
  };

  const exhausted = !src || !sources || index >= sources.length - 1;

  return {
    src,
    loaded,
    setLoaded,
    onError,
    showFallback: !loaded && exhausted
  };
}

export function ViewBackgroundLayer({
  screen,
  themeMode,
  backgroundVisualMode
}: {
  screen: ScreenId;
  themeMode: ThemeMode;
  backgroundVisualMode: BackgroundVisualMode;
}) {
  const config = VIEW_BACKGROUNDS[screen];
  const isManagedByView = screen === 'Map' || screen === 'Combat' || screen === 'Event' || screen === 'RemoveCard';
  const enabled = !!config && !isManagedByView;

  const primary = useResolvedImage(config?.primary, enabled);
  const secondary = useResolvedImage(config?.secondary, enabled);

  const intensityMultiplier = backgroundVisualMode === 'cinematic' ? 0.85 : backgroundVisualMode === 'vivid' ? 1.15 : 1;

  const visual = useMemo(() => {
    const baseOpacity = (config?.opacity ?? 0.4) * intensityMultiplier;
    const secondaryOpacity = (config?.secondaryOpacity ?? 0.12) * intensityMultiplier;
    const darkOverlay = backgroundVisualMode === 'cinematic' ? 0.7 : backgroundVisualMode === 'vivid' ? 0.42 : 0.56;
    const lightOverlay = backgroundVisualMode === 'cinematic' ? 0.66 : backgroundVisualMode === 'vivid' ? 0.3 : 0.46;
    return {
      primaryOpacity: Math.max(0, Math.min(1, baseOpacity)),
      secondaryOpacity: Math.max(0, Math.min(1, secondaryOpacity)),
      veilOpacity: themeMode === 'dark' ? darkOverlay : lightOverlay
    };
  }, [config, backgroundVisualMode, intensityMultiplier, themeMode]);

  if (!enabled) return null;

  return (
    <div className="app-view-bg" aria-hidden="true">
      <div className={`bg-image-layer bg-image-layer--responsive ${primary.showFallback ? 'bg-image-fallback bg-image-loading' : ''}`} />
      {primary.src && (
        <img
          key={`bg-primary-${screen}-${primary.src}`}
          src={primary.src}
          alt=""
          className={`app-view-bg__img app-view-bg__img--primary ${primary.loaded ? 'is-loaded' : ''}`}
          style={{
            opacity: primary.loaded ? visual.primaryOpacity : 0,
            objectPosition: config?.primaryPosition || 'center center'
          }}
          onLoad={() => primary.setLoaded(true)}
          onError={primary.onError}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      )}
      {config?.secondary && secondary.src && (
        <img
          key={`bg-secondary-${screen}-${secondary.src}`}
          src={secondary.src}
          alt=""
          className={`app-view-bg__img app-view-bg__img--secondary ${secondary.loaded ? 'is-loaded' : ''}`}
          style={{
            opacity: secondary.loaded ? visual.secondaryOpacity : 0,
            objectPosition: config?.secondaryPosition || 'center center'
          }}
          onLoad={() => secondary.setLoaded(true)}
          onError={secondary.onError}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      <div
        className={`app-view-bg__veil ${themeMode === 'dark' ? 'is-dark' : 'is-light'}`}
        style={{ opacity: visual.veilOpacity }}
      />
    </div>
  );
}
