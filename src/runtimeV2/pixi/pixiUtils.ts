import { Graphics, TextStyle } from 'pixi.js';

export interface PixiHitTarget {
  action: string;
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixiHitHandler extends PixiHitTarget {
  handler: () => void;
}

declare global {
  interface Window {
    __deckrogueRuntimeV2PixiTargets?: {
      screen: string;
      width: number;
      height: number;
      targets: PixiHitTarget[];
    };
  }
}

export const COLORS = {
  background: 0x1a1a2e,
  panel: 0x16213e,
  panelLight: 0x1f3460,
  accent: 0x0f3460,
  highlight: 0xe94560,
  text: 0xffffff,
  textMuted: 0x888888,
  health: 0x4ade80,
  healthBg: 0x374151,
  energy: 0x60a5fa,
  gold: 0xfbbf24,
  cardCommon: 0x9ca3af,
  cardUncommon: 0x22c55e,
  cardRare: 0x8b5cf6,
  nodeCombat: 0xef4444,
  nodeElite: 0xf59e0b,
  nodeBoss: 0xdc2626,
  nodeEvent: 0x8b5cf6,
  nodeShop: 0x22c55e,
  nodeRest: 0x06b6d4,
  nodeUnknown: 0x6b7280,
};

export function createTextStyle(options: Partial<TextStyle> = {}): TextStyle {
  return new TextStyle({
    fontFamily: 'Arial, sans-serif',
    fontSize: 14,
    fill: 0xffffff,
    ...options,
  });
}

export function drawRoundedRect(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: number,
  strokeColor?: number,
  strokeWidth: number = 1
): void {
  graphics.roundRect(x, y, width, height, radius);
  graphics.fill(fillColor);
  if (strokeColor !== undefined) {
    graphics.stroke({ width: strokeWidth, color: strokeColor });
  }
}

export function drawCircle(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  fillColor: number,
  strokeColor?: number,
  strokeWidth: number = 1
): void {
  graphics.circle(x, y, radius);
  graphics.fill(fillColor);
  if (strokeColor !== undefined) {
    graphics.stroke({ width: strokeWidth, color: strokeColor });
  }
}

export function publishPixiHitTargets(screen: string, width: number, height: number, targets: PixiHitTarget[]): void {
  if (typeof window === 'undefined') return;
  window.__deckrogueRuntimeV2PixiTargets = {
    screen,
    width,
    height,
    targets: targets.map((target) => ({
      action: target.action,
      id: target.id,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
    })),
  };
}

export function createDedupedPointerHandler(handler: () => void): () => void {
  let lastTriggeredAt = 0;
  return () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastTriggeredAt < 250) return;
    lastTriggeredAt = now;
    handler();
  };
}

export function dispatchPixiCanvasHit(event: MouseEvent, handlers: PixiHitHandler[]): boolean {
  const registry = typeof window !== 'undefined' ? window.__deckrogueRuntimeV2PixiTargets : undefined;
  const canvas = event.currentTarget;
  if (!registry || !(canvas instanceof HTMLCanvasElement)) return false;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * registry.width;
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * registry.height;
  const target = [...handlers].reverse().find((entry) =>
    x >= entry.x - entry.width / 2 &&
    x <= entry.x + entry.width / 2 &&
    y >= entry.y - entry.height / 2 &&
    y <= entry.y + entry.height / 2
  );
  if (!target) return false;
  target.handler();
  return true;
}
