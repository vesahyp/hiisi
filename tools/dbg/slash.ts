import { DT, newRun, step, spawn } from '../../src/game/sim';
import { NO_INPUT, type HeroInput } from '../../src/game/state';
import { T, VISIBLE, lineOfSight } from '../../src/game/dungeon';
import { nearestVisible, swordReach } from '../../src/game/attacks';
const s = newRun(8);
const h = s.hero;
const d = s.dungeon;
const room = [...d.rooms].sort((a, b) => b.w - a.w)[0];
h.x = (room.x + 1.5) * T; h.y = (room.cy + 0.5) * T; h.facing = 0; s.enemies = []; d.seen.fill(VISIBLE);
h.active = 0; h.invuln = 1e9;
const e = spawn(s, 'luuranko', h.x + 30, h.y, -1, false);
e.hp = 1e9;
const inp = (o: Partial<HeroInput>): HeroInput => ({ ...NO_INPUT, tech: [false, false], ...o });
for (let k = 0; k < 2; k++) {
  e.x = h.x + 30; e.y = h.y; e.knock = { vx: 0, vy: 0 }; e.mode = 'idle';
  const hp0 = e.hp;
  console.log(`try ${k}: hero (${h.x.toFixed(0)},${h.y.toFixed(0)}) tile ${Math.floor(h.x / T)},${Math.floor(h.y / T)} enemy (${e.x.toFixed(0)},${e.y.toFixed(0)}) seen ${d.seen[Math.floor(e.y / T) * d.w + Math.floor(e.x / T)]} los ${lineOfSight(d, h.x, h.y, e.x, e.y)} nearest ${nearestVisible(s, h, swordReach(h, h.hands[0]!) * 1.6)?.def.id} reach ${swordReach(h, h.hands[0]!)}`);
  for (let i = 0; i < 40; i++) {
    s.sounds.length = 0;
    step(s, inp(i === 0 ? { attack: true } : {}), DT);
    if (i < 12 || s.sounds.length) console.log(`  i=${i} swing ${h.swing ? `t=${h.swing.t.toFixed(2)} a=${h.swing.angle.toFixed(2)} hit=${[...h.swing.hit].length}` : 'none'} lock ${h.lock.toFixed(2)} draw ${h.draw.toFixed(2)} drawing ${h.drawing} sounds ${s.sounds.join(',')} dmg ${hp0 - e.hp} enemy (${e.x.toFixed(0)},${e.y.toFixed(0)}) mode ${e.mode}`);
  }
}
