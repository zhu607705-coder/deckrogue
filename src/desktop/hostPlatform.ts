export type DeckrogueHostPlatform = 'web' | 'desktop';
export type DeckrogueDesktopChannel = 'web' | 'development' | 'production';

export interface DeckrogueDesktopBridge {
  hostPlatform: 'desktop';
  appVersion: string;
  channel: Exclude<DeckrogueDesktopChannel, 'web'>;
  isPackaged: boolean;
}

export interface DeckrogueDesktopWindowLike {
  deckrogueDesktop?: DeckrogueDesktopBridge | null;
}

export interface DeckrogueDesktopEnvironment {
  hostPlatform: DeckrogueHostPlatform;
  isDesktop: boolean;
  appVersion: string | null;
  channel: DeckrogueDesktopChannel;
  isPackaged: boolean;
}

declare global {
  interface Window {
    deckrogueDesktop?: DeckrogueDesktopBridge;
  }
}

export function resolveHostPlatform(source?: DeckrogueDesktopWindowLike): DeckrogueHostPlatform {
  return source?.deckrogueDesktop?.hostPlatform === 'desktop' ? 'desktop' : 'web';
}

export function getDesktopEnvironment(source?: DeckrogueDesktopWindowLike): DeckrogueDesktopEnvironment {
  const bridge = source?.deckrogueDesktop;
  if (!bridge || bridge.hostPlatform !== 'desktop') {
    return {
      hostPlatform: 'web',
      isDesktop: false,
      appVersion: null,
      channel: 'web',
      isPackaged: false,
    };
  }

  return {
    hostPlatform: 'desktop',
    isDesktop: true,
    appVersion: bridge.appVersion,
    channel: bridge.channel,
    isPackaged: bridge.isPackaged,
  };
}

export function resolveCurrentDesktopEnvironment(): DeckrogueDesktopEnvironment {
  if (typeof window === 'undefined') {
    return {
      hostPlatform: 'web',
      isDesktop: false,
      appVersion: null,
      channel: 'web',
      isPackaged: false,
    };
  }

  return getDesktopEnvironment(window);
}
