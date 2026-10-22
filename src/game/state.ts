import { Rng } from './rng';
import type { Dungeon } from './dungeon';
import type { EnemyDef } from './content/enemies';
import type { Item, PotionKind } from './items';
import type { SkillId, SkillState } from './skills';

/** Per-step input. Aim vectors have length 0..1: the stick's reach. */
export interface HeroInput {
  mx: number;
  my: number;
  /** the aim stick while dragged, for the aim line */
  aiming: boolean;
  aimX: number;
  aimY: number;
  /** the attack side held without a drag: the weapon's hold verb (draw, parry) */
  hold: boolean;
  /** attack this step: a tap, or a drag released; along the aim if it has length, else at the nearest enemy */
  attack: boolean;
  /** a hold ended this step: the bow releases its draw, the sword comes down */
  holdRelease: boolean;
  tech: [boolean, boolean];
  potion: boolean;
  swap: boolean;
  take: boolean;
}

export const NO_INPUT: HeroInput = { mx: 0, my: 0, aiming: false, aimX: 0, aimY: 0, hold: false, attack: false, holdRelease: false, tech: [false, false], potion: false, swap: false, take: false };

/** A melee strike in flight: its shape sweeps over `dur` seconds and hits once per pass. */
export interface Swing {
  /** arc: a wedge of `width` half-angle; line: a bar of `width` half-width; ring: all round */
  shape: 'arc' | 'line' | 'ring';
  effect: 'none' | 'bleed' | 'stagger' | 'push' | 'backstab' | 'reap' | 'armorbreak';
  /** a slam shakes the ground */
  slam: boolean;
  t: number;
  dur: number;
  angle: number;
  reach: number;
  /** half-width of the arc, radians */
  width: number;
  dmgMul: number;
  hit: Set<number>;
  /** twice: the whirl's second pass */
  passes: number;
  lunge: number;
}

export interface Hero {
  x: number;
  y: number;
  r: number;
  hp: number;
  alive: boolean;
  facing: number;
  moving: boolean;
  walk: number;
  level: number;
  xp: number;
  /** unspent tree points */
  points: number;
  skills: Record<SkillId, SkillState>;
  /** tree nodes learned */
  nodes: Record<string, true>;
  /** the two technique buttons */
  techs: [string | null, string | null];
  cooldowns: Record<string, number>;
  hands: [Item | null, Item | null];
  active: number;
  coat: Item | null;
  pack: Item[];
  /** potion kinds whose colour the run has shown */
  known: Record<PotionKind, boolean>;
  swing: Swing | null;
  /** the bow's draw or the weapon's wind-up, 0..1, while the hold lasts; the shot or the swing leaves on the release */
  draw: number;
  drawing: boolean;
  /** the flail's ball: its angle round the hero and its spin, radians per second */
  orbit: { a: number; spin: number; hit: Record<number, number> };
  /** the sword held up: seconds held, -1 when down */
  parry: number;
  /** seconds a parry just landed, for the stagger window and the flash */
  parried: number;
  /** seconds before the next attack can start */
  lock: number;
  dash: { t: number; dx: number; dy: number; target: number } | null;
  buffs: { strength: number; speed: number; poison: number };
  invuln: number;
  hurtFlash: number;
  /** hits landed, for every-Nth rules */
  hits: number;
  /** the drop under the hero */
  near: number | null;
  /** the item last put into the pack by a swap, highlighted when the pack opens */
  lastStowed: number | null;
  /** the aim the renderer shows */
  aimShow: { on: boolean; x: number; y: number };
  swapCd: number;
}

export type EnemyMode = 'sleep' | 'idle' | 'chase' | 'windup' | 'strike' | 'charge' | 'stagger' | 'trapped';

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  mode: EnemyMode;
  /** seconds left in the mode */
  t: number;
  facing: number;
  /** has seen the hero */
  aware: boolean;
  /** seconds the ! mark shows after noticing */
  alertT: number;
  room: number;
  home: { x: number; y: number };
  /** the charge's lane */
  cx: number;
  cy: number;
  /** seconds before the next attack may start */
  cd: number;
  hurtFlash: number;
  knock: { vx: number; vy: number };
  dead: boolean;
  deathT: number;
  level: number;
  /** the charge, so a sidestep is possible: px/s, and tiles left */
  chargeLeft: number;
  /** has the strike of this windup landed */
  struck: boolean;
  /** the bear's swipes before the next charge */
  swipes: number;
  /** seconds of bleeding left and the damage a second (the axe) */
  bleed: { t: number; dps: number };
  /** seconds of broken armour left: a third more damage taken (the mace's slam) */
  armorBreak: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  team: 0 | 1;
  dmg: number;
  left: number;
  pierce: number;
  hit: Set<number>;
  kind: 'arrow' | 'enemyArrow' | 'rain' | 'anchor' | 'ball';
  /** the charge behind a hero's shot, as its damage multiplier */
  power?: number;
  /** the anchor: the enemies it has hooked, dragged in when it turns */
  hooked?: number[];
  /** the anchor on its way back */
  returning?: boolean;
  /** the skill a hero shot trains */
  skill: SkillId | null;
  homing: number;
  dead: boolean;
}

