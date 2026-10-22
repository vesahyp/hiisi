// The mockup scene painter. Draws one static dungeon scene on a canvas the
// way the game would: 3/4 view, stone walls with a top and a front face,
// a light radius around the hero, explored tiles remembered in the dark.
// Nothing here moves. The game's renderer will be written from scratch on
// the Höyry pattern; this file exists only to render the design mockups.

export const T = 24; // tile size in CSS px, the same scale as Höyry

export const RARITY = ['#b8b8b8', '#6ee06e', '#4aa8ff', '#c070ff', '#ff9a2a'];
export const COL = {
  floor: '#2a2e29', floor2: '#30352f', seam: '#1a1d19',
  wallTop: '#5b645a', wallFront: '#3a4139', mortar: '#1e2420', moss: '#4b7a44',
  water: '#1a3650', water2: '#224a6a', void: '#07090a',
  ember: '#ff7a2a', frost: '#8fd8ff', spirit: '#c9b7ff', venom: '#8ae070', shadow: '#8a7fd0',
  ink: '#ece6d2', bone: '#e8dcc0',
};

// mulberry32, so a scene looks the same on every render
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A floor is rooms and corridors rasterised onto a grid.
// rooms: [x, y, w, h]; corridors: [[x,y],[x,y],...] axis-aligned polylines;
// doors: [x, y]; stairs: [x, y]; water: [x, y, w, h]; traps: [x, y].
export function buildFloor(spec) {
  const { cols, rows } = spec;
  const g = [];
  for (let y = 0; y < rows; y++) g.push(new Array(cols).fill(' '));
  const carve = (x, y, ch = '.') => { if (x >= 0 && y >= 0 && x < cols && y < rows) g[y][x] = ch; };
  for (const [x, y, w, h] of spec.rooms) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) carve(x + i, y + j);
  for (const path of spec.corridors || []) {
    for (let k = 0; k + 1 < path.length; k++) {
      let [x0, y0] = path[k]; const [x1, y1] = path[k + 1];
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      carve(x0, y0);
      while (x0 !== x1 || y0 !== y1) { x0 += dx; y0 += dy; carve(x0, y0); }
    }
  }
  for (const [x, y, w, h] of spec.water || []) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) carve(x + i, y + j, '~');
  for (const [x, y] of spec.doors || []) carve(x, y, '+');
  for (const [x, y] of spec.traps || []) carve(x, y, '^');
  if (spec.down) carve(spec.down[0], spec.down[1], '>');
  if (spec.up) carve(spec.up[0], spec.up[1], '<');
  // walls: any void tile next to a walkable one
  const walk = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && g[y][x] !== ' ' && g[y][x] !== '#';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (g[y][x] !== ' ') continue;
    let near = false;
    for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) if (walk(x + i, y + j)) { near = true; break; }
    if (near) g[y][x] = '#';
  }
  return g;
}

