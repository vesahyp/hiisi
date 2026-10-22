// The play screen on an emulated iPhone 15 in landscape, two ways, after
// Linko's screen check:
//   home-screen: the whole 852x393 screen, as the game runs when added to
//     the home screen, with the iPhone's safe area stood in (?safe=59,59,0,21:
//     the notch side, the other side, the top, the home bar; Chromium's
//     emulation has no notch of its own);
//   safari: Playwright's iPhone 15 landscape preset, 734x343, what Safari
//     leaves a page beside its bars.
// Checks that the canvas covers the whole screen and that every HUD element
// (the HUD, the hands, the corner buttons, the technique block, the log) sits
// inside the safe area, and that the title in Safari shows the install hint.
// `make screen-check` (needs `make shots-setup`); writes shots/screen/.
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const OUT = 'shots/screen';
const SAFE = { l: 59, r: 59, t: 0, b: 21 };
const port = 5194;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed = true;
};
const browser = await chromium.launch();
const phone = devices['iPhone 15 landscape'];
const cases = [
  { name: 'home-screen', ctx: { ...phone, viewport: { width: 852, height: 393 }, screen: { width: 852, height: 393 } }, safe: SAFE, standalone: true },
  { name: 'safari', ctx: phone, safe: { l: 0, r: 0, t: 0, b: 0 }, standalone: false },
];
try {
  for (const c of cases) {
    const ctx = await browser.newContext({ ...c.ctx, hasTouch: true });
    const page = await ctx.newPage();
    const S = c.safe;
    await page.goto(`http://localhost:${port}/?lang=fi&seed=7&safe=${S.l},${S.r},${S.t},${S.b}&standalone=${c.standalone ? 1 : 0}`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://localhost:${port}/?lang=fi&seed=7&safe=${S.l},${S.r},${S.t},${S.b}&standalone=${c.standalone ? 1 : 0}`);
    await page.screenshot({ path: `${OUT}/${c.name}-title.png` });
    const hint = await page.locator('.install').count();
    check(c.standalone ? hint === 0 : hint === 1, c.standalone ? `${c.name}: no install hint once installed` : `${c.name}: the title tells how to add to the home screen`);
    await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
    await page.waitForFunction(() => window.__sim && window.__sim.time > 0.5, null, { timeout: 20000 });
    await page.screenshot({ path: `${OUT}/${c.name}-play.png` });
    const r = await page.evaluate(() => {
      const cv = document.querySelector('.game > canvas');
      const b = cv.getBoundingClientRect();
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const q = el.getBoundingClientRect();
        return { l: q.left, r: q.right, t: q.top, b: q.bottom };
      };
      return { vw: innerWidth, vh: innerHeight, cw: b.width, ch: b.height, hud: box('.hud'), corner: box('.corner'), ctl: box('.ctl .tech.t1'), swap: box('.ctl .swapbtn'), potion: box('.ctl .potion'), move: box('.zone.move .ring'), attack: box('.zone.attack .ring'), log: box('.log') };
    });
    console.log(`${c.name}: screen ${r.vw}x${r.vh}, canvas ${r.cw}x${r.ch}`);
    check(Math.round(r.cw) === r.vw && Math.round(r.ch) === r.vh, `${c.name}: the canvas covers the whole screen`);
    for (const [name, q] of Object.entries({ hud: r.hud, corner: r.corner, technique: r.ctl, swap: r.swap, potion: r.potion, 'move ring': r.move, 'attack ring': r.attack, log: r.log })) {
      if (!q) continue;
      const inside = q.l >= S.l - 0.5 && q.r <= r.vw - S.r + 0.5 && q.t >= S.t - 0.5 && q.b <= r.vh - S.b + 0.5;
      check(inside, `${c.name}: ${name} sits inside the safe area (x ${Math.round(q.l)}..${Math.round(q.r)}, y ${Math.round(q.t)}..${Math.round(q.b)})`);
    }
    // the bottom half is the controls: the rings sit in it, left and right, and the arc stays right of the middle
    check(r.move && (r.move.t + r.move.b) / 2 > r.vh / 2 && r.move.r < r.vw / 2, `${c.name}: the move ring sits in the bottom left quarter`);
    const mc = (r.move.l + r.move.r) / 2;
    const ac = (r.attack.l + r.attack.r) / 2;
    check(mc <= Math.max(0.16 * r.vw, S.l + 60) && r.vw - ac <= Math.max(0.16 * r.vw, S.r + 60), `${c.name}: the ring centres sit where the thumbs rest, within 16 % of the width from the edges (${Math.round((100 * mc) / r.vw)} % and ${Math.round((100 * (r.vw - ac)) / r.vw)} %)`);
    check(r.attack && (r.attack.t + r.attack.b) / 2 > r.vh / 2 && r.attack.l > r.vw / 2, `${c.name}: the attack ring sits in the bottom right quarter`);
    check([r.ctl, r.swap, r.potion].every((q) => q && q.l >= r.vw / 2 - 1), `${c.name}: every button stays right of the middle`);
    check([r.ctl, r.swap, r.potion].every((q) => q && (q.t + q.b) / 2 >= r.vh / 2 - 4), `${c.name}: every button sits in the bottom half (technique centre y ${Math.round((r.ctl.t + r.ctl.b) / 2)} of ${r.vh})`);
    // the rings are drawn before any touch
    const faint = await page.evaluate(() => getComputedStyle(document.querySelector('.zone.move .ring')).borderStyle);
    check(faint === 'dashed', `${c.name}: the control rings show as outlines before a touch`);
    await ctx.close();
  }
  console.log(`${OUT}/home-screen-play.png, ${OUT}/safari-play.png`);
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
