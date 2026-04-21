import { useEffect, useState } from 'react';

interface FontPreloadOptions {
  fonts: { family: string; weights?: number[]; styles?: string[] }[];
  timeout?: number;
}

export function useFontPreload({ fonts, timeout = 3000 }: FontPreloadOptions) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadFonts = async () => {
      try {
        const fontFaces: FontFace[] = [];

        for (const { family, weights = [400, 700], styles = ['normal'] } of fonts) {
          for (const weight of weights) {
            for (const style of styles) {
              const fontFace = new FontFace(family, `normal ${style} ${weight}px ${family}`);
              fontFaces.push(fontFace);
            }
          }
        }

        await Promise.race([
          Promise.all(fontFaces.map((face) => face.load())),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Font load timeout')), timeout)
          ),
        ]);

        for (const face of fontFaces) {
          document.fonts.add(face);
        }

        if (mounted) {
          setLoaded(true);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setLoaded(false);
          setLoading(false);
        }
      }
    };

    loadFonts();

    return () => {
      mounted = false;
    };
  }, [fonts, timeout]);

  return { loaded, loading };
}

export function preloadSystemFonts() {
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      console.log('System fonts loaded');
    });
  }
}

export function useCriticalFonts() {
  return useFontPreload({
    fonts: [
      { family: 'Cinzel', weights: [400, 700] },
      { family: 'serif', weights: [400, 700] },
    ],
    timeout: 2000,
  });
}

export default useFontPreload;
