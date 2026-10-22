// One shot per melee family on an emulated iPhone in landscape: the weapon
// in hand, a full charge held so its hit shape shows, with two dummies in
// front. Into shots/arsenal/. Run with `make arsenal-shots`.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5193;
const dir = 'shots/arsenal';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 852, height: 393 }, hasTouch: true });
const page = await ctx.newPage();
const families = (process.argv[2] ?? 'sword,axe,mace,spear,dagger').split(',');
for (const kind of families) {
  await page.goto(`http://localhost:${port}/?lang=fi&seed=9`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${port}/?lang=fi&seed=9`);
  await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
  await page.waitForFunction(() => window.__sim && window.__sim.time > 0.3, null, { timeout: 15000 });
  await page.evaluate((k) => {
    const s = window.__sim;
    const h = s.hero;
    h.hands[0] = window.__roll(k, 3, 2);
    h.active = 0;
    h.invuln = 1e9;
    s.enemies = [];
    window.__dummy('hiisi', 44, -14);
    window.__dummy('hiisi', 40, 26);
    window.__dummy('luuranko', 70, 4);
  }, kind);
  // hold the attack side so the charge and the hit shape show
  const cx = 852 * 0.75;
  const cy = 393 * 0.6;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/${kind}-charge.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${dir}/${kind}-hit.png` });
  console.log(kind);
}
await browser.close();
server.kill();
