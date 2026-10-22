// The human profile of the bot plays on an emulated iPhone at real speed,
// on video, from floor 1 until it dies or reaches floor 3. The check passes
// when the run reaches floor 2 with no page errors: the proof that the sim,
// the renderer and the HUD hold together on a phone for minutes at a time.
// Run with `make phone-run [SEED=n]` (part of `make check`); needs
// `make shots-setup`. The video lands in shots/phone/run.webm, a screenshot
// every ten seconds beside it.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, rmSync } from 'node:fs';

const port = 5197;
const dir = 'shots/phone';
const seed = Number(process.argv[2] ?? 2026);
const until = Number(process.argv[3] ?? 3);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed = true;
};

const phone = devices['iPhone 15'];
const ctx = await browser.newContext({ ...phone, hasTouch: true, recordVideo: { dir, size: phone.viewport } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
try {
  await page.goto(`http://localhost:${port}/?bot=human&speed=1&seed=${seed}`);
  await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
  await page.waitForFunction(() => window.__sim && window.__sim.floor === 1, null, { timeout: 15000 });
  let shot = 0;
  let floor = 1;
  const cleared = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 420000) {
    const st = await page.evaluate(() => ({ floor: window.__sim.floor, over: window.__sim.gameOver, time: window.__sim.time }));
    while (floor < st.floor) cleared.push(floor++);
    if (st.over || st.floor >= until) break;
    if (st.time >= shot * 10) {
      await page.screenshot({ path: `${dir}/floor-${st.floor}-${String(Math.round(st.time)).padStart(3, '0')}s.png` });
      shot++;
    }
    await page.waitForTimeout(250);
  }
  const end = await page.evaluate(() => ({ floor: window.__sim.floor, over: window.__sim.gameOver, won: window.__sim.won, time: Math.round(window.__sim.time), hp: Math.round(window.__sim.hero.hp), level: window.__sim.hero.level, kills: window.__sim.run.kills }));
  check(cleared.includes(1), `seed ${seed}: the human-limited bot clears floor 1 on an iPhone${cleared.includes(1) ? '' : end.over ? ` (fell on floor ${end.floor} at ${end.time} s)` : ' (ran out of time)'}`);
  const perf = await page.evaluate(() => window.__perf);
  check(perf.ms / perf.frames < 12, `a frame takes ${(perf.ms / perf.frames).toFixed(2)} ms on average, worst ${perf.worst.toFixed(0)} ms`);
  console.log(`run ended on floor ${end.floor} at ${end.time} s, level ${end.level}, ${end.kills} kills, ${end.hp} hp${end.over ? ', dead' : ''}`);
  check(errors.length === 0, errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  const video = page.video();
  await ctx.close();
  if (video) {
    const p = await video.path();
    renameSync(p, `${dir}/run.webm`);
    console.log(`video: ${dir}/run.webm`);
  }
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
