// A stalled bot run, step by step: where it is, what it wants.
// args: seed style(best|sword|bow) who(bot|human) until-floor
import { DT, newRun, step } from '../../src/game/sim';
import { Rng } from '../../src/game/rng';
import { botInput, botSpend, BOT, HUMAN, type Player } from '../autoplayer';
import { T, UNSEEN, VISIBLE, seenAt, hitsSolid, moveCircle, distanceField, flowDir, openDir } from '../../src/game/dungeon';
declare const process: { argv: string[] };
const seed = Number(process.argv[2] ?? 100);
const style = (process.argv[3] ?? 'best') as Player['style'];
const who: Player = { ...(process.argv[4] === 'human' ? HUMAN : BOT), style };
const until = Number(process.argv[5] ?? 6);
const s = newRun(seed);
const rng = new Rng(seed ^ 0x5151);
let last = 0;
let lastFloor = 0;
while (!s.gameOver && s.floor < until && s.time < 1500) {
  const inp = botInput(s, s.hero, rng, who);
  step(s, inp, DT);
  if (s.hero.points > 0) botSpend(s, s.hero, who);
  if (s.floor !== lastFloor) { lastFloor = s.floor; console.log(`--- floor ${s.floor} at ${Math.round(s.time)} s`); }
  if (s.time - last > 20) {
    last = s.time;
    const d = s.dungeon;
    const h = s.hero;
    const unexplored = d.rooms.filter((r) => d.seen[r.cy * d.w + r.cx] === UNSEEN).map((r) => `${r.id}@(${r.cx},${r.cy})`);
    const near = s.enemies.filter((e) => !e.dead).map((e) => `${e.def.id}:${e.mode}:${Math.round(Math.hypot(e.x - h.x, e.y - h.y) / T)}t${seenAt(d, e.x, e.y) === VISIBLE ? '*' : ''}`).slice(0, 5);
    console.log(`t=${Math.round(s.time)} tile (${Math.floor(h.x / T)},${Math.floor(h.y / T)}) hp ${Math.round(h.hp)} inp (${inp.mx.toFixed(1)},${inp.my.toFixed(1)}) hold ${inp.hold} rel ${inp.holdRelease} atk ${inp.attack} draw ${h.draw.toFixed(2)} unexplored [${unexplored.join(' ')}] enemies ${near.join(' ')} near ${h.near}`);
  }
}
console.log(`end: floor ${s.floor} over ${s.gameOver} t ${Math.round(s.time)}`);
{
  const d = s.dungeon;
  const h = s.hero;
  const tx = Math.floor(h.x / T);
  const ty = Math.floor(h.y / T);
  console.log(`hero at (${h.x.toFixed(1)},${h.y.toFixed(1)}) r ${h.r} solid here: ${hitsSolid(d, h.x, h.y, h.r)}`);
  for (let y = ty - 5; y <= ty + 5; y++) {
    let row = '';
    for (let x = tx - 8; x <= tx + 8; x++) {
      const i = y * d.w + x;
      const t = x < 0 || y < 0 || x >= d.w || y >= d.h ? 0 : d.tiles[i];
      const ch = x === tx && y === ty ? '@' : t === 0 ? ' ' : t === 1 ? '.' : t === 2 ? '#' : t === 3 ? '+' : t === 4 ? "'" : t === 5 ? '>' : '<';
      const f = d.flow[i];
      row += ch + (x === tx && y === ty ? '' : '');
      void f;
    }
    console.log(row);
  }
  const chests = s.drops.filter((x) => x.kind === 'chest').map((c) => `chest (${Math.floor(c.x / T)},${Math.floor(c.y / T)}) opened ${c.opened} seen ${c.seen}`);
  console.log(chests.join('; '));
}
{
  const d = s.dungeon;
  const h = s.hero;
  const tx = Math.floor(h.x / T);
  const ty = Math.floor(h.y / T);
  console.log('tiles:', [ty - 1, ty, ty + 1].map((y) => [tx - 1, tx, tx + 1].map((x) => d.tiles[y * d.w + x]).join(',')).join(' | '));
  const p = { x: h.x, y: h.y };
  moveCircle(d, p, h.r, 0, -3);
  console.log(`move up 3: (${p.x.toFixed(1)},${p.y.toFixed(1)}) solid at up: ${hitsSolid(d, h.x, h.y - 3, h.r)}`);
  const f = distanceField(d, [{ x: (d.rooms[5].cx + 0.5) * T, y: (d.rooms[5].cy + 0.5) * T }]);
  console.log('field here', f[ty * d.w + tx], 'up', f[(ty - 1) * d.w + tx], 'down', f[(ty + 1) * d.w + tx], 'flowDir', JSON.stringify(flowDir(d, h.x, h.y, f)), 'openDir', JSON.stringify(openDir(d, h.x, h.y, h.r, 0, -1)));
  console.log('hero', JSON.stringify({ swing: h.swing, dash: h.dash, drawing: h.drawing, parry: h.parry, lock: h.lock, buffs: h.buffs, hp: h.hp, alive: h.alive }));
}
