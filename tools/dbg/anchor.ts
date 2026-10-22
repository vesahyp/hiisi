import { DT, newRun, step, spawn } from '../../src/game/sim';
import { NO_INPUT, type HeroInput } from '../../src/game/state';
import { T, VISIBLE, FLOOR, WALL, type Dungeon } from '../../src/game/dungeon';
import { rollWeapon } from '../../src/game/items';
const w = 28, hh = 16;
const tiles = new Uint8Array(w * hh);
for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = x === 0 || y === 0 || x === w - 1 || y === hh - 1 ? WALL : FLOOR;
const d: Dungeon = { w, h: hh, tiles, rooms: [], roomAt: new Int16Array(w * hh).fill(-1), seen: new Uint8Array(w * hh).fill(VISIBLE), flow: new Int16Array(w * hh).fill(-1), startX: 0, startY: 0, downX: 0, downY: 0, downRoom: 0, floor: 1 };
const s = newRun(9);
s.dungeon = d; const h = s.hero; h.x = 3 * T; h.y = 8 * T; h.facing = 0; s.enemies = []; s.drops = []; h.active = 0; h.invuln = 1e9;
h.hands[0] = rollWeapon(s.rng, 'anchor', 1, 0);
const inp = (o: Partial<HeroInput>): HeroInput => ({ ...NO_INPUT, tech: [false, false], ...o });
const e = spawn(s, 'hiisi', h.x + 96, h.y, -1, false); e.hp = 1e9; e.aware = false; e.mode = 'sleep';
step(s, inp({ attack: true, aimX: 1, aimY: 0 }), DT);
for (let i = 0; i < 70; i++) {
  step(s, inp({}), DT);
  const p = s.projectiles[0];
  if (i % 4 === 0) console.log(`i=${i} p ${p ? `(${(p.x - h.x).toFixed(0)},${(p.y - h.y).toFixed(0)}) ret ${p.returning} hooked ${p.hooked?.length} left ${p.left.toFixed(0)}` : 'gone'} e at ${(e.x - h.x).toFixed(0)} mode ${e.mode} hp ${1e9 - e.hp} hero ${h.x.toFixed(0)},${h.y.toFixed(0)}`);
}
