// A charge survives walking. On an emulated iPhone in landscape, by real
// touches: the right thumb goes down and holds; a second touch on the
// left walks in four directions for two seconds while the right thumb
// stays down, then the right thumb drifts under the hold; the charge
// must keep building and never drop; the release fires the full shot.
// Then the same with the walk started first. And a partial release at a
// half charge fires with that much. `make charge-check` (part of
// `make check`); needs `make shots-setup`.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';

const port = 5192;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed = true;
};
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 852, height: 393 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);
// two touch points by id: Chromium wants the whole set on every event
const points = new Map();
const send = async (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...points.values()].map((p) => ({ x: p.x, y: p.y, id: p.id })) });
const down = async (id, x, y) => {
  points.set(id, { id, x, y });
  await send('touchStart');
};
const moveTo = async (id, x, y) => {
  points.get(id).x = x;
  points.get(id).y = y;
  await send('touchMove');
};
// a touchEnd lists the points released, not the ones that remain
const up = async (id) => {
  const p = points.get(id);
  points.delete(id);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id: p.id }] });
};
const sim = () => page.evaluate(() => ({ draw: window.__sim.hero.draw, drawing: window.__sim.hero.drawing, x: window.__sim.hero.x, y: window.__sim.hero.y, shots: window.__sim.projectiles.filter((p) => p.kind === 'arrow').map((p) => p.power ?? 0) }));

try {
  await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
  await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
  await page.waitForFunction(() => window.__sim && window.__sim.time > 0.3, null, { timeout: 15000 });
  // the bow in hand, invulnerable, no enemies: a quiet range
  await page.evaluate(() => {
    const s = window.__sim;
    s.hero.active = s.hero.hands.findIndex((h) => h && h.kind === 'bow');
    s.hero.invuln = 1e9;
    s.enemies = [];
  });
  const R = { x: 852 * 0.87, y: 393 - 84 - 21 };
  const L = { x: 852 * 0.13, y: 393 - 84 - 21 };

  // 1: charge standing, then walk with a second touch while holding
  await down(1, R.x, R.y);
  await page.waitForTimeout(700);
  let st = await sim();
  check(st.drawing && st.draw > 0.3, `a hold on the right starts the draw (${st.draw.toFixed(2)})`);
  await down(2, L.x, L.y);
  let dropped = false;
  let minDraw = 1;
  let far = 0;
  const start = await sim();
  for (const [dx, dy] of [[40, 0], [0, -40], [-40, 0], [0, 40], [30, 30], [-30, -30]]) {
    await moveTo(2, L.x + dx, L.y + dy);
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(80);
      st = await sim();
      if (!st.drawing) dropped = true;
      minDraw = Math.min(minDraw, st.draw);
      far = Math.max(far, Math.hypot(st.x - start.x, st.y - start.y));
    }
  }
  check(!dropped, `the charge holds while a second touch walks in six directions (lowest draw ${minDraw.toFixed(2)})`);
  check(far > 12, `the hero walked meanwhile, at the draw's slower pace (as far as ${far.toFixed(0)} px from the start)`);
  // the right thumb drifts under the hold
  await moveTo(1, R.x - 30, R.y + 20);
  await page.waitForTimeout(300);
  st = await sim();
  check(st.drawing && st.draw >= 0.99, `a drift of the right thumb keeps the charge (${st.draw.toFixed(2)})`);
  await up(2);
  await page.waitForTimeout(100);
  st = await sim();
  check(st.drawing && st.draw >= 0.99, `lifting the left thumb keeps the charge (${st.draw.toFixed(2)})`);
  await up(1);
  await page.waitForTimeout(100);
  st = await sim();
  check(st.shots.length === 1 && st.shots[0] >= 1.9, `the release fires the full shot (power ${st.shots.map((p) => p.toFixed(1)).join(',')})`);
  await page.waitForTimeout(1500);

  // 2: walking first, then the charge starts and builds while the walk goes on
  await page.evaluate(() => { window.__sim.projectiles = []; window.__sim.hero.lock = 0; });
  await down(2, L.x, L.y);
  await moveTo(2, L.x + 40, L.y);
  await page.waitForTimeout(300);
  await down(1, R.x, R.y);
  dropped = false;
  for (const [dx, dy] of [[40, 0], [0, 40], [-40, 0], [0, -40]]) {
    await moveTo(2, L.x + dx, L.y + dy);
    for (let k = 0; k < 4; k++) {
      await page.waitForTimeout(80);
      st = await sim();
      if (st.draw > 0.2 && !st.drawing) dropped = true;
    }
  }
  st = await sim();
  check(!dropped && st.drawing && st.draw >= 0.99, `a charge started while walking builds to full (${st.draw.toFixed(2)})`);
  await up(1);
  await up(2);
  await page.waitForTimeout(100);
  st = await sim();
  check(st.shots.length === 1 && st.shots[0] >= 1.9, `and fires full on the release (power ${st.shots.map((p) => p.toFixed(1)).join(',')})`);
  await page.waitForTimeout(1500);

  // 3: a partial charge fires with that much
  await page.evaluate(() => { window.__sim.projectiles = []; window.__sim.hero.lock = 0; });
  await down(1, R.x, R.y);
  await page.waitForTimeout(560);
  const half = await sim();
  await up(1);
  await page.waitForTimeout(100);
  st = await sim();
  check(st.shots.length === 1 && st.shots[0] > 0.9 && st.shots[0] < 1.9, `a release at a part charge (${half.draw.toFixed(2)}) fires with that much (power ${st.shots.map((p) => p.toFixed(2)).join(',')})`);
  check(errors.length === 0, errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
