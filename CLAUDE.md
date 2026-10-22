# CLAUDE.md

Guidance for AI agents working in this repo. `README.md` is the player page:
what the game is and how to play it. Code, architecture and process notes
live here. `TODO.md` is forward-looking only.

## What this is

**Hiisi** is a NetHack-style action RPG for the browser, phones first,
played with Höyry's hands: the left thumb walks, the right thumb taps to
strike or shoot and drags to aim, a hold draws the bow or blocks with the
sword. Floors of rooms and corridors with a light radius and remembered
rooms, experience levels, a skill tree, and skills that rise by use. Death
is death. The design is in `docs/plan.md`, the player research behind it in
`docs/research.md`, and the design mockups in `public/mockups/` (published
under `/mockups/`). The architecture is Höyry's (`../hoyry`), which proved
it on a phone.

The first slice is live: floors 1 to 5, the sword and the bow, levels, the
tree's sword, bow and general rows, items, a bear on floor 5.

## Stack

- **Vite + TypeScript + React.** React renders the menus, the HUD and the
  sheets. The game itself never goes through React.
- **Canvas 2D** for the game view. No engine. Sprites are drawn once with
  canvas paths and cached as images (`src/render/sprites.ts`).
- **No physics, no ECS.** Enemies, projectiles, drops and traps are plain
  arrays of objects on `SimState`.
- **Seeded RNG** (`src/game/rng.ts`, mulberry32). One stream per run, on
  the sim state. Same seed and same input replay the same run. The stream's
  position is part of the save.

## Where things live

```
src/
  game/                 the simulation, no DOM anywhere in here
    state.ts            SimState, Hero, Enemy, HeroInput, createState
    sim.ts              newRun, startFloor, step(), nextFloor; the stairs,
                          drops under the hero, the pack, potions
    dungeon.ts          floor generation (four kinds of area: chamber, hall,
                          courtyard, cave; corridors one to three wide; doors
                          on the narrow ones; Höyry's wall stamps as
                          furniture), tile collision that slides round
                          corners, flow field, line of sight, what the hero
                          has seen
    attacks.ts          the hero's hands: the melee families' shapes and
                          effects on the release, the guard, the bow's draw
                          and arrows, the techniques, projectiles
    ai.ts               enemy behaviour: sleep, idle, chase, windup, strike,
                          the bear's charge; traps
    combat.ts           hurtEnemy, hurtHero, kills, experience, drops
    hero.ts             the hero's numbers, skills by use, levels, the tree
                          (learn, refund, the buttons)
    skills.ts           the six skills, the cap, the level curve, the build name
    items.ts            weapons x rarity x affix, coats, potions and their colours
    save.ts             the run at the top of a floor, as JSON; restore
    log.ts              the message log
    content/
      weapons.ts        the melee families: sword, axe, mace, spear, dagger,
                          flail, scythe, anchor; shape, effect, rhythm, names
      enemies.ts        the cast: numbers, windups, reach, sight
      tree.ts           every node: row, gate, chain, what it does
  render/
    renderer.ts         3/4 view, row-sorted walls, the dark, telegraphs,
                          the minimap
    sprites.ts          procedural sprite cache
  input/input.ts        two thumbs (tap, drag, hold) + mouse and keyboard
  ui/
    Game.tsx            the game loop (fixed step), HUD, pause, the sheets
    Sheets.tsx          the character, the tree, the pack, the map
    Screens.tsx         title, death, records, the guide
    Cards.tsx           the item card
    Compare.tsx         a choice: what is in that place now, the differences, the button that says what it does
  ../docs/loot-ui.md    the walk-over rule and the chip, written for Höyry too
    Guide.tsx           how to play, in words
  audio.ts              Web Audio synth, from Höyry, with Hiisi's sound names
  records.ts            local records and the saved run, localStorage
  i18n.ts               fi or en, t()/tr()/L()
tools/
  sim-check.ts          npm run sim-check: assertions on the real sim
  balance.ts            npm run balance: bot runs, one line each
  gauntlet.ts           npm run gauntlet: the human-limited bot must reach floor 3
  autoplayer.ts         the bot: BOT and HUMAN profiles, a style per hand
  dbg/                  probes for a stuck run; not part of a check
scripts/shots.mjs       make shots: Playwright, iPhone 15, the bot playing
scripts/phone-run.mjs   make phone-run: the human-limited bot on an emulated
                          iPhone at real speed, on video
scripts/loot-check.mjs  make loot-check: loot never covers the play area,
                          portrait and a short landscape
scripts/floor-shots.mjs make floor-shots: whole floors as images, three
                          seeds, floors 1, 3 and 5
scripts/screen-check.mjs make screen-check: the play screen on an iPhone
                          from the home screen (safe area stood in) and in
                          Safari; the install hint
scripts/charge-check.mjs make charge-check: a charge survives walking, a
                          drift and a second touch; a part charge fires with that much
scripts/sheets-check.mjs make sheets-check: every sheet survives a rotation
scripts/icons.mjs       make icons: the home-screen PNGs from public/icon.svg
public/mockups/         the design mockups and their shooter
```

