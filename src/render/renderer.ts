import { DOOR, DOOR_OPEN, FLOOR, REMEMBERED, STAIRS_DOWN, STAIRS_UP, T, UNSEEN, VISIBLE, VOID, WALL, type Dungeon } from '../game/dungeon';
import { hash2 } from '../game/rng';
import type { Enemy, Hero, SimState } from '../game/state';
import { held } from '../game/hero';
import { swordReach, bowRange } from '../game/attacks';
import { RARITY_COLOR, isMelee } from '../game/items';
import { FAMILY } from '../game/content/weapons';
import { arrowSprite, blit, chestSprite, enemySprite, heroSprite, itemSprite, setSpriteResolution, weaponSprite } from './sprites';
import { t } from '../i18n';

/** How tall a wall stands above its tile, in world units: the 3/4 view. */
const WH = 14;

interface Palette {
  floor: string;
  floor2: string;
  seam: string;
  wallTop: string;
  wallFront: string;
  mortar: string;
  moss: string;
}

const PALETTES: Palette[] = [
  // the root cellar: packed earth, timber and roots
  { floor: '#2e2a22', floor2: '#34302a', seam: '#1c1a14', wallTop: '#6e5a40', wallFront: '#3a2e20', mortar: '#1e180e', moss: '#4b7a44' },
  // the cellars: grey stone and moss
  { floor: '#2a2e29', floor2: '#30352f', seam: '#1a1d19', wallTop: '#6a746a', wallFront: '#363d36', mortar: '#1e2420', moss: '#4b7a44' },
  // the mine: dark rock, ore glints
  { floor: '#262628', floor2: '#2c2c30', seam: '#161618', wallTop: '#5c5c66', wallFront: '#2a2a32', mortar: '#18181c', moss: '#6a6a40' },
  // the deep mine: wet black rock
  { floor: '#202428', floor2: '#262a30', seam: '#121416', wallTop: '#4e5862', wallFront: '#222830', mortar: '#101418', moss: '#3a6a7a' },
  // the bear's den: red earth and bones
  { floor: '#2e2420', floor2: '#342a26', seam: '#1a1210', wallTop: '#6e4a40', wallFront: '#36201c', mortar: '#1e100e', moss: '#7a5a3a' },
];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private scale = 1;
  private t = 0;
  camX = 0;
  camY = 0;
  private camInit = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    const c = this.canvas;
    this.cssW = c.clientWidth || window.innerWidth;
    this.cssH = c.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(this.cssW * this.dpr);
    c.height = Math.round(this.cssH * this.dpr);
    // About 400k square units in view: 14 tiles across a portrait phone.
    const cssScale = Math.max(0.7, Math.sqrt((this.cssW * this.cssH) / 400000));
    this.scale = cssScale * this.dpr;
    setSpriteResolution(this.scale);
  }

  needsResize(): boolean {
    const c = this.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    return w !== this.cssW || h !== this.cssH || Math.min(2, window.devicePixelRatio || 1) !== this.dpr;
  }

  view(): { w: number; h: number } {
    return { w: this.canvas.width / this.scale, h: this.canvas.height / this.scale };
  }

  toScreen(x: number, y: number): { x: number; y: number; scale: number } {
    const s = this.scale / this.dpr;
    return { x: (x - this.camX) * s + this.cssW / 2, y: (y - this.camY) * s + this.cssH / 2, scale: s };
  }

  render(s: SimState, dt: number): void {
    this.t += dt;
    const ctx = this.ctx;
    const d = s.dungeon;
    const h = s.hero;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sc = this.scale;
    const viewW = W / sc;
    const viewH = H / sc;
    // in portrait the controls own the bottom half, so the hero is kept in the upper part of the screen
    const tx = s.cam.x;
    const ty = s.cam.y + (this.cssH > this.cssW ? viewH * 0.15 : 0);
    if (!this.camInit || s.floorTime < 0.05) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
    }
    const k = 1 - Math.pow(0.0005, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    const shake = s.shake > 0 ? Math.min(1, s.shake) * 8 : 0;
    const camX = this.camX + (shake ? (Math.random() - 0.5) * shake : 0);
    const camY = this.camY + (shake ? (Math.random() - 0.5) * shake : 0);
    const left = camX - viewW / 2;
    const top = camY - viewH / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07090a';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(sc, 0, 0, sc, -left * sc, -top * sc);
    const p = PALETTES[Math.min(PALETTES.length - 1, s.floor - 1)];

    const x0 = Math.max(0, Math.floor(left / T) - 1);
    const x1 = Math.min(d.w - 1, Math.floor((left + viewW) / T) + 1);
    const y0 = Math.max(0, Math.floor(top / T) - 1);
    const y1 = Math.min(d.h - 1, Math.floor((top + viewH + WH) / T) + 1);

    // floors, doors and stairs
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const i = yy * d.w + xx;
        const tt = d.tiles[i];
        if (tt === VOID || tt === WALL || d.seen[i] === UNSEEN) continue;
        const x = xx * T;
        const y = yy * T;
        const hv = hash2(xx, yy, s.floor);
        ctx.fillStyle = (xx + yy) % 2 ? p.floor : p.floor2;
        ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = p.seam;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        if (hv < 0.1) {
          ctx.fillStyle = p.moss;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.ellipse(x + T * 0.5, y + T * 0.6, 7, 4.5, hv * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (hv < 0.16) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.arc(x + 10 + hv * 60, y + 12, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (tt === DOOR || tt === DOOR_OPEN) this.door(ctx, x, y, tt === DOOR_OPEN, d, xx, yy);
        if (tt === STAIRS_DOWN) this.stairs(ctx, x, y, true, !s.bossAlive);
        if (tt === STAIRS_UP) this.stairs(ctx, x, y, false, false);
      }
    }

    // walls and bodies, row by row, so a body behind a wall is hidden by it
    const bodies: { y: number; draw: () => void }[] = [];
    for (const dr of s.drops) {
      if (!dr.seen && d.seen[Math.floor(dr.y / T) * d.w + Math.floor(dr.x / T)] !== VISIBLE) continue;
      bodies.push({ y: dr.y, draw: () => this.drop(ctx, s, dr) });
    }
    for (const tr of s.traps) bodies.push({ y: tr.y - 1, draw: () => this.trap(ctx, tr.x, tr.y) });
    for (const e of s.enemies) {
      const vis = d.seen[Math.floor(e.y / T) * d.w + Math.floor(e.x / T)] === VISIBLE;
      if (!vis) continue;
      bodies.push({ y: e.y, draw: () => this.enemy(ctx, s, e) });
    }
    bodies.push({ y: h.y, draw: () => this.hero(ctx, s, h) });
    for (const pr of s.projectiles) bodies.push({ y: pr.y, draw: () => this.projectile(ctx, pr, h) });
    bodies.sort((a, b) => a.y - b.y);
    let bi = 0;
    for (let yy = y0; yy <= y1 + 1; yy++) {
      const rowBottom = (yy + 1) * T;
      if (yy <= y1) {
        for (let xx = x0; xx <= x1; xx++) {
          const i = yy * d.w + xx;
          if (d.tiles[i] !== WALL || d.seen[i] === UNSEEN) continue;
          this.wall(ctx, p, d, xx, yy);
        }
      }
      while (bi < bodies.length && bodies[bi].y < rowBottom) bodies[bi++].draw();
    }
    while (bi < bodies.length) bodies[bi++].draw();

    // the dark: remembered tiles dim, unseen tiles stay black
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const i = yy * d.w + xx;
        if (d.seen[i] !== REMEMBERED || d.tiles[i] === VOID) continue;
        ctx.fillStyle = 'rgba(4,6,10,0.56)';
        ctx.fillRect(xx * T, yy * T - WH, T, T + WH);
      }
    }
    // the warm centre of the light
    const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 6 * T);
    g.addColorStop(0, 'rgba(255,190,110,0.13)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(left, top, viewW, viewH);

    // effects and floating text, over everything
    for (const ef of s.effects) this.effect(ctx, ef);
    for (const ft of s.texts) {
      ctx.font = `bold ${ft.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.min(1, ft.life * 2);
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // edge arrows: the stairs once seen, an aware enemy off screen
    const si = Math.floor(d.downY / T) * d.w + Math.floor(d.downX / T);
    if (d.seen[si] !== UNSEEN) this.edgeArrow(ctx, d.downX, d.downY, left, top, viewW, viewH, s.bossAlive ? '#ff8a70' : '#ece6d2');
    for (const e of s.enemies) if (!e.dead && e.aware && e.mode !== 'sleep') this.edgeArrow(ctx, e.x, e.y, left, top, viewW, viewH, '#ff4a3a');
    // hurt flash
    if (h.hurtFlash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(220,40,30,${h.hurtFlash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private wall(ctx: CanvasRenderingContext2D, p: Palette, d: Dungeon, xx: number, yy: number): void {
    const x = xx * T;
    const y = yy * T;
    const below = yy + 1 < d.h && d.tiles[(yy + 1) * d.w + xx] !== WALL && d.tiles[(yy + 1) * d.w + xx] !== VOID;
    ctx.fillStyle = p.wallTop;
    ctx.fillRect(x, y - WH, T, T);
    ctx.strokeStyle = p.mortar;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - WH + 0.5, T - 1, T - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - WH + T / 2);
    ctx.lineTo(x + T - 2, y - WH + T / 2);
    ctx.stroke();
    if (hash2(xx, yy, 7) < 0.2) {
      ctx.fillStyle = p.moss;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x + 4 + hash2(xx, yy, 8) * 12, y - WH + 3, 9, 3);
      ctx.globalAlpha = 1;
    }
    if (below) {
      ctx.fillStyle = p.wallFront;
      ctx.fillRect(x, y + T - WH, T, WH);
      ctx.strokeStyle = p.mortar;
      ctx.beginPath();
      ctx.moveTo(x, y + T - WH / 2);
      ctx.lineTo(x + T, y + T - WH / 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y + T - 2, T, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y - WH + 0.75, T - 1.5, T - 1.5);
  }

  private door(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean, d: Dungeon, xx: number, yy: number): void {
    const vertical = d.tiles[yy * d.w + xx - 1] === WALL || d.tiles[yy * d.w + xx + 1] === WALL;
    ctx.fillStyle = '#4a3418';
    ctx.strokeStyle = '#2a1c0a';
    ctx.lineWidth = 2;
    if (open) {
      if (vertical) {
        ctx.fillRect(x + 1, y + 1, 6, T - 2);
        ctx.strokeRect(x + 1, y + 1, 6, T - 2);
      } else {
        ctx.fillRect(x + 1, y + 1, T - 2, 6);
        ctx.strokeRect(x + 1, y + 1, T - 2, 6);
      }
      return;
    }
    if (vertical) {
      ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
      ctx.strokeStyle = '#6a4a28';
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 2 + k * 7, y + 2);
        ctx.lineTo(x + 2 + k * 7, y + T - 2);
        ctx.stroke();
      }
    } else {
      ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
      ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
      ctx.strokeStyle = '#6a4a28';
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2 + k * 7);
        ctx.lineTo(x + T - 2, y + 2 + k * 7);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#c8a040';
    ctx.beginPath();
    ctx.arc(x + T - 8, y + T / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private stairs(ctx: CanvasRenderingContext2D, x: number, y: number, down: boolean, open: boolean): void {
    ctx.fillStyle = '#101210';
    ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
    ctx.strokeStyle = down ? (open ? '#c8d0c0' : '#6a5a5a') : '#7a7e76';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 5 + k * 2, y + 5 + k * 6);
      ctx.lineTo(x + T - 5 - k * 2, y + 5 + k * 6);
      ctx.stroke();
    }
    if (down && open) {
      ctx.strokeStyle = `rgba(236,230,210,${0.35 + 0.3 * Math.sin(this.t * 4)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    }
  }

  private drop(ctx: CanvasRenderingContext2D, s: SimState, dr: SimState['drops'][number]): void {
    void s;
    if (dr.kind === 'chest') {
      blit(ctx, chestSprite(dr.opened), dr.x, dr.y);
      return;
    }
    const it = dr.item!;
    const col = RARITY_COLOR[it.rarity];
    if (it.rarity >= 2) {
      const g = ctx.createLinearGradient(0, dr.y - 90, 0, dr.y + 6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, col + '70');
      ctx.fillStyle = g;
      ctx.fillRect(dr.x - 5, dr.y - 90, 10, 96);
    }
    const bob = Math.sin(this.t * 3 + dr.id) * 1.5;
    blit(ctx, itemSprite(it), dr.x, dr.y + bob);
    if (s.hero.near === dr.id) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(dr.x, dr.y + 8, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private trap(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.strokeStyle = '#8ae070';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8ae070';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + this.t;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 10, y + Math.sin(a) * 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private enemy(ctx: CanvasRenderingContext2D, _s: SimState, e: Enemy): void {
    const dead = e.dead;
    const frame = e.mode === 'chase' ? (Math.floor(this.t * 8) % 2) : 0;
    // the windup: a red arc where the strike will land, or a line for an arrow
    if (!dead && e.mode === 'windup') {
      const f = 1 - e.t / e.def.windup;
      if (e.def.attack === 'bow') {
        ctx.strokeStyle = `rgba(255,120,100,${0.25 + f * 0.5})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.facing) * e.def.reach, e.y + Math.sin(e.facing) * e.def.reach);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (e.chargeLeft > 0) {
        // the charge's lane
        ctx.fillStyle = `rgba(255,90,60,${0.12 + f * 0.2})`;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(Math.atan2(e.cy, e.cx));
        ctx.fillRect(0, -e.r - 6, e.chargeLeft, (e.r + 6) * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(255,90,60,${0.15 + f * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.arc(e.x, e.y, e.def.reach + 10, e.facing - 0.9, e.facing + 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }
    // an enemy standing over the hero goes see-through, so the hero stays readable
    const hero = _s.hero;
    const over = !dead && Math.hypot(e.x - hero.x, e.y - hero.y) < e.r + hero.r + 6 && e.y > hero.y;
    ctx.globalAlpha = dead ? Math.max(0, e.deathT / 0.5) : over ? 0.55 : 1;
    const flip = Math.cos(e.facing) < 0;
    const sp = enemySprite(e.def.id, frame);
    if (e.hurtFlash > 0) {
      ctx.filter = 'brightness(2.2)';
      blit(ctx, sp, e.x, e.y - 4, flip);
      ctx.filter = 'none';
    } else blit(ctx, sp, e.x, e.y - 4, flip);
    ctx.globalAlpha = 1;
    if (dead) return;
    if (e.mode === 'stagger' || e.mode === 'trapped') {
      ctx.fillStyle = e.mode === 'trapped' ? '#8ae070' : '#ffd040';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.mode === 'trapped' ? '✶' : '✦ ✦', e.x, e.y - e.r - 16);
    }
    if (e.mode === 'sleep') {
      ctx.fillStyle = '#9ab0ff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('z', e.x + 8 + Math.sin(this.t * 2) * 2, e.y - e.r - 12 - ((this.t * 6) % 6));
    } else if (e.alertT > 0) {
      ctx.fillStyle = '#ff6a4a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', e.x, e.y - e.r - 14);
    }
    if (e.hp < e.maxHp || e.aware) {
      const w = e.def.boss ? 44 : 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4);
      ctx.fillStyle = e.def.boss ? '#ffd040' : '#e0503a';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, (w * Math.max(0, e.hp)) / e.maxHp, 4);
    }
    if (e.def.boss || e.aware) {
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = e.def.boss ? '#ffd040' : 'rgba(236,230,210,0.8)';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 3;
      ctx.fillText(t(e.def.name), e.x, e.y + e.r + 10);
      ctx.shadowBlur = 0;
    }
  }

  private hero(ctx: CanvasRenderingContext2D, _s: SimState, h: Hero): void {
    const it = held(h);
    // the aim: the sword's arc or the bow's line
    if (it && (h.aimShow.on || h.drawing || h.parry >= 0)) {
      const a = h.aimShow.on && Math.hypot(h.aimShow.x, h.aimShow.y) > 0.2 ? Math.atan2(h.aimShow.y, h.aimShow.x) : h.facing;
      if (isMelee(it.kind)) {
        // the hit shape, drawn where it would land: an arc, a thrust line, a ring
        const f = FAMILY[it.kind];
        const r = swordReach(h, it);
        const slam = f.full === 'slam' && h.draw >= 1;
        const fill = h.parry >= 0 ? 'rgba(200,210,230,0.18)' : slam ? 'rgba(255,120,60,0.18)' : 'rgba(255,208,64,0.16)';
        const line = h.parry >= 0 ? 'rgba(200,210,230,0.7)' : slam ? 'rgba(255,120,60,0.8)' : 'rgba(255,208,64,0.7)';
        ctx.fillStyle = fill;
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (f.shape === 'line') {
          const w = f.width;
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(a);
          ctx.rect(0, -w, r, w * 2);
          ctx.restore();
        } else if (f.shape === 'ring' || f.shape === 'orbit' || slam) {
          ctx.arc(h.x, h.y, slam ? r * 1.4 : r, 0, Math.PI * 2);
        } else if (f.shape === 'throw') {
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(a);
          ctx.rect(0, -f.width, r, f.width * 2);
          ctx.restore();
        } else {
          ctx.moveTo(h.x, h.y);
          ctx.arc(h.x, h.y, r, a - f.width, a + f.width);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      } else {
        const r = bowRange(it);
        ctx.strokeStyle = 'rgba(255,208,64,0.75)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // the draw ring
    // the charge ring: the draw or the wind-up, and what it is worth
    if (h.drawing) {
      const full = h.draw >= 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = full ? '#ffffff' : it && isMelee(it.kind) ? '#ffb060' : '#ffd040';
      ctx.lineWidth = full ? 6 : 5;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 20, -Math.PI / 2, -Math.PI / 2 + h.draw * Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = full ? '#fff' : '#ffd870';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(`×${(0.6 + 1.4 * h.draw).toFixed(1)}`, h.x, h.y - 30);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 9, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = h.invuln > 0 ? 'rgba(255,255,255,0.7)' : '#6ab0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 9, 12, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    const frame = h.moving ? 1 + (Math.floor(h.walk) % 2) : 0;
    const flip = Math.cos(h.facing) < 0;
    if (h.hurtFlash > 0) ctx.filter = 'brightness(2)';
    blit(ctx, heroSprite(frame, h.coat && h.coat.rarity >= 2 ? '#6a5a7a' : '#5a5a60'), h.x, h.y - 4, flip);
    ctx.filter = 'none';
    if (it && isMelee(it.kind) && FAMILY[it.kind].shape === 'orbit' && (h.drawing || h.orbit.spin > 0.5)) {
      // the flail: the haft in hand, the chain out to the ball on its orbit
      const r = swordReach(h, it);
      const bx = h.x + Math.cos(h.orbit.a) * r;
      const by = h.y - 2 + Math.sin(h.orbit.a) * r;
      ctx.strokeStyle = '#8a8e96';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(h.x, h.y - 2);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6a6e74';
      ctx.strokeStyle = '#1a1c1e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = RARITY_COLOR[it.rarity];
      ctx.beginPath();
      ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (it) {
      ctx.save();
      ctx.translate(h.x + Math.cos(h.facing) * 7, h.y - 2 + Math.sin(h.facing) * 4);
      let a = h.facing;
      if (h.swing) {
        const f = h.swing.t / h.swing.dur;
        a = h.swing.angle + (f < 0.45 ? -h.swing.width + (f / 0.45) * h.swing.width * 2 : h.swing.width - ((f - 0.45) / 0.55) * h.swing.width * 0.5);
      }
      ctx.rotate(a);
      blit(ctx, weaponSprite(it), isMelee(it.kind) ? 8 : 6, 0);
      ctx.restore();
    }
    if (h.parry >= 0) {
      ctx.strokeStyle = h.parried > 0 ? '#ffd040' : 'rgba(200,210,230,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y - 2, 17, h.facing - 0.9, h.facing + 0.9);
      ctx.stroke();
    }
  }

  private projectile(ctx: CanvasRenderingContext2D, p: SimState['projectiles'][number], h: Hero): void {
    if (p.kind === 'ball' || p.kind === 'anchor') {
      // a chain back to the hand
      ctx.strokeStyle = '#8a8e96';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(h.x, h.y - 2);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6a6e74';
      ctx.strokeStyle = '#1a1c1e';
      ctx.lineWidth = 1.5;
      if (p.kind === 'ball') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#6a6e74';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(4, 0);
        ctx.moveTo(4, -8);
        ctx.quadraticCurveTo(11, 0, 4, 8);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }
    if (p.kind === 'rain') {
      ctx.strokeStyle = 'rgba(138,224,112,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    if (p.team === 1) ctx.filter = 'hue-rotate(-20deg) brightness(0.8)';
    blit(ctx, arrowSprite(), 0, 0);
    ctx.restore();
  }

  private effect(ctx: CanvasRenderingContext2D, ef: SimState['effects'][number]): void {
    const f = ef.life / ef.maxLife;
    ctx.globalAlpha = Math.max(0, f);
    switch (ef.kind) {
      case 'slash':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3 + (1 - f) * 4;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r * (0.7 + (1 - f) * 0.3), ef.angle - 0.8, ef.angle + 0.8);
        ctx.stroke();
        break;
      case 'thrust':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 4 + (1 - f) * 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ef.x, ef.y);
        ctx.lineTo(ef.x + Math.cos(ef.angle) * ef.r, ef.y + Math.sin(ef.angle) * ef.r);
        ctx.stroke();
        break;
      case 'ring':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 4 + (1 - f) * 4;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r * (0.6 + (1 - f) * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'hit':
        ctx.fillStyle = ef.color;
        for (let k = 0; k < 5; k++) {
          const a = ef.angle + (k - 2) * 0.5;
          const rr = (1 - f) * 14;
          ctx.beginPath();
          ctx.arc(ef.x + Math.cos(a) * rr, ef.y + Math.sin(a) * rr, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'blast':
      case 'open':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r * (1.2 - f), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'rain':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      case 'parry':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r * (1.4 - f * 0.4), ef.angle - 1, ef.angle + 1);
        ctx.stroke();
        break;
      case 'levelup':
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, ef.r * (1.5 - f), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'stagger':
        break;
    }
    ctx.globalAlpha = 1;
  }

  private edgeArrow(ctx: CanvasRenderingContext2D, wx: number, wy: number, left: number, top: number, vw: number, vh: number, color: string): void {
    const m = 18;
    if (wx > left + m && wx < left + vw - m && wy > top + m && wy < top + vh - m) return;
    const cx = left + vw / 2;
    const cy = top + vh / 2;
    const a = Math.atan2(wy - cy, wx - cx);
    const x = Math.max(left + m, Math.min(left + vw - m, wx));
    const y = Math.max(top + m, Math.min(top + vh - m, wy));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The floor as a small map: remembered tiles, the hero, seen enemies, the stairs. */
  drawMinimap(canvas: HTMLCanvasElement, s: SimState, full = false): void {
    const d = s.dungeon;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || 86;
    const ch = canvas.clientHeight || 70;
    if (canvas.width !== Math.round(cw * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const c = canvas.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = full ? '#0a0c0e' : 'rgba(8,10,12,0.85)';
    c.fillRect(0, 0, cw, ch);
    const sc = Math.min(cw / d.w, ch / d.h);
    const ox = (cw - d.w * sc) / 2;
    const oy = (ch - d.h * sc) / 2;
    for (let y = 0; y < d.h; y++) {
      for (let x = 0; x < d.w; x++) {
        const i = y * d.w + x;
        const tt = d.tiles[i];
        if (tt === VOID || d.seen[i] === UNSEEN) continue;
        c.fillStyle = tt === WALL ? '#6a7268' : tt === DOOR || tt === DOOR_OPEN ? '#a07030' : d.seen[i] === VISIBLE ? '#3a443a' : '#2a302a';
        if (tt === STAIRS_DOWN || tt === STAIRS_UP) c.fillStyle = '#ece6d2';
        c.fillRect(ox + x * sc, oy + y * sc, Math.ceil(sc), Math.ceil(sc));
      }
    }
    const dot = (x: number, y: number, col: string, r: number) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(ox + (x / T) * sc, oy + (y / T) * sc, r, 0, Math.PI * 2);
      c.fill();
    };
    for (const dr of s.drops) if (dr.seen && (dr.kind === 'chest' ? !dr.opened : dr.item && dr.item.rarity >= 2)) dot(dr.x, dr.y, dr.kind === 'chest' ? '#e0b048' : '#c070ff', Math.max(1.5, sc * 0.8));
    for (const e of s.enemies) if (!e.dead && d.seen[Math.floor(e.y / T) * d.w + Math.floor(e.x / T)] === VISIBLE) dot(e.x, e.y, e.def.boss ? '#ffd040' : '#ff6a4a', Math.max(1.5, sc * 0.8));
    dot(s.hero.x, s.hero.y, '#6ab0ff', Math.max(2, sc * 1.1));
    c.strokeStyle = '#fff';
    c.lineWidth = 1;
    c.stroke();
    void FLOOR;
  }
}
