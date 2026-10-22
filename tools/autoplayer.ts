import { clearShot, distanceField, flowDir, lineOfSight, openDir, T, UNSEEN, VISIBLE, seenAt } from '../src/game/dungeon';
import { NO_INPUT, type Enemy, type Hero, type HeroInput, type SimState } from '../src/game/state';
import { DT } from '../src/game/sim';
import { nearestVisible, swordReach, bowRange } from '../src/game/attacks';
import { canLearn, has, held, learn } from '../src/game/hero';
import { isMelee, weaponScore } from '../src/game/items';
import { NODES, NODE_BY_ID, type RowId } from '../src/game/content/tree';
import { FAMILY } from '../src/game/content/weapons';
import type { Rng } from '../src/game/rng';

/**
 * The bot: explores room by room, fights what it sees with the hand it
 * prefers, steps out of windups and charges, takes a better weapon, drinks
 * when low, spends its points in its row, and walks to the stairs when the
 * floor is explored. It is a floor for balance, not a player.
 *
 * A `Player` profile puts a person's limits on it, Höyry's way: BOT reacts
 * in one step; HUMAN has a reaction time, a thumb that eases, a tap rate.
 */
export interface Player {
  reaction: number;
  thumb: number;
  taps: number;
  /** the hand it fights with: the better one, or a style */
  /** the hand it fights with: the better one, melee, or the bow */
  style: 'best' | 'sword' | 'bow';
}
export const BOT: Player = { reaction: 0, thumb: 0, taps: Infinity, style: 'best' };
export const HUMAN: Player = { reaction: 0.25, thumb: 0.12, taps: 4, style: 'best' };

interface Mem {
  seen: Map<number, number>;
  mx: number;
  my: number;
  lastTap: number;
  /** the room it is walking to */
  goal: number;
  holdSince: number;
  /** drops it stood beside without taking, with the time it gave up */
  ignore: Map<number, number>;
  wantSince: number;
  wantId: number;
  stuckT: number;
  lastX: number;
  lastY: number;
  /** the direction a stuck bot tries, held for a moment */
  jiggle: { a: number; until: number } | null;
}
const mems = new WeakMap<SimState, Mem>();
function memOf(s: SimState): Mem {
  let m = mems.get(s);
  if (!m) {
    m = { seen: new Map(), mx: 0, my: 0, lastTap: -1, goal: -1, holdSince: -1, ignore: new Map(), wantSince: 0, wantId: -1, stuckT: 0, lastX: 0, lastY: 0, jiggle: null };
    mems.set(s, m);
  }
  return m;
}

function noticed(mem: Mem, s: SimState, who: Player, id: number): boolean {
  if (who.reaction <= 0) return true;
  let t0 = mem.seen.get(id);
  if (t0 === undefined) {
    t0 = s.time;
    mem.seen.set(id, t0);
  }
  return s.time - t0 >= who.reaction;
}

const fields = new WeakMap<object, Map<number, Int16Array>>();
function walkTo(s: SimState, h: Hero, x: number, y: number): { dx: number; dy: number } {
  const d = s.dungeon;
  const key = Math.floor(y / T) * d.w + Math.floor(x / T);
  let m = fields.get(d);
  if (!m) {
    m = new Map();
    fields.set(d, m);
  }
  let f = m.get(key);
  if (!f) {
    f = distanceField(d, [{ x, y }]);
    m.set(key, f);
  }
  const dist = Math.hypot(x - h.x, y - h.y) || 1;
  if (dist < T) return { dx: (x - h.x) / dist, dy: (y - h.y) / dist };
  return flowDir(d, h.x, h.y, f) ?? { dx: (x - h.x) / dist, dy: (y - h.y) / dist };
}

/** Which hand the bot wants for this fight. */
function wantHand(h: Hero, who: Player, dist: number): number {
  const [a, b] = h.hands;
  if (!a || !b) return a ? 0 : 1;
  if (who.style === 'sword') return isMelee(a.kind) ? 0 : 1;
  if (who.style === 'bow') return a.kind === 'bow' ? 0 : 1;
  // the better one, but a sword when they are on top of you
  const best = weaponScore(a) * (a.kind === 'bow' ? 1.15 : 1) >= weaponScore(b) * (b.kind === 'bow' ? 1.15 : 1) ? 0 : 1;
  if (dist < 1.6 * T) return isMelee(a.kind) ? 0 : isMelee(b.kind) ? 1 : best;
  return best;
}

export function botInput(s: SimState, h: Hero, rng: Rng, who: Player = BOT): HeroInput {
  const inp: HeroInput = { ...NO_INPUT, tech: [false, false] };
  if (!h.alive) return inp;
  const mem = memOf(s);
  const d = s.dungeon;
  if (mem.seen.size > 300) {
    const live = new Set<number>();
    for (const p of s.projectiles) live.add(p.id);
    for (const e of s.enemies) live.add(-e.id);
    for (const k of mem.seen.keys()) if (!live.has(k)) mem.seen.delete(k);
  }
  let mx = 0;
  let my = 0;

  // the nearest enemy it can see
  let tgt: Enemy | null = null;
  let td = Infinity;
  for (const e of s.enemies) {
    if (e.dead || seenAt(d, e.x, e.y) !== VISIBLE) continue;
    const dist = Math.hypot(e.x - h.x, e.y - h.y);
    if (dist < td && dist < 9 * T) {
      td = dist;
      tgt = e;
    }
  }

  if (tgt) {
    const want = wantHand(h, who, td);
    if (want !== h.active && h.hands[want]) inp.swap = true;
    const it = held(h);
    const sees = lineOfSight(d, h.x, h.y, tgt.x, tgt.y);
    const dx = (tgt.x - h.x) / td;
    const dy = (tgt.y - h.y) / td;
    if (it?.kind === 'bow') {
      const pref = 5 * T;
      if (!sees) {
        const f = walkTo(s, h, tgt.x, tgt.y);
        mx = f.dx;
        my = f.dy;
      } else if (td > pref + 20) {
        mx = dx;
        my = dy;
      } else if (td < 2.5 * T) {
        mx = -dx;
        my = -dy;
      }
      // a wall corner in the arrow's way: close in until the shot is clear
      const clear = sees && clearShot(d, h.x, h.y, tgt.x, tgt.y);
      if (sees && !clear && td > 1.5 * T) {
        const f = walkTo(s, h, tgt.x, tgt.y);
        mx = f.dx;
        my = f.dy;
      }
      // draw to full when the draw pays, else tap
      const full = has(h, 'jannitys');
      if ((clear || td <= 1.5 * T) && td < bowRange(it)) {
        if (full) {
          if (h.draw < 1) inp.hold = true;
          else inp.holdRelease = true;
        } else inp.attack = true;
      }
    } else if (it) {
      const reach = swordReach(h, it);
      if (!sees || td > reach + 10) {
        const f = td < 3 * T && sees ? { dx, dy } : walkTo(s, h, tgt.x, tgt.y);
        mx = f.dx;
        my = f.dy;
      }
      // close: wind the swing up, and release it in reach; a windup coming
      // is met with the same hold (the guard) or a sidestep
      const fam = isMelee(it.kind) ? FAMILY[it.kind] : null;
      if (fam?.shape === 'orbit') {
        // the flail: hold and walk into them; hurl it when they are at the chain's end
        if (sees && td < reach * 3) {
          if (h.drawing && td > reach * 1.3 && h.orbit.spin > 4) inp.holdRelease = true;
          else if (h.lock <= 0) inp.hold = true;
        }
      } else if (sees && td < reach * 2.2) {
        const threat = tgt.mode === 'windup' && noticed(mem, s, who, -tgt.id);
        if (threat && !has(h, 'torjunta')) {
          mx += -dy * 2;
          my += dx * 2;
        }
        const inReach = td < reach + tgt.r + 6;
        if (h.drawing && inReach && (h.draw >= 1 || !threat)) inp.holdRelease = true;
        else if (h.lock <= 0 && !h.swing) inp.hold = true;
      }
    }
    if (tgt.mode !== 'windup') mem.seen.delete(-tgt.id);
    // techniques whenever one is ready and the target is near
    for (const i of [0, 1] as const) {
      const id = h.techs[i];
      if (!id || (h.cooldowns[id] ?? 0) > 0) continue;
      const row = NODE_BY_ID[id].row;
      if ((row === 'lahi' && !(it && isMelee(it.kind))) || (row === 'jousi' && it?.kind !== 'bow')) continue;
      const near = td < (it?.kind === 'bow' ? 7 * T : 4 * T);
      if (near && sees) inp.tech[i] = true;
    }
  } else {
    // nothing to fight: a better weapon on the floor, then the next room, then the stairs
    let want: SimState['drops'][number] | null = null;
    let wd = 10 * T;
    const mine = held(h);
    for (const dr of s.drops) {
      if (dr.kind !== 'item' || !dr.item || !dr.seen || mem.ignore.has(dr.id)) continue;
      const it = dr.item;
      const dist = Math.hypot(dr.x - h.x, dr.y - h.y);
      if (dist >= wd) continue;
      if (it.kind === 'potion') {
        if (h.pack.length < 12) {
          wd = dist;
          want = dr;
        }
        continue;
      }
      if (it.kind === 'coat') {
        if (!h.coat || it.armor > h.coat.armor) {
          wd = dist;
          want = dr;
        }
        continue;
      }
      // a weapon of the class it holds: better by worth; a melee of another family counts the same way
      const same = h.hands.find((x) => x && isMelee(x.kind) === isMelee(it.kind)) ?? mine;
      if (!same || weaponScore(it) > weaponScore(same) * 1.05) {
        wd = dist;
        want = dr;
      }
    }
    if (want) {
      // a drop it cannot take in a few seconds (a full pack, a wall) is left
      if (mem.wantId !== want.id) {
        mem.wantId = want.id;
        mem.wantSince = s.time;
      } else if (s.time - mem.wantSince > 4) mem.ignore.set(want.id, s.time);
      if (h.near === want.id) {
        const it = want.item!;
        if (isMelee(it.kind) || it.kind === 'bow') {
          const slot = h.hands.findIndex((x) => x && isMelee(x.kind) === isMelee(it.kind));
          if (slot >= 0 && slot !== h.active) inp.swap = true;
          else inp.take = true;
        } else inp.take = true;
      }
      const f = walkTo(s, h, want.x, want.y);
      mx = f.dx;
      my = f.dy;
    } else {
      // chests first, then unexplored rooms by walking distance, then the stairs
      const chest = s.drops.find((dr) => dr.kind === 'chest' && !dr.opened && dr.seen);
      let gx = 0;
      let gy = 0;
      if (chest) {
        gx = chest.x;
        gy = chest.y;
      } else {
        if (mem.goal < 0 || d.seen[d.rooms[mem.goal].cy * d.w + d.rooms[mem.goal].cx] !== UNSEEN) {
          mem.goal = -1;
          let best = Infinity;
          for (const r of d.rooms) {
            if (d.seen[r.cy * d.w + r.cx] !== UNSEEN) continue;
            const v = d.flow[r.cy * d.w + r.cx];
            if (v < 0 || v >= best) continue;
            best = v;
            mem.goal = r.id;
          }
        }
        if (mem.goal >= 0) {
          gx = (d.rooms[mem.goal].cx + 0.5) * T;
          gy = (d.rooms[mem.goal].cy + 0.5) * T;
        } else if (s.bossAlive) {
          const boss = s.enemies.find((e) => e.def.boss && !e.dead);
          gx = boss ? boss.x : d.downX;
          gy = boss ? boss.y : d.downY;
        } else {
          gx = d.downX;
          gy = d.downY;
        }
      }
      const f = walkTo(s, h, gx, gy);
      mx = f.dx;
      my = f.dy;
    }
  }

  // a charge or a windup coming at it: step out of the lane, sideways
  for (const e of s.enemies) {
    if (e.dead) continue;
    const charging = e.mode === 'charge';
    const winding = e.mode === 'windup' && e.def.boss && e.chargeLeft > 0;
    if (!charging && !winding) continue;
    if (!noticed(mem, s, who, -e.id)) continue;
    const rx = h.x - e.x;
    const ry = h.y - e.y;
    const dist = Math.hypot(rx, ry) || 1;
    const ux = charging ? e.cx : rx / dist;
    const uy = charging ? e.cy : ry / dist;
    const along = rx * ux + ry * uy;
    const across = rx * uy - ry * ux;
    if (along < -10 || along > 340) continue;
    if (Math.abs(across) > e.r + h.r + 24) continue;
    const side = across >= 0 ? 1 : -1;
    mx += uy * side * 3;
    my += -ux * side * 3;
  }
  // an arrow coming: step across its line
  for (const p of s.projectiles) {
    if (p.team !== 1) continue;
    if (!noticed(mem, s, who, p.id)) continue;
    const rx = h.x - p.x;
    const ry = h.y - p.y;
    const dist = Math.hypot(rx, ry);
    if (dist > 140) continue;
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const along = (rx * p.vx + ry * p.vy) / sp;
    if (along < 0) continue;
    const across = (rx * p.vy - ry * p.vx) / sp;
    if (Math.abs(across) > h.r + p.r + 10) continue;
    const side = across >= 0 ? 1 : -1;
    mx += (p.vy / sp) * side * 2.5;
    my += (-p.vx / sp) * side * 2.5;
  }

  const m = Math.hypot(mx, my);
  if (m > 0.01) {
    const o = openDir(d, h.x, h.y, h.r, mx / m, my / m);
    inp.mx = o.dx;
    inp.my = o.dy;
  }
  if (who.thumb > 0) {
    const k = Math.min(1, DT / who.thumb);
    mem.mx += (inp.mx - mem.mx) * k;
    mem.my += (inp.my - mem.my) * k;
    inp.mx = mem.mx;
    inp.my = mem.my;
  }
  // stuck against something with the stick well over: one direction, held a moment
  const pushing = Math.hypot(inp.mx, inp.my) > 0.6;
  if (pushing && Math.hypot(h.x - mem.lastX, h.y - mem.lastY) < 0.3) mem.stuckT += DT;
  else if (!mem.jiggle) mem.stuckT = 0;
  mem.lastX = h.x;
  mem.lastY = h.y;
  if (mem.stuckT > 0.6 && !mem.jiggle) mem.jiggle = { a: rng.range(0, Math.PI * 2), until: s.time + 0.5 };
  if (mem.jiggle) {
    inp.mx = Math.cos(mem.jiggle.a);
    inp.my = Math.sin(mem.jiggle.a);
    mem.mx = inp.mx;
    mem.my = inp.my;
    if (s.time > mem.jiggle.until) {
      mem.jiggle = null;
      mem.stuckT = 0;
    }
  }
  if ((inp.attack || inp.holdRelease) && who.taps < Infinity) {
    if (s.time - mem.lastTap < 1 / who.taps) {
      inp.attack = false;
      inp.holdRelease = false;
    } else mem.lastTap = s.time + rng.range(-0.04, 0.04);
  }
  // a potion when low
  if (h.hp < 45 && h.pack.some((x) => x.kind === 'potion' && x.potion === 'heal') && rng.chance(0.2)) inp.potion = true;
  return inp;
}

/** The bot spends its points: its row first, then the general row. */
export function botSpend(s: SimState, h: Hero, who: Player = BOT): void {
  const it = held(h);
  const pref: RowId = who.style === 'bow' ? 'jousi' : who.style === 'sword' ? 'lahi' : it?.kind === 'bow' ? 'jousi' : 'lahi';
  let guard = 10;
  while (h.points > 0 && guard-- > 0) {
    let done = false;
    for (const row of [pref, 'yleinen', pref === 'jousi' ? 'lahi' : 'jousi'] as RowId[]) {
      for (const n of NODES) {
        if (n.row !== row || !canLearn(s, h, n.id).ok) continue;
        learn(s, h, n.id);
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) break;
  }
}

export { nearestVisible };
