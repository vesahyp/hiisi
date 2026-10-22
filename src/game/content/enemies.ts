import { L, type Text } from '../../i18n';

/**
 * The hill's cast. Every attack is slow enough to see and dodge, Höyry's
 * rule: a windup shows before a strike lands, a charge draws its lane, an
 * arrow flies slowly. A new enemy is an entry here plus a weight; the sim
 * reads `attack` to know what the windup turns into.
 */
export type AttackKind = 'bite' | 'club' | 'sword' | 'bow' | 'bear' | 'rock';

/**
 * The quirk, one per type, readable on screen in play:
 *   coward: fights only beside two awake friends, else hangs back and chitters
 *   rage: faster and harder below half health, turns red
 *   keep: keeps its distance and shoots (the model Vesa liked)
 *   playdead: collapses when low, rises behind you
 *   thief: a hit takes an item from your pack, then it runs; killing it drops the item
 *   trapper: lays traps between you and it, keeps away
 *   hoarder: carries a rare item and flees on sight; worth the chase
 *   thrower: lobs rocks that land where you were
 *   grumpy: sleeps, and wakes enraged for a few seconds
 */
export type Quirk = 'coward' | 'rage' | 'keep' | 'playdead' | 'thief' | 'trapper' | 'hoarder' | 'thrower' | 'grumpy';

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
  quirk: Quirk;
  /** the quirk in the player's words, for the log and the guide */
  quirkText: Text;
  boss?: boolean;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'rotta', name: L('Rotta', 'Rat'), hp: 16, dmg: 7, speed: 105, r: 9, xp: 8, attack: 'bite', windup: 0.35, reach: 26, cooldown: 0.9, sight: 6, minFloor: 1, weight: 4, sleepy: 0.3, quirk: 'coward', quirkText: L('Pelkuri: hyökkää vain lauman kanssa. Yksin se kiertää ja kitisee.', 'A coward: it attacks only with a pack. Alone it circles and chitters.') },
  { id: 'hiisi', name: L('Hiisi', 'Hiisi'), hp: 36, dmg: 12, speed: 72, r: 11, xp: 16, attack: 'club', windup: 0.55, reach: 34, cooldown: 1.3, sight: 7, minFloor: 1, weight: 5, sleepy: 0.4, quirk: 'rage', quirkText: L('Raivostuu kun sattuu: alle puolen elämän se punertuu, nopeutuu ja lyö kovempaa.', 'Rages when hurt: below half health it reddens, speeds up and hits harder.') },
  { id: 'jousihiisi', name: L('Jousihiisi', 'Hiisi archer'), hp: 26, dmg: 10, speed: 66, r: 11, xp: 20, attack: 'bow', windup: 0.7, reach: 260, cooldown: 2.2, sight: 9, minFloor: 2, weight: 2.5, sleepy: 0.3, quirk: 'keep', quirkText: L('Pitää etäisyyden ja ampuu; peräytyy kun lähestyt.', 'Keeps its distance and shoots; backs off as you close.') },
  { id: 'luuranko', name: L('Luuranko', 'Skeleton'), hp: 56, dmg: 18, speed: 57, r: 12, xp: 28, attack: 'sword', windup: 0.75, reach: 40, cooldown: 1.6, sight: 6, minFloor: 2, weight: 3, sleepy: 0.5, quirk: 'playdead', quirkText: L('Romahtaa luukasaksi kun elämä on vähissä, ja nousee selkäsi takana.', 'Collapses into a bone pile when low, and rises behind your back.') },
  { id: 'varas', name: L('Varas', 'Thief'), hp: 22, dmg: 6, speed: 86, r: 10, xp: 24, attack: 'bite', windup: 0.4, reach: 28, cooldown: 1.2, sight: 8, minFloor: 2, weight: 1.5, sleepy: 0.2, quirk: 'thief', quirkText: L('Osuma vie esineen repustasi, ja sitten se juoksee. Tapa se, niin saat esineen takaisin.', 'A hit takes an item from your pack, then it runs. Kill it and the item drops.') },
  { id: 'ansastaja', name: L('Ansastaja', 'Trapper'), hp: 30, dmg: 9, speed: 62, r: 11, xp: 26, attack: 'club', windup: 0.6, reach: 32, cooldown: 1.4, sight: 8, minFloor: 3, weight: 1.5, sleepy: 0.3, quirk: 'trapper', quirkText: L('Virittää punaisia ansoja väliinne ja pysyy kauempana.', 'Lays red traps between you and keeps away.') },
  { id: 'kultahiisi', name: L('Kultahiisi', 'Gold hiisi'), hp: 28, dmg: 8, speed: 84, r: 11, xp: 40, attack: 'club', windup: 0.6, reach: 32, cooldown: 1.5, sight: 9, minFloor: 2, weight: 1, sleepy: 0.2, quirk: 'hoarder', quirkText: L('Kantaa aarretta ja pakenee heti kun näkee sinut. Kiinni saatuna se pudottaa aarteen.', 'Carries a treasure and flees as soon as it sees you. Caught, it drops the treasure.') },
  { id: 'kivenheittaja', name: L('Kivenheittäjä', 'Stone thrower'), hp: 34, dmg: 14, speed: 60, r: 12, xp: 30, attack: 'rock', windup: 0.9, reach: 220, cooldown: 2.6, sight: 9, minFloor: 3, weight: 1.5, sleepy: 0.3, quirk: 'thrower', quirkText: L('Heittää kiviä kaaressa: punainen ympyrä näyttää minne kivi putoaa.', 'Lobs rocks: a red circle shows where the rock will land.') },
  { id: 'karhu', name: L('Hiiden karhu', "The hill's bear"), hp: 640, dmg: 30, speed: 80, r: 15, xp: 300, attack: 'bear', windup: 0.9, reach: 48, cooldown: 2.0, sight: 12, minFloor: 5, weight: 0, sleepy: 1, quirk: 'grumpy', quirkText: L('Nukkuu portaiden luona ja herää äkäisenä: ensimmäiset sekunnit se on nopea ja punainen.', 'Sleeps by the stairs and wakes grumpy: for the first seconds it is fast and red.'), boss: true },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** How many enemies a floor gets and which, by weight. */
export function floorCast(floor: number): { count: number; pool: EnemyDef[] } {
  const pool = ENEMIES.filter((e) => !e.boss && e.minFloor <= floor);
  return { count: 13 + floor * 3, pool };
}
