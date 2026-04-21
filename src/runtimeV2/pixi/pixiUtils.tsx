import { Application, Container, Graphics, TextStyle } from 'pixi.js';

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
