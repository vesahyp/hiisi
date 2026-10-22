import { L, type Text } from '../i18n';

/**
 * The six skills that rise by use, and the experience levels the tree
 * spends. A skill gains a hit when a strike or an arrow lands on an enemy
 * that still gives experience; it cannot pass the floor's cap, so the way
 * to raise a capped skill is the next floor. Low levels take a few hits,
 * so a weapon picked up late catches up in a floor.
 */
export type SkillId = 'miekka' | 'jousi' | 'varjo' | 'tuli' | 'halla' | 'henki';

export const SKILLS: { id: SkillId; name: Text; icon: string; inSlice: boolean }[] = [
  { id: 'miekka', name: L('Miekka', 'Sword'), icon: '⚔', inSlice: true },
  { id: 'jousi', name: L('Jousi', 'Bow'), icon: '🏹', inSlice: true },
  { id: 'varjo', name: L('Varjo', 'Shadow'), icon: '🐾', inSlice: false },
  { id: 'tuli', name: L('Tuli', 'Fire'), icon: '🔥', inSlice: false },
  { id: 'halla', name: L('Halla', 'Frost'), icon: '❄', inSlice: false },
  { id: 'henki', name: L('Henki', 'Spirit'), icon: '✨', inSlice: false },
];

export interface SkillState {
  lvl: number;
  /** hits toward the next level */
  hits: number;
}

export const SKILL_MAX = 20;

/** Hits that take a skill from `lvl` to the next. */
export function hitsToNext(lvl: number): number {
  return 4 + lvl * 2;
}

/** The floor's cap on every skill. */
export function skillCap(floor: number): number {
  return Math.min(SKILL_MAX, floor + 5);
}

/** The damage multiplier a skill level gives. */
export function skillMul(lvl: number): number {
  return 1 + lvl * 0.06;
}

/** Experience to go from `level` to the next. */
export function xpToNext(level: number): number {
  return 50 + 25 * level * level;
}

export const LEVEL_MAX = 30;

export function heroMaxHp(level: number, bonus: number): number {
  return 100 + (level - 1) * 10 + bonus;
}

/** The build's name from the two highest skills, for the sheet and the record. */
export function buildName(skills: Record<SkillId, SkillState>): Text {
  const ranked = (Object.keys(skills) as SkillId[]).filter((k) => skills[k].lvl > 0).sort((a, b) => skills[b].lvl - skills[a].lvl);
  if (!ranked.length) return L('Kulkija', 'Wanderer');
  const [a, b] = ranked;
  if (!b || skills[b].lvl * 2 < skills[a].lvl) return SOLO[a];
  const key = [a, b].sort().join('+');
  return PAIR[key] ?? L(`${SOLO[a].fi}-${SOLO[b].fi.toLowerCase()}`, `${SOLO[a].en} ${SOLO[b].en.toLowerCase()}`);
}

const SOLO: Record<SkillId, Text> = {
  miekka: L('Miekkamies', 'Swordsman'),
  jousi: L('Jousimies', 'Archer'),
  varjo: L('Salamurhaaja', 'Assassin'),
  tuli: L('Tulimaagi', 'Fire mage'),
  halla: L('Hallamaagi', 'Frost mage'),
  henki: L('Henkimaagi', 'Spirit mage'),
};
const PAIR: Record<string, Text> = {
  'jousi+miekka': L('Metsästäjä', 'Hunter'),
  'miekka+tuli': L('Liekkimiekka', 'Flame sword'),
  'jousi+varjo': L('Varjojousi', 'Shadow bow'),
  'miekka+varjo': L('Puukkojunkkari', 'Knife fighter'),
};