// Visibility: tiles in the hero's light and inside the hero's room are
// visible; tiles of explored rooms are remembered; the rest is dark.
export function visibility(grid, spec, hero, lightR, explored) {
  const rows = grid.length, cols = grid[0].length;
  const v = [];
  for (let y = 0; y < rows; y++) v.push(new Float32Array(cols));
  const mark = (x, y, a) => { if (x >= 0 && y >= 0 && x < cols && y < rows) v[y][x] = Math.max(v[y][x], a); };
  for (const [x, y, w, h] of explored) for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) mark(x + i, y + j, 0.3);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const d = Math.hypot(x + 0.5 - hero.x, y + 0.5 - hero.y);
    if (d < lightR) mark(x, y, Math.min(1, 1.15 - d / lightR));
  }
  for (const [x, y, w, h] of spec.lit || []) for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) mark(x + i, y + j, 0.85);
  return v;
}

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, W, H };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Draw the whole scene. scene = { spec, hero, enemies, items, effects, lightR, explored, cam }
export function drawScene(canvas, scene) {
  const { c, W, H } = setupCanvas(canvas);
  const grid = buildFloor(scene.spec);
  const rows = grid.length, cols = grid[0].length;
  const hero = scene.hero;
  const vis = visibility(grid, scene.spec, hero, scene.lightR ?? 6.5, scene.explored || []);
  const cam = scene.cam || hero;
  const ox = W / 2 - cam.x * T, oy = H / 2 - cam.y * T;
  const r = rng(7);
  c.fillStyle = COL.void; c.fillRect(0, 0, W, H);
  const x0 = Math.max(0, Math.floor(-ox / T) - 1), x1 = Math.min(cols, Math.ceil((W - ox) / T) + 1);
  const y0 = Math.max(0, Math.floor(-oy / T) - 1), y1 = Math.min(rows, Math.ceil((H - oy) / T) + 1);
  // floors and water
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ch = grid[y][x]; if (ch === ' ' || ch === '#') continue;
    const px = ox + x * T, py = oy + y * T;
    const n = ((x * 7 + y * 13) % 5);
    c.fillStyle = ch === '~' ? (n < 2 ? COL.water : COL.water2) : (n < 2 ? COL.floor2 : COL.floor);
    c.fillRect(px, py, T, T);
    c.strokeStyle = COL.seam; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
    if (ch !== '~' && (x * 31 + y * 17) % 11 === 0) { c.fillStyle = hexA(COL.moss, 0.5); c.beginPath(); c.ellipse(px + T * 0.5, py + T * 0.6, 6, 4, 0.3, 0, 7); c.fill(); }
    if (ch === '+') { // door: a dark plank frame
      c.fillStyle = '#4a3418'; c.fillRect(px + 3, py + 2, T - 6, T - 4);
      c.strokeStyle = '#2a1c0a'; c.lineWidth = 2; c.strokeRect(px + 3, py + 2, T - 6, T - 4);
      c.fillStyle = '#c8a040'; c.beginPath(); c.arc(px + T - 8, py + T / 2, 1.8, 0, 7); c.fill();
    }
    if (ch === '>' || ch === '<') {
      c.fillStyle = '#121412'; c.fillRect(px + 2, py + 2, T - 4, T - 4);
      c.strokeStyle = '#8a8e86'; c.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(px + 4 + k * 2, py + 4 + k * 4.5); c.lineTo(px + T - 4 - k * 2, py + 4 + k * 4.5); c.stroke(); }
    }
    if (ch === '^') { c.strokeStyle = '#d0503a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 6, py + T - 6); c.lineTo(px + T / 2, py + 6); c.lineTo(px + T - 6, py + T - 6); c.closePath(); c.stroke(); }
  }
  // walls, row-sorted: a top face and a front face below it
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (grid[y][x] !== '#') continue;
    const px = ox + x * T, py = oy + y * T;
    const below = y + 1 < rows && grid[y + 1][x] !== '#' && grid[y + 1][x] !== ' ';
    c.fillStyle = COL.wallTop; c.fillRect(px, py - 6, T, T);
    c.strokeStyle = COL.mortar; c.lineWidth = 1; c.strokeRect(px + 0.5, py - 5.5, T - 1, T - 1);
    c.strokeStyle = hexA('#ffffff', 0.08); c.beginPath(); c.moveTo(px + 2, py + T / 2 - 6); c.lineTo(px + T - 2, py + T / 2 - 6); c.stroke();
    if ((x * 5 + y * 3) % 7 === 0) { c.fillStyle = hexA(COL.moss, 0.6); c.fillRect(px + 4, py - 2, 8, 3); }
    if (below) {
      c.fillStyle = COL.wallFront; c.fillRect(px, py + T - 6, T, 6);
      c.strokeStyle = COL.mortar; c.beginPath(); c.moveTo(px, py + T - 3); c.lineTo(px + T, py + T - 3); c.stroke();
    }
  }
  // items
  for (const it of scene.items || []) {
    const px = ox + it.x * T, py = oy + it.y * T;
    if (vis[Math.floor(it.y)]?.[Math.floor(it.x)] < 0.35 && !it.known) continue;
    drawItem(c, px, py, it);
  }
  // enemies
  for (const e of scene.enemies || []) drawEnemy(c, ox + e.x * T, oy + e.y * T, e, vis);
  // effects under the hero
  for (const ef of scene.effects || []) if (ef.under) drawEffect(c, ox, oy, ef, hero);
  drawHero(c, ox + hero.x * T, oy + hero.y * T, hero);
  for (const ef of scene.effects || []) if (!ef.under) drawEffect(c, ox, oy, ef, hero);
  // light and fog, as one pass over the tiles
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const a = vis[y][x];
    if (a >= 0.99) continue;
    c.fillStyle = hexA('#05070a', 1 - a);
    c.fillRect(ox + x * T, oy + y * T - 6, T, T + 6);
  }
  // the warm centre of the light
  const g = c.createRadialGradient(ox + hero.x * T, oy + hero.y * T, 0, ox + hero.x * T, oy + hero.y * T, (scene.lightR ?? 6.5) * T);
  g.addColorStop(0, hexA('#ffb060', 0.14)); g.addColorStop(1, hexA('#ffb060', 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // labels and floating text last
  for (const ef of scene.effects || []) if (ef.kind === 'text') drawEffect(c, ox, oy, ef, hero);
  return { c, W, H, ox, oy };
}

function drawItem(c, px, py, it) {
  const col = RARITY[it.rarity ?? 0];
  if ((it.rarity ?? 0) >= 2) { // a beam of light for the good ones
    const g = c.createLinearGradient(0, py - 90, 0, py + 10);
    g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, 0.45));
    c.fillStyle = g; c.fillRect(px + 7, py - 90, 10, 100);
  }
  c.fillStyle = hexA('#000', 0.35); c.beginPath(); c.ellipse(px + 12, py + 19, 8, 3, 0, 0, 7); c.fill();
  c.save(); c.translate(px + 12, py + 12);
  c.lineCap = 'round';
  if (it.kind === 'sword') { c.rotate(-0.7); c.strokeStyle = '#d8dce0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(7, 0); c.stroke(); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, -4); c.lineTo(-6, 4); c.stroke(); }
  else if (it.kind === 'bow') { c.strokeStyle = '#8a5a2a'; c.lineWidth = 3; c.beginPath(); c.arc(-3, 0, 8, -1.2, 1.2); c.stroke(); c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -7.5); c.lineTo(0, 7.5); c.stroke(); }
  else if (it.kind === 'staff') { c.rotate(0.5); c.strokeStyle = '#7a5a30'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(9, 0, 3.5, 0, 7); c.fill(); }
  else if (it.kind === 'potion') { c.fillStyle = it.color || '#c050a0'; c.beginPath(); c.arc(0, 2, 6, 0, 7); c.fill(); c.fillStyle = '#d0c8b0'; c.fillRect(-2, -8, 4, 5); }
  else if (it.kind === 'scroll') { c.fillStyle = '#e8dcc0'; c.fillRect(-7, -5, 14, 10); c.strokeStyle = '#6a5a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -2); c.lineTo(5, -2); c.moveTo(-5, 1); c.lineTo(3, 1); c.stroke(); }
  else if (it.kind === 'chest') { c.fillStyle = '#6a4a22'; c.fillRect(-10, -6, 20, 14); c.fillStyle = '#8a6232'; c.fillRect(-10, -6, 20, 5); c.strokeStyle = '#2a1a08'; c.lineWidth = 1.5; c.strokeRect(-10, -6, 20, 14); c.fillStyle = '#e0b048'; c.fillRect(-2, -2, 4, 5); }
  else if (it.kind === 'coins') { c.fillStyle = '#e0b048'; for (const [dx, dy] of [[-4, 2], [3, 0], [0, 4]]) { c.beginPath(); c.arc(dx, dy, 3.5, 0, 7); c.fill(); } }
  else if (it.kind === 'ring') { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.stroke(); }
  c.restore();
}

