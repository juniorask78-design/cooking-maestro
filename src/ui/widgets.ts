import Phaser from 'phaser';
import { THEME } from '../config/theme';

export const FONT = '"Baloo 2", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 20, color = THEME.palette.hudText, style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, ...style });
}

export interface ButtonOpts { w?: number; h?: number; color?: number; textColor?: string; size?: number; disabled?: boolean }

/** Bouton arrondi, cliquable à la souris et au doigt. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, o: ButtonOpts = {}) {
  const w = o.w ?? 240;
  const h = o.h ?? 56;
  const color = o.color ?? THEME.palette.accent;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
    g.fillStyle(o.disabled ? 0x8a8299 : color, 1).fillRoundedRect(-w / 2, -h / 2 + (hover ? 2 : 0), w, h, 16);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 6, -h / 2 + 4 + (hover ? 2 : 0), w - 12, h / 2 - 6, 10);
  };
  draw(false);
  const t = text(scene, 0, 0, label, o.size ?? 22, o.textColor ?? THEME.palette.accentText, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  if (!o.disabled) {
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => draw(true));
    c.on('pointerout', () => draw(false));
    c.on('pointerup', () => onClick());
  }
  return c;
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = 0xfff6e6, alpha = 1) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25).fillRoundedRect(x, y + 6, w, h, 22);
  g.fillStyle(color, alpha).fillRoundedRect(x, y, w, h, 22);
  return g;
}

/** Petit chef dessiné en formes simples (provisoire, en attendant les sprites). */
export function drawChef(scene: Phaser.Scene, bodyColor: number, hat: string, scale = 1) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.18).fillEllipse(0, 22, 40, 12);
  g.fillStyle(bodyColor, 1).fillRoundedRect(-17, -6, 34, 30, 12);
  g.lineStyle(3, 0x3d3158, 1).strokeRoundedRect(-17, -6, 34, 30, 12);
  g.fillStyle(0xffd9b3, 1).fillCircle(0, -14, 15);
  g.lineStyle(3, 0x3d3158, 1).strokeCircle(0, -14, 15);
  g.fillStyle(0x3d3158, 1).fillCircle(-5, -15, 2.5).fillCircle(5, -15, 2.5);
  g.fillStyle(0xff9a8a, 0.8).fillCircle(-9, -9, 3).fillCircle(9, -9, 3);
  if (hat === 'toque') {
    g.fillStyle(0xffffff, 1).fillRect(-10, -36, 20, 10).fillCircle(-7, -38, 7).fillCircle(7, -38, 7).fillCircle(0, -42, 8);
    g.lineStyle(2, 0x3d3158, 1).strokeRect(-10, -32, 20, 6);
  } else if (hat === 'casquette') {
    g.fillStyle(0xef6f6c, 1).fillEllipse(0, -26, 30, 14).fillRect(0, -26, 20, 4);
  } else if (hat === 'bandana') {
    g.fillStyle(0x6ec6ff, 1).fillRect(-15, -28, 30, 8).fillTriangle(13, -26, 22, -30, 22, -20);
  }
  c.add(g);
  c.setScale(scale);
  return c;
}

export function colorOf<T extends { id: string }>(list: T[], id: string): T {
  return list.find((x) => x.id === id) ?? list[0];
}
