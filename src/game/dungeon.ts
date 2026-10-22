import { Rng } from './rng';

/**
 * A floor of the hill: rooms joined by corridors, doors where a corridor
 * meets a room, stairs up where the hero arrives and stairs down in the
 * room farthest away. Generated from the run seed and the floor number, so
 * a saved run regenerates the same floor. The collision, flow field and
 * line-of-sight helpers follow Höyry's arena.ts.
 */
export const T = 32;

export const VOID = 0;
export const FLOOR = 1;
export const WALL = 2;
export const DOOR = 3;
export const DOOR_OPEN = 4;
export const STAIRS_DOWN = 5;
export const STAIRS_UP = 6;

export const UNSEEN = 0;
export const REMEMBERED = 1;
export const VISIBLE = 2;

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** centre, in tiles */
  cx: number;
  cy: number;
}

export interface Dungeon {
  w: number;
  h: number;
  tiles: Uint8Array;
  rooms: Room[];
  /** room index per tile, -1 in corridors and walls */
  roomAt: Int16Array;
  /** what the hero has seen of the floor: UNSEEN, REMEMBERED or VISIBLE */
  seen: Uint8Array;
  /** BFS distance in tiles from the hero, -1 unreachable */
  flow: Int16Array;
  startX: number;
  startY: number;
  downX: number;
  downY: number;
  /** the room with the stairs down */
  downRoom: number;
  floor: number;
}

/** What stops a body. A closed door stops until it is opened by touch. */
export function solidMove(t: number): boolean {
  return t === WALL || t === VOID || t === DOOR;
}

/** What stops an arrow and a line of sight. */
export function solidShot(t: number): boolean {
  return t === WALL || t === VOID || t === DOOR;
}

export function tileAt(d: Dungeon, x: number, y: number): number {
  const tx = Math.floor(x / T);
  const ty = Math.floor(y / T);
  if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) return VOID;
  return d.tiles[ty * d.w + tx];
}

export function idxAt(d: Dungeon, x: number, y: number): number {
  const tx = Math.floor(x / T);
  const ty = Math.floor(y / T);
  if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) return -1;
  return ty * d.w + tx;
}

export function roomOf(d: Dungeon, x: number, y: number): number {
  const i = idxAt(d, x, y);
  return i < 0 ? -1 : d.roomAt[i];
}

export function hitsSolid(d: Dungeon, x: number, y: number, r: number): boolean {
  const x0 = Math.floor((x - r) / T);
  const x1 = Math.floor((x + r) / T);
  const y0 = Math.floor((y - r) / T);
  const y1 = Math.floor((y + r) / T);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) return true;
      if (!solidMove(d.tiles[ty * d.w + tx])) continue;
      const cx = Math.max(tx * T, Math.min(x, tx * T + T));
      const cy = Math.max(ty * T, Math.min(y, ty * T + T));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Move a circle by (dx, dy), stopping at solid tiles, one axis at a time. */
export function moveCircle(d: Dungeon, p: { x: number; y: number }, r: number, dx: number, dy: number): void {
  const step = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.8)));
  const sx = dx / step;
  const sy = dy / step;
  for (let i = 0; i < step; i++) {
    p.x += sx;
    if (hitsSolid(d, p.x, p.y, r)) p.x -= sx;
    p.y += sy;
    if (hitsSolid(d, p.x, p.y, r)) p.y -= sy;
  }
  p.x = Math.max(T + r, Math.min((d.w - 1) * T - r, p.x));
  p.y = Math.max(T + r, Math.min((d.h - 1) * T - r, p.y));
}

/** Open every closed door within `reach` of (x, y). Returns how many opened. */
export function openDoorsNear(d: Dungeon, x: number, y: number, reach: number): number {
  const x0 = Math.floor((x - reach) / T);
  const x1 = Math.floor((x + reach) / T);
  const y0 = Math.floor((y - reach) / T);
  const y1 = Math.floor((y + reach) / T);
  let n = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) continue;
      const i = ty * d.w + tx;
      if (d.tiles[i] !== DOOR) continue;
      const cx = Math.max(tx * T, Math.min(x, tx * T + T));
      const cy = Math.max(ty * T, Math.min(y, ty * T + T));
      if ((x - cx) ** 2 + (y - cy) ** 2 < reach * reach) {
        d.tiles[i] = DOOR_OPEN;
        n++;
      }
    }
  }
  return n;
}