const ENEMY = {
  hiisi: { body: '#4f8a3a', r: 8, eye: '#ffe060' },
  rotta: { body: '#6a5a4a', r: 6, eye: '#ff6a4a' },
  luuranko: { body: '#d8d0b8', r: 8, eye: '#2a3a5a' },
  noita: { body: '#5a3a6a', r: 9, eye: '#c9b7ff' },
  karhu: { body: '#4a3222', r: 13, eye: '#ffb060' },
  nakki: { body: '#2a6a6a', r: 9, eye: '#b0ffe0' },
};

function drawEnemy(c, px, py, e, vis) {
  const d = ENEMY[e.kind] || ENEMY.hiisi;
  const a = vis[Math.floor(e.y)]?.[Math.floor(e.x)] ?? 0;
  if (a < 0.4 && !e.known) return;
  c.save(); c.translate(px, py);
  // sight cone for an enemy that has not noticed the hero
  if (e.cone) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, e.cone.r * T);
    g.addColorStop(0, hexA(e.aware ? '#ff6a4a' : '#ffe060', 0.22)); g.addColorStop(1, hexA(e.aware ? '#ff6a4a' : '#ffe060', 0));
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, e.cone.r * T, e.cone.a - 0.55, e.cone.a + 0.55); c.closePath(); c.fill();
  }
  c.fillStyle = hexA('#000', 0.35); c.beginPath(); c.ellipse(0, d.r * 0.9, d.r, d.r * 0.4, 0, 0, 7); c.fill();
  c.fillStyle = d.body; c.beginPath(); c.arc(0, -d.r * 0.2, d.r, 0, 7); c.fill();
  c.strokeStyle = hexA('#000', 0.5); c.lineWidth = 1.5; c.stroke();
  if (e.kind === 'hiisi') { c.fillStyle = d.body; c.beginPath(); c.moveTo(-d.r, -d.r * 0.4); c.lineTo(-d.r - 5, -d.r - 2); c.lineTo(-d.r * 0.3, -d.r * 0.8); c.fill(); c.beginPath(); c.moveTo(d.r, -d.r * 0.4); c.lineTo(d.r + 5, -d.r - 2); c.lineTo(d.r * 0.3, -d.r * 0.8); c.fill(); }
  if (e.kind === 'luuranko') { c.strokeStyle = '#8a8070'; c.lineWidth = 1; for (let k = -3; k <= 3; k += 3) { c.beginPath(); c.moveTo(-5, k); c.lineTo(5, k); c.stroke(); } }
  if (e.kind === 'noita') { c.fillStyle = '#2a1a3a'; c.beginPath(); c.moveTo(-11, -d.r * 0.5); c.lineTo(11, -d.r * 0.5); c.lineTo(2, -d.r * 2.2); c.closePath(); c.fill(); }
  if (e.kind === 'karhu') { c.fillStyle = d.body; c.beginPath(); c.arc(-8, -11, 4, 0, 7); c.arc(8, -11, 4, 0, 7); c.fill(); }
  const ex = Math.cos(e.face ?? 0) * 3, ey = Math.sin(e.face ?? 0) * 2 - d.r * 0.4;
  c.fillStyle = d.eye; c.beginPath(); c.arc(ex - 3, ey, 1.6, 0, 7); c.arc(ex + 3, ey, 1.6, 0, 7); c.fill();
  // the awareness mark: ! when it sees you, z when it sleeps
  if (e.mark) { c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillStyle = e.mark === '!' ? '#ff6a4a' : '#9ab0ff'; c.fillText(e.mark, 0, -d.r - 8); }
  if (e.hp !== undefined) {
    c.fillStyle = hexA('#000', 0.6); c.fillRect(-12, -d.r - 6, 24, 4);
    c.fillStyle = e.elite ? '#ffd040' : '#e0503a'; c.fillRect(-12, -d.r - 6, 24 * e.hp, 4);
  }
  if (e.elite) { c.strokeStyle = '#ffd040'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, d.r * 0.9, d.r + 3, (d.r + 3) * 0.45, 0, 0, 7); c.stroke(); }
  if (e.label) { c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.fillStyle = e.elite ? '#ffd040' : COL.ink; c.shadowColor = '#000'; c.shadowBlur = 4; c.fillText(e.label, 0, d.r + 14); c.shadowBlur = 0; }
  c.restore();
}

