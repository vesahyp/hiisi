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
h.hands[0] = rollWeapon(s.rng, 'spear', 1, 0);
const inp = (o: Partial<HeroInput>): HeroInput => ({ ...NO_INPUT, tech: [false, false], ...o });
const r = spawn(s, 'rotta', h.x + 40, h.y, -1, false); r.hp = 1e9; r.aware = false; r.mode = 'sleep';
const x0 = r.x;
step(s, inp({ attack: true }), DT);
for (let i = 0; i < 30; i++) { step(s, inp({}), DT); if (i % 3 === 0) console.log(`i=${i} rat x ${(r.x - x0).toFixed(1)} knock (${r.knock.vx.toFixed(0)},${r.knock.vy.toFixed(0)}) mode ${r.mode} t ${r.t.toFixed(2)} hp ${1e9 - r.hp} swing ${h.swing ? h.swing.t.toFixed(2) : '-'} hero ${(h.x - 3 * T).toFixed(1)}`); }
