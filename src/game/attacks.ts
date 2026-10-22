import { lineOfSight, T, solidShot, tileAt, VISIBLE, seenAt } from './dungeon';
import type { Enemy, Hero, HeroInput, SimState, Swing } from './state';
import { has, held, heroStats, rollDamage, skillOf } from './hero';
import { hurtEnemy, hurtHero } from './combat';
import { noise } from './ai';
import { NODE_BY_ID } from './content/tree';
import { tr } from '../i18n';
import { say } from './log';
import { isMelee, weaponScore, type Item } from './items';
import { FAMILY, type Family } from './content/weapons';

/**
 * The hero's hands. The weapon in the active hand sets the style: a sword
 * strikes an arc and parries, a bow shoots and draws. Techniques from the
 * tree sit on two buttons and use the weapon's damage.
 */

/** The nearest living enemy the hero can see within `range`. */
export function nearestVisible(s: SimState, h: Hero, range: number, los = true): Enemy | null {
  let best: Enemy | null = null;
  let bd = range;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - h.x, e.y - h.y);
    if (d >= bd) continue;
    if (seenAt(s.dungeon, e.x, e.y) !== VISIBLE) continue;
    if (los && !lineOfSight(s.dungeon, h.x, h.y, e.x, e.y)) continue;
    bd = d;
    best = e;
  }
  return best;
}

/** The family of a melee weapon in hand; the sword's for anything else, so old callers keep working. */
export function familyOf(it: Item): Family {
  return isMelee(it.kind) ? FAMILY[it.kind] : FAMILY.sword;
}

export function swordReach(h: Hero, it: Item): number {
  return familyOf(it).reach * it.reach * heroStats(h).reachMul;
}

export function bowRange(it: Item): number {
  return 9 * T * it.reach;
}

/**
 * The hands' rhythm. A hold charges: the bow draws, the sword winds up, as
 * long as the thumb stays down, to a cap at 1. The release fires with the
 * charge; a tap fires at zero charge, the weak version. After a shot the
 * next draw waits NOCK of a draw time; after a swing the next waits
 * `swingLock`. Skills and gear shorten the time to full, never the cap.
 */
export const DRAW_TIME = 1.0;
export const NOCK = 0.6;
export function drawTime(h: Hero, it: Item): number {
  return DRAW_TIME * it.speed * heroStats(h).drawMul;
}
export function windTime(h: Hero, it: Item): number {
  return familyOf(it).wind * it.speed * heroStats(h).windMul;
}
/** the flail's full spin, radians a second */
export const ORBIT_FULL = 7;
export const SWING_TIME = 0.3;
export function swingLock(h: Hero, it: Item): number {
  return Math.max(0.2, familyOf(it).lock * it.speed * (1 - 0.02 * h.skills.lahi.lvl));
}
/** What a charge is worth: a tap does three fifths, a full hold twice. */
export function chargeMul(charge: number): number {
  return 0.6 + 1.4 * Math.min(1, Math.max(0, charge));
}

function aimAngle(s: SimState, h: Hero, inp: HeroInput, range: number): number {
  if (Math.hypot(inp.aimX, inp.aimY) > 0.2) return Math.atan2(inp.aimY, inp.aimX);
  const e = nearestVisible(s, h, range);
  if (e) return Math.atan2(e.y - h.y, e.x - h.x);
  return h.facing;
}

export function startSwing(s: SimState, h: Hero, it: Item, angle: number, o: Partial<Swing> = {}): void {
  const f = familyOf(it);
  const dur = SWING_TIME * f.swing * it.speed;
  const effect = f.effect === 'pull' || f.effect === 'none' ? 'none' : f.effect;
  h.swing = { t: 0, dur, angle, reach: swordReach(h, it), width: f.width, dmgMul: 1, hit: new Set(), passes: 1, lunge: f.lunge, shape: f.shape === 'line' ? 'line' : f.shape === 'ring' ? 'ring' : 'arc', effect, slam: false, ...o };
  h.facing = angle;
  h.lock = swingLock(h, it);
  h.parry = -1;
  h.draw = 0;
  h.drawing = false;
  s.sounds.push(f.sound);
}

