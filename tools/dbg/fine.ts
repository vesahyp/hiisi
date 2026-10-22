import { DT, newRun, step } from '../../src/game/sim';
import { Rng } from '../../src/game/rng';
import { botInput, botSpend, HUMAN, type Player } from '../autoplayer';
import { tileAt } from '../../src/game/dungeon';
declare const process: { argv: string[] };
const seed = Number(process.argv[2] ?? 1021);
const from = Number(process.argv[3] ?? 1240);
const who: Player = { ...HUMAN, style: 'bow' };
const s = newRun(seed);
const rng = new Rng(seed ^ 0x5151);
let trace = 0;
while (!s.gameOver && s.time < from + 3) {
  const inp = botInput(s, s.hero, rng, who);
  step(s, inp, DT);
  if (s.hero.points > 0) botSpend(s, s.hero, who);
  if (s.time > from) {
    if (inp.holdRelease) trace = 12;
    if (trace > 0) {
      trace--;
      const p = s.projectiles[0];
      console.log(`${s.time.toFixed(3)} proj ${p ? `(${p.x.toFixed(0)},${p.y.toFixed(0)}) tile ${tileAt(s.dungeon, p.x, p.y)} left ${p.left.toFixed(0)} v (${p.vx.toFixed(0)},${p.vy.toFixed(0)}) dead ${p.dead}` : 'none'} enemies ${s.enemies.filter((e) => !e.dead).slice(0, 3).map((e) => `${e.def.id}@(${e.x.toFixed(0)},${e.y.toFixed(0)}) r${e.r} hp${e.hp}`).join(' ')} hero (${s.hero.x.toFixed(0)},${s.hero.y.toFixed(0)})`);
    }
  }
}
