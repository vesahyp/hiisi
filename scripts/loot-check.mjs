// Loot never covers the play area (docs/loot-ui.md). On an emulated iPhone
// in portrait and in a short landscape viewport (Safari with its bars), a
// drop that the walk-over rule leaves shows as a chip in the left column,
// the hero keeps walking, no HUD element covers the hero's part of the
// screen, a tap on the chip opens the comparison and Jätä closes it, a
// plainly better weapon is taken on the walk with a log line, and the
// technique block stays clear of the top-right buttons. Screenshots land in
// shots/loot/. Run with `make loot-check` (part of `make check`).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5196;
const dir = 'shots/loot';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed = true;
};
const box = (page, sel) => page.locator(sel).first().boundingBox();
const overlaps = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

for (const [orient, viewport] of [['portrait', devices['iPhone 15'].viewport], ['landscape', { width: 852, height: 330 }]]) {
  const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    const vw = viewport.width;
    const vh = viewport.height;
    // the hero's part of the screen: a box round where the hero is drawn
    const heroBox = { x: vw / 2 - 90, y: vh / 2 - 90, width: 180, height: 180 };
    // a still hero (no bot), so a drop stays under the feet while it is measured
    await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
    await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
    await page.waitForFunction(() => window.__sim && window.__sim.time > 0.3, null, { timeout: 15000 });
    // a worse weapon: the walk-over rule leaves it, the chip shows
    await page.evaluate(() => window.__drop('sword', 0));
    const shown = await page.waitForSelector('.lootchip', { timeout: 5000 }).then(() => true, () => false);
    if (!shown) {
      const st = await page.evaluate(() => ({ near: window.__sim.hero.near, hero: [window.__sim.hero.x, window.__sim.hero.y], drops: window.__sim.drops.map((d) => [d.kind, d.item?.kind, Math.round(d.x), Math.round(d.y), d.judged]), hands: window.__sim.hero.hands.map((h) => h && h.name.fi), log: window.__sim.log.slice(-3).map((l) => l.text) }));
      console.log('no chip:', JSON.stringify(st));
    }
    check(shown, `${orient}: a worse sword under the hero shows the chip`);
    await page.waitForTimeout(300);
    const chip = await box(page, '.lootchip');
    check(chip && !overlaps(chip, heroBox) && chip.x + chip.width <= vw / 2 - 30, `${orient}: the chip sits in the left column, off the hero (x ${Math.round(chip?.x ?? -1)}, w ${Math.round(chip?.width ?? -1)})`);
    await page.screenshot({ path: `${dir}/${orient}-chip.png` });
    for (const sel of ['.hud', '.hands', '.lootchip', '.log', '.techs', '.corner']) {
      const b = await box(page, sel);
      check(!overlaps(b, heroBox), `${orient}: ${sel} stays off the hero's part of the screen (${b ? `x ${Math.round(b.x)}..${Math.round(b.x + b.width)}, y ${Math.round(b.y)}..${Math.round(b.y + b.height)}` : 'absent'}; hero x ${heroBox.x}..${heroBox.x + heroBox.width}, y ${heroBox.y}..${heroBox.y + heroBox.height})`);
    }
    const techs = await box(page, '.techs');
    const corner = await box(page, '.corner');
    check(!overlaps(techs, corner), `${orient}: the technique block is clear of the top-right buttons`);
    const labels = await page.locator('.tech.none small').count();
    check(labels === 0, `${orient}: empty technique buttons carry no label (${labels} labels)`);
    const log = await box(page, '.log');
    if (orient === 'landscape') check(log && log.x + log.width <= vw / 2 - 30, `${orient}: the log stays in the left column (ends at x ${Math.round((log?.x ?? 0) + (log?.width ?? 0))})`);
    else check(log && log.y >= heroBox.y + heroBox.height, `${orient}: the log sits under the hero's part of the screen (y ${Math.round(log?.y ?? 0)})`);
    // the chip opens the comparison; Jätä closes it and the drop stays
    await page.locator('.lootchip').tap();
    await page.waitForSelector('.overlay.loot', { timeout: 3000 });
    await page.screenshot({ path: `${dir}/${orient}-card.png` });
    const cards = await page.locator('.overlay.loot .icard').count();
    check(cards === 2, `${orient}: the comparison shows the drop beside the hand (${cards} cards)`);
    await page.getByRole('button', { name: 'Jätä' }).tap();
    await page.waitForSelector('.overlay.loot', { state: 'detached', timeout: 3000 });
    // a plainly better weapon is taken on the walk, with a log line
    const handBefore = await page.evaluate(() => window.__sim.hero.hands[0].id);
    await page.evaluate(() => window.__drop('sword', 3));
    await page.waitForTimeout(400);
    const handAfter = await page.evaluate(() => ({ id: window.__sim.hero.hands[0].id, log: window.__sim.log.slice(-2).map((l) => l.text).join(' | ') }));
    check(handAfter.id !== handBefore && /Parempi/.test(handAfter.log), `${orient}: a plainly better sword goes to the sword hand on the walk ("${handAfter.log}")`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/${orient}-better.png` });
    // the bot walks: a drop it does not want never stops it
    await page.goto(`http://localhost:${port}/?bot=1&speed=1&lang=fi&seed=4242`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://localhost:${port}/?bot=1&speed=1&lang=fi&seed=4242`);
    await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
    await page.waitForFunction(() => window.__sim && window.__sim.time > 0.5, null, { timeout: 15000 });
    await page.evaluate(() => window.__drop('sword', 0));
    const before = await page.evaluate(() => [window.__sim.hero.x, window.__sim.hero.y]);
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => [window.__sim.hero.x, window.__sim.hero.y]);
    check(Math.hypot(after[0] - before[0], after[1] - before[1]) > 20, `${orient}: the hero keeps walking over a drop it does not take`);
    check(errors.length === 0, errors.length ? `${orient}: page errors:\n` + errors.join('\n') : `${orient}: no page errors`);
  } catch (err) {
    console.error(err);
    failed = true;
  } finally {
    await ctx.close();
  }
}
await browser.close();
server.kill();
process.exit(failed ? 1 : 0);