function drawHero(c, px, py, h) {
  c.save(); c.translate(px, py);
  if (h.sneak) { c.globalAlpha = 0.7; }
  c.fillStyle = hexA('#000', 0.4); c.beginPath(); c.ellipse(0, 9, 9, 4, 0, 0, 7); c.fill();
  c.strokeStyle = '#6ab0ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 9, 11, 5, 0, 0, 7); c.stroke();
  // body: a grey wool coat, a red sash, a birch-bark pack
  c.fillStyle = '#5a5a60'; c.beginPath(); c.roundRect(-7, -6, 14, 16, 4); c.fill();
  c.fillStyle = '#a83a2a'; c.fillRect(-7, 2, 14, 3);
  c.fillStyle = '#e8c9a0'; c.beginPath(); c.arc(0, -11, 6, 0, 7); c.fill();
  c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(0, -13, 6, Math.PI, 2 * Math.PI); c.fill();
  // the hand: what is held says the style
  const f = h.face ?? 0;
  c.save(); c.translate(Math.cos(f) * 8, Math.sin(f) * 4); c.rotate(f);
  c.lineCap = 'round';
  if (h.style === 'sword') { c.strokeStyle = '#e0e4e8'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 0); c.stroke(); c.strokeStyle = '#e0b048'; c.beginPath(); c.moveTo(2, -4); c.lineTo(2, 4); c.stroke(); }
  if (h.style === 'bow') { c.strokeStyle = '#8a5a2a'; c.lineWidth = 3; c.beginPath(); c.arc(4, 0, 10, -1.3, 1.3); c.stroke(); c.strokeStyle = '#d8d0b8'; c.lineWidth = 1; c.beginPath(); c.moveTo(6, -9.5); c.lineTo(-2, 0); c.lineTo(6, 9.5); c.stroke(); }
  if (h.style === 'magic') { c.strokeStyle = '#7a5a30'; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, 6); c.lineTo(14, -6); c.stroke(); c.fillStyle = h.school === 'frost' ? COL.frost : COL.ember; c.shadowColor = c.fillStyle; c.shadowBlur = 10; c.beginPath(); c.arc(15, -7, 4, 0, 7); c.fill(); c.shadowBlur = 0; }
  if (h.style === 'shadow') { c.strokeStyle = '#c8ccd0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(10, 0); c.stroke(); }
  c.restore();
  c.restore();
  if (h.hp !== undefined) {
    c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.shadowColor = '#000'; c.shadowBlur = 4;
    c.fillText(String(h.hpText ?? ''), px, py - 30); c.shadowBlur = 0;
    c.fillStyle = hexA('#000', 0.6); c.fillRect(px - 20, py - 27, 40, 6);
    c.fillStyle = '#58e040'; c.fillRect(px - 20, py - 27, 40 * h.hp, 6);
    if (h.mana !== undefined) { c.fillStyle = hexA('#000', 0.6); c.fillRect(px - 20, py - 20, 40, 4); c.fillStyle = '#5aa0ff'; c.fillRect(px - 20, py - 20, 40 * h.mana, 4); }
  }
}