/** The release of a wound-up melee weapon, with its family's behaviour. */
export function release(s: SimState, h: Hero, it: Item, angle: number, charge: number): void {
  const f = familyOf(it);
  const mul = chargeMul(charge);
  if (f.shape === 'orbit') {
    // the flail: the ball flies straight ahead with the spin behind it
    const spin = Math.min(1, h.orbit.spin / ORBIT_FULL);
    const sp = 300 + 220 * spin;
    s.projectiles.push({ id: s.nextId++, x: h.x + Math.cos(angle) * 14, y: h.y + Math.sin(angle) * 14, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: 9, team: 0, dmg: rollDamage(s, h, it, chargeMul(spin)), left: swordReach(h, it) * 3.2, pierce: 0, hit: new Set(), kind: 'ball', skill: 'lahi', homing: 0, dead: false });
    h.orbit.spin = 0;
    h.lock = swingLock(h, it);
    h.facing = angle;
    s.sounds.push('whirl');
    noise(s, h.x, h.y, 5);
    return;
  }
  if (f.shape === 'throw') {
    // the anchor: a hook down a line, back with whatever it caught
    const sp = 520;
    s.projectiles.push({ id: s.nextId++, x: h.x + Math.cos(angle) * 14, y: h.y + Math.sin(angle) * 14, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: f.width, team: 0, dmg: rollDamage(s, h, it, mul), left: swordReach(h, it) * (0.6 + 0.4 * charge), pierce: 99, hit: new Set(), kind: 'anchor', skill: 'lahi', homing: 0, dead: false, hooked: [], returning: false });
    h.lock = swingLock(h, it);
    h.facing = angle;
    s.sounds.push('chain');
    noise(s, h.x, h.y, 6);
    return;
  }
  if (f.full === 'slam' && charge >= 1) {
    // the mace's ground slam: a ring round the hero, armour broken
    startSwing(s, h, it, angle, { shape: 'ring', width: Math.PI, reach: swordReach(h, it) * 1.4, dmgMul: mul, effect: 'armorbreak', slam: true, lunge: 0 });
    s.shake = Math.max(s.shake, 0.6);
    s.sounds.push('stomp');
    return;
  }
  if (f.full === 'run' && charge >= 1) {
    // the spear's running thrust: a dash, then the line
    h.dash = { t: 0.16, dx: Math.cos(angle), dy: Math.sin(angle), target: -1 };
    h.facing = angle;
    h.invuln = Math.max(h.invuln, 0.2);
    s.sounds.push('dash');
    return;
  }
  startSwing(s, h, it, angle, { dmgMul: mul });
}

/** The swing's hit lands partway through; a whirl lands twice. */
export function updateSwing(s: SimState, h: Hero, dt: number): void {
  const sw = h.swing;
  if (!sw) return;
  const it = held(h);
  const before = sw.t;
  sw.t += dt;
  const hitAt = sw.dur * 0.45;
  const hitAt2 = sw.dur * 0.85;
  const landed = (at: number) => before < at && sw.t >= at;
  if (landed(hitAt) || (sw.passes > 1 && landed(hitAt2))) {
    if (landed(hitAt2)) sw.hit.clear();
    s.effects.push({ kind: sw.shape === 'line' ? 'thrust' : sw.shape === 'ring' ? 'ring' : 'slash', x: h.x, y: h.y, angle: sw.angle, r: sw.reach, life: sw.slam ? 0.4 : 0.22, maxLife: sw.slam ? 0.4 : 0.22, color: sw.slam ? '#ff9a60' : '#ffe9c0' });
    const f = it ? familyOf(it) : FAMILY.sword;
    // the blow is what wakes a room, when it lands; a dagger wakes only who it touches
    noise(s, h.x, h.y, f.kind === 'dagger' ? 0.5 : f.heavy ? 6 : 4);
    for (const e of s.enemies) {
      if (e.dead || sw.hit.has(e.id)) continue;
      const dx = e.x - h.x;
      const dy = e.y - h.y;
      const dist = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (sw.shape === 'line') {
        // a thrust: a bar from the hero along the angle
        const along = dx * Math.cos(sw.angle) + dy * Math.sin(sw.angle);
        const across = Math.abs(-dx * Math.sin(sw.angle) + dy * Math.cos(sw.angle));
        if (along < 0 || along > sw.reach + e.r || across > sw.width + e.r) continue;
      } else {
        if (dist > sw.reach + e.r) continue;
        if (sw.shape === 'arc') {
          const diff = Math.abs(Math.atan2(Math.sin(a - sw.angle), Math.cos(a - sw.angle)));
          if (diff > sw.width) continue;
        }
      }
      if (!lineOfSight(s.dungeon, h.x, h.y, e.x, e.y)) continue;
      sw.hit.add(e.id);
      if (!it) continue;
      let mul = sw.dmgMul;
      let crit = false;
      if (has(h, 'mestari') && (h.hits + 1) % 3 === 0) {
        mul *= 2;
        crit = true;
      }
      // the dagger: triple on an enemy that has not noticed you
      if (sw.effect === 'backstab' && !e.aware) {
        mul *= 3;
        crit = true;
        s.texts.push({ x: e.x, y: e.y - e.r - 22, text: tr('selkään', 'backstab'), color: '#c9b7ff', life: 1, size: 12 });
      }
      const dmg = rollDamage(s, h, it, mul);
      const knock = sw.effect === 'push' ? f.knock : it.affix === 'heavy' ? f.knock * 2 : f.knock;
      const hpBefore = e.hp;
      hurtEnemy(s, e, dmg, { skill: 'lahi', knock, angle: sw.shape === 'line' ? sw.angle : a, crit, what: f.kind });
      if (e.dead) {
        if (sw.effect === 'reap') {
          h.hp = Math.min(heroStats(h).maxHp, h.hp + 3);
          s.texts.push({ x: h.x, y: h.y - 30, text: '+3', color: '#8ae070', life: 0.8, size: 12 });
        }
        continue;
      }
      if (sw.effect === 'bleed') e.bleed = { t: 3, dps: Math.max(2, Math.round(dmg * 0.25)) };
      if (sw.effect === 'push' && !e.def.boss && e.mode !== 'stagger') {
        e.mode = 'stagger';
        e.t = 0.5;
      }
      if ((sw.effect === 'stagger' || sw.effect === 'armorbreak') && !e.def.boss && e.mode !== 'stagger') {
        e.mode = 'stagger';
        e.t = Math.max(e.t, 0.8);
      }
      if (sw.effect === 'armorbreak') e.armorBreak = 5;
      void hpBefore;
    }
  }
  if (sw.t >= sw.dur) h.swing = null;
}

