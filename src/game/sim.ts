import { createState, LAST_FLOOR, type Hero, type HeroInput, type SimState, type Enemy } from './state';
import { freeSpot, generateDungeon, moveCircle, openDoorsNear, roomSpots, STAIRS_DOWN, T, tileAt, updateFlow, updateSeen, idxAt, VISIBLE, UNSEEN } from './dungeon';
import { ENEMY_BY_ID, floorCast } from './content/enemies';
import { heroAttack, updateDash, updateProjectiles, updateSwing } from './attacks';
import { enemyStep, separate, springTraps } from './ai';
import { dropItem } from './combat';
import { has, held, heroStats } from './hero';
import { FAMILIES } from './content/weapons';
import { isMelee, makePotion, rollCoat, POTION_COLORS, resetItemIds, rollDrop, rollWeapon, weaponScore, type Item, type PotionKind, POTION_NAME, POTION_COLOR_NAME } from './items';

/** A thing a hand can hold. */
export const isWeapon = (it: Item): boolean => isMelee(it.kind) || it.kind === 'bow';
import { Rng } from './rng';
import { t, tr, L } from '../i18n';
import { say } from './log';
import { snapshot } from './save';

export const DT = 1 / 60;

/** The floor's light: tiles the hero sees round them outside a room. */
export const LIGHT_TILES = 5.5;

export const FLOOR_NAMES = [L('Juurikellari', 'The root cellar'), L('Hiiden kellarit', "Hiisi's cellars"), L('Kaivos', 'The mine'), L('Syvä kaivos', 'The deep mine'), L('Karhun pesä', "The bear's den")];

export function newRun(seed: number): SimState {
  const s = createState(seed, generateDungeon(seed, 1));
  const colors = s.rng.shuffle([...POTION_COLORS]);
  s.potionColors = { heal: '#d04040', strength: colors[0], speed: colors[1], poison: colors[2] };
  resetItemIds(1);
  const h = s.hero;
  h.hands = [rollWeapon(s.rng, 'sword', 1, 0), rollWeapon(s.rng, 'bow', 1, 0)];
  h.pack = [makePotion('heal', s.potionColors, 2)];
  s.saveBlob = snapshot(s);
  startFloor(s);
  return s;
}