const TURN_OFFSETS = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];

/** Rotate a wished unit direction toward the nearest opening when it is blocked. */
export function openDir(d: Dungeon, x: number, y: number, r: number, ux: number, uy: number): { dx: number; dy: number } {
  for (const turn of TURN_OFFSETS) {
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    const tx = ux * c - uy * sn;
    const ty = ux * sn + uy * c;
    if (!hitsSolid(d, x + tx * (r + 6), y + ty * (r + 6), r)) return { dx: tx, dy: ty };
  }
  return { dx: ux, dy: uy };
}

/** The nearest point to (x, y) where a circle of radius r stands free. */
export function freeSpot(d: Dungeon, x: number, y: number, r: number): { x: number; y: number } {
  if (!hitsSolid(d, x, y, r)) return { x, y };
  for (let dist = 8; dist < 200; dist += 8) {
    for (let k = 0; k < 12; k++) {
      const px = x + Math.cos((k / 12) * Math.PI * 2) * dist;
      const py = y + Math.sin((k / 12) * Math.PI * 2) * dist;
      if (!hitsSolid(d, px, py, r)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/** True when nothing that stops an arrow lies on the segment. */
export function lineOfSight(d: Dungeon, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(dist / 4);
  for (let i = 1; i < n; i++) {
    const f = i / n;
    if (solidShot(tileAt(d, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f))) return false;
  }
  return true;
}

/** A line of sight as wide as an arrow: the centre line and one to each side. A wall corner the eye misses still stops the shot. */
export function clearShot(d: Dungeon, x0: number, y0: number, x1: number, y1: number, r = 5): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0) || 1;
  const px = (-(y1 - y0) / dist) * r;
  const py = ((x1 - x0) / dist) * r;
  return lineOfSight(d, x0, y0, x1, y1) && lineOfSight(d, x0 + px, y0 + py, x1 + px, y1 + py) && lineOfSight(d, x0 - px, y0 - py, x1 - px, y1 - py);
}

/** BFS distance in tiles from the given points; -1 where no walk reaches. Doors count as open: a walker opens them. */
export function distanceField(d: Dungeon, from: { x: number; y: number }[], f: Int16Array = new Int16Array(d.w * d.h)): Int16Array {
  f.fill(-1);
  const q = new Int32Array(d.w * d.h);
  let qh = 0;
  let qt = 0;
  for (const p of from) {
    const i = idxAt(d, p.x, p.y);
    if (i < 0 || f[i] === 0) continue;
    f[i] = 0;
    q[qt++] = i;
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % d.w;
    const y = (i - x) / d.w;
    const dist = f[i] + 1;
    const ns = [x > 0 ? i - 1 : -1, x < d.w - 1 ? i + 1 : -1, y > 0 ? i - d.w : -1, y < d.h - 1 ? i + d.w : -1];
    for (const j of ns) {
      if (j < 0 || f[j] !== -1) continue;
      const t = d.tiles[j];
      if (t === WALL || t === VOID) continue;
      f[j] = dist;
      q[qt++] = j;
    }
  }
  return f;
}

export function updateFlow(d: Dungeon, from: { x: number; y: number }[]): void {
  distanceField(d, from, d.flow);
}

const walkable = (d: Dungeon, i: number): boolean => {
  const t = d.tiles[i];
  return t !== WALL && t !== VOID;
};

/** The walkable neighbour (8-way) nearest to the field's source, as a direction. */
export function flowDir(d: Dungeon, x: number, y: number, field = d.flow): { dx: number; dy: number } | null {
  const tx = Math.floor(x / T);
  const ty = Math.floor(y / T);
  const here = field[ty * d.w + tx];
  let best = here < 0 ? 1e9 : here;
  let bx = 0;
  let by = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = tx + ox;
      const ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
      const v = field[ny * d.w + nx];
      if (v < 0) continue;
      if (!walkable(d, ny * d.w + nx)) continue;
      if (ox && oy && (!walkable(d, ty * d.w + nx) || !walkable(d, ny * d.w + tx))) continue;
      const score = v + (ox && oy ? 0.4 : 0);
      if (score < best) {
        best = score;
        bx = ox;
        by = oy;
      }
    }
  }
  if (!bx && !by) return null;
  const cx = (tx + bx + 0.5) * T - x;
  const cy = (ty + by + 0.5) * T - y;
  const dist = Math.hypot(cx, cy) || 1;
  return { dx: cx / dist, dy: cy / dist };
}

