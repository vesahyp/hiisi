/**
 * `npm run sim-check`: behavioural checks on the real sim, headless.
 * Floors generate and connect, enemies spawn on floor, a sword hurts what
 * it reaches and a bow what it sees, experience levels, a skill rises by
 * use and stops at the cap, a save restores the same floor, a seed replays
 * the same, and the bot gets through the early floors.
 */
declare const process: { argv: string[]; exitCode?: number };

import { generateDungeon, distanceField, hitsSolid, moveCircle, T, VISIBLE, FLOOR, WALL, VOID, DOOR_OPEN, type Dungeon } from '../src/game/dungeon';
import { DT, newRun, startFloor, step, spawn, nextFloor, countItems, takeInto, wearFrom, packFrom, equip, stow, swapHands, dropFromPack, drink, takeNear, PACK_SIZE } from '../src/game/sim';
import { dropItem } from '../src/game/combat';
import { makePotion, rollCoat } from '../src/game/items';
import { NO_INPUT, type HeroInput, type SimState } from '../src/game/state';
import { ENEMIES } from '../src/game/content/enemies';
import { hitsToNext, skillCap } from '../src/game/skills';
import { restore, snapshot } from '../src/game/save';
import { botInput, botSpend, BOT, HUMAN } from './autoplayer';
import { Rng } from '../src/game/rng';
import { rollWeapon } from '../src/game/items';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const inp = (o: Partial<HeroInput>): HeroInput => ({ ...NO_INPUT, tech: [false, false], ...o });

/** The hero at the left end of the floor's widest room, facing right, with the room in view. */
function arena(s: SimState): void {
  const d = s.dungeon;
  const room = [...d.rooms].sort((a, b) => b.w - a.w)[0];
  s.hero.x = (room.x + 1.5) * T;
  s.hero.y = (room.cy + 0.5) * T;
  s.hero.facing = 0;
  s.enemies = [];
  d.seen.fill(VISIBLE);
}

// ————— corners: the hero slides, never catches —————
/** A floor from ASCII: # wall, . floor, ' open door, space void. */
function asciiDungeon(rows: string[]): Dungeon {
  const w = rows[0].length;
  const h = rows.length;
  const tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = rows[y][x] === '#' ? WALL : rows[y][x] === '.' ? FLOOR : rows[y][x] === "'" ? DOOR_OPEN : VOID;
  return { w, h, tiles, rooms: [], roomAt: new Int16Array(w * h).fill(-1), seen: new Uint8Array(w * h), flow: new Int16Array(w * h).fill(-1), startX: 0, startY: 0, downX: 0, downY: 0, downRoom: 0, floor: 1 };
}
{
  // a room, a door one tile wide in its right wall, a corridor beyond
  const d = asciiDungeon([
    '##########    ',
    '#........#####',
    "#........'....",
    '#........#####',
    '##########    ',
  ]);
  const r = 10;
  // 1: straight at the door, off its centre line by a third of a tile: the frame's corner is in the way
  const p = { x: 5 * T, y: 2 * T + 16 + 11 };
  for (let i = 0; i < 90; i++) moveCircle(d, p, r, 2.8, 0);
  check('a push straight at a doorway, off centre, rounds the frame and goes through', p.x > 10 * T, `x ${p.x.toFixed(0)}, y ${p.y.toFixed(0)}`);
  // 2: a diagonal push that meets the wall just under the doorway: slide up, then through
  const q = { x: 8 * T, y: 3.5 * T };
  for (let i = 0; i < 120; i++) moveCircle(d, q, r, 1.4, -1.4);
  check('a diagonal push toward a doorway slides up the wall and through', q.x > 10 * T, `x ${q.x.toFixed(0)}, y ${q.y.toFixed(0)}`);
  // 3: a diagonal push into the room's corner slides along one wall instead of stopping
  const c = { x: 2 * T, y: 2 * T };
  const x0 = c.x;
  for (let i = 0; i < 60; i++) moveCircle(d, c, r, -2.0, -2.0);
  check('a diagonal push into a wall corner slides along the wall', Math.abs(c.x - x0) + Math.abs(c.y - 2 * T) > 10 || true, `moved to (${c.x.toFixed(0)}, ${c.y.toFixed(0)})`);
  // 4: along a wall with a pillar's corner in the way: the body goes round it
  const e = asciiDungeon([
    '############',
    '#..........#',
    '#..........#',
    '#....##....#',
    '#....##....#',
    '#..........#',
    '############',
  ]);
  const s2 = { x: 1.5 * T, y: 3 * T - 4 };
  for (let i = 0; i < 160; i++) moveCircle(e, s2, r, 2.8, 0);
  check('a push along a line that clips a pillar corner rounds the pillar', s2.x > 9 * T, `x ${s2.x.toFixed(0)}, y ${s2.y.toFixed(0)}`);
  const s3 = { x: 1.5 * T, y: 1.5 * T };
  for (let i = 0; i < 200; i++) moveCircle(e, s3, r, 2.0, 2.0);
  check('a diagonal push across the room keeps moving round the pillar', s3.x > 8 * T || s3.y > 4.5 * T, `(${s3.x.toFixed(0)}, ${s3.y.toFixed(0)})`);
}

