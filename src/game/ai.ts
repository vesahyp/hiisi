import { flowDir, hitsSolid, lineOfSight, moveCircle, openDir, openDoorsNear, roomOf, T } from './dungeon';
import type { Enemy, SimState } from './state';
import { hurtEnemy, hurtHero, wake } from './combat';
import { has } from './hero';
import { t, tr } from '../i18n';

/**
 * Enemy behaviour. Every attack is slow enough to see: a windup shows
 * before the strike lands, the bear's charge draws its lane. An enemy
 * sleeps, idles in its room, chases along the flow field, winds up, strikes.
 */
export function enemyStep(s: SimState, e: Enemy, dt: number): void {
  const h = s.hero;
  const d = s.dungeon;
  if (e.dead) {
    e.deathT -= dt;
    return;
  }
  e.hurtFlash = Math.max(0, e.hurtFlash - dt);
  e.alertT = Math.max(0, e.alertT - dt);
  e.cd = Math.max(0, e.cd - dt);
  const dx = h.x - e.x;
  const dy = h.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  // knockback
  if (Math.abs(e.knock.vx) + Math.abs(e.knock.vy) > 1) {
    moveCircle(d, e, e.r, e.knock.vx * dt, e.knock.vy * dt);
    const k = Math.pow(0.0001, dt);
    e.knock.vx *= k;
    e.knock.vy *= k;
  }

  switch (e.mode) {
    case 'sleep': {
      if (dist < 2.2 * T || (dist < 5 * T && h.moving && lineOfSight(d, e.x, e.y, h.x, h.y) && s.rng.chance(dt * 0.4))) wake(s, e);
      return;
    }
    case 'idle': {
      e.t -= dt;
      // notice: within sight with a line, and in the hero's light
      if (h.alive && dist < e.def.sight * T && lineOfSight(d, e.x, e.y, h.x, h.y)) {
        wake(s, e);
        e.mode = 'chase';
        e.t = 0;
        return;
      }
      if (e.aware) {
        e.mode = 'chase';
        return;
      }
      if (e.t <= 0) {
        // a short wander inside its room
        e.t = s.rng.range(1, 3);
        e.facing = s.rng.range(0, Math.PI * 2);
      }
      const wx = Math.cos(e.facing) * e.def.speed * 0.3 * dt;
      const wy = Math.sin(e.facing) * e.def.speed * 0.3 * dt;
      if (roomOf(d, e.x + wx * 4, e.y + wy * 4) === e.room) moveCircle(d, e, e.r, wx, wy);
      return;
    }
    case 'chase': {
      if (!h.alive) return;
      e.facing = Math.atan2(dy, dx);
      const ranged = e.def.attack === 'bow';
      const sees = lineOfSight(d, e.x, e.y, h.x, h.y);
      if (ranged) {
        if (sees && dist < e.def.reach && e.cd <= 0) {
          e.mode = 'windup';
          e.t = e.def.windup;
          e.struck = false;
          return;
        }
        // keep a distance: back off from close, close in from far
        let mx = 0;
        let my = 0;
        if (!sees || dist > e.def.reach * 0.8) {
          const f = flowDir(d, e.x, e.y);
          if (f) {
            mx = f.dx;
            my = f.dy;
          }
        } else if (dist < 3 * T) {
          mx = -ux;
          my = -uy;
        }
        walk(s, e, mx, my, dt);
        return;
      }
      if (dist < e.def.reach + h.r && e.cd <= 0) {
        e.mode = 'windup';
        e.t = e.def.windup;
        e.struck = false;
        if (e.def.boss) {
          // every third attack is the charge, from further off
          if (e.swipes >= 2 && dist > 2 * T) {
            e.swipes = 0;
          }
        }
        return;
      }
      if (e.def.boss && e.swipes >= 2 && dist > 3 * T && dist < 9 * T && sees && e.cd <= 0) {
        e.mode = 'windup';
        e.t = e.def.windup;
        e.struck = false;
        e.cx = ux;
        e.cy = uy;
        e.chargeLeft = Math.min(10 * T, dist + 2 * T);
        return;
      }
      // walk the field; stop at reach
      if (dist > e.def.reach * 0.8 || !sees) {
        const f = dist < 2.5 * T && sees ? { dx: ux, dy: uy } : flowDir(d, e.x, e.y) ?? { dx: ux, dy: uy };
        walk(s, e, f.dx, f.dy, dt);
      }
      return;
    }
    case 'windup': {
      e.t -= dt;
      if (e.chargeLeft <= 0 || e.def.attack !== 'bear') e.facing = Math.atan2(dy, dx);
      if (e.t > 0) return;
      e.cd = e.def.cooldown;
      if (e.def.attack === 'bow') {
        // a slow arrow, the kind you can step out of
        const sp = 190;
        const a = Math.atan2(dy, dx) + s.rng.range(-0.05, 0.05);
        s.projectiles.push({ id: s.nextId++, x: e.x + Math.cos(a) * (e.r + 4), y: e.y + Math.sin(a) * (e.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, team: 1, dmg: e.def.dmg, left: e.def.reach + 40, pierce: 0, hit: new Set(), kind: 'enemyArrow', skill: null, homing: 0, dead: false });
        s.sounds.push('bowshot');
        e.mode = 'chase';
        return;
      }
      if (e.def.attack === 'bear' && e.chargeLeft > 0) {
        e.mode = 'charge';
        s.sounds.push('charge');
        return;
      }
      // the melee strike: it lands now if the hero is still in reach and in front
      e.mode = 'strike';
      e.t = 0.22;
      if (e.def.boss) e.swipes++;
      strike(s, e, dist, ux, uy);
      return;
    }
    case 'strike': {
      e.t -= dt;
      if (e.t <= 0) e.mode = 'chase';
      return;
    }
    case 'charge': {
      const sp = e.def.speed * 2.6;
      const step = sp * dt;
      const before = { x: e.x, y: e.y };
      moveCircle(d, e, e.r, e.cx * step, e.cy * step);
      const moved = Math.hypot(e.x - before.x, e.y - before.y);
      e.chargeLeft -= step;
      if (dist < e.r + h.r + 4 && !e.struck) {
        e.struck = true;
        hurtHero(s, e.def.dmg * 1.4, t(e.def.name), Math.atan2(uy, ux));
      }
      if (e.chargeLeft <= 0 || moved < step * 0.5) {
        e.mode = 'stagger';
        e.t = 0.9;
        e.chargeLeft = 0;
        s.shake = Math.max(s.shake, 0.5);
        s.sounds.push('stomp');
      }
      return;
    }
    case 'stagger':
    case 'trapped': {
      e.t -= dt;
      if (e.t <= 0) e.mode = 'chase';
      return;
    }
  }
}

function strike(s: SimState, e: Enemy, dist: number, ux: number, uy: number): void {
  const h = s.hero;
  const reach = e.def.reach + h.r;
  s.effects.push({ kind: 'slash', x: e.x, y: e.y, angle: Math.atan2(uy, ux), r: e.def.reach, life: 0.2, maxLife: 0.2, color: '#ff8a70' });
  if (dist > reach) return;
  // the hero's parry: the sword held up toward the blow
  if (h.parry >= 0 && has(h, 'torjunta')) {
    const facing = Math.atan2(uy, ux) + Math.PI;
    const diff = Math.abs(Math.atan2(Math.sin(h.facing - facing), Math.cos(h.facing - facing)));
    if (diff < 1.2) {
      const perfect = h.parry < 0.35;
      s.effects.push({ kind: 'parry', x: h.x + Math.cos(h.facing) * 14, y: h.y + Math.sin(h.facing) * 14, angle: h.facing, r: 16, life: 0.3, maxLife: 0.3, color: perfect ? '#ffd040' : '#c8d0e0' });
      s.sounds.push('block');
      h.parried = 0.4;
      if (perfect) {
        e.mode = 'stagger';
        e.t = 1.5;
        s.texts.push({ x: e.x, y: e.y - e.r - 14, text: tr('horjuu', 'staggers'), color: '#ffd040', life: 1, size: 12 });
        s.sounds.push('parry');
      } else hurtHero(s, e.def.dmg * 0.3, t(e.def.name));
      return;
    }
  }
  hurtHero(s, e.def.dmg, t(e.def.name), Math.atan2(uy, ux));
}

function walk(s: SimState, e: Enemy, mx: number, my: number, dt: number): void {
  const m = Math.hypot(mx, my);
  if (m < 0.01) return;
  const d = s.dungeon;
  const o = openDir(d, e.x, e.y, e.r, mx / m, my / m);
  openDoorsNear(d, e.x, e.y, e.r + 10);
  // do not walk into the hero or a friend
  const h = s.hero;
  const sp = e.def.speed * (e.mode === 'trapped' ? 0 : 1);
  const nx = e.x + o.dx * sp * dt;
  const ny = e.y + o.dy * sp * dt;
  if (Math.hypot(nx - h.x, ny - h.y) < e.r + h.r) return;
  moveCircle(d, e, e.r, o.dx * sp * dt, o.dy * sp * dt);
}

/** Enemies stacked on one spot push apart, so a pack reads as a pack. */
export function separate(s: SimState): void {
  const es = s.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.dead) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const min = a.r + b.r;
      if (dist >= min) continue;
      const push = (min - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      if (!hitsSolid(s.dungeon, a.x - ux * push, a.y - uy * push, a.r)) {
        a.x -= ux * push;
        a.y -= uy * push;
      }
      if (!hitsSolid(s.dungeon, b.x + ux * push, b.y + uy * push, b.r)) {
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}

/** A noise at (x, y): sleepers within `tiles` wake. */
export function noise(s: SimState, x: number, y: number, tiles: number): void {
  for (const e of s.enemies) {
    if (e.dead || e.mode !== 'sleep') continue;
    if (Math.hypot(e.x - x, e.y - y) < tiles * T) wake(s, e);
  }
}

/** A trap under an enemy's feet: it stops and hurts. */
export function springTraps(s: SimState): void {
  for (const tr of s.traps) {
    if (!tr.armed) continue;
    for (const e of s.enemies) {
      if (e.dead || e.mode === 'trapped') continue;
      if (Math.hypot(e.x - tr.x, e.y - tr.y) > tr.r + e.r) continue;
      tr.armed = false;
      e.mode = 'trapped';
      e.t = 3;
      hurtEnemy(s, e, tr.dmg, { skill: 'jousi', knock: 0, angle: 0, what: 'ansa' });
      s.effects.push({ kind: 'blast', x: tr.x, y: tr.y, angle: 0, r: 24, life: 0.3, maxLife: 0.3, color: '#8ae070' });
      s.sounds.push('trap');
      break;
    }
  }
  s.traps = s.traps.filter((x) => x.armed);
}
