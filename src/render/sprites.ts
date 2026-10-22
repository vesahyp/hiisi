/**
 * Procedural sprite cache, Höyry's way: every sprite is drawn once with
 * canvas paths at the render resolution and reused as an image.
 * Coordinates inside a draw function are world units centred on (0, 0).
 */
import { RARITY_COLOR, type Item } from '../game/items';

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

type C = CanvasRenderingContext2D;

const OUT = '#0b0d0a';
let res = 2;
const cache = new Map<string, Sprite>();

export function setSpriteResolution(r: number): void {
  const q = Math.round(r * 4) / 4;
  if (q !== res) {
    res = q;
    cache.clear();
  }
}

function make(key: string, hw: number, hh: number, draw: (c: C) => void): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(hw * 2 * res);
  cv.height = Math.ceil(hh * 2 * res);
  const c = cv.getContext('2d')!;
  c.scale(res, res);
  c.translate(hw, hh);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  const s = { img: cv, w: hw * 2, h: hh * 2, ox: hw, oy: hh };
  cache.set(key, s);
  return s;
}

export function blit(ctx: C, s: Sprite, x: number, y: number, flip = false, alpha = 1): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(s.img, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  } else ctx.drawImage(s.img, x - s.ox, y - s.oy, s.w, s.h);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function ell(c: C, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = OUT, lw = 1.2): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function rect(c: C, x: number, y: number, w: number, h: number, fill: string, r = 1.5, stroke: string | null = OUT, lw = 1.2): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

/** The hero: a grey wool coat, a red sash, a birch-bark pack. The weapon is drawn separately, rotated. */
export function heroSprite(frame: number, coatColor = '#5a5a60'): Sprite {
  return make(`hero:${frame}:${coatColor}`, 18, 24, (c) => {
    const step = frame === 1 ? 1.6 : frame === 2 ? -1.6 : 0;
    rect(c, -5.5, 8 + Math.max(0, step), 4.5, 7 - Math.max(0, step), '#2a2420', 1.5);
    rect(c, 1, 8 + Math.max(0, -step), 4.5, 7 - Math.max(0, -step), '#2a2420', 1.5);
    // the pack behind the shoulder
    rect(c, -11, -4, 6, 10, '#c8a060', 2);
    c.beginPath();
    c.moveTo(-9, 10);
    c.quadraticCurveTo(-10, -2, -6, -5);
    c.lineTo(6, -5);
    c.quadraticCurveTo(10, -2, 9, 10);
    c.closePath();
    c.fillStyle = coatColor;
    c.fill();
    c.lineWidth = 1.3;
    c.strokeStyle = OUT;
    c.stroke();
    rect(c, -8.6, 2, 17.2, 3, '#a83a2a', 0.5, null);
    ell(c, 0, -10, 7, 6.8, '#e8c9a0');
    // hair and a knit cap
    c.beginPath();
    c.arc(0, -11.5, 7, Math.PI, 2 * Math.PI);
    c.fillStyle = '#3a2a1a';
    c.fill();
    rect(c, -7.5, -15.5, 15, 3.4, '#8a3a2a', 1.2);
    ell(c, -2.5, -9.5, 1.1, 1.1, '#1a1a1a', null);
    ell(c, 2.5, -9.5, 1.1, 1.1, '#1a1a1a', null);
  });
}

const ENEMY_LOOK: Record<string, { body: string; r: number; eye: string }> = {
  rotta: { body: '#6a5a4a', r: 9, eye: '#ff6a4a' },
  hiisi: { body: '#4f8a3a', r: 11, eye: '#ffe060' },
  jousihiisi: { body: '#3f7a4a', r: 11, eye: '#ffe060' },
  luuranko: { body: '#d8d0b8', r: 12, eye: '#2a3a5a' },
  karhu: { body: '#4a3222', r: 22, eye: '#ffb060' },
};