/**
 * What the hero sees this step. Everything visible becomes remembered,
 * then the hero's room (if in one) and every tile in the light with a
 * clear line become visible, and the walls round them with them.
 */
export function updateSeen(d: Dungeon, hx: number, hy: number, lightTiles: number): void {
  const seen = d.seen;
  for (let i = 0; i < seen.length; i++) if (seen[i] === VISIBLE) seen[i] = REMEMBERED;
  const mark = (i: number) => {
    seen[i] = VISIBLE;
  };
  const room = roomOf(d, hx, hy);
  if (room >= 0) {
    const r = d.rooms[room];
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) mark(y * d.w + x);
  }
  const tx0 = Math.floor(hx / T);
  const ty0 = Math.floor(hy / T);
  const R = Math.ceil(lightTiles);
  for (let ty = ty0 - R; ty <= ty0 + R; ty++) {
    for (let tx = tx0 - R; tx <= tx0 + R; tx++) {
      if (tx < 0 || ty < 0 || tx >= d.w || ty >= d.h) continue;
      const i = ty * d.w + tx;
      if (seen[i] === VISIBLE) continue;
      const cx = (tx + 0.5) * T;
      const cy = (ty + 0.5) * T;
      if (Math.hypot(cx - hx, cy - hy) > lightTiles * T) continue;
      const t = d.tiles[i];
      if (t === VOID) continue;
      // a wall or door is seen from the side it faces: test the line to the near edge
      const ex = t === WALL || t === DOOR ? hx + (cx - hx) * (1 - T / 2 / Math.max(T / 2, Math.hypot(cx - hx, cy - hy))) : cx;
      const ey = t === WALL || t === DOOR ? hy + (cy - hy) * (1 - T / 2 / Math.max(T / 2, Math.hypot(cx - hx, cy - hy))) : cy;
      if (lineOfSight(d, hx, hy, ex, ey)) mark(i);
    }
  }
}

export function seenAt(d: Dungeon, x: number, y: number): number {
  const i = idxAt(d, x, y);
  return i < 0 ? UNSEEN : d.seen[i];
}

/** Rooms the hero has stepped into (any tile remembered or visible). */
export function roomsExplored(d: Dungeon): number {
  let n = 0;
  for (const r of d.rooms) if (d.seen[r.cy * d.w + r.cx] !== UNSEEN) n++;
  return n;
}

export function generateDungeon(seed: number, floor: number): Dungeon {
  for (let attempt = 0; attempt < 50; attempt++) {
    const d = tryGenerate(new Rng(seed * 7919 + floor * 104729 + attempt * 31), floor);
    if (d) return d;
  }
  throw new Error('no floor generated');
}

