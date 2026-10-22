import { DT, newRun, step } from '../src/game/sim';
import { Rng } from '../src/game/rng';
import { botInput, botSpend, BOT, HUMAN, type Player } from './autoplayer';
import { t } from '../src/i18n';
import { buildName } from '../src/game/skills';

declare const process: { argv: string[] };

/**
 * npm run balance [runs] [style] [who]: the bot plays whole runs, one line
 * each: how deep it got, what level, which skills, what killed it. `style`
 * is best, sword or bow; `who` is bot or human.
 */
const runs = Number(process.argv[2] ?? 6);
const style = (process.argv[3] ?? 'best') as Player['style'];
const who: Player = { ...(process.argv[4] === 'human' ? HUMAN : BOT), style };

let depth = 0;
for (let r = 0; r < runs; r++) {
  const seed = 1000 + r * 7;
  const s = newRun(seed);
  const rng = new Rng(seed ^ 0x5151);
  let last = '';
  s.onHurt = (_d, src) => (last = src);
  while (!s.gameOver && s.time < 1500) {
    step(s, botInput(s, s.hero, rng, who), DT);
    if (s.hero.points > 0) botSpend(s, s.hero, who);
  }
  const h = s.hero;
  const end = s.won ? 'WON' : s.gameOver ? `died: ${last}` : 'time out';
  depth += s.won ? 6 : s.floor;
  console.log(`seed ${seed}  floor ${s.floor}  ${Math.round(s.time)} s  level ${h.level}  miekka ${h.skills.miekka.lvl} jousi ${h.skills.jousi.lvl}  ${t(buildName(h.skills))}  kills ${s.run.kills}  hp ${Math.round(h.hp)}  ${end}`);
}
console.log(`mean depth ${(depth / runs).toFixed(2)}`);