export interface Drop {
  id: number;
  x: number;
  y: number;
  kind: 'item' | 'chest';
  item: Item | null;
  /** chests: items inside, opened by touch */
  loot: Item[];
  opened: boolean;
  /** once seen, drawn in the dark too */
  seen: boolean;
  /** the walk-over rule has been applied once; what it left waits as a chip */
  judged: boolean;
  life: number;
}

export interface Trap {
  id: number;
  x: number;
  y: number;
  r: number;
  dmg: number;
  armed: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface Effect {
  kind: 'slash' | 'thrust' | 'ring' | 'hit' | 'blast' | 'rain' | 'stagger' | 'parry' | 'levelup' | 'open';
  x: number;
  y: number;
  angle: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface LogLine {
  text: string;
  color: string;
  /** sim time it was said */
  at: number;
}

export interface Banner {
  text: string;
  sub: string;
  life: number;
  color?: string;
}

export interface RunStats {
  kills: number;
  floor: number;
  bosses: number;
  bestRarity: number;
  /** items taken */
  items: number;
}

export interface SimState {
  seed: number;
  rng: Rng;
  time: number;
  floorTime: number;
  floor: number;
  dungeon: Dungeon;
  hero: Hero;
  enemies: Enemy[];
  projectiles: Projectile[];
  drops: Drop[];
  traps: Trap[];
  texts: FloatText[];
  effects: Effect[];
  log: LogLine[];
  banner: Banner | null;
  /** a short line by the hands: where a swapped item went */
  toast: { text: string; color: string; life: number } | null;
  nextId: number;
  /** the potion colours this run gave each kind */
  potionColors: Record<PotionKind, string>;
  run: RunStats;
  floorKills: number;
  /** the boss floor's stairs open only when the boss is dead */
  bossAlive: boolean;
  sounds: string[];
  shake: number;
  gameOver: boolean;
  /** the hero went down the last stairs of the slice */
  won: boolean;
  /** seconds the hero has stood on the stairs down */
  stairsT: number;
  /** set by the sim when the hero leaves a floor: the game loop saves the run */
  saveWanted: boolean;
  /** the run as it stood at the top of this floor (save.ts) */
  saveBlob: string;
  slowmo: number;
  view: { w: number; h: number };
  cam: { x: number; y: number };
  /** every hit on the hero, after armour, with what dealt it: for the tools */
  onHurt: ((dmg: number, src: string) => void) | null;
}

export const LAST_FLOOR = 5;

export function createHero(): Hero {
  return {
    x: 0,
    y: 0,
    r: 10,
    hp: 100,
    alive: true,
    facing: 0,
    moving: false,
    walk: 0,
    level: 1,
    xp: 0,
    points: 0,
    skills: { lahi: { lvl: 0, hits: 0 }, jousi: { lvl: 0, hits: 0 }, varjo: { lvl: 0, hits: 0 }, tuli: { lvl: 0, hits: 0 }, halla: { lvl: 0, hits: 0 }, henki: { lvl: 0, hits: 0 } },
    nodes: {},
    techs: [null, null],
    cooldowns: {},
    hands: [null, null],
    active: 0,
    coat: null,
    pack: [],
    known: { heal: true, strength: false, speed: false, poison: false },
    swing: null,
    draw: 0,
    drawing: false,
    orbit: { a: 0, spin: 0, hit: {} },
    parry: -1,
    parried: 0,
    lock: 0,
    dash: null,
    buffs: { strength: 0, speed: 0, poison: 0 },
    invuln: 0,
    hurtFlash: 0,
    hits: 0,
    near: null,
    lastStowed: null,
    aimShow: { on: false, x: 0, y: 0 },
    swapCd: 0,
  };
}

export function createState(seed: number, dungeon: Dungeon): SimState {
  return {
    seed,
    rng: new Rng(seed),
    time: 0,
    floorTime: 0,
    floor: 1,
    dungeon,
    hero: createHero(),
    enemies: [],
    projectiles: [],
    drops: [],
    traps: [],
    texts: [],
    effects: [],
    log: [],
    banner: null,
    toast: null,
    nextId: 1,
    potionColors: { heal: '', strength: '', speed: '', poison: '' },
    run: { kills: 0, floor: 1, bosses: 0, bestRarity: 0, items: 0 },
    floorKills: 0,
    bossAlive: false,
    sounds: [],
    shake: 0,
    gameOver: false,
    won: false,
    stairsT: 0,
    saveWanted: false,
    saveBlob: '',
    slowmo: 0,
    view: { w: 420, h: 760 },
    cam: { x: 0, y: 0 },
    onHurt: null,
  };
}
