import { lineOfSight, T, solidShot, tileAt, VISIBLE, seenAt } from './dungeon';
import type { Enemy, Hero, HeroInput, SimState, Swing } from './state';
import { has, held, heroStats, rollDamage, skillOf } from './hero';
import { hurtEnemy, hurtHero } from './combat';
import { noise } from './ai';
import { NODE_BY_ID } from './content/tree';
import { tr } from '../i18n';
import { say } from './log';
import { weaponScore, type Item } from './items';

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

export function swordReach(h: Hero, it: Item): number {
  return 44 * it.reach * heroStats(h).reachMul;
}

export function bowRange(it: Item): number {
  return 9 * T * it.reach;
}

/** The bow's rhythm: a full draw takes this long; a quick shot leaves at half; after a shot the next draw waits NOCK of it. */
export const DRAW_TIME = 1.0;
export const QUICK = 0.5;
export const NOCK = 0.5;
export function drawTime(h: Hero, it: Item): number {
  return DRAW_TIME * it.speed * heroStats(h).drawMul;
}

/** The sword's rhythm: a swing lasts this long, and the next can start after `swingLock`. */
export const SWING_TIME = 0.3;
export const SWING_LOCK = 0.6;
export function swingLock(h: Hero, it: Item): number {
  return Math.max(0.25, SWING_LOCK * it.speed * (1 - 0.02 * h.skills.miekka.lvl));
}

function aimAngle(s: SimState, h: Hero, inp: HeroInput, range: number): number {
  if (Math.hypot(inp.aimX, inp.aimY) > 0.2) return Math.atan2(inp.aimY, inp.aimX);
  const e = nearestVisible(s, h, range);
  if (e) return Math.atan2(e.y - h.y, e.x - h.x);
  return h.facing;
}

export function startSwing(s: SimState, h: Hero, it: Item, angle: number, o: Partial<Swing> = {}): void {
  const dur = SWING_TIME * it.speed;
  h.swing = { t: 0, dur, angle, reach: swordReach(h, it), width: 1.05, dmgMul: 1, hit: new Set(), passes: 1, lunge: 10, ...o };
  h.facing = angle;
  h.lock = swingLock(h, it);
  h.parry = -1;
  s.sounds.push('swing');
  noise(s, h.x, h.y, 4);
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
    s.effects.push({ kind: 'slash', x: h.x, y: h.y, angle: sw.angle, r: sw.reach, life: 0.22, maxLife: 0.22, color: '#ffe9c0' });
    for (const e of s.enemies) {
      if (e.dead || sw.hit.has(e.id)) continue;
      const dx = e.x - h.x;
      const dy = e.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist > sw.reach + e.r) continue;
      const a = Math.atan2(dy, dx);
      const diff = Math.abs(Math.atan2(Math.sin(a - sw.angle), Math.cos(a - sw.angle)));
      if (diff > sw.width) continue;
      if (!lineOfSight(s.dungeon, h.x, h.y, e.x, e.y)) continue;
      sw.hit.add(e.id);
      if (!it) continue;
      let mul = sw.dmgMul;
      let crit = false;
      if (has(h, 'mestari') && (h.hits + 1) % 3 === 0) {
        mul *= 2;
        crit = true;
      }
      const dmg = rollDamage(s, h, it, mul);
      hurtEnemy(s, e, dmg, { skill: 'miekka', knock: it.affix === 'heavy' ? 260 : 100, angle: a, crit, what: 'miekka' });
    }
  }
  if (sw.t >= sw.dur) h.swing = null;
}

export function shoot(s: SimState, h: Hero, it: Item, angle: number, draw: number): void {
  const full = draw >= 0.99;
  let mul = 1 + draw * (has(h, 'jannitys') ? 1 : 0.5);
  const pierce = (full && has(h, 'jannitys')) || it.affix === 'piercing' ? 4 : 0;
  const count = has(h, 'kaksoisnuoli') ? 2 : 1;
  const sp = 330 + draw * 90;
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
      left: bowRange(it),
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
  h.wantShot = false;
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
  const sword = it.kind === 'sword';

  // the hold verb: the sword up, the bow drawn
  if (sword) {
    if (inp.hold && !h.swing && h.lock <= 0 && !h.dash && has(h, 'torjunta')) {
      if (h.parry < 0) h.parry = 0;
      else h.parry += dt;
      if (Math.hypot(inp.aimX, inp.aimY) > 0.2) h.facing = Math.atan2(inp.aimY, inp.aimX);
      else {
        const e = nearestVisible(s, h, 4 * T);
        if (e) h.facing = Math.atan2(e.y - h.y, e.x - h.x);
      }
    } else h.parry = -1;
    h.drawing = false;
    h.draw = 0;
    h.wantShot = false;
    if (inp.attack && h.lock <= 0 && !h.swing && !h.dash) {
      const angle = aimAngle(s, h, inp, swordReach(h, it) * 1.6);
      startSwing(s, h, it, angle);
    }
  } else {
    h.parry = -1;
    // the bow: a tap queues one shot, which leaves when the draw reaches the
    // quick mark; a hold draws on toward the full shot and the release fires
    // it; nothing fires while the last shot is still being nocked
    if (inp.attack && h.lock <= 0 && !h.dash && !h.wantShot) h.wantShot = true;
    if (inp.holdRelease && h.lock <= 0 && !h.dash) {
      if (h.draw >= QUICK) {
        shoot(s, h, it, aimAngle(s, h, inp, bowRange(it)), h.draw);
      } else h.wantShot = true;
    }
    if ((inp.hold || h.wantShot) && h.lock <= 0 && !h.dash) {
      const before = h.draw;
      h.drawing = true;
      h.draw = Math.min(1, h.draw + dt / drawTime(h, it));
      if (h.draw >= 1 && before < 1) s.sounds.push('drawfull');
      if (h.wantShot && h.draw >= QUICK) shoot(s, h, it, aimAngle(s, h, inp, bowRange(it)), h.draw);
    } else if (!inp.hold && !h.wantShot) {
      h.drawing = false;
      h.draw = 0;
    }
  }
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
  const needs = d.row === 'miekka' ? 'sword' : d.row === 'jousi' ? 'bow' : null;
  if (needs && it?.kind !== needs) {
    say(s, needs === 'sword' ? tr('Tekniikka tarvitsee miekan käteen.', 'The technique needs a sword in hand.') : tr('Tekniikka tarvitsee jousen käteen.', 'The technique needs a bow in hand.'), '#ff8a70');
    return;
  }
  if (!it) return;
  if (h.swing || h.lock > 0 || h.dash) return;
  switch (id) {
    case 'halkaisu': {
      const angle = aimAngle(s, h, inp, swordReach(h, it) * 1.8);
      startSwing(s, h, it, angle, { width: 1.75, dmgMul: 1.5, reach: swordReach(h, it) * 1.15, dur: 0.38 * it.speed, lunge: 10 });
      h.lock = 0.55 * it.speed;
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
      startSwing(s, h, it, h.facing, { width: Math.PI, passes: 2, dur: 0.6 * it.speed, lunge: 0 });
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
      const e = s.enemies.find((x) => x.id === d.target && !x.dead);
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
      if (p.left <= 0 || solidShot(tileAt(d, p.x, p.y))) {
        p.dead = true;
        if (p.left > 0) s.sounds.push('thud');
        break;
      }
      if (p.team === 0) {
        for (const e of s.enemies) {
          if (e.dead || p.hit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r) continue;
          p.hit.add(e.id);
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