export function startFloor(s: SimState): void {
  const d = s.dungeon;
  const h = s.hero;
  h.x = d.startX;
  h.y = d.startY;
  h.swing = null;
  h.dash = null;
  h.draw = 0;
  h.drawing = false;
  h.parry = -1;
  h.near = null;
  s.enemies = [];
  s.projectiles = [];
  s.drops = [];
  s.traps = [];
  s.texts = [];
  s.effects = [];
  s.floorTime = 0;
  s.floorKills = 0;
  s.stairsT = 0;
  s.run.floor = Math.max(s.run.floor, s.floor);
  const boss = s.floor === LAST_FLOOR;
  s.bossAlive = boss;
  const { count, pool } = floorCast(s.floor);
  const rooms = d.rooms.filter((r) => r.id !== 0);
  const n = boss ? Math.round(count * 0.6) : count;
  for (let k = 0; k < n; k++) {
    const room = s.rng.pick(boss ? rooms.filter((r) => r.id !== d.downRoom) : rooms);
    const spots = roomSpots(d, room, h.x, h.y, 4 * T);
    if (!spots.length) continue;
    const p = s.rng.pick(spots);
    const def = s.rng.weighted(pool, (e) => e.weight);
    spawn(s, def.id, p.x, p.y, room.id, s.rng.chance(def.sleepy));
  }
  if (boss) {
    const room = d.rooms[d.downRoom];
    const den = freeSpot(d, d.downX + T, d.downY, 16);
    spawn(s, 'karhu', den.x, den.y, room.id, true);
  }
  // chests and a few things on the floor
  const chests = 1 + (s.rng.chance(0.5) ? 1 : 0);
  for (let k = 0; k < chests; k++) {
    const room = s.rng.pick(rooms);
    const spots = roomSpots(d, room, d.downX, d.downY, 2 * T).filter((p) => tileAt(d, p.x, p.y) !== STAIRS_DOWN);
    if (!spots.length) continue;
    const p = s.rng.pick(spots);
    const loot = [rollDrop(s.rng, s.floor, s.potionColors, 0.15), rollDrop(s.rng, s.floor, s.potionColors, 0.15)];
    if (s.rng.chance(0.5)) loot.push(rollDrop(s.rng, s.floor, s.potionColors, 0.3));
    s.drops.push({ id: s.nextId++, x: p.x, y: p.y, kind: 'chest', item: null, loot, opened: false, seen: false, judged: false, life: 0 });
  }
  for (let k = 0; k < 2 + Math.floor(s.floor / 2); k++) {
    const room = s.rng.pick(rooms);
    const spots = roomSpots(d, room, h.x, h.y, 2 * T);
    if (!spots.length) continue;
    const p = s.rng.pick(spots);
    dropItem(s, p.x + s.rng.range(-8, 8), p.y + s.rng.range(-8, 8), rollDrop(s.rng, s.floor, s.potionColors));
  }
  updateFlow(d, [{ x: h.x, y: h.y }]);
  updateSeen(d, h.x, h.y, LIGHT_TILES);
  const name = t(FLOOR_NAMES[Math.min(FLOOR_NAMES.length - 1, s.floor - 1)]);
  s.banner = { text: tr(`Kerros ${s.floor}`, `Floor ${s.floor}`), sub: name, life: 2.6 };
  say(s, tr(`Kerros ${s.floor}: ${name.toLowerCase()}.`, `Floor ${s.floor}: ${name.toLowerCase()}.`), '#ffd870');
  if (boss) say(s, tr('Karhu nukkuu portaiden luona. Se herää kun tulet lähelle.', 'The bear sleeps by the stairs. It wakes when you come near.'), '#ff8a70');
  s.sounds.push('floor');
}

export function spawn(s: SimState, defId: string, x: number, y: number, room: number, asleep: boolean): Enemy {
  const def = ENEMY_BY_ID[defId];
  const hpMul = 1 + (s.floor - 1) * 0.2;
  const e: Enemy = {
    id: s.nextId++,
    def,
    x,
    y,
    r: def.r,
    hp: Math.round(def.hp * hpMul),
    maxHp: Math.round(def.hp * hpMul),
    mode: asleep ? 'sleep' : 'idle',
    t: 0,
    facing: s.rng.range(0, Math.PI * 2),
    aware: false,
    alertT: 0,
    room,
    home: { x, y },
    cx: 0,
    cy: 0,
    cd: 0.5,
    hurtFlash: 0,
    knock: { vx: 0, vy: 0 },
    dead: false,
    deathT: 0,
    level: s.floor,
    chargeLeft: 0,
    struck: false,
    swipes: 0,
    bleed: { t: 0, dps: 0 },
    armorBreak: 0,
    carry: null,
    rage: 0,
    lostT: 0,
    fleeT: 0,
    quirkUsed: false,
    wantDrop: null,
    quirkT: s.rng.range(1, 3),
  };
  // the hoarder's treasure: a rare weapon or coat
  if (def.quirk === 'hoarder') e.carry = s.rng.chance(0.6) ? rollWeapon(s.rng, s.rng.weighted(FAMILIES, (f) => f.weight).kind, s.floor, 2 + (s.rng.chance(0.3) ? 1 : 0)) : rollCoat(s.rng, s.floor, 2);
  s.enemies.push(e);
  return e;
}

