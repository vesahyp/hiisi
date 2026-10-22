// Renders every mockup on an emulated iPhone 15, portrait and landscape,
// into mockups/shots/. Run `make mockups-setup` once, then `make mockups`.
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import { createServer } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'shots');
mkdirSync(out, { recursive: true });

export const SHOTS = [
  ['map', 'map.html', 'Kerros: tutkiminen, valo ja sumu, pienoiskartta'],
  ['map-full', 'map.html?full=1', 'Koko kerroksen kartta avattuna'],
  ['combat-sword', 'combat.html?style=sword', 'Taistelu miekalla'],
  ['combat-bow', 'combat.html?style=bow', 'Taistelu jousella'],
  ['combat-magic', 'combat.html?style=magic', 'Taistelu taialla'],
  ['combat-shadow', 'combat.html?style=shadow', 'Taistelu varjossa'],
  ['tree', 'tree.html', 'Taitopuu'],
  ['character', 'character.html', 'Hahmo ja taitojen tasot'],
  ['items', 'items.html', 'Reppu ja esinekortti'],
];

// ES modules do not load from file://, so serve the folder for the run.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = resolve(here, '.' + (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  try { res.setHeader('content-type', types[extname(path)] || 'application/octet-stream'); res.end(readFileSync(path)); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const errors = [];
for (const [orient, viewport] of [['portrait', null], ['landscape', { width: 852, height: 393 }]]) {
  const ctx = await browser.newContext({ ...devices['iPhone 15'], hasTouch: true, ...(viewport ? { viewport } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${orient}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${orient}: ${m.text()}`));
  for (const [name, file] of SHOTS) {
    await page.goto(base + file);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${name}-${orient}.png` });
    console.log(`${name}-${orient}.png`);
  }
  await ctx.close();
}
await browser.close();
server.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }
