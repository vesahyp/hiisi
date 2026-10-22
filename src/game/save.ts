import { createState, type Hero, type SimState } from './state';
import { generateDungeon } from './dungeon';
import { resetItemIds } from './items';

/**
 * A run is saved at the stairs: the hero as they arrive on a new floor,
 * before the floor spawns, so a load regenerates the floor from the seed
 * and spawns the same cast. Death deletes the save. The sim builds the
 * blob; the game loop writes it, so this file stays headless.
 */
export const SAVE_VERSION = 1;

interface Blob {
  v: number;
  seed: number;
  floor: number;
  time: number;
  rng: number;
  nextId: number;
  itemId: number;
  hero: Hero;
  potionColors: SimState['potionColors'];
  run: SimState['run'];
  log: SimState['log'];
}

export function snapshot(s: SimState): string {
  const h: Hero = { ...s.hero, swing: null, dash: null, near: null, cooldowns: {} };
  const maxItem = Math.max(0, ...[...h.hands, h.coat, ...h.pack].map((x) => x?.id ?? 0));
  const b: Blob = { v: SAVE_VERSION, seed: s.seed, floor: s.floor, time: s.time, rng: s.rng.state, nextId: s.nextId, itemId: maxItem + 1, hero: h, potionColors: s.potionColors, run: s.run, log: s.log.slice(-6) };
  return JSON.stringify(b);
}

/** The state a blob describes, at the top of its floor and before it spawns; the caller runs startFloor. */
export function restore(blob: string): SimState | null {
  let b: Blob;
  try {
    b = JSON.parse(blob) as Blob;
  } catch {
    return null;
  }
  if (b.v !== SAVE_VERSION || !b.hero) return null;
  const s = createState(b.seed, generateDungeon(b.seed, b.floor));
  s.floor = b.floor;
  s.time = b.time;
  s.rng.state = b.rng;
  s.nextId = b.nextId;
  s.hero = { ...createState(0, s.dungeon).hero, ...b.hero, swing: null, dash: null, near: null, cooldowns: {} };
  s.potionColors = b.potionColors;
  s.run = b.run;
  s.log = b.log ?? [];
  resetItemIds(b.itemId);
  return s;
}