export function nextFloor(s: SimState): void {
  if (s.floor >= LAST_FLOOR) {
    s.won = true;
    s.gameOver = true;
    s.banner = { text: tr('Mäki jatkuu', 'The hill goes on'), sub: tr('Viipale yksi loppuu tähän', 'Slice one ends here'), life: 5, color: '#ffd870' };
    return;
  }
  s.floor++;
  s.dungeon = generateDungeon(s.seed, s.floor);
  const h = s.hero;
  h.hp = heroStats(h).maxHp;
  say(s, tr('Elämä palaa portailla.', 'Your health returns on the stairs.'), '#8ae070');
  // the save is taken before the floor spawns, so a load replays the spawn
  s.saveBlob = snapshot(s);
  s.saveWanted = true;
  startFloor(s);
}

export function step(s: SimState, inp: HeroInput, dt: number): void {
  s.time += dt;
  s.floorTime += dt;
  const h = s.hero;
  const d = s.dungeon;
  if (s.banner) {
    s.banner.life -= dt;
    if (s.banner.life <= 0) s.banner = null;
  }
  if (s.toast) {
    s.toast.life -= dt;
    if (s.toast.life <= 0) s.toast = null;
  }
  for (const x of s.texts) {
    x.life -= dt;
    x.y -= 22 * dt;
  }
  s.texts = s.texts.filter((x) => x.life > 0);
  for (const x of s.effects) x.life -= dt;
  s.effects = s.effects.filter((x) => x.life > 0);
  s.shake = Math.max(0, s.shake - dt * 2);
  s.slowmo = Math.max(0, s.slowmo - dt);
  for (const e of s.enemies) if (e.dead) e.deathT -= dt;
  s.enemies = s.enemies.filter((e) => !e.dead || e.deathT > 0);
  if (s.gameOver) return;

  h.invuln = Math.max(0, h.invuln - dt);
  h.hurtFlash = Math.max(0, h.hurtFlash - dt);
  for (const k of ['strength', 'speed', 'poison'] as const) h.buffs[k] = Math.max(0, h.buffs[k] - dt);
  if (h.buffs.poison > 0 && Math.floor((h.buffs.poison + dt) * 2) !== Math.floor(h.buffs.poison * 2)) {
    h.hp = Math.max(1, h.hp - 2);
    s.texts.push({ x: h.x, y: h.y - 30, text: '-2', color: '#8ae070', life: 0.7, size: 11 });
  }

  // movement
  const st = heroStats(h);
  h.hp = Math.min(h.hp, st.maxHp);
  h.stuck = Math.max(0, h.stuck - dt);
  const m = h.stuck > 0 ? 0 : Math.hypot(inp.mx, inp.my);
  h.moving = m > 0.05 && !h.dash;
  if (h.dash) {
    moveCircle(d, h, h.r, h.dash.dx * 460 * dt, h.dash.dy * 460 * dt);
    updateDash(s, h, dt);
  } else if (h.moving) {
    const k = Math.min(1, m);
    let sp = st.speed * k;
    if (h.swing) sp *= 0.3;
    moveCircle(d, h, h.r, inp.mx * sp * dt, inp.my * sp * dt);
    h.walk += dt * k * 10;
    if (!h.swing && h.parry < 0 && !h.drawing && !inp.aiming) h.facing = Math.atan2(inp.my, inp.mx);
  }
  if (h.swing && h.swing.lunge > 0 && h.swing.t < h.swing.dur * 0.45) {
    const k = (h.swing.lunge / (h.swing.dur * 0.45)) * dt;
    moveCircle(d, h, h.r, Math.cos(h.swing.angle) * k, Math.sin(h.swing.angle) * k);
  }
  if (inp.aiming && Math.hypot(inp.aimX, inp.aimY) > 0.2 && !h.swing) h.facing = Math.atan2(inp.aimY, inp.aimX);
  // a door opens to a hand on it: the reach covers a body pressed against the frame beside it
  if (openDoorsNear(d, h.x, h.y, h.r + 16) > 0) {
    s.sounds.push('door');
    say(s, tr('Ovi aukeaa.', 'The door opens.'), '#b8c8a8');
  }

  heroAttack(s, h, inp, dt);
  updateSwing(s, h, dt);
  if (inp.potion) drinkHeal(s, h);
  if (inp.take) takeNear(s, h);

  // enemies
  const frame = Math.round(s.time / dt);
  if (frame % 6 === 0) updateFlow(d, [{ x: h.x, y: h.y }]);
  for (const e of s.enemies) enemyStep(s, e, dt);
  separate(s);
  springTraps(s);
  updateProjectiles(s, dt);

  // drops: what is plainly better, and every consumable, is taken on the
  // walk (docs/loot-ui.md); the rest waits under the hero as a chip
  h.near = null;
  let nd = 24;
  for (const dr of s.drops) {
    const dist = Math.hypot(dr.x - h.x, dr.y - h.y);
    if (dr.kind === 'chest') {
      if (!dr.opened && dist < h.r + 18) openChest(s, dr);
      continue;
    }
    if (!dr.item) continue;
    if (dist < 20 && !dr.judged) {
      dr.judged = true;
      if (autoTake(s, h, dr)) continue;
    }
    if (dr.item && dist < nd) {
      nd = dist;
      h.near = dr.id;
    }
  }
  s.drops = s.drops.filter((dr) => dr.kind === 'chest' || dr.item);

  // the stairs down: stand on them a moment
  const onStairs = tileAt(d, h.x, h.y) === STAIRS_DOWN;
  if (onStairs && !s.bossAlive) {
    s.stairsT += dt;
    if (s.stairsT >= 0.6) {
      s.sounds.push('stairs');
      nextFloor(s);
      return;
    }
  } else {
    if (onStairs && s.bossAlive && s.stairsT === 0) {
      say(s, tr('Portaat ovat tukossa: karhu vartioi niitä.', 'The stairs are blocked: the bear guards them.'), '#ff8a70');
      s.stairsT = 0.01;
    }
    if (!onStairs) s.stairsT = 0;
  }

  if (frame % 3 === 0) updateSeen(d, h.x, h.y, LIGHT_TILES);
  for (const dr of s.drops) if (!dr.seen && d.seen[idxAt(d, dr.x, dr.y)] === VISIBLE) dr.seen = true;
  s.cam.x = h.x;
  s.cam.y = h.y;
}

function openChest(s: SimState, dr: SimState['drops'][number]): void {
  dr.opened = true;
  s.sounds.push('chest');
  s.effects.push({ kind: 'open', x: dr.x, y: dr.y, angle: 0, r: 24, life: 0.5, maxLife: 0.5, color: '#e0b048' });
  say(s, tr('Arkku aukeaa.', 'The chest opens.'), '#ffd870');
  dr.loot.forEach((it, i) => {
    const a = (i / dr.loot.length) * Math.PI * 2 + 0.6;
    dropItem(s, dr.x + Math.cos(a) * 26, dr.y + Math.sin(a) * 22, it);
  });
  dr.loot = [];
}

export const PACK_SIZE = 12;

/** An item into the pack (potions stack). False when the pack is full. */
export function giveItem(s: SimState, h: Hero, it: Item): boolean {
  if (it.kind === 'potion') {
    const same = h.pack.find((p) => p.kind === 'potion' && p.potion === it.potion);
    if (same) {
      same.count += it.count;
      sayTaken(s, h, it);
      return true;
    }
  }
  if (h.pack.length >= PACK_SIZE) {
    say(s, tr('Reppu on täynnä.', 'The pack is full.'), '#ff8a70');
    return false;
  }
  h.pack.push(it);
  s.run.items++;
  s.run.bestRarity = Math.max(s.run.bestRarity, it.rarity);
  sayTaken(s, h, it);
  return true;
}

function sayTaken(s: SimState, h: Hero, it: Item): void {
  s.sounds.push('take');
  say(s, tr(`Otit: ${nameOf(h, it)}.`, `You take: ${nameOf(h, it)}.`), it.rarity >= 2 ? '#c070ff' : '#b8c8a8');
}

/** An unknown potion is named by its colour until it has been drunk. */
export function nameOf(h: Hero, it: Item): string {
  if (it.kind === 'potion' && it.potion && !h.known[it.potion]) return tr(`${t(POTION_COLOR_NAME[it.color] ?? L('outo', 'odd'))} juoma`, `${t(POTION_COLOR_NAME[it.color] ?? L('outo', 'odd'))} potion`);
  return t(it.name);
}

/** The weapon under the hero into the active hand; the old one onto the floor. */
export function takeNear(s: SimState, h: Hero): void {
  if (h.near === null) return;
  const dr = s.drops.find((x) => x.id === h.near);
  if (!dr || !dr.item) return;
  const it = dr.item;
  if (it.kind === 'potion') {
    if (giveItem(s, h, it)) dr.item = null;
    return;
  }
  if (it.kind === 'coat') {
    wearFrom(s, h, dr);
    return;
  }
  const same = h.hands.findIndex((x) => x && isMelee(x.kind) === isMelee(it.kind));
  const empty = h.hands[0] === null ? 0 : h.hands[1] === null ? 1 : -1;
  const slot = empty >= 0 ? empty : same >= 0 ? same : h.active;
  takeInto(s, h, dr, slot, false);
}

/**
 * The rule for a drop under the hero, written in docs/loot-ui.md so Höyry
 * can share it: a potion joins the pack; a coat with more armour is worn;
 * a weapon into an empty hand, or in place of the same kind when it is
 * plainly better (a sixth more worth). The replaced thing goes into the
 * pack when there is room, else it lies where the new one lay, so nothing
 * is lost and the walk is never stopped. True when the drop was taken.
 */
export function autoTake(s: SimState, h: Hero, dr: SimState['drops'][number]): boolean {
  const it = dr.item;
  if (!it) return false;
  if (it.kind === 'potion') {
    if (giveItem(s, h, it)) {
      dr.item = null;
      return true;
    }
    return false;
  }
  if (it.kind === 'coat') {
    if (h.coat && h.coat.armor >= it.armor) return false;
    wearFrom(s, h, dr);
    return true;
  }
  // the same family replaces on the walk; another family is a choice, it waits as a chip
  const same = h.hands.findIndex((x) => x?.kind === it.kind);
  const sameClass = h.hands.findIndex((x) => x && (isMelee(x.kind) === isMelee(it.kind)));
  const empty = h.hands[0] === null ? 0 : h.hands[1] === null ? 1 : -1;
  if (empty >= 0 && sameClass < 0) {
    takeInto(s, h, dr, empty, true);
    return true;
  }
  if (same >= 0 && weaponScore(it) > weaponScore(h.hands[same]!) * 1.15) {
    takeInto(s, h, dr, same, true);
    return true;
  }
  return false;
}

/** Where a thing taken off the hero goes: the pack when there is room, else the floor. */
export type Where = 'pack' | 'floor';
export function whereOldGoes(h: Hero): Where {
  return h.pack.length < PACK_SIZE ? 'pack' : 'floor';
}
export function whereWord(w: Where): string {
  return w === 'pack' ? tr('reppuun', 'to the pack') : tr('lattialle (reppu täynnä)', 'to the floor (pack full)');
}

/** The thing taken off the hero: into the pack, or onto the floor at (x, y). Nothing is ever destroyed. */
function placeOld(s: SimState, h: Hero, old: Item | null, x: number, y: number): Where | null {
  if (!old) return null;
  if (h.pack.length < PACK_SIZE) {
    h.pack.push(old);
    h.lastStowed = old.id;
    s.toast = { text: `${t(old.name)} → ${tr('reppu', 'pack')}`, color: '#b8c8a8', life: 3.5 };
    return 'pack';
  }
  dropItem(s, x, y, old);
  s.toast = { text: `${t(old.name)} → ${tr('lattia', 'floor')}`, color: '#ff8a70', life: 3.5 };
  return 'floor';
}

function sayMove(s: SimState, head: string, old: Item | null, where: Where | null, color: string): void {
  const tail = old && where ? ` ${t(old.name)} ${whereWord(where)}.` : '';
  say(s, `${head}${tail}`, color);
}

/** The coat from a drop onto the hero; the old one into the pack or onto the floor. */
export function wearFrom(s: SimState, h: Hero, dr: SimState['drops'][number]): void {
  const it = dr.item;
  if (!it || it.kind !== 'coat') return;
  const old = h.coat;
  h.coat = it;
  dr.item = null;
  const where = placeOld(s, h, old, dr.x, dr.y);
  s.run.items++;
  s.run.bestRarity = Math.max(s.run.bestRarity, it.rarity);
  s.sounds.push('take');
  sayMove(s, tr(`Ylle: ${t(it.name)}.`, `Worn: ${t(it.name)}.`), old, where, it.rarity >= 2 ? '#c070ff' : '#b8c8a8');
  s.drops = s.drops.filter((x) => x.kind === 'chest' || x.item);
}

/** A weapon from a drop into hand `slot`; the old one into the pack or onto the floor. */
export function takeInto(s: SimState, h: Hero, dr: SimState['drops'][number], slot: number, auto: boolean): void {
  const it = dr.item;
  if (!it || !isWeapon(it)) return;
  const old = h.hands[slot];
  h.hands[slot] = it;
  if (!auto) h.active = slot;
  dr.item = null;
  const where = placeOld(s, h, old, dr.x, dr.y);
  if (slot === h.active) {
    h.swing = null;
    h.draw = 0;
    h.drawing = false;
  }
  s.run.items++;
  s.run.bestRarity = Math.max(s.run.bestRarity, it.rarity);
  s.sounds.push('take');
  const head = auto ? tr(`Parempi, käsi ${slot + 1}: ${t(it.name)}.`, `Better, hand ${slot + 1}: ${t(it.name)}.`) : tr(`Käsi ${slot + 1}: ${t(it.name)}.`, `Hand ${slot + 1}: ${t(it.name)}.`);
  sayMove(s, head, old, where, it.rarity >= 2 ? '#c070ff' : '#b8c8a8');
  s.drops = s.drops.filter((x) => x.kind === 'chest' || x.item);
}

/** From the chip's card: the drop into the pack. */
export function packFrom(s: SimState, h: Hero, dr: SimState['drops'][number]): boolean {
  const it = dr.item;
  if (!it) return false;
  if (!giveItem(s, h, it)) return false;
  dr.item = null;
  s.drops = s.drops.filter((x) => x.kind === 'chest' || x.item);
  return true;
}

/** The two hands change places; the active one stays the active weapon. */
export function swapHands(s: SimState, h: Hero): void {
  h.hands = [h.hands[1], h.hands[0]];
  h.active = 1 - h.active;
  s.sounds.push('swap');
  say(s, tr('Kädet vaihtoivat paikkaa.', 'The hands changed places.'), '#b8c8a8');
}

/** A hand or the coat into the pack. False when the pack is full. */
export function stow(s: SimState, h: Hero, it: Item): boolean {
  if (h.pack.length >= PACK_SIZE) {
    say(s, tr('Reppu on täynnä.', 'The pack is full.'), '#ff8a70');
    return false;
  }
  if (h.coat === it) h.coat = null;
  for (const i of [0, 1] as const) if (h.hands[i] === it) h.hands[i] = null;
  if (!h.hands[h.active] && h.hands[1 - h.active]) h.active = 1 - h.active;
  h.pack.push(it);
  s.sounds.push('take');
  say(s, tr(`${t(it.name)} reppuun.`, `${t(it.name)} to the pack.`), '#b8c8a8');
  return true;
}

/** The potion button: the first healing potion in the pack. */
export function drinkHeal(s: SimState, h: Hero): void {
  const p = h.pack.find((x) => x.kind === 'potion' && x.potion === 'heal');
  if (!p) {
    say(s, tr('Ei parannusjuomaa.', 'No healing potion.'), '#ff8a70');
    return;
  }
  drink(s, h, p);
}

export function drink(s: SimState, h: Hero, p: Item): void {
  if (p.kind !== 'potion' || !p.potion) return;
  const kind: PotionKind = p.potion;
  const first = !h.known[kind];
  h.known[kind] = true;
  const st = heroStats(h);
  switch (kind) {
    case 'heal':
      h.hp = Math.min(st.maxHp, h.hp + (has(h, 'sisu') ? st.maxHp : Math.round(st.maxHp * 0.5)));
      s.texts.push({ x: h.x, y: h.y - 30, text: '+', color: '#8ae070', life: 0.8, size: 16 });
      break;
    case 'strength':
      h.buffs.strength = 30;
      break;
    case 'speed':
      h.buffs.speed = 30;
      break;
    case 'poison':
      h.buffs.poison = 8;
      break;
  }
  s.sounds.push('drink');
  const name = t(POTION_NAME[kind]);
  say(s, first ? tr(`Juot: se oli ${name.toLowerCase()}!`, `You drink: it was a ${name.toLowerCase()}!`) : tr(`Juot: ${name.toLowerCase()}.`, `You drink: ${name.toLowerCase()}.`), kind === 'poison' ? '#8ae070' : '#ffd870');
  p.count--;
  if (p.count <= 0) h.pack = h.pack.filter((x) => x !== p);
}

/** From the pack screen: a weapon into a hand, a coat on, an item onto the floor. */
export function equip(s: SimState, h: Hero, it: Item, slot: 0 | 1): void {
  if (!h.pack.includes(it)) return;
  if (it.kind === 'coat') {
    const old = h.coat;
    h.coat = it;
    h.pack = h.pack.filter((x) => x !== it);
    if (old) h.pack.push(old);
    s.sounds.push('take');
    sayMove(s, tr(`Ylle: ${t(it.name)}.`, `Worn: ${t(it.name)}.`), old, old ? 'pack' : null, '#b8c8a8');
    return;
  }
  if (!isWeapon(it)) return;
  const old = h.hands[slot];
  h.hands[slot] = it;
  h.pack = h.pack.filter((x) => x !== it);
  if (old) {
    h.pack.push(old);
    h.lastStowed = old.id;
  }
  h.active = slot;
  h.swing = null;
  h.draw = 0;
  h.drawing = false;
  s.sounds.push('swap');
  sayMove(s, tr(`Käsi ${slot + 1}: ${t(it.name)}.`, `Hand ${slot + 1}: ${t(it.name)}.`), old, old ? 'pack' : null, '#b8c8a8');
}

export function dropFromPack(s: SimState, h: Hero, it: Item): void {
  h.pack = h.pack.filter((x) => x !== it);
  if (h.coat === it) h.coat = null;
  for (const i of [0, 1] as const) if (h.hands[i] === it) h.hands[i] = null;
  if (!h.hands[h.active] && h.hands[1 - h.active]) h.active = 1 - h.active;
  dropItem(s, h.x + s.rng.range(-10, 10), h.y + 14, it);
  say(s, tr(`${t(it.name)} lattialle.`, `${t(it.name)} onto the floor.`), '#b8c8a8');
}

/** Every item the run holds: in the hands, worn, in the pack, on the floor and in chests. For the checks. */
export function countItems(s: SimState): number {
  const h = s.hero;
  let n = 0;
  for (const it of [...h.hands, h.coat, ...h.pack]) if (it) n += it.count;
  for (const dr of s.drops) {
    if (dr.item) n += dr.item.count;
    for (const it of dr.loot) n += it.count;
  }
  for (const e of s.enemies) if (e.carry) n += e.carry.count;
  return n;
}

/** The whole floor, for the map screen: rooms explored of all. */
export function explored(s: SimState): { seen: number; total: number } {
  const d = s.dungeon;
  let seen = 0;
  for (const r of d.rooms) if (d.seen[r.cy * d.w + r.cx] !== UNSEEN) seen++;
  return { seen, total: d.rooms.length };
}

export const botRng = (seed: number) => new Rng(seed ^ 0x5151);
export { held };