export function shoot(s: SimState, h: Hero, it: Item, angle: number, draw: number): void {
  const full = draw >= 0.99;
  // the draw's worth: damage, and a little range and speed; the node adds the pierce at full
  let mul = chargeMul(draw);
  const pierce = (full && has(h, 'jannitys')) || it.affix === 'piercing' ? 4 : 0;
  const count = has(h, 'kaksoisnuoli') ? 2 : 1;
  const sp = 260 + draw * 160;
  for (let k = 0; k < count; k++) {
    const a = angle + (count > 1 ? (k === 0 ? -0.07 : 0.07) : 0);
    s.projectiles.push({
      id: s.nextId++,
      x: h.x + Math.cos(a) * 14,
      y: h.y + Math.sin(a) * 14,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 5,
      team: 0,
      dmg: rollDamage(s, h, it, mul),
      left: bowRange(it) * (0.7 + 0.3 * draw),
      pierce,
      hit: new Set(),
      kind: 'arrow',
      skill: 'jousi',
      homing: has(h, 'haukansilma') ? 3 : 0,
      dead: false,
    });
  }
  mul = 0;
  h.facing = angle;
  h.lock = NOCK * drawTime(h, it);
  h.draw = 0;
  h.drawing = false;
  s.sounds.push(full ? 'bowfull' : 'bowshot');
  if (!has(h, 'hiljainen')) noise(s, h.x, h.y, 6);
}

