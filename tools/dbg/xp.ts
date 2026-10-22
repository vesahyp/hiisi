import { DT, newRun, step, spawn } from '../../src/game/sim';
import { NO_INPUT } from '../../src/game/state';
import { rollWeapon } from '../../src/game/items';
import { T, VISIBLE, seenAt } from '../../src/game/dungeon';
import { nearestVisible, swordReach } from '../../src/game/attacks';
const s = newRun(5);
const h = s.hero;
const d = s.dungeon;
const room = [...d.rooms].sort((a, b) => b.w - a.w)[0];
h.x = (room.x + 1.5) * T; h.y = (room.cy + 0.5) * T; h.facing = 0; s.enemies = []; d.seen.fill(VISIBLE);
h.active = 0;
h.hands[0] = rollWeapon(s.rng, 'sword', 5, 3);
for (let k = 0; k < 20; k++) {
  const e = spawn(s, 'rotta', h.x + 24, h.y, -1, false);
  let i = 0;
  let swings = 0;
  for (; i < 400 && !e.dead; i++) {
    const had = !!h.swing;
    step(s, { ...NO_INPUT, tech: [false, false], attack: i % 30 === 0 }, DT);
    if (!had && h.swing) swings++;
  }
  const nv = nearestVisible(s, h, swordReach(h, h.hands[0]!) * 1.6);
  console.log(`rat ${k}: dead ${e.dead} after ${i} steps, swings ${swings}, hp ${e.hp}, dist ${Math.hypot(e.x - h.x, e.y - h.y).toFixed(0)} seen ${seenAt(d, e.x, e.y)} nearest ${nv ? nv.def.id : 'none'} lvl ${h.level} lock ${h.lock.toFixed(2)} hero tile ${Math.floor(h.x / T)},${Math.floor(h.y / T)} hero hp ${h.hp}`);
  s.enemies = []; h.hp = 100;
}