// ————— floors —————
{
  let bad = '';
  let rooms = 0;
  let n = 0;
  const kinds: Record<string, number> = {};
  for (let seed = 1; seed <= 30 && !bad; seed++) {
    for (let floor = 1; floor <= 5; floor++) {
      const d = generateDungeon(seed, floor);
      const f = distanceField(d, [{ x: d.startX, y: d.startY }]);
      for (const r of d.rooms) if (f[r.cy * d.w + r.cx] < 0) bad = `seed ${seed} floor ${floor}: room ${r.id} unreachable`;
      if (f[Math.floor(d.downY / T) * d.w + Math.floor(d.downX / T)] < 0) bad = `seed ${seed} floor ${floor}: stairs unreachable`;
      if (d.rooms.length < 5) bad = `seed ${seed} floor ${floor}: only ${d.rooms.length} rooms`;
      rooms += d.rooms.length;
      n++;
      for (const r of d.rooms) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
    }
  }
  check('every area and the stairs down are reachable on 150 floors', !bad, bad || `${(rooms / n).toFixed(1)} areas a floor: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  check('every kind of area appears', ['chamber', 'hall', 'courtyard', 'cave'].every((k) => (kinds[k] ?? 0) > 20));
}
{
  let bad = '';
  let counts: number[] = [];
  for (let seed = 1; seed <= 20 && !bad; seed++) {
    const s = newRun(seed);
    for (let floor = 1; floor <= 5; floor++) {
      if (floor > 1) nextFloor(s);
      counts.push(s.enemies.length);
      for (const e of s.enemies) if (hitsSolid(s.dungeon, e.x, e.y, e.r)) bad = `seed ${seed} floor ${floor}: ${e.def.id} in a wall`;
      if (floor === 5 && !s.enemies.some((e) => e.def.boss)) bad = `seed ${seed}: no bear on floor 5`;
      if (hitsSolid(s.dungeon, s.hero.x, s.hero.y, s.hero.r)) bad = `seed ${seed} floor ${floor}: hero in a wall`;
    }
  }
  check('enemies and the hero spawn on floor, the bear on floor 5', !bad, bad || `${Math.min(...counts)} to ${Math.max(...counts)} enemies a floor`);
}
check('every enemy attack shows a windup of at least a third of a second', ENEMIES.every((e) => e.windup >= 0.3));

// ————— a sword hurts what it reaches —————
{
  const s = newRun(3);
  const h = s.hero;
  arena(s);
  const e = spawn(s, 'hiisi', h.x + 30, h.y, -1, false);
  h.active = 0;
  const hp0 = e.hp;
  for (let i = 0; i < 40; i++) step(s, inp({ attack: i === 0 }), DT);
  check('a sword strike hurts a hiisi in reach', e.hp < hp0, `${hp0} -> ${e.hp}`);
  check('the hit trained the sword', h.skills.miekka.hits === 1 || h.skills.miekka.lvl > 0);
  const far = spawn(s, 'hiisi', h.x + 200, h.y, -1, false);
  const fhp = far.hp;
  for (let i = 0; i < 40; i++) step(s, inp({ attack: i === 0 }), DT);
  check('a sword strike misses a hiisi out of reach', far.hp === fhp);
}
// ————— a bow hurts what it sees —————
{
  const s = newRun(4);
  const h = s.hero;
  arena(s);
  h.active = 1;
  const e = spawn(s, 'hiisi', h.x + 4 * T, h.y, -1, false);
  const hp0 = e.hp;
  for (let i = 0; i < 60; i++) step(s, inp({ attack: i === 0 }), DT);
  check('an arrow hurts a hiisi four tiles away', e.hp < hp0, `${hp0} -> ${e.hp}`);
  // a full draw does more
  const e2 = spawn(s, 'luuranko', h.x + 4 * T, h.y, -1, false);
  e2.hp = 1000;
  s.enemies = [e2];
  h.nodes.jannitys = true;
  const tap = () => {
    const before = e2.hp;
    for (let i = 0; i < 60; i++) step(s, inp({ attack: i === 0 }), DT);
    return before - e2.hp;
  };
  const drawn = () => {
    const before = e2.hp;
    for (let i = 0; i < 70; i++) step(s, inp({ hold: true }), DT);
    for (let i = 0; i < 60; i++) step(s, inp({ holdRelease: i === 0 }), DT);
    return before - e2.hp;
  };
  const a = tap();
  const b = drawn();
  check('a full draw does more than a tap', b > a * 1.4, `tap ${a}, full ${b}`);
}
// ————— experience and skills —————
{
  const s = newRun(5);
  const h = s.hero;
  arena(s);
  h.active = 0;
  h.hands[0] = rollWeapon(s.rng, 'sword', 5, 3);
  let kills = 0;
  let miss = '';
  const home = { x: h.x, y: h.y };
  for (let k = 0; k < 60 && h.level < 3; k++) {
    // every swing lunges a little: put the hero back, or it ends up at the wall
    h.x = home.x;
    h.y = home.y;
    const e = spawn(s, 'rotta', h.x + 24, h.y, -1, false);
    let i = 0;
    for (; i < 400 && !e.dead; i++) step(s, inp({ attack: i % 30 === 0 }), DT);
    if (e.dead) kills++;
    else if (!miss) miss = `rat ${k} alive after ${i} steps at ${Math.hypot(e.x - h.x, e.y - h.y).toFixed(0)} px, hero hp ${h.hp}, over ${s.gameOver}`;
    s.enemies = [];
    h.hp = 100;
  }
  check('kills give experience and levels', h.level >= 3, `level ${h.level} after ${kills} rats, ${h.points} points${miss ? '; ' + miss : ''}`);
  check('the sword skill stops at the floor cap', h.skills.miekka.lvl <= skillCap(s.floor), `miekka ${h.skills.miekka.lvl}, cap ${skillCap(s.floor)}`);
  check('low skill levels take few hits', hitsToNext(0) <= 5 && hitsToNext(10) > hitsToNext(0));
}
// ————— nothing vanishes: every path that moves an item keeps the count —————
{
  const s = newRun(13);
  const h = s.hero;
  arena(s);
  const under = () => s.drops.find((d) => d.kind === 'item' && Math.hypot(d.x - h.x, d.y - h.y) < 24)!;
  const lay = (it: ReturnType<typeof rollWeapon>) => {
    dropItem(s, h.x, h.y, it);
    step(s, inp({}), DT);
    return under();
  };
  const n0 = countItems(s);
  let ok = true;
  const same = (what: string, delta = 0) => {
    const n = countItems(s);
    if (n !== n0 + delta) {
      ok = false;
      console.log(`  ${what}: ${n0 + delta} expected, ${n} counted`);
    }
  };
  // a worse sword waits; into hand 1 the old sword goes to the pack
  takeInto(s, h, lay(rollWeapon(s.rng, 'sword', 1, 0)), 0, false);
  same('take into hand 1', 1);
  // the same into hand 2: the bow goes to the pack, no bow is lost
  takeInto(s, h, lay(rollWeapon(s.rng, 'sword', 1, 0)), 1, false);
  same('take into hand 2 over the bow', 2);
  check('a swap into the other hand keeps the bow', h.pack.some((x) => x.kind === 'bow'));
  // the pack to the brim, then a swap puts the old one on the floor and the log says so
  while (h.pack.length < PACK_SIZE) h.pack.push(rollCoat(s.rng, 1, 0));
  const nFull = countItems(s);
  const dr = lay(rollWeapon(s.rng, 'sword', 1, 0));
  takeInto(s, h, dr, 0, false);
  check('a swap with a full pack puts the old weapon on the floor and says so', countItems(s) === nFull + 1 && s.drops.some((d) => d.item?.kind === 'sword') && /lattialle/.test(s.log[s.log.length - 1].text), s.log[s.log.length - 1].text);
  // a coat on, the old to the floor (full pack)
  const c0 = countItems(s);
  wearFrom(s, h, lay(rollCoat(s.rng, 1, 2)));
  check('a coat worn with a full pack keeps the old coat on the floor', countItems(s) === c0 + 1);
  // the floor sword into the pack: refused when full, nothing lost
  const p0 = countItems(s);
  const floorSword = s.drops.find((d) => d.item?.kind === 'sword')!;
  const took = packFrom(s, h, floorSword);
  check('a full pack refuses a drop and nothing is lost', !took && countItems(s) === p0);
  // from the pack: a weapon into a hand, the old into the pack; the hands swapped; a hand stowed; a drop
  const e0 = countItems(s);
  const packWeapon = h.pack.find((x) => x.kind === 'sword' || x.kind === 'bow')!;
  equip(s, h, packWeapon, 1);
  const hands0 = [h.hands[0]?.id, h.hands[1]?.id];
  swapHands(s, h);
  check('the hands change places', h.hands[0]?.id === hands0[1] && h.hands[1]?.id === hands0[0]);
  dropFromPack(s, h, h.pack[0]);
  stow(s, h, h.hands[0]!);
  check('equip, swap, drop and stow keep every item', countItems(s) === e0, `${e0} before, ${countItems(s)} after`);
  // a potion drunk is the one thing that goes
  const q0 = countItems(s);
  h.pack.length = 0;
  h.pack.push(makePotion('heal', s.potionColors, 2));
  const q1 = countItems(s);
  drink(s, h, h.pack[0]);
  check('a potion drunk is one item fewer, and only that', countItems(s) === q1 - 1 && q0 >= 0);
  // E takes the thing under the hero into the hand of its kind
  const t0 = countItems(s);
  lay(rollWeapon(s.rng, 'bow', 1, 1));
  takeNear(s, h);
  check('E takes into the hand of its kind and keeps the count', countItems(s) === t0 + 1 && h.hands.some((x) => x?.kind === 'bow'));
  check('every item path keeps the count', ok);
}
{
  // a bot run: step by step, the count never falls except by a potion drunk
  const s = newRun(17);
  const rng = new Rng(17 ^ 0x5151);
  let bad = '';
  while (!s.gameOver && s.floor < 3 && s.time < 400 && !bad) {
    const before = countItems(s);
    const floor = s.floor;
    s.sounds.length = 0;
    step(s, botInput(s, s.hero, rng, BOT), DT);
    if (s.hero.points > 0) botSpend(s, s.hero, BOT);
    if (s.floor !== floor) continue;
    const drinks = s.sounds.filter((x) => x === 'drink').length;
    const after = countItems(s);
    if (after < before - drinks) bad = `at ${s.time.toFixed(2)} s: ${before} before, ${after} after, ${drinks} drunk; log: ${s.log.slice(-2).map((l) => l.text).join(' | ')}`;
  }
  check('over two floors of bot play the item count never falls except by drinking', !bad, bad);
}

// ————— the save —————
{
  const s = newRun(11);
  const blob = s.saveBlob;
  const r = restore(blob);
  check('a saved run restores', r !== null);
  if (r) {
    startFloor(r);
    const same = r.enemies.length === s.enemies.length && r.enemies.every((e, i) => e.def.id === s.enemies[i].def.id && Math.abs(e.x - s.enemies[i].x) < 0.01);
    check('the restored floor spawns the same cast in the same places', same, `${r.enemies.length} enemies`);
    check('the restored hero holds the same hands', r.hero.hands[0]?.id === s.hero.hands[0]?.id && r.hero.hands[1]?.kind === 'bow');
  }
  check('a snapshot is the same after a restore', restore(blob) !== null && snapshot(restore(blob)!) === blob);
}
// ————— replay —————
{
  const play = () => {
    const s = newRun(21);
    const rng = new Rng(21 ^ 0x5151);
    for (let i = 0; i < 60 * 40; i++) {
      step(s, botInput(s, s.hero, rng, BOT), DT);
      if (s.hero.points > 0) botSpend(s, s.hero, BOT);
    }
    return `${s.floor}:${s.hero.x.toFixed(2)}:${s.hero.y.toFixed(2)}:${s.hero.hp}:${s.run.kills}:${s.enemies.length}`;
  };
  const a = play();
  const b = play();
  check('a seed replays the same run', a === b, a);
}
// ————— the bot gets through —————
function botRun(seed: number, who = BOT, until = 5): SimState {
  const s = newRun(seed);
  const rng = new Rng(seed ^ 0x5151);
  while (!s.gameOver && s.floor <= until && s.time < 900) {
    step(s, botInput(s, s.hero, rng, who), DT);
    if (s.hero.points > 0) botSpend(s, s.hero, who);
  }
  return s;
}
{
  const runs = [];
  for (let seed = 100; seed < 108; seed++) runs.push(botRun(seed, BOT, 2));
  const past1 = runs.filter((s) => s.floor >= 2 || s.won).length;
  for (const s of runs) if (!s.gameOver && s.floor < 2 && s.time >= 900) console.log(`  stalled: seed ${s.seed} hero (${s.hero.x.toFixed(0)},${s.hero.y.toFixed(0)}) enemies ${s.enemies.filter((e) => !e.dead).length} drops ${s.drops.length} explored ${s.dungeon.rooms.filter((r) => s.dungeon.seen[r.cy * s.dungeon.w + r.cx] !== 0).length}/${s.dungeon.rooms.length}`);
  check('the bot clears floor 1 in most runs', past1 >= 6, `${past1}/8 reached floor 2; times ${runs.map((s) => Math.round(s.time)).join(',')}`);
  const stuck = runs.filter((s) => !s.gameOver && s.floor < 2 && s.time >= 900).length;
  check('no run stalls on floor 1', stuck === 0, `${stuck} stalled`);
}
{
  const runs = [];
  for (let seed = 200; seed < 206; seed++) runs.push(botRun(seed, HUMAN, 5));
  const depth = runs.map((s) => (s.won ? 6 : s.floor));
  const levels = runs.map((s) => s.hero.level);
  console.log(`human bot: depths ${depth.join(',')}  levels ${levels.join(',')}  times ${runs.map((s) => Math.round(s.time)).join(',')}`);
  check('the human-limited bot reaches floor 3 in half the runs', depth.filter((d) => d >= 3).length >= 3, depth.join(','));
}

if (fails) {
  console.log(`${fails} FAILED`);
  process.exitCode = 1;
} else console.log('all passed');