export function heroAttack(s: SimState, h: Hero, inp: HeroInput, dt: number): void {
  const it = held(h);
  h.lock = Math.max(0, h.lock - dt);
  h.parried = Math.max(0, h.parried - dt);
  h.swapCd = Math.max(0, h.swapCd - dt);
  for (const k of Object.keys(h.cooldowns)) h.cooldowns[k] = Math.max(0, h.cooldowns[k] - dt);

  if (inp.swap && h.swapCd <= 0 && h.hands[1 - h.active]) {
    h.active = 1 - h.active;
    h.swapCd = 0.25;
    h.swing = null;
    h.draw = 0;
    h.drawing = false;
    h.parry = -1;
    s.sounds.push('swap');
  }
  if (!it) return;
  const sword = isMelee(it.kind);
  const fam = isMelee(it.kind) ? FAMILY[it.kind] : null;

  // the hold verb charges: the bow draws, the sword winds up (and, with
  // Torjunta, guards from the front while it does); the release fires with
  // the charge, a tap fires the weak version at once
  const canStart = h.lock <= 0 && !h.swing && !h.dash;
  if (inp.hold && (canStart || h.drawing)) {
    if (!h.drawing) {
      h.drawing = true;
      h.draw = 0;
    }
    const before = h.draw;
    h.draw = Math.min(1, h.draw + dt / (sword ? windTime(h, it) : drawTime(h, it)));
    if (h.draw >= 1 && before < 1) s.sounds.push('drawfull');
    if (sword && fam?.guard && has(h, 'torjunta')) {
      if (h.parry < 0) h.parry = 0;
      else h.parry += dt;
    }
    if (Math.hypot(inp.aimX, inp.aimY) > 0.2) h.facing = Math.atan2(inp.aimY, inp.aimX);
    else if (sword) {
      const e = nearestVisible(s, h, 4 * T);
      if (e) h.facing = Math.atan2(e.y - h.y, e.x - h.x);
    }
  } else if (!inp.holdRelease) {
    h.drawing = false;
    h.draw = 0;
    h.parry = -1;
  }
  // the flail's ball orbits while the hold lasts; walking feeds the spin
  if (fam?.shape === 'orbit') {
    if (h.drawing) {
      const feed = (h.moving ? 1.6 : 1.0) * ORBIT_FULL * dt / windTime(h, it);
      h.orbit.spin = Math.min(ORBIT_FULL * 1.3, h.orbit.spin + feed);
      h.orbit.a += h.orbit.spin * dt;
      const r = swordReach(h, it);
      const bx = h.x + Math.cos(h.orbit.a) * r;
      const by = h.y + Math.sin(h.orbit.a) * r;
      for (const e of s.enemies) {
        if (e.dead || Math.hypot(e.x - bx, e.y - by) > e.r + 10) continue;
        if (s.time - (h.orbit.hit[e.id] ?? -9) < 0.45) continue;
        if (!lineOfSight(s.dungeon, h.x, h.y, e.x, e.y)) continue;
        h.orbit.hit[e.id] = s.time;
        const spin = Math.min(1, h.orbit.spin / ORBIT_FULL);
        hurtEnemy(s, e, rollDamage(s, h, it, 0.35 + 0.45 * spin), { skill: 'lahi', knock: fam.knock * (0.5 + spin), angle: h.orbit.a + Math.PI / 2, what: 'varsta' });
        s.effects.push({ kind: 'hit', x: bx, y: by, angle: h.orbit.a, r: 8, life: 0.15, maxLife: 0.15, color: '#ffe9c0' });
      }
    } else {
      h.orbit.spin = Math.max(0, h.orbit.spin - ORBIT_FULL * 2 * dt);
      h.orbit.a += h.orbit.spin * dt;
    }
  }
  const fire = (charge: number) => {
    if (sword) release(s, h, it, aimAngle(s, h, inp, swordReach(h, it) * 1.6), charge);
    else shoot(s, h, it, aimAngle(s, h, inp, bowRange(it)), charge);
  };
  if (inp.holdRelease && h.drawing) {
    const charge = h.draw;
    h.drawing = false;
    h.draw = 0;
    h.parry = -1;
    if (h.lock <= 0 && !h.swing && !h.dash) fire(charge);
  } else if (inp.attack && canStart) fire(0);
  h.aimShow = { on: inp.aiming, x: inp.aiming ? inp.aimX : h.aimShow.x, y: inp.aiming ? inp.aimY : h.aimShow.y };

  for (const i of [0, 1] as const) {
    if (!inp.tech[i]) continue;
    const id = h.techs[i];
    if (!id) continue;
    technique(s, h, id, inp);
  }
}

