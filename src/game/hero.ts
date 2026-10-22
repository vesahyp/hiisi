import type { Hero, SimState } from './state';
import type { Item } from './items';
import { NODE_BY_ID, isTechnique } from './content/tree';
import { heroMaxHp, hitsToNext, skillCap, skillMul, xpToNext, type SkillId, LEVEL_MAX } from './skills';
import { t, tr } from '../i18n';
import { say } from './log';

/** The hero's numbers from level, nodes, coat and buffs. */
export interface HeroStats {
  maxHp: number;
  speed: number;
  armor: number;
  dmgMul: number;
  reachMul: number;
  drawMul: number;
}

export const has = (h: Hero, id: string): boolean => h.nodes[id] === true;

/** The starting walk, px/s. The old pace, 170, is the top end: a ranger or a shadow late in the run. */
export const BASE_SPEED = 105;

/** How much faster than the start the hero walks: the higher of the bow and shadow skills, a light coat, the stride node, a speed potion. */
export function speedMul(h: Hero): number {
  const skill = Math.max(h.skills.jousi.lvl, h.skills.varjo.lvl);
  let m = 1 + 0.03 * skill;
  if (has(h, 'askel')) m *= 1.08;
  if (h.coat?.affix === 'light') m *= 1.1;
  if (h.buffs.speed > 0) m *= 1.3;
  return m;
}

export function heroStats(h: Hero): HeroStats {
  const maxHp = heroMaxHp(h.level, has(h, 'sydan') ? 20 : 0);
  let speed = BASE_SPEED * speedMul(h);
  if (h.drawing || h.parry >= 0) speed *= 0.55;
  const armor = (h.coat?.armor ?? 0) + (has(h, 'nahka') ? 2 : 0);
  const dmgMul = h.buffs.strength > 0 ? 1.4 : 1;
  const reachMul = has(h, 'ulottuvuus') ? 1.33 : 1;
  const drawMul = (has(h, 'nopeaveto') ? 0.7 : 1) * (held(h)?.affix === 'taut' ? 0.65 : 1);
  return { maxHp, speed, armor, dmgMul, reachMul, drawMul };
}

export const held = (h: Hero): Item | null => h.hands[h.active];

/** What the hand's skill is. */
export function skillOf(it: Item | null): SkillId | null {
  if (!it) return null;
  if (it.kind === 'sword') return 'miekka';
  if (it.kind === 'bow') return 'jousi';
  return null;
}

/** A weapon's damage for one hit, with the skill and the buffs. */
export function rollDamage(s: SimState, h: Hero, it: Item, mul = 1): number {
  const sk = skillOf(it);
  const lvl = sk ? h.skills[sk].lvl : 0;
  let m = skillMul(lvl) * heroStats(h).dmgMul * mul;
  if (sk === 'miekka' && has(h, 'vahva')) m *= 1.15;
  return Math.round(s.rng.range(it.dmgMin, it.dmgMax) * m);
}

/** A landed hit trains the weapon's skill, up to the floor's cap. */
export function trainSkill(s: SimState, h: Hero, sk: SkillId): void {
  const st = h.skills[sk];
  const cap = skillCap(s.floor);
  if (st.lvl >= cap) return;
  st.hits++;
  if (st.hits >= hitsToNext(st.lvl)) {
    st.hits = 0;
    st.lvl++;
    const name = t(SKILL_NAMES[sk]);
    say(s, tr(`${name} ${st.lvl - 1} → ${st.lvl}.`, `${name} ${st.lvl - 1} → ${st.lvl}.`), '#ffd870');
    s.texts.push({ x: h.x, y: h.y - 34, text: `${name} ${st.lvl}`, color: '#ffd870', life: 1.4, size: 12 });
    s.sounds.push('skillup');
  }
}

const SKILL_NAMES: Record<SkillId, { fi: string; en: string }> = {
  miekka: { fi: 'Miekka', en: 'Sword' },
  jousi: { fi: 'Jousi', en: 'Bow' },
  varjo: { fi: 'Varjo', en: 'Shadow' },
  tuli: { fi: 'Tuli', en: 'Fire' },
  halla: { fi: 'Halla', en: 'Frost' },
  henki: { fi: 'Henki', en: 'Spirit' },
};

export function gainXp(s: SimState, h: Hero, xp: number): void {
  h.xp += xp;
  while (h.level < LEVEL_MAX && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    h.points++;
    const max = heroStats(h).maxHp;
    h.hp = Math.min(max, h.hp + 10);
    s.banner = { text: tr(`Taso ${h.level}`, `Level ${h.level}`), sub: tr('Taitopiste: avaa taitopuu', 'A skill point: open the tree'), life: 2.4, color: '#ffd870' };
    s.effects.push({ kind: 'levelup', x: h.x, y: h.y, angle: 0, r: 40, life: 0.8, maxLife: 0.8, color: '#ffd870' });
    s.sounds.push('levelup');
    say(s, tr(`Taso ${h.level}! Yksi taitopiste.`, `Level ${h.level}! One skill point.`), '#ffd870');
  }
}

/** Can the node be bought now: a point, the chain, the gate. */
export function canLearn(s: SimState, h: Hero, id: string): { ok: boolean; why: string } {
  const d = NODE_BY_ID[id];
  if (!d.inSlice) return { ok: false, why: tr('Tulossa myöhemmin', 'Coming later') };
  if (has(h, id)) return { ok: false, why: tr('Opittu', 'Learned') };
  if (d.after && !has(h, d.after)) return { ok: false, why: tr(`Vaatii: ${t(NODE_BY_ID[d.after].name)}`, `Needs ${t(NODE_BY_ID[d.after].name)}`) };
  if (d.skill && h.skills[d.skill].lvl < d.gate) return { ok: false, why: tr(`Vaatii ${t(SKILL_NAMES[d.skill])} ${d.gate}`, `Needs ${t(SKILL_NAMES[d.skill])} ${d.gate}`) };
  if (h.points < 1) return { ok: false, why: tr('Ei pisteitä', 'No points') };
  void s;
  return { ok: true, why: '' };
}

export function learn(s: SimState, h: Hero, id: string): boolean {
  if (!canLearn(s, h, id).ok) return false;
  h.points--;
  h.nodes[id] = true;
  const d = NODE_BY_ID[id];
  if (isTechnique(d)) {
    if (h.techs[0] === null) h.techs[0] = id;
    else if (h.techs[1] === null) h.techs[1] = id;
  }
  if (id === 'sydan') h.hp += 20;
  s.sounds.push('learn');
  return true;
}

/** Give every point back. Allowed at the start of a floor, before the first kill. */
export function canRefund(s: SimState): boolean {
  return s.floorKills === 0;
}

export function refund(s: SimState, h: Hero): void {
  if (!canRefund(s)) return;
  let n = 0;
  for (const id of Object.keys(h.nodes)) {
    delete h.nodes[id];
    n++;
  }
  h.points += n;
  h.techs = [null, null];
  h.hp = Math.min(h.hp, heroStats(h).maxHp);
  s.sounds.push('learn');
}

/** Put a learned technique on a button. */
export function setTech(h: Hero, slot: 0 | 1, id: string): void {
  if (!has(h, id) || !isTechnique(NODE_BY_ID[id])) return;
  const other = slot === 0 ? 1 : 0;
  if (h.techs[other] === id) h.techs[other] = h.techs[slot];
  h.techs[slot] = id;
}