function drawEffect(c, ox, oy, ef, hero) {
  const hx = ox + hero.x * T, hy = oy + hero.y * T;
  c.save();
  if (ef.kind === 'aim') { // a straight aim line, the bow's or the staff's
    const ex = ox + ef.to[0] * T, ey = oy + ef.to[1] * T;
    c.strokeStyle = hexA(ef.color || '#ffd040', 0.85); c.lineWidth = 2; c.setLineDash([6, 5]);
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
    c.strokeStyle = ef.color || '#ffd040'; c.lineWidth = 2; c.beginPath(); c.arc(ex, ey, ef.r || 12, 0, 7); c.stroke();
    if (ef.r) { c.beginPath(); c.moveTo(ex - 5, ey); c.lineTo(ex + 5, ey); c.moveTo(ex, ey - 5); c.lineTo(ex, ey + 5); c.stroke(); }
  }
  if (ef.kind === 'arc') { // the sword's reach
    const g = c.createRadialGradient(hx, hy, 0, hx, hy, ef.r * T);
    g.addColorStop(0, hexA(ef.color || '#ffd040', 0.05)); g.addColorStop(1, hexA(ef.color || '#ffd040', 0.35));
    c.fillStyle = g; c.beginPath(); c.moveTo(hx, hy); c.arc(hx, hy, ef.r * T, ef.a - ef.w, ef.a + ef.w); c.closePath(); c.fill();
    c.strokeStyle = ef.color || '#ffd040'; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, ef.r * T, ef.a - ef.w, ef.a + ef.w); c.stroke();
  }
  if (ef.kind === 'slash') { c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(hx, hy, ef.r * T, ef.a - 0.5, ef.a + 0.5); c.stroke(); c.strokeStyle = hexA('#ffd040', 0.6); c.lineWidth = 7; c.stroke(); }
  if (ef.kind === 'charge') { // a ring that fills while the bow is drawn
    c.strokeStyle = hexA('#000', 0.5); c.lineWidth = 5; c.beginPath(); c.arc(hx, hy, 20, 0, 7); c.stroke();
    c.strokeStyle = '#ffd040'; c.lineWidth = 5; c.beginPath(); c.arc(hx, hy, 20, -Math.PI / 2, -Math.PI / 2 + ef.f * 2 * Math.PI); c.stroke();
  }
  if (ef.kind === 'arrow') { const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T; c.save(); c.translate(ex, ey); c.rotate(ef.a); c.strokeStyle = '#d8d0b8'; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); c.fillStyle = '#d8d0b8'; c.beginPath(); c.moveTo(10, 0); c.lineTo(5, -3); c.lineTo(5, 3); c.fill(); c.restore(); }
  if (ef.kind === 'blast') { // a fireball's landing circle, like Höyry's mortar
    const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T;
    const g = c.createRadialGradient(ex, ey, 0, ex, ey, ef.r * T);
    g.addColorStop(0, hexA(ef.color, 0.55)); g.addColorStop(1, hexA(ef.color, 0.05));
    c.fillStyle = g; c.beginPath(); c.arc(ex, ey, ef.r * T, 0, 7); c.fill();
    c.strokeStyle = ef.color; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(ex, ey, ef.r * T, 0, 7); c.stroke(); c.setLineDash([]);
  }
  if (ef.kind === 'bolt') { // a spell in flight
    const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T;
    c.shadowColor = ef.color; c.shadowBlur = 16; c.fillStyle = ef.color; c.beginPath(); c.arc(ex, ey, 6, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 2.5, 0, 7); c.fill();
  }
  if (ef.kind === 'pool') { const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T; c.fillStyle = hexA(ef.color, 0.35); c.beginPath(); c.ellipse(ex, ey, ef.r * T, ef.r * T * 0.6, 0, 0, 7); c.fill(); }
  if (ef.kind === 'backstab') { // the mark behind an unaware enemy
    const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T;
    c.strokeStyle = COL.shadow; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.arc(ex, ey, 14, 0, 7); c.stroke(); c.setLineDash([]);
    c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillStyle = COL.shadow; c.shadowColor = '#000'; c.shadowBlur = 4; c.fillText(ef.text || '×4', ex, ey + 26);
  }
  if (ef.kind === 'text') {
    const ex = ox + ef.at[0] * T, ey = oy + ef.at[1] * T;
    c.font = `bold ${ef.size || 14}px system-ui`; c.textAlign = 'center'; c.fillStyle = ef.color || '#fff'; c.shadowColor = '#000'; c.shadowBlur = 5; c.fillText(ef.text, ex, ey);
  }
  if (ef.kind === 'stick') { // the move stick, drawn where the left thumb rests
    c.strokeStyle = hexA('#fff', 0.25); c.lineWidth = 2; c.beginPath(); c.arc(ef.at[0], ef.at[1], 44, 0, 7); c.stroke();
    c.fillStyle = hexA('#fff', 0.35); c.beginPath(); c.arc(ef.at[0] + ef.d[0], ef.at[1] + ef.d[1], 20, 0, 7); c.fill();
  }
  c.restore();
}

