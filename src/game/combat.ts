import type { Enemy, Hero, SimState } from './state';
import { gainXp, heroStats, trainSkill } from './hero';
import type { SkillId } from './skills';
import { rollDrop, rollWeapon, type Item } from './items';
import { t, tr } from '../i18n';
import { say } from './log';
import { LAST_FLOOR } from './state';
import { freeSpot, T } from './dungeon';

/**
 * Every hit goes through one of two functions, Höyry's rule: hurtEnemy and
 * hurtHero own damage numbers, knockback, kills, experience and drops. A
 * new weapon or technique never has to remember them.
 */
export interface HitSource {
  /** the skill the hit trains, if a hero weapon dealt it */
  skill: SkillId | null;
  /** the push, px/s, along `angle` */
  knock: number;
  angle: number;
  crit?: boolean;
  what: string;
  /** the charge behind the hit, as its damage multiplier (0.6 a tap, 2 full): the number grows and the sound steps with it */
  power?: number;
}

export function hurtEnemy(s: SimState, e: Enemy, dmg: number, src: HitSource): void {
  if (e.dead) return;
  if (e.armorBreak > 0) dmg = Math.round(dmg * 1.33);
  e.hp -= dmg;
  e.hurtFlash = 0.15;
  wake(s, e, true);
  if (src.knock > 0 && !e.def.boss) {
    e.knock.vx += Math.cos(src.angle) * src.knock;
    e.knock.vy += Math.sin(src.angle) * src.knock;
  }
  const power = src.power ?? 1;
  const size = Math.round((src.crit ? 16 : 12) + 5 * Math.max(0, power - 0.6));
  s.texts.push({ x: e.x + s.rng.range(-6, 6), y: e.y - e.r - 10, text: String(dmg), color: src.crit ? '#ffd040' : power >= 1.5 ? '#ffe9a0' : '#fff', life: 0.8 + 0.2 * power, size });
  s.effects.push({ kind: 'hit', x: e.x, y: e.y - e.r * 0.5, angle: src.angle, r: 8 + 6 * power, life: 0.18, maxLife: 0.18, color: src.crit ? '#ffd040' : '#ffe9c0' });
  s.sounds.push(power >= 1.5 ? 'hitbig' : 'hit');
  if (power >= 1.5) s.shake = Math.max(s.shake, 0.25);
  const h = s.hero;
  h.hits++;
  // a hit on something that still gives experience trains the hand
  if (src.skill && givesXp(h, e)) trainSkill(s, h, src.skill);
  if (e.hp <= 0) kill(s, e, src);
}

/** An enemy ten levels under you teaches nothing. */
export function givesXp(h: Hero, e: Enemy): boolean {
  return e.level >= h.level - 3;
}

function kill(s: SimState, e: Enemy, src: HitSource): void {
  e.dead = true;
  e.deathT = 0.5;
  s.run.kills++;
  s.floorKills++;
  s.sounds.push(e.def.boss ? 'bosskill' : 'kill');
  const h = s.hero;
  if (givesXp(h, e)) gainXp(s, h, Math.round(e.def.xp * (1 + 0.25 * (e.level - 1))));
  say(s, tr(`Tapoit: ${t(e.def.name).toLowerCase()}.`, `You killed the ${t(e.def.name).toLowerCase()}.`), '#b8c8a8');
  if (e.def.boss) {
    s.run.bosses++;
    s.bossAlive = false;
    s.shake = 1;
    s.slowmo = 0.8;
    s.banner = { text: tr('Karhu kaatui', 'The bear falls'), sub: s.floor >= LAST_FLOOR ? tr('Portaat alas avautuvat', 'The stairs down open') : '', life: 3, color: '#ffd870' };
    for (let k = 0; k < 3; k++) dropItem(s, e.x + s.rng.range(-28, 28), e.y + s.rng.range(-20, 20), k === 0 ? rollWeapon(s.rng, s.rng.chance(0.5) ? 'sword' : 'bow', s.floor, 3) : rollDrop(s.rng, s.floor, s.potionColors, 0.2));
    return;
  }
  void src;
  if (s.rng.chance(0.32)) dropItem(s, e.x, e.y, rollDrop(s.rng, s.floor, s.potionColors));
}

export function dropItem(s: SimState, x: number, y: number, item: Item): void {
  // onto the floor, never into a wall: a thing in a wall cannot be reached
  const p = freeSpot(s.dungeon, x, y, 10);
  s.drops.push({ id: s.nextId++, x: p.x, y: p.y, kind: 'item', item, loot: [], opened: false, seen: false, judged: false, life: 0 });
  if (item.rarity >= 2) s.sounds.push(item.rarity >= 3 ? 'epic' : 'rare');
}

export function hurtHero(s: SimState, dmg: number, what: string, angle = 0): void {
  const h = s.hero;
  if (!h.alive || h.invuln > 0) return;
  const st = heroStats(h);
  const taken = Math.max(1, Math.round(dmg - st.armor));
  h.hp -= taken;
  h.hurtFlash = 0.25;
  h.invuln = 0.3;
  s.shake = Math.max(s.shake, 0.4);
  s.texts.push({ x: h.x, y: h.y - 30, text: `-${taken}`, color: '#ff6a5a', life: 0.9, size: 14 });
  s.sounds.push('hurt');
  s.onHurt?.(taken, what);
  say(s, tr(`${what} osuu: -${taken}.`, `${what} hits: -${taken}.`), '#ff8a70');
  if (h.hp <= 0) {
    h.hp = 0;
    h.alive = false;
    s.gameOver = true;
    s.slowmo = 1.2;
    s.banner = { text: tr('Kuolit', 'You died'), sub: tr(`${what} kerroksessa ${s.floor}`, `${what} on floor ${s.floor}`), life: 5, color: '#ff6a5a' };
    s.sounds.push('death');
  }
  void angle;
}

/** An enemy hears or sees something: it wakes, and from now on it hunts. */
export function wake(s: SimState, e: Enemy, hurt = false): void {
  if (e.dead) return;
  if (e.mode === 'sleep') {
    e.mode = 'idle';
    e.t = 0.3;
  }
  if (!e.aware) {
    e.aware = true;
    e.alertT = 1.2;
    // the room wakes with it: a pack, the way a NetHack room empties at you
    for (const o of s.enemies) {
      if (o === e || o.dead || o.aware || o.room !== e.room || o.def.boss) continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) > 7 * T) continue;
      if (o.mode === 'sleep' && !s.rng.chance(0.5)) continue;
      o.aware = true;
      o.alertT = 1.2;
      if (o.mode === 'sleep') o.mode = 'idle';
    }
    if (e.def.boss) {
      s.banner = { text: t(e.def.name), sub: tr('Väistä rynnäkkö sivulle', 'Sidestep the charge'), life: 2.6, color: '#ff8a70' };
      s.sounds.push('boss');
    } else if (!hurt) say(s, tr(`${t(e.def.name)} huomaa sinut!`, `The ${t(e.def.name).toLowerCase()} notices you!`), '#ff8a70');
  }
  void s;
}