function tryGenerate(rng: Rng, floor: number): Dungeon | null {
  const w = Math.min(64, 46 + floor * 3);
  const h = Math.min(52, 38 + floor * 3);
  const tiles = new Uint8Array(w * h);
  const roomAt = new Int16Array(w * h).fill(-1);
  const rooms: Room[] = [];
  const want = Math.min(9, 7 + Math.floor(floor / 2));
  const get = (x: number, y: number) => tiles[y * w + x];
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t;
  };
  // Rooms: random rectangles, two tiles apart.
  for (let k = 0; k < 400 && rooms.length < want; k++) {
    const rw = rng.int(5, 11);
    const rh = rng.int(4, 8);
    const x = rng.int(2, w - rw - 3);
    const y = rng.int(2, h - rh - 3);
    let clash = false;
    for (const r of rooms) {
      if (x < r.x + r.w + 3 && x + rw + 3 > r.x && y < r.y + r.h + 3 && y + rh + 3 > r.y) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    const id = rooms.length;
    rooms.push({ id, x, y, w: rw, h: rh, cx: x + Math.floor(rw / 2), cy: y + Math.floor(rh / 2) });
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
      tiles[(y + j) * w + x + i] = FLOOR;
      roomAt[(y + j) * w + x + i] = id;
    }
  }
  if (rooms.length < 5) return null;
  rooms.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
  rooms.forEach((r, i) => (r.id = i));
  for (let i = 0; i < roomAt.length; i++) if (roomAt[i] >= 0) roomAt[i] = rooms.findIndex((r) => i % w >= r.x && i % w < r.x + r.w && Math.floor(i / w) >= r.y && Math.floor(i / w) < r.y + r.h);
  // Corridors: a chain through the rooms in x order, plus a loop or two.
  const corridor = (a: Room, b: Room) => {
    let x = a.cx;
    let y = a.cy;
    const carve = () => {
      if (get(x, y) === VOID) set(x, y, FLOOR);
    };
    const horizFirst = rng.chance(0.5);
    const goX = () => {
      while (x !== b.cx) {
        x += Math.sign(b.cx - x);
        carve();
      }
    };
    const goY = () => {
      while (y !== b.cy) {
        y += Math.sign(b.cy - y);
        carve();
      }
    };
    if (horizFirst) {
      goX();
      goY();
    } else {
      goY();
      goX();
    }
  };
  for (let i = 0; i + 1 < rooms.length; i++) corridor(rooms[i], rooms[i + 1]);
  const loops = 1 + rng.int(0, 1);
  for (let k = 0; k < loops; k++) {
    const a = rng.int(0, rooms.length - 1);
    const b = rng.int(0, rooms.length - 1);
    if (Math.abs(a - b) >= 2) corridor(rooms[a], rooms[b]);
  }
  // Doors: a corridor tile on a room's wall ring, between room floor and corridor.
  for (const r of rooms) {
    for (let y = r.y - 1; y <= r.y + r.h; y++) {
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        const onRing = x === r.x - 1 || x === r.x + r.w || y === r.y - 1 || y === r.y + r.h;
        const corner = (x === r.x - 1 || x === r.x + r.w) && (y === r.y - 1 || y === r.y + r.h);
        if (!onRing || corner) continue;
        if (get(x, y) !== FLOOR || roomAt[y * w + x] >= 0) continue;
        // the tile straight across must be room floor and the one behind corridor
        const dx = x === r.x - 1 ? 1 : x === r.x + r.w ? -1 : 0;
        const dy = y === r.y - 1 ? 1 : y === r.y + r.h ? -1 : 0;
        if (roomAt[(y + dy) * w + x + dx] !== r.id) continue;
        if (get(x - dx, y - dy) === VOID) continue;
        if (rng.chance(0.75)) set(x, y, DOOR);
      }
    }
  }
  // Walls: everything void next to a floor.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (get(x, y) !== VOID) continue;
      let near = false;
      for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = get(nx, ny);
        if (t === FLOOR || t === DOOR) {
          near = true;
          break;
        }
      }
      if (near) set(x, y, WALL);
    }
  }
  // Every room must be reachable from the first.
  const d: Dungeon = {
    w,
    h,
    tiles,
    rooms,
    roomAt,
    seen: new Uint8Array(w * h),
    flow: new Int16Array(w * h).fill(-1),
    startX: (rooms[0].cx + 0.5) * T,
    startY: (rooms[0].cy + 0.5) * T,
    downX: 0,
    downY: 0,
    downRoom: 0,
    floor,
  };
  const f = distanceField(d, [{ x: d.startX, y: d.startY }]);
  let far = -1;
  let farRoom = 0;
  for (const r of rooms) {
    const v = f[r.cy * w + r.cx];
    if (v < 0) return null;
    if (v > far) {
      far = v;
      farRoom = r.id;
    }
  }
  const dr = rooms[farRoom];
  d.downRoom = farRoom;
  d.downX = (dr.cx + 0.5) * T;
  d.downY = (dr.cy + 0.5) * T;
  tiles[dr.cy * w + dr.cx] = STAIRS_DOWN;
  tiles[rooms[0].cy * w + rooms[0].cx] = STAIRS_UP;
  return d;
}

/** Floor tiles of a room, as world centres, at least `minDist` from (x, y). */
export function roomSpots(d: Dungeon, room: Room, x: number, y: number, minDist: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let j = 0; j < room.h; j++) {
    for (let i = 0; i < room.w; i++) {
      const tx = room.x + i;
      const ty = room.y + j;
      if (d.tiles[ty * d.w + tx] !== FLOOR) continue;
      const cx = (tx + 0.5) * T;
      const cy = (ty + 0.5) * T;
      if (Math.hypot(cx - x, cy - y) < minDist) continue;
      out.push({ x: cx, y: cy });
    }
  }
  return out;
}