function technique(s: SimState, h: Hero, id: string, inp: HeroInput): void {
  const d = NODE_BY_ID[id];
  if ((h.cooldowns[id] ?? 0) > 0) return;
  const it = held(h);
  const needs = d.row === 'lahi' ? 'melee' : d.row === 'jousi' ? 'bow' : null;
  const held0 = it ? (isMelee(it.kind) ? 'melee' : it.kind) : null;
  if (needs && held0 !== needs) {
    say(s, needs === 'melee' ? tr('Tekniikka tarvitsee lähitaisteluaseen käteen.', 'The technique needs a melee weapon in hand.') : tr('Tekniikka tarvitsee jousen käteen.', 'The technique needs a bow in hand.'), '#ff8a70');
    return;
  }
  if (!it) return;
  if (h.swing || h.lock > 0 || h.dash) return;
  switch (id) {
    case 'halkaisu': {
      // the weapon's heavy blow: half again as wide and as strong
      const angle = aimAngle(s, h, inp, swordReach(h, it) * 1.8);
      const f = familyOf(it);
      startSwing(s, h, it, angle, { width: f.shape === 'line' ? f.width * 2 : Math.min(Math.PI, f.width * 1.5), dmgMul: 1.5, reach: swordReach(h, it) * 1.15, dur: SWING_TIME * f.swing * 1.3 * it.speed });
      h.lock = swingLock(h, it) * 1.2;
      break;
    }
    case 'syoksy': {
      const e = nearestVisible(s, h, 6 * T);
      if (!e) {
        say(s, tr('Ei kohdetta syöksylle.', 'No target for the lunge.'), '#b8c8a8');
        return;
      }
      const dx = e.x - h.x;
      const dy = e.y - h.y;
      const dist = Math.hypot(dx, dy) || 1;
      h.dash = { t: Math.max(0.05, (dist - e.r - 20) / 460), dx: dx / dist, dy: dy / dist, target: e.id };
      h.facing = Math.atan2(dy, dx);
      h.invuln = Math.max(h.invuln, h.dash.t + 0.1);
      s.sounds.push('dash');
      break;
    }
    case 'pyorre': {
      startSwing(s, h, it, h.facing, { shape: 'ring', width: Math.PI, passes: 2, dur: 0.6 * it.speed, lunge: 0 });
      h.lock = 0.7 * it.speed;
      break;
    }
    case 'ansa': {
      s.traps.push({ id: s.nextId++, x: h.x, y: h.y, r: 18, dmg: Math.round(((it.dmgMin + it.dmgMax) / 2) * 1.5), armed: true });
      s.sounds.push('trap');
      say(s, tr('Ansa on viritetty jalkoihisi.', 'A trap is set at your feet.'), '#8ae070');
      break;
    }
    case 'nuolisade': {
      const e = nearestVisible(s, h, 8 * T);
      const tx = e ? e.x : h.x + Math.cos(h.facing) * 4 * T;
      const ty = e ? e.y : h.y + Math.sin(h.facing) * 4 * T;
      for (let k = 0; k < 7; k++) {
        const a = s.rng.range(0, Math.PI * 2);
        const r = s.rng.range(0, 1.6 * T);
        s.projectiles.push({ id: s.nextId++, x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, vx: 0, vy: 0, r: 20, team: 0, dmg: rollDamage(s, h, it, 0.9), left: 0.45 + k * 0.06, pierce: 0, hit: new Set(), kind: 'rain', skill: 'jousi', homing: 0, dead: false });
      }
      s.effects.push({ kind: 'rain', x: tx, y: ty, angle: 0, r: 1.8 * T, life: 0.9, maxLife: 0.9, color: '#8ae070' });
      s.sounds.push('bowfull');
      break;
    }
    default:
      return;
  }
  h.cooldowns[id] = d.cooldown;
}

/** The lunge: a dash that ends in a double strike at the target. */
export function updateDash(s: SimState, h: Hero, dt: number): void {
  const d = h.dash;
  if (!d) return;
  d.t -= dt;
  const it = held(h);
  if (d.t <= 0) {
    h.dash = null;
    if (it) {
      const e = d.target >= 0 ? s.enemies.find((x) => x.id === d.target && !x.dead) : null;
      const angle = e ? Math.atan2(e.y - h.y, e.x - h.x) : h.facing;
      startSwing(s, h, it, angle, { dmgMul: 2, lunge: 0 });
    }
  }
}

