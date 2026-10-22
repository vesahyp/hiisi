import { DT, newRun, step } from '../src/game/sim';
import { Rng } from '../src/game/rng';
import { botInput, botSpend, HUMAN } from './autoplayer';

declare const process: { argv: string[]; exitCode?: number };

/**
 * npm run gauntlet [runs] [to]: the human profile of the bot (a reaction
 * time, a thumb, a tap rate) plays from floor 1. The check fails when
 * fewer than NEED of the runs reach floor `to`: the early floors have to
 * be beatable by a person on a phone, most of the time, with either hand.
 */
const runs = Number(process.argv[2] ?? 8);
const to = Number(process.argv[3] ?? 3);
const NEED = 0.6;

let reached = 0;
const lines: string[] = [];
for (const style of ['sword', 'bow'] as const) {
  let n = 0;
  const fell: string[] = [];
  for (let r = 0; r < runs; r++) {
    const seed = 3000 + r * 13;
    const s = newRun(seed);
    const rng = new Rng(seed ^ 0x5151);
    let last = '';
    s.onHurt = (_d, src) => (last = src);
    while (!s.gameOver && s.floor < to && s.time < 900) {
      step(s, botInput(s, s.hero, rng, { ...HUMAN, style }), DT);
      if (s.hero.points > 0) botSpend(s, s.hero, { ...HUMAN, style });
    }
    if (s.floor >= to || s.won) n++;
    else fell.push(`${s.floor}:${s.gameOver ? last : 'stuck'}`);
  }
  reached += n;
  lines.push(`${style.padEnd(6)} reached floor ${to} in ${n}/${runs}${fell.length ? ` | fell on ${fell.join(', ')}` : ''}`);
}
for (const l of lines) console.log(l);
const rate = reached / (runs * 2);
console.log(`${reached}/${runs * 2} runs reached floor ${to} (${Math.round(rate * 100)} %, need ${Math.round(NEED * 100)} %)`);
if (rate < NEED) {
  console.log('FAIL  the early floors are too hard for a person on a phone');
  process.exitCode = 1;
} else console.log('PASS');
