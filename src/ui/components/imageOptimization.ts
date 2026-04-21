export interface ImageSrcSet {
  avif?: string;
  webp?: string;
  fallback: string;
}

export function generateImageSrcSet(
  basePath: string,
  formats: ('avif' | 'webp')[] = ['webp']
): ImageSrcSet {
  const fallback = basePath;

  const srcSet: ImageSrcSet = { fallback };

  if (formats.includes('webp')) {
    const webpPath = basePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    if (webpPath !== basePath) {
      srcSet.webp = webpPath;
    }
  }

  if (formats.includes('avif')) {
    const avifPath = basePath.replace(/\.(png|jpg|jpeg)$/i, '.avif');
    if (avifPath !== basePath) {
      srcSet.avif = avifPath;
    }
  }

  return srcSet;
}

export function useResponsiveImage(
  src: string,
  breakpoints?: { width: number; src: string }[]
) {
  if (!breakpoints || breakpoints.length === 0) {
    return { src, srcSet: undefined };
  }

  const srcSet = breakpoints
    .map((bp) => `${bp.src} ${bp.width}w`)
    .join(', ');

  return {
    src: breakpoints[0]?.src || src,
    srcSet,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  };
}

export function isWebPSupported(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  });
}

export async function getOptimalImageFormat(
  paths: ImageSrcSet
): Promise<string> {
  const supported = await isWebPSupported();

  if (supported && paths.webp) {
    return paths.webp;
  }

  return paths.fallback;
}

export function getCriticalImages(): string[] {
  return [
    '/assets/characters/puppeteer.png',
    '/assets/characters/informant.png',
    '/assets/characters/alchemist.png',
    '/assets/map/map_combat.svg',
    '/assets/map/map_event.svg',
    '/assets/backgrounds/menu_war_room.png',
  ];
}

export function getPreloadHints(): { rel: string; href: string; type?: string; imagesrcset?: string }[] {
  return getCriticalImages().map((src) => ({
    rel: 'preload',
    href: src,
    as: 'image',
  }));
}
