// A stalled bot run, step by step: where it is, what it wants.
import { DT, newRun, step } from '../../src/game/sim';
import { Rng } from '../../src/game/rng';
import { botInput, botSpend, BOT } from '../autoplayer';
import { T, UNSEEN } from '../../src/game/dungeon';
declare const process: { argv: string[] };
const seed = Number(process.argv[2] ?? 100);
const s = newRun(seed);
const rng = new Rng(seed ^ 0x5151);
let last = 0;
while (!s.gameOver && s.floor < 2 && s.time < 300) {
  const inp = botInput(s, s.hero, rng, BOT);
  step(s, inp, DT);
  if (s.hero.points > 0) botSpend(s, s.hero, BOT);
  if (s.time - last > 5) {
    last = s.time;
    const d = s.dungeon;
    const h = s.hero;
    const unexplored = d.rooms.filter((r) => d.seen[r.cy * d.w + r.cx] === UNSEEN).map((r) => `${r.id}@(${r.cx},${r.cy}) flow ${d.flow[r.cy * d.w + r.cx]}`);
    const near = s.enemies.filter((e) => !e.dead).map((e) => `${e.def.id}:${e.mode}:${Math.round(Math.hypot(e.x - h.x, e.y - h.y) / T)}t`).slice(0, 4);
    console.log(`t=${Math.round(s.time)} hero tile (${Math.floor(h.x / T)},${Math.floor(h.y / T)}) hp ${h.hp} inp (${inp.mx.toFixed(1)},${inp.my.toFixed(1)}) atk ${inp.attack} unexplored [${unexplored.join('; ')}] enemies ${near.join(' ')} drops ${s.drops.filter((x) => x.kind === 'item').length} chests ${s.drops.filter((x) => x.kind === 'chest' && !x.opened).map((c) => `(${Math.floor(c.x / T)},${Math.floor(c.y / T)}) seen ${c.seen}`).join(' ')}`);
  }
}
console.log(`end: floor ${s.floor} over ${s.gameOver} t ${Math.round(s.time)}`);