## Rules

1. **The sim is headless.** Nothing under `src/game/` may touch `window`,
   `document`, React or audio. Sounds are names pushed onto `state.sounds`.
2. **Fixed step.** `DT = 1/60`. The render loop accumulates real time and
   calls `step` a whole number of times. Never pass a frame delta into `step`.
3. **Seeded RNG on the state.** UI and render code never draw from it.
4. **Content is data.** A new enemy is an `EnemyDef` in `content/enemies.ts`.
   A new melee family is a `Family` in `content/weapons.ts` plus its
   branch in `attacks.ts` (`release`, `updateSwing`) and its sprite; one
   skill, Lähitaistelu, trains every family, so a new weapon costs nothing
   to pick up.
   A new node is a `NodeDef` in `content/tree.ts`; the sim reads
   `has(hero, id)` where the rule lives. A new affix is an entry in `items.ts`.
5. **Every hit goes through `hurtEnemy` or `hurtHero`** (`combat.ts`). They
   own damage, knockback, kills, experience, skill training and drops.
   **Nothing vanishes:** every path that moves an item (`sim.ts`: takeInto,
   wearFrom, packFrom, equip, stow, swapHands, dropFromPack) keeps
   `countItems`, and the log says where the old thing went. `sim-check`
   asserts it path by path and over two floors of bot play.
6. **The pace starts slow and is earned.** `BASE_SPEED` is 105 px/s; the
   bow and shadow skills, a light coat, the stride node and a speed potion
   multiply it (`speedMul`), so 170, the first build's pace, is a late
   ranger's. Enemies, arrows, knockback and the lunge are set to the base
   pace; scale them with it.
7. **A hold charges, the release fires, a tap is weak.** Both hands: the
   bow draws, the sword winds up (and guards with Torjunta), for as long as
   the thumb stays down, to a cap at 1; the release fires with the charge
   (`chargeMul`: ×0.6 at a tap, ×2 at full), and the next draw or swing
   waits `NOCK` or `swingLock`. Skills and gear shorten the time to full
   (`drawMul`, `windMul`), never the cap. `sim-check` asserts the spam
   rate, the held draw, the damage curve and the cap.
8. **Every enemy attack is slow enough to see.** A windup shows before a
   strike, the bear's charge draws its lane, enemy arrows fly slowly. The
   proof is `npm run gauntlet`: the human-limited bot must reach floor 3
   with either hand in most runs.
9. **Skills rise only from hits on enemies that still give experience, and
   never past the floor's cap** (`skillCap`). That is the rule that makes
   grinding impossible; do not add a way round it.
10. **The save is the top of a floor.** `nextFloor` snapshots before the
   floor spawns (`save.ts`); death clears it. Nothing mid-floor is saved.
11. **Two languages, English in the code.** Every player-facing string is
   `L(fi, en)` or `tr(fi, en)`.
12. **A body never catches on a corner.** `moveCircle` slides along walls
    and nudges round door frames and wall ends; `sim-check` pushes a body
    diagonally into corners and doorways and fails if it stops. Corridors
    are one to three tiles wide; areas are open enough to kite in.
13. **Nothing in the HUD covers the hero's part of the screen.** Every
    element lives in a column at an edge (`docs/loot-ui.md`); `loot-check`
    asserts it in portrait and in a short landscape viewport.
14. **Prose style:** no em dashes, no "this, not that", no metaphors.
    Commit messages in English.

## Workflow

- `make dev` (http://localhost:5173, also on the LAN for a phone).
- **Before committing:** `make check` (typecheck, build, `sim-check`,
  `gauntlet`, `loot-check`, `screen-check`, `charge-check`, `sheets-check`,
  `phone-run`) must pass. `phone-run` drives an emulated iPhone,
  so it needs `make shots-setup` once.
- **Balance with `make balance [RUNS=6] [STYLE=best|sword|bow] [WHO=bot|human]`.**
- **URL knobs:** `?seed=N` fixes the run, `?safe=l,r,t,b` stands in the
  iPhone's safe area, `?standalone=0|1` forces the install hint on or off, `?bot=1` plays the bot, `?bot=human`
  the bot with a person's limits, `?speed=3` runs the sim at three times
  real time, `?lang=en`.
- `make shots` / `make shots-en` for phone screenshots.
- Deploy is automatic: every push to `main` builds and publishes to GitHub
  Pages at https://vesahyp.github.io/hiisi/.
- When a change alters what the player sees or does, update `README.md` in
  player words.
