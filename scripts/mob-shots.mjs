// One shot per mob with its quirk showing, on an emulated iPhone in
// landscape: each mob is placed beside the hero in a quiet room and the
// sim run a moment, so the cue shows (the rage tint, the bone pile, the
// thief's sack, the trapper's red trap, the gold hiisi fleeing, the
// rock's circle, the grumpy bear). Into shots/mobs/. `make mob-shots`.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5189;
const dir = 'shots/mobs';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 852, height: 393 }, hasTouch: true });
const page = await ctx.newPage();
const scenes = [
  ['rotta', (s) => { window.__mob('rotta', 70, 0, true); window.__run(1.6); }],
  ['hiisi', (s) => { const e = window.__mob('hiisi', 60, 0, true); window.__hurt(e, Math.round(e.maxHp * 0.6)); window.__run(0.4); }],
  ['luuranko', (s) => { const e = window.__mob('luuranko', 60, 0, true); window.__hurt(e, Math.round(e.maxHp * 0.7)); window.__run(0.3); }],
  ['varas', (s) => { const e = window.__mob('varas', 60, 0, true); e.carry = window.__roll('coat', 2, 1); e.mode = 'flee'; window.__run(0.5); }],
  ['ansastaja', (s) => { const e = window.__mob('ansastaja', 130, 0, true); e.quirkT = 0; window.__run(0.6); }],
  ['kultahiisi', (s) => { window.__mob('kultahiisi', 60, 0, true); window.__run(0.8); }],
  ['kivenheittaja', (s) => { const e = window.__mob('kivenheittaja', 150, 0, true); e.cd = 0; window.__run(1.5); }],
  ['karhu', (s) => { const e = window.__mob('karhu', 90, 0, false); window.__wake(e); window.__run(0.3); }],
];
for (const [name, fn] of scenes) {
  await page.goto(`http://localhost:${port}/?lang=fi&seed=9`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${port}/?lang=fi&seed=9`);
  await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
  await page.waitForFunction(() => window.__sim && window.__sim.time > 0.3, null, { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.__sim;
    s.hero.invuln = 1e9;
    s.enemies = [];
    s.banner = null;
  });
  await page.evaluate(fn);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log(name);
}
await browser.close();
server.kill();