export function updateProjectiles(s: SimState, dt: number): void {
  const d = s.dungeon;
  const h = s.hero;
  for (const p of s.projectiles) {
    if (p.dead) continue;
    if (p.kind === 'rain') {
      p.left -= dt;
      if (p.left > 0) continue;
      p.dead = true;
      s.effects.push({ kind: 'blast', x: p.x, y: p.y, angle: 0, r: p.r, life: 0.25, maxLife: 0.25, color: '#c8e0a0' });
      for (const e of s.enemies) {
        if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.r) continue;
        hurtEnemy(s, e, p.dmg, { skill: 'jousi', knock: 60, angle: Math.atan2(e.y - p.y, e.x - p.x), what: 'nuolisade' });
      }
      continue;
    }
    if (p.homing > 0 && p.team === 0) {
      const e = nearestVisible(s, { ...h, x: p.x, y: p.y } as Hero, 5 * T, true);
      if (e) {
        const want = Math.atan2(e.y - p.y, e.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, diff));
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(cur + turn) * sp;
        p.vy = Math.sin(cur + turn) * sp;
      }
    }
    const step = Math.hypot(p.vx, p.vy) * dt;
    const n = Math.max(1, Math.ceil(step / 4));
    for (let i = 0; i < n && !p.dead; i++) {
      p.x += (p.vx * dt) / n;
      p.y += (p.vy * dt) / n;
      p.left -= step / n;
      // (the sub-step is the line of sight's sampling, so what the eye sees the arrow reaches)
      if (p.kind === 'anchor' && p.returning) {
        // on the way back: the hooked come with it, and it ends at the hero's feet
        const dh = Math.hypot(h.x - p.x, h.y - p.y);
        for (const id of p.hooked ?? []) {
          const e = s.enemies.find((x) => x.id === id && !x.dead);
          if (!e) continue;
          e.x = p.x + (e.x - p.x) * 0.1;
          e.y = p.y + (e.y - p.y) * 0.1;
          e.knock = { vx: 0, vy: 0 };
          if (e.mode !== 'stagger') {
            e.mode = 'stagger';
            e.t = 0.6;
          }
        }
        if (dh < 30) {
          p.dead = true;
          for (const id of p.hooked ?? []) {
            const e = s.enemies.find((x) => x.id === id && !x.dead);
            if (e) {
              e.mode = 'stagger';
              e.t = 0.8;
            }
          }
          if ((p.hooked ?? []).length) s.sounds.push('stomp');
          break;
        }
        continue;
      }
      if (p.left <= 0 || solidShot(tileAt(d, p.x, p.y))) {
        if (p.kind === 'anchor' && !p.returning) {
          // the end of the chain: turn and haul
          p.returning = true;
          if (solidShot(tileAt(d, p.x, p.y))) {
            p.x -= (p.vx * dt) / n;
            p.y -= (p.vy * dt) / n;
          }
          const back = Math.atan2(h.y - p.y, h.x - p.x);
          const sp = 380;
          p.vx = Math.cos(back) * sp;
          p.vy = Math.sin(back) * sp;
          p.left = 1e9;
          break;
        }
        p.dead = true;
        if (p.left > 0) s.sounds.push(p.kind === 'ball' ? 'stomp' : 'thud');
        break;
      }
      if (p.team === 0) {
        for (const e of s.enemies) {
          if (e.dead || p.hit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r) continue;
          p.hit.add(e.id);
          if (p.kind === 'anchor') {
            // hooked: it comes back with the chain
            hurtEnemy(s, e, p.dmg, { skill: p.skill, knock: 0, angle: 0, what: 'ankkuri' });
            p.hooked?.push(e.id);
            continue;
          }
          if (p.kind === 'ball') {
            hurtEnemy(s, e, p.dmg, { skill: p.skill, knock: 320, angle: Math.atan2(p.vy, p.vx), what: 'varsta' });
            if (!e.def.boss && e.mode !== 'stagger') {
              e.mode = 'stagger';
              e.t = 0.5;
            }
            p.dead = true;
            break;
          }
          hurtEnemy(s, e, p.dmg, { skill: p.skill, knock: 55, angle: Math.atan2(p.vy, p.vx), what: 'nuoli' });
          if (p.pierce > 0) {
            p.pierce--;
            p.dmg = Math.round(p.dmg * 0.85);
          } else {
            p.dead = true;
            break;
          }
        }
      } else if (h.alive && Math.hypot(h.x - p.x, h.y - p.y) < h.r + p.r) {
        p.dead = true;
        // a parry stops an arrow from the front
        if (h.parry >= 0 && has(h, 'torjunta')) {
          const from = Math.atan2(-p.vy, -p.vx);
          const diff = Math.abs(Math.atan2(Math.sin(h.facing - from), Math.cos(h.facing - from)));
          if (diff < 1.2) {
            s.effects.push({ kind: 'parry', x: h.x + Math.cos(h.facing) * 14, y: h.y + Math.sin(h.facing) * 14, angle: h.facing, r: 16, life: 0.3, maxLife: 0.3, color: '#c8d0e0' });
            s.sounds.push('block');
            break;
          }
        }
        hurtHero(s, p.dmg, tr('Nuoli', 'An arrow'), Math.atan2(p.vy, p.vx));
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => !p.dead);
}

/** For the pickup card: is this weapon better than the hand it would replace. */
export function better(it: Item, than: Item | null): boolean {
  return !than || weaponScore(it) > weaponScore(than);
}

export { skillOf };
