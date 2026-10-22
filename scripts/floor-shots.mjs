// Whole floors as images: for three seeds and floors 1, 3 and 5, the run is
// started, the floor revealed through the test hook, and the map sheet
// screenshotted in landscape, plus one in-game shot of the floor's first
// area. Into shots/floors/. Run with `make floor-shots`.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5195;
const dir = 'shots/floors';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 852, height: 393 }, hasTouch: true });
const page = await ctx.newPage();
const seeds = (process.argv[2] ?? '11,23,37').split(',').map(Number);
for (const seed of seeds) {
  for (const floor of [1, 3, 5]) {
    await page.goto(`http://localhost:${port}/?lang=fi&seed=${seed}`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://localhost:${port}/?lang=fi&seed=${seed}`);
    await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
    await page.waitForFunction(() => window.__sim && window.__sim.time > 0.2, null, { timeout: 15000 });
    // jump to the floor the way the stairs would
    await page.evaluate((f) => {
      const s = window.__sim;
      while (s.floor < f) {
        s.floor++;
        s.dungeon = window.__gen(s.seed, s.floor);
        window.__start(s);
      }
      window.__reveal();
    }, floor);
    await page.waitForTimeout(200);
    if (floor === 1) await page.screenshot({ path: `${dir}/seed-${seed}-floor-1-play.png` });
    await page.keyboard.press('m');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/seed-${seed}-floor-${floor}-map.png` });
    console.log(`seed ${seed} floor ${floor}`);
  }
}
await browser.close();
server.kill();