export function enemySprite(id: string, frame: number): Sprite {
  const d = ENEMY_LOOK[id] ?? ENEMY_LOOK.hiisi;
  const r = d.r;
  return make(`enemy:${id}:${frame}`, r + 12, r + 14, (c) => {
    const bob = frame === 1 ? -1 : 0;
    ell(c, 0, r * 0.9, r, r * 0.4, 'rgba(0,0,0,0.35)', null);
    if (id === 'rotta') {
      ell(c, 0, bob, r * 1.2, r * 0.75, d.body);
      ell(c, r * 1.0, bob - 2, r * 0.5, r * 0.4, d.body);
      c.strokeStyle = '#8a7a6a';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-r * 1.1, bob);
      c.quadraticCurveTo(-r * 1.8, bob + 4, -r * 2.1, bob - 3);
      c.stroke();
      ell(c, r * 1.1, bob - 3, 1.3, 1.3, d.eye, null);
      return;
    }
    if (id === 'luuranko') {
      rect(c, -r * 0.55, bob - r * 0.2, r * 1.1, r * 1.1, d.body, 3);
      c.strokeStyle = '#8a8070';
      c.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(-r * 0.4, bob + k * 4);
        c.lineTo(r * 0.4, bob + k * 4);
        c.stroke();
      }
      ell(c, 0, bob - r * 0.75, r * 0.6, r * 0.6, d.body);
      ell(c, -2.5, bob - r * 0.8, 1.6, 1.8, d.eye, null);
      ell(c, 2.5, bob - r * 0.8, 1.6, 1.8, d.eye, null);
      rect(c, -r * 0.8, bob + r * 0.9, r * 0.5, r * 0.6, d.body, 1);
      rect(c, r * 0.3, bob + r * 0.9, r * 0.5, r * 0.6, d.body, 1);
      return;
    }
    if (id === 'karhu') {
      ell(c, 0, bob, r, r * 0.8, d.body);
      ell(c, r * 0.55, bob - r * 0.45, r * 0.55, r * 0.5, d.body);
      ell(c, r * 0.35, bob - r * 0.85, r * 0.18, r * 0.18, '#3a2418');
      ell(c, r * 0.8, bob - r * 0.85, r * 0.18, r * 0.18, '#3a2418');
      ell(c, r * 0.95, bob - r * 0.35, r * 0.12, r * 0.12, '#1a0a08', null);
      ell(c, r * 0.6, bob - r * 0.5, 2, 2, d.eye, null);
      for (const px of [-r * 0.6, -r * 0.1, r * 0.3]) rect(c, px, bob + r * 0.55, r * 0.3, r * 0.45, '#3a2418', 2);
      return;
    }
    // hiisi: a green goblin with pointed ears, a club or a bow
    ell(c, 0, bob + 2, r * 0.9, r * 0.8, d.body);
    ell(c, 0, bob - r * 0.6, r * 0.75, r * 0.7, d.body);
    c.fillStyle = d.body;
    c.strokeStyle = OUT;
    c.lineWidth = 1.2;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.moveTo(sx * r * 0.6, bob - r * 0.7);
      c.lineTo(sx * r * 1.2, bob - r * 1.3);
      c.lineTo(sx * r * 0.35, bob - r * 1.05);
      c.closePath();
      c.fill();
      c.stroke();
    }
    ell(c, -3, bob - r * 0.65, 1.8, 1.8, d.eye, null);
    ell(c, 3, bob - r * 0.65, 1.8, 1.8, d.eye, null);
    ell(c, -3, bob - r * 0.65, 0.8, 0.8, '#1a1a1a', null);
    ell(c, 3, bob - r * 0.65, 0.8, 0.8, '#1a1a1a', null);
    rect(c, -r * 0.5, bob + r * 0.5, r * 0.4, r * 0.6, '#2a3a20', 1);
    rect(c, r * 0.1, bob + r * 0.5, r * 0.4, r * 0.6, '#2a3a20', 1);
    if (id === 'jousihiisi') {
      c.strokeStyle = '#8a5a2a';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(r * 0.9, bob, r * 0.8, -1.3, 1.3);
      c.stroke();
    } else {
      c.strokeStyle = '#6a4a2a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(r * 0.8, bob + 4);
      c.lineTo(r * 1.4, bob - 8);
      c.stroke();
    }
  });
}

/** A weapon held in a hand, pointing right; the renderer rotates it. */
export function weaponSprite(it: Item): Sprite {
  const col = RARITY_COLOR[it.rarity];
  return make(`weapon:${it.kind}:${it.rarity}:${it.affix ?? ''}`, 22, 12, (c) => {
    c.lineCap = 'round';
    if (it.kind === 'sword') {
      const len = 16 * (it.affix === 'long' ? 1.3 : 1);
      c.strokeStyle = '#1a1c1e';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(-2, 0);
      c.lineTo(len, 0);
      c.stroke();
      c.strokeStyle = it.rarity >= 3 ? '#e8d0ff' : '#e0e4e8';
      c.lineWidth = 2.8;
      c.beginPath();
      c.moveTo(-2, 0);
      c.lineTo(len, 0);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -4.5);
      c.lineTo(0, 4.5);
      c.stroke();
      c.strokeStyle = '#5a3a1a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(-1, 0);
      c.stroke();
    } else {
      c.strokeStyle = '#1a1c1e';
      c.lineWidth = 4.5;
      c.beginPath();
      c.arc(2, 0, 10, -1.3, 1.3);
      c.stroke();
      c.strokeStyle = it.rarity >= 2 ? '#a06a3a' : '#8a5a2a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(2, 0, 10, -1.3, 1.3);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(4.7, -9.6);
      c.lineTo(-2, 0);
      c.lineTo(4.7, 9.6);
      c.stroke();
    }
  });
}

export function itemSprite(it: Item): Sprite {
  const col = RARITY_COLOR[it.rarity];
  return make(`item:${it.kind}:${it.rarity}:${it.color}:${it.affix ?? ''}`, 14, 14, (c) => {
    ell(c, 0, 8, 8, 3, 'rgba(0,0,0,0.35)', null);
    c.lineCap = 'round';
    if (it.kind === 'sword') {
      c.rotate(-0.7);
      c.strokeStyle = '#1a1c1e';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(8, 0);
      c.stroke();
      c.strokeStyle = '#e0e4e8';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(8, 0);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-6, -4);
      c.lineTo(-6, 4);
      c.stroke();
    } else if (it.kind === 'bow') {
      c.strokeStyle = '#8a5a2a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(-3, 0, 8, -1.2, 1.2);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(0, -7.5);
      c.lineTo(0, 7.5);
      c.stroke();
    } else if (it.kind === 'coat') {
      c.beginPath();
      c.moveTo(-8, 8);
      c.lineTo(-7, -5);
      c.lineTo(-3, -8);
      c.lineTo(3, -8);
      c.lineTo(7, -5);
      c.lineTo(8, 8);
      c.closePath();
      c.fillStyle = it.rarity >= 2 ? '#6a5a7a' : '#5a5a60';
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = 1.5;
      c.stroke();
    } else {
      ell(c, 0, 2, 6, 6.5, it.color || '#c050a0');
      rect(c, -2.2, -9, 4.4, 5, '#d0c8b0', 1);
      ell(c, -2, 0, 1.4, 2.4, 'rgba(255,255,255,0.45)', null);
    }
  });
}

export function chestSprite(open: boolean): Sprite {
  return make(`chest:${open}`, 14, 12, (c) => {
    ell(c, 0, 8, 10, 3, 'rgba(0,0,0,0.35)', null);
    rect(c, -11, -2, 22, 12, '#6a4a22', 2);
    if (open) {
      rect(c, -11, -12, 22, 6, '#8a6232', 2);
      rect(c, -8, -1, 16, 4, '#e0b048', 1, null);
    } else {
      rect(c, -11, -7, 22, 6, '#8a6232', 2);
      rect(c, -2, -3, 4, 5, '#e0b048', 1);
    }
  });
}

export function arrowSprite(): Sprite {
  return make('arrow', 10, 4, (c) => {
    c.strokeStyle = '#d8d0b8';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(6, 0);
    c.stroke();
    c.fillStyle = '#e8e0d0';
    c.beginPath();
    c.moveTo(9, 0);
    c.lineTo(4, -2.5);
    c.lineTo(4, 2.5);
    c.fill();
    c.fillStyle = '#a04030';
    c.beginPath();
    c.moveTo(-8, 0);
    c.lineTo(-5, -2.5);
    c.lineTo(-5, 2.5);
    c.fill();
  });
}
