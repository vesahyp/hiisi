import { distanceField, flowDir, hitsSolid, lineOfSight, moveCircle, openDir, openDoorsNear, roomOf, T } from './dungeon';
import type { Enemy, SimState } from './state';
import { hurtEnemy, hurtHero, wake } from './combat';
import { has } from './hero';
import { isMelee } from './items';
import { t, tr } from '../i18n';
import { say } from './log';

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
  e.armorBreak = Math.max(0, e.armorBreak - dt);
  if (e.bleed.t > 0) {
    // the axe's wound: a tick every half second
    const was = e.bleed.t;
    e.bleed.t = Math.max(0, e.bleed.t - dt);
    if (Math.floor(was * 2) !== Math.floor(e.bleed.t * 2)) hurtEnemy(s, e, Math.max(1, Math.round(e.bleed.dps / 2)), { skill: null, knock: 0, angle: 0, what: 'vuoto' });
    if (e.dead) return;
  }
  const dx = h.x - e.x;
  const dy = h.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  e.rage = Math.max(0, e.rage - dt);
  e.quirkT -= dt;
  // knockback
  if (Math.abs(e.knock.vx) + Math.abs(e.knock.vy) > 1) {
    moveCircle(d, e, e.r, e.knock.vx * dt, e.knock.vy * dt);
    const k = Math.pow(0.002, dt);
    e.knock.vx *= k;
    e.knock.vy *= k;
  }

  // ---- the shared brains: every mob, before its mode ----
  const active = e.mode === 'chase' || e.mode === 'hover' || e.mode === 'flee';
  if (active && !e.def.boss) {
    // a potion within reach is drunk, a weapon on the floor is grabbed
    for (const dr of s.drops) {
      if (dr.kind !== 'item' || !dr.item) continue;
      const dd = Math.hypot(dr.x - e.x, dr.y - e.y);
      if (dd > e.r + 12) continue;
      if (dr.item.kind === 'potion' && e.hp < e.maxHp * 0.7) {
        const heal = Math.round(e.maxHp * 0.5);
        e.hp = Math.min(e.maxHp, e.hp + heal);
        dr.item.count--;
        if (dr.item.count <= 0) dr.item = null;
        s.texts.push({ x: e.x, y: e.y - e.r - 14, text: `+${heal}`, color: '#8ae070', life: 1, size: 12 });
        say(s, tr(`${t(e.def.name)} juo juoman!`, `The ${t(e.def.name).toLowerCase()} drinks a potion!`), '#8ae070');
        s.sounds.push('drink');
        e.wantDrop = null;
        if (e.mode === 'flee' && e.hp > e.maxHp * 0.5) e.mode = 'chase';
      } else if (isMelee(dr.item.kind) && !e.carry && e.def.attack !== 'bow' && e.def.attack !== 'rock') {
        e.carry = dr.item;
        dr.item = null;
        say(s, tr(`${t(e.def.name)} nappaa: ${t(e.carry.name)}!`, `The ${t(e.def.name).toLowerCase()} grabs: ${t(e.carry.name)}!`), '#ffd870');
        s.texts.push({ x: e.x, y: e.y - e.r - 14, text: t(e.carry.name), color: '#ffd870', life: 1.2, size: 11 });
        s.sounds.push('take');
        e.wantDrop = null;
      }
    }
    s.drops = s.drops.filter((x) => x.kind === 'chest' || x.item);
  }
  // low on health: flee, to a potion if one lies within eight tiles, else away
  const lowHp = e.hp < e.maxHp * 0.3;
  if (lowHp && !e.def.boss && e.mode !== 'flee' && e.mode !== 'playdead' && active && e.def.quirk !== 'rage') {
    e.mode = 'flee';
    e.fleeT = 0;
    e.wantDrop = nearestPotion(s, e, 8 * T);
    say(s, tr(`${t(e.def.name)} pakenee!`, `The ${t(e.def.name).toLowerCase()} flees!`), '#b8c8a8');
    s.texts.push({ x: e.x, y: e.y - e.r - 14, text: '!', color: '#ffd870', life: 0.8, size: 14 });
  }
  // a chase with no line to the hero for twelve seconds is given up
  if (e.mode === 'chase' || e.mode === 'hover') {
    const sees = lineOfSight(d, e.x, e.y, h.x, h.y) && dist < e.def.sight * T * 1.5;
    e.lostT = sees ? 0 : e.lostT + dt;
    if (e.lostT > 12) {
      e.aware = false;
      e.lostT = 0;
      e.mode = 'idle';
      e.t = 1;
      say(s, tr(`${t(e.def.name)} menettää jälkesi.`, `The ${t(e.def.name).toLowerCase()} loses your trail.`), '#8ab0a0');
      return;
    }
  }

  switch (e.mode) {
    case 'sleep': {
      // a sleeper wakes to a hero moving close by, with a chance a second;
      // a hero who stands still beside it is a dagger's chance
      if (h.moving && dist < 5 * T && lineOfSight(d, e.x, e.y, h.x, h.y) && s.rng.chance(dt * (dist < 2 * T ? 1.5 : 0.4))) wake(s, e);
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
    case 'flee': {
      e.fleeT += dt;
      e.facing = Math.atan2(-dy, -dx);
      const want = e.wantDrop !== null ? s.drops.find((x) => x.id === e.wantDrop && x.item) : null;
      if (want) {
        const f = toward(s, e, want.x, want.y);
        walk(s, e, f.dx, f.dy, dt, 1.15);
      } else {
        // away, round whatever is in the way; cornered, it turns and fights
        const o = openDir(d, e.x, e.y, e.r, -ux, -uy);
        const bx = e.x;
        const by = e.y;
        walk(s, e, o.dx, o.dy, dt, 1.15);
        if (Math.hypot(e.x - bx, e.y - by) < enemySpeed(e) * dt * 0.3) {
          e.fleeT += 0.5;
          if (e.fleeT > 2.5) {
            e.mode = 'chase';
            e.fleeT = 0;
            e.rage = Math.max(e.rage, 3);
            say(s, tr(`${t(e.def.name)} on nurkassa ja kääntyy vastaan!`, `The ${t(e.def.name).toLowerCase()} is cornered and turns on you!`), '#ff8a70');
            s.texts.push({ x: e.x, y: e.y - e.r - 14, text: '!!', color: '#ff5a4a', life: 1, size: 14 });
            return;
          }
        }
      }
      // out of sight for a while, or long enough: it has got away, and will fight again
      const seen = lineOfSight(d, e.x, e.y, h.x, h.y);
      if ((!seen && e.fleeT > 2) || e.fleeT > 8) {
        e.mode = e.def.quirk === 'hoarder' ? 'idle' : 'chase';
        if (e.def.quirk === 'hoarder') e.aware = false;
        e.fleeT = 0;
        e.wantDrop = null;
      }
      return;
    }
    case 'playdead': {
      // a bone pile: still, until the hero turns away or the time runs out
      e.t -= dt;
      const facingAway = Math.cos(h.facing) * -ux + Math.sin(h.facing) * -uy < 0.2;
      if (e.t <= 0 || (dist < 3 * T && facingAway && e.t < 2)) {
        e.mode = 'chase';
        e.cd = 0;
        say(s, tr(`${t(e.def.name)} nousee!`, `The ${t(e.def.name).toLowerCase()} rises!`), '#ff8a70');
        s.texts.push({ x: e.x, y: e.y - e.r - 14, text: '!', color: '#ff6a5a', life: 0.8, size: 16 });
        s.sounds.push('crate');
      }
      return;
    }
    case 'hover': {
      // the coward: circles at four tiles and chitters; the chitter is a
      // pause, the window a player learns to shoot it in
      e.facing = Math.atan2(dy, dx);
      e.t = Math.max(0, e.t - dt);
      if (e.t <= 0) {
        const pref = 4 * T;
        let mx = -uy * 0.8;
        let my = ux * 0.8;
        if (dist > pref + 20) {
          mx += ux;
          my += uy;
        } else if (dist < pref - 20) {
          mx -= ux;
          my -= uy;
        }
        walk(s, e, mx, my, dt);
      }
      if (e.quirkT <= 0) {
        e.quirkT = s.rng.range(1.5, 3);
        e.t = 0.7;
        s.texts.push({ x: e.x, y: e.y - e.r - 12, text: '?', color: '#ffd870', life: 0.7, size: 12 });
        s.sounds.push('chitter');
      }
      if (friendsNear(s, e) >= 2 || e.hp < e.maxHp * 0.99) e.mode = 'chase';
      return;
    }
    case 'chase': {
      if (!h.alive) return;
      e.facing = Math.atan2(dy, dx);
      // the coward hangs back without a pack; the hoarder runs on sight
      if (e.def.quirk === 'coward' && friendsNear(s, e) < 2 && e.hp >= e.maxHp * 0.99 && dist > 2 * T) {
        e.mode = 'hover';
        return;
      }
      if (e.def.quirk === 'hoarder') {
        e.mode = 'flee';
        e.fleeT = 0;
        if (e.quirkT < 0) {
          e.quirkT = 6;
          say(s, tr(`${t(e.def.name)} pakenee aarteineen!`, `The ${t(e.def.name).toLowerCase()} flees with its treasure!`), '#ffd870');
        }
        return;
      }
      // the trapper lays a trap between you and keeps its distance
      if (e.def.quirk === 'trapper') {
        const sees0 = lineOfSight(d, e.x, e.y, h.x, h.y);
        if (sees0 && e.quirkT <= 0 && dist > 2.5 * T && s.traps.filter((x) => x.team === 1).length < 4) {
          e.quirkT = 3.5;
          const tx = e.x + ux * 1.5 * T;
          const ty = e.y + uy * 1.5 * T;
          if (!hitsSolid(d, tx, ty, 8)) {
            s.traps.push({ id: s.nextId++, x: tx, y: ty, r: 16, dmg: enemyDamage(e), armed: true, team: 1 });
            s.sounds.push('trap');
            say(s, tr(`${t(e.def.name)} virittää ansan.`, `The ${t(e.def.name).toLowerCase()} sets a trap.`), '#ff8a70');
          }
        }
        if (sees0 && dist < 4 * T) {
          const o = openDir(d, e.x, e.y, e.r, -ux, -uy);
          walk(s, e, o.dx, o.dy, dt);
          return;
        }
      }
      const ranged = e.def.attack === 'bow' || e.def.attack === 'rock';
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
      if (e.def.boss && e.swipes >= 1 && dist > 3 * T && dist < 9 * T && sees && e.cd <= 0) {
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
        const sp = 115;
        const a = Math.atan2(dy, dx) + s.rng.range(-0.05, 0.05);
        s.projectiles.push({ id: s.nextId++, x: e.x + Math.cos(a) * (e.r + 4), y: e.y + Math.sin(a) * (e.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, team: 1, dmg: enemyDamage(e), left: e.def.reach + 40, pierce: 0, hit: new Set(), kind: 'enemyArrow', skill: null, homing: 0, dead: false });
        s.sounds.push('bowshot');
        e.mode = 'chase';
        return;
      }
      if (e.def.attack === 'rock') {
        // a rock lobbed to where the hero stands now: the landing circle shows the whole flight
        const dur = 0.9;
        s.projectiles.push({ id: s.nextId++, x: e.x, y: e.y, vx: 0, vy: 0, r: 20, team: 1, dmg: enemyDamage(e), left: dur, pierce: 0, hit: new Set(), kind: 'rock', skill: null, homing: 0, dead: false, lob: { tx: h.x, ty: h.y, t: 0, dur, sx: e.x, sy: e.y } });
        s.sounds.push('throw');
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
      const sp = enemySpeed(e) * 2.6;
      const step = sp * dt;
      const before = { x: e.x, y: e.y };
      moveCircle(d, e, e.r, e.cx * step, e.cy * step);
      const moved = Math.hypot(e.x - before.x, e.y - before.y);
      e.chargeLeft -= step;
      if (dist < e.r + h.r + 4 && !e.struck) {
        e.struck = true;
        hurtHero(s, enemyDamage(e) * 1.4, t(e.def.name), Math.atan2(uy, ux));
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

/** What an enemy's blow does on its floor: a grabbed weapon's damage when it is more, and the rage on top. */
export function enemyDamage(e: Enemy): number {
  let base = e.def.dmg;
  if (e.carry && isMelee(e.carry.kind)) base = Math.max(base, Math.round(((e.carry.dmgMin + e.carry.dmgMax) / 2) * 0.8));
  return Math.round(base * (1 + 0.15 * (e.level - 1)) * (e.rage > 0 ? 1.3 : 1));
}

/** How fast it walks now: the rage adds half. */
export function enemySpeed(e: Enemy): number {
  return e.def.speed * (e.rage > 0 ? 1.5 : 1);
}

/** Awake friends within five tiles, for the coward. */
export function friendsNear(s: SimState, e: Enemy): number {
  let n = 0;
  for (const o of s.enemies) if (o !== e && !o.dead && o.aware && o.mode !== 'sleep' && Math.hypot(o.x - e.x, o.y - e.y) < 5 * T) n++;
  return n;
}

function nearestPotion(s: SimState, e: Enemy, within: number): number | null {
  let best: number | null = null;
  let bd = within;
  for (const dr of s.drops) {
    if (dr.kind !== 'item' || dr.item?.kind !== 'potion') continue;
    const dd = Math.hypot(dr.x - e.x, dr.y - e.y);
    if (dd < bd) {
      bd = dd;
      best = dr.id;
    }
  }
  return best;
}

const goalFields = new WeakMap<object, Map<number, Int16Array>>();
/** A direction toward (x, y) along the floor, the field cached per goal tile. */
function toward(s: SimState, e: Enemy, x: number, y: number): { dx: number; dy: number } {
  const d = s.dungeon;
  const key = Math.floor(y / T) * d.w + Math.floor(x / T);
  let m = goalFields.get(d);
  if (!m) {
    m = new Map();
    goalFields.set(d, m);
  }
  let f = m.get(key);
  if (!f) {
    f = distanceField(d, [{ x, y }]);
    m.set(key, f);
  }
  const dist = Math.hypot(x - e.x, y - e.y) || 1;
  if (dist < T) return { dx: (x - e.x) / dist, dy: (y - e.y) / dist };
  return flowDir(d, e.x, e.y, f) ?? { dx: (x - e.x) / dist, dy: (y - e.y) / dist };
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
      } else hurtHero(s, enemyDamage(e) * 0.3, t(e.def.name));
      return;
    }
  }
  hurtHero(s, enemyDamage(e), t(e.def.name), Math.atan2(uy, ux));
  // the thief: a hit takes an item from the pack, and it runs
  if (e.def.quirk === 'thief' && !e.carry && h.pack.length > 0 && h.alive) {
    const it = h.pack[h.pack.length - 1];
    if (it.count > 1) {
      it.count--;
      e.carry = { ...it, id: s.nextId++, count: 1 };
    } else {
      h.pack = h.pack.filter((x) => x !== it);
      e.carry = it;
    }
    say(s, tr(`${t(e.def.name)} vie: ${t(e.carry.name)}!`, `The ${t(e.def.name).toLowerCase()} takes: ${t(e.carry.name)}!`), '#ff8a70');
    s.texts.push({ x: e.x, y: e.y - e.r - 16, text: tr('VARAS', 'THIEF'), color: '#ff8a70', life: 1.2, size: 13 });
    s.sounds.push('take');
    e.mode = 'flee';
    e.fleeT = 0;
    e.quirkT = 12;
  }
}

function walk(s: SimState, e: Enemy, mx: number, my: number, dt: number, mul = 1): void {
  const m = Math.hypot(mx, my);
  if (m < 0.01) return;
  const d = s.dungeon;
  const o = openDir(d, e.x, e.y, e.r, mx / m, my / m);
  openDoorsNear(d, e.x, e.y, e.r + 10);
  // do not walk into the hero or a friend
  const h = s.hero;
  const sp = enemySpeed(e) * mul * (e.mode === 'trapped' ? 0 : 1);
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
  const h = s.hero;
  for (const tp of s.traps) {
    if (!tp.armed) continue;
    if (tp.team === 1) {
      // a trapper's: the hero steps in, is hurt and held a moment
      if (h.alive && h.invuln <= 0 && Math.hypot(h.x - tp.x, h.y - tp.y) < tp.r + h.r) {
        tp.armed = false;
        h.stuck = 1.0;
        hurtHero(s, tp.dmg, tr('Ansa', 'A trap'));
        s.effects.push({ kind: 'blast', x: tp.x, y: tp.y, angle: 0, r: 24, life: 0.3, maxLife: 0.3, color: '#ff6a5a' });
        s.sounds.push('trap');
      }
      continue;
    }
    for (const e of s.enemies) {
      if (e.dead || e.mode === 'trapped') continue;
      if (Math.hypot(e.x - tp.x, e.y - tp.y) > tp.r + e.r) continue;
      tp.armed = false;
      e.mode = 'trapped';
      e.t = 3;
      hurtEnemy(s, e, tp.dmg, { skill: 'jousi', knock: 0, angle: 0, what: 'ansa' });
      s.effects.push({ kind: 'blast', x: tp.x, y: tp.y, angle: 0, r: 24, life: 0.3, maxLife: 0.3, color: '#8ae070' });
      s.sounds.push('trap');
      break;
    }
  }
  s.traps = s.traps.filter((x) => x.armed);
}
