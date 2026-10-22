import { L, type Text } from '../../i18n';

/**
 * The hill's cast. Every attack is slow enough to see and dodge, Höyry's
 * rule: a windup shows before a strike lands, a charge draws its lane, an
 * arrow flies slowly. A new enemy is an entry here plus a weight; the sim
 * reads `attack` to know what the windup turns into.
 */
export type AttackKind = 'bite' | 'club' | 'sword' | 'bow' | 'bear';

export interface EnemyDef {
  id: string;
  name: Text;
  hp: number;
  dmg: number;
  /** px per second */
  speed: number;
  r: number;
  xp: number;
  attack: AttackKind;
  /** seconds the windup shows before the strike */
  windup: number;
  /** px from centre to centre within which the strike lands */
  reach: number;
  /** seconds between strikes */
  cooldown: number;
  /** tiles within which it notices the hero (with a line of sight) */
  sight: number;
  minFloor: number;
  weight: number;
  /** share that start asleep */
  sleepy: number;
  boss?: boolean;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'rotta', name: L('Rotta', 'Rat'), hp: 14, dmg: 5, speed: 150, r: 9, xp: 8, attack: 'bite', windup: 0.35, reach: 26, cooldown: 0.9, sight: 6, minFloor: 1, weight: 4, sleepy: 0.3 },
  { id: 'hiisi', name: L('Hiisi', 'Hiisi'), hp: 32, dmg: 9, speed: 105, r: 11, xp: 16, attack: 'club', windup: 0.55, reach: 34, cooldown: 1.3, sight: 7, minFloor: 1, weight: 5, sleepy: 0.4 },
  { id: 'jousihiisi', name: L('Jousihiisi', 'Hiisi archer'), hp: 24, dmg: 8, speed: 95, r: 11, xp: 20, attack: 'bow', windup: 0.7, reach: 260, cooldown: 2.2, sight: 9, minFloor: 2, weight: 2.5, sleepy: 0.3 },
  { id: 'luuranko', name: L('Luuranko', 'Skeleton'), hp: 50, dmg: 14, speed: 80, r: 12, xp: 28, attack: 'sword', windup: 0.75, reach: 40, cooldown: 1.6, sight: 6, minFloor: 2, weight: 3, sleepy: 0.5 },
  { id: 'karhu', name: L('Hiiden karhu', "The hill's bear"), hp: 420, dmg: 22, speed: 120, r: 15, xp: 300, attack: 'bear', windup: 0.9, reach: 48, cooldown: 2.0, sight: 12, minFloor: 5, weight: 0, sleepy: 1, boss: true },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** How many enemies a floor gets and which, by weight. */
export function floorCast(floor: number): { count: number; pool: EnemyDef[] } {
  const pool = ENEMIES.filter((e) => !e.boss && e.minFloor <= floor);
  return { count: 9 + floor * 2, pool };
}
