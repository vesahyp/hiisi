// Every sheet survives a rotation. On an emulated iPhone each of the
// sheets (pack, character, tree, map, the loot comparison, pause, the
// title, death) is opened in portrait, the viewport turned to landscape
// and back, and after each turn: no horizontal overflow anywhere, every
// element inside the viewport, the sheet scrolled to its top, and no two
// panels or cells overlapping. `make sheets-check` (part of `make check`).
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = 5190;
const dir = 'shots/sheets';
mkdirSync(dir, { recursive: true });
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
let failed = false;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failed = true;
};
const PORTRAIT = { width: 393, height: 852 };
const LANDSCAPE = { width: 852, height: 393 };
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: PORTRAIT, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const audit = async (name, orient) => {
  const r = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const sheet = document.querySelector('.overlay, .screen');
    const out = { vw, vh, docScrollW: document.scrollingElement.scrollWidth, sheetScrollW: sheet ? sheet.scrollWidth : 0, sheetClientW: sheet ? sheet.clientWidth : 0, sheetScrollTop: sheet ? sheet.scrollTop : 0, outside: [], overlaps: [] };
    const els = [...document.querySelectorAll('.overlay *, .screen *')].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
    for (const el of els) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > vw + 1 || b.left < -1) out.outside.push(`${el.className || el.tagName} x ${Math.round(b.left)}..${Math.round(b.right)}`);
    }
    const boxes = (sel) => [...document.querySelectorAll(sel)].map((el) => ({ el: el.className, b: el.getBoundingClientRect() })).filter((x) => x.b.width > 0);
    const ov = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    for (const sel of ['.panel', '.cell', '.choice', '.btn', '.icard']) {
      const list = boxes(sel);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (ov(list[i].b, list[j].b)) out.overlaps.push(`${sel} ${i} and ${j}`);
    }
    const head = document.querySelector('.sheethead, .overlay h2, .screen h1, .screen h2');
    out.headTop = head ? head.getBoundingClientRect().top : 0;
    return out;
  });
  check(r.docScrollW <= r.vw + 1 && r.sheetScrollW <= r.sheetClientW + 1, `${name}, ${orient}: no horizontal scroll (page ${r.docScrollW}/${r.vw}, sheet ${r.sheetScrollW}/${r.sheetClientW})`);
  check(r.outside.length === 0, `${name}, ${orient}: every element inside the viewport${r.outside.length ? ': ' + r.outside.slice(0, 3).join('; ') : ''}`);
  check(r.overlaps.length === 0, `${name}, ${orient}: no panels, cells or buttons overlap${r.overlaps.length ? ': ' + r.overlaps.slice(0, 3).join('; ') : ''}`);
  check(r.headTop >= -1 && r.sheetScrollTop <= 1, `${name}, ${orient}: the sheet starts at its top (header at y ${Math.round(r.headTop)})`);
};

const rotateAndAudit = async (name) => {
  await page.waitForTimeout(150);
  await audit(name, 'portrait');
  await page.setViewportSize(LANDSCAPE);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/${name}-landscape.png` });
  await audit(name, 'landscape');
  await page.setViewportSize(PORTRAIT);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/${name}-portrait.png` });
  await audit(name, 'portrait again');
};

try {
  await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://localhost:${port}/?lang=fi&seed=4242`);
  await rotateAndAudit('title');
  await page.getByRole('button', { name: 'Pelaa', exact: true }).tap();
  await page.waitForFunction(() => window.__sim && window.__sim.time > 0.3, null, { timeout: 15000 });
  // a few items in the pack, a point in hand
  await page.evaluate(() => {
    const s = window.__sim;
    for (const k of ['axe', 'mace', 'bow', 'spear']) s.hero.pack.push(window.__roll(k, 2, 1));
    s.hero.points = 2;
  });
  for (const [key, name] of [['i', 'pack'], ['c', 'character'], ['t', 'tree'], ['m', 'map']]) {
    await page.keyboard.press(key);
    await page.waitForSelector('.overlay.sheet', { timeout: 3000 });
    await rotateAndAudit(name);
    await page.keyboard.press(key);
    await page.waitForSelector('.overlay.sheet', { state: 'detached', timeout: 3000 });
  }
  await page.evaluate(() => window.__drop('sword', 0));
  await page.waitForSelector('.lootchip', { timeout: 5000 });
  await page.locator('.lootchip').tap();
  await page.waitForSelector('.overlay.loot', { timeout: 3000 });
  await rotateAndAudit('comparison');
  await page.getByRole('button', { name: 'Jätä lattialle' }).tap();
  await page.keyboard.press('Escape');
  await page.waitForSelector('.overlay', { timeout: 3000 });
  await rotateAndAudit('pause');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const s = window.__sim;
    s.hero.hp = 0;
    s.hero.alive = false;
    s.gameOver = true;
  });
  await page.waitForSelector('.screen', { timeout: 10000 });
  await rotateAndAudit('death');
  check(errors.length === 0, errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
