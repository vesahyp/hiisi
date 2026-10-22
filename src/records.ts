/**
 * Local records and the saved run: JSON in localStorage. A finished run
 * folds into a top-ten ranked by floor, then level, then time. The saved
 * run is one blob the sim built at the stairs (game/save.ts); death
 * deletes it, because death is death.
 */
export interface RunRecord {
  floor: number;
  level: number;
  time: number;
  kills: number;
  build: string;
  won: boolean;
  date: string;
}

export interface Records {
  runs: number;
  best: RunRecord[];
  deepest: number;
  wins: number;
}

const KEY = 'hiisi.records.v1';
const SAVE_KEY = 'hiisi.save.v1';

export function loadRecords(): Records {
  const empty: Records = { runs: 0, best: [], deepest: 0, wins: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty, ...JSON.parse(raw) };
  } catch {
    /* private mode: play without records */
  }
  return empty;
}

export function saveRun(r: RunRecord): { records: Records; rank: number } {
  const rec = loadRecords();
  rec.runs++;
  rec.deepest = Math.max(rec.deepest, r.floor);
  if (r.won) rec.wins++;
  rec.best.push(r);
  rec.best.sort((a, b) => Number(b.won) - Number(a.won) || b.floor - a.floor || b.level - a.level || a.time - b.time);
  const rank = rec.best.indexOf(r);
  rec.best = rec.best.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* see loadRecords */
  }
  return { records: rec, rank: rank < 10 ? rank : -1 };
}

export function loadSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeSave(blob: string): void {
  try {
    localStorage.setItem(SAVE_KEY, blob);
  } catch {
    /* fine: the run goes on without a save */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* fine */
  }
}

export function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