// The floor as a small map: explored rooms as blocks, the hero as a dot.
export function drawMinimap(canvas, spec, explored, hero, opts = {}) {
  const { c, W, H } = setupCanvas(canvas);
  const s = Math.min(W / spec.cols, H / spec.rows);
  const ox = (W - spec.cols * s) / 2, oy = (H - spec.rows * s) / 2;
  c.fillStyle = opts.bg || 'rgba(8,10,12,0.85)'; c.fillRect(0, 0, W, H);
  const grid = buildFloor(spec);
  const seen = (x, y) => explored.some(([rx, ry, rw, rh]) => x >= rx - 1 && x <= rx + rw && y >= ry - 1 && y <= ry + rh) || (opts.all);
  for (let y = 0; y < spec.rows; y++) for (let x = 0; x < spec.cols; x++) {
    const ch = grid[y][x]; if (ch === ' ' || !seen(x, y)) continue;
    c.fillStyle = ch === '#' ? '#6a7268' : ch === '~' ? '#2a5a7a' : '#2e342d';
    if (ch === '+') c.fillStyle = '#a07030';
    c.fillRect(ox + x * s, oy + y * s, s, s);
    if (ch === '>' || ch === '<') { c.fillStyle = '#ece6d2'; c.fillRect(ox + x * s, oy + y * s, s, s); }
  }
  for (const m of opts.marks || []) { c.fillStyle = m.color; c.beginPath(); c.arc(ox + (m.x + 0.5) * s, oy + (m.y + 0.5) * s, Math.max(2, s * 0.9), 0, 7); c.fill(); }
  c.fillStyle = '#6ab0ff'; c.beginPath(); c.arc(ox + hero.x * s, oy + hero.y * s, Math.max(2.5, s * 1.1), 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
  if (opts.labels) { c.font = `bold ${Math.max(9, s * 2.2)}px system-ui`; c.fillStyle = '#ece6d2'; c.textAlign = 'center'; for (const l of opts.labels) c.fillText(l.text, ox + l.x * s, oy + l.y * s); }
}
