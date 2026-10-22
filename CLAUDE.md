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
    dungeon.ts          floor generation (rooms, corridors, doors, stairs),
                          tile collision, flow field, line of sight, what the
                          hero has seen
    attacks.ts          the hero's hands: the sword's arc and parry, the
                          bow's draw and arrows, the techniques, projectiles
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
public/mockups/         the design mockups and their shooter
```

## Rules

1. **The sim is headless.** Nothing under `src/game/` may touch `window`,
   `document`, React or audio. Sounds are names pushed onto `state.sounds`.
2. **Fixed step.** `DT = 1/60`. The render loop accumulates real time and
   calls `step` a whole number of times. Never pass a frame delta into `step`.
3. **Seeded RNG on the state.** UI and render code never draw from it.
4. **Content is data.** A new enemy is an `EnemyDef` in `content/enemies.ts`.
   A new node is a `NodeDef` in `content/tree.ts`; the sim reads
   `has(hero, id)` where the rule lives. A new affix is an entry in `items.ts`.
5. **Every hit goes through `hurtEnemy` or `hurtHero`** (`combat.ts`). They
   own damage, knockback, kills, experience, skill training and drops.
6. **Every enemy attack is slow enough to see.** A windup shows before a
   strike, the bear's charge draws its lane, enemy arrows fly slowly. The
   proof is `npm run gauntlet`: the human-limited bot must reach floor 3
   with either hand in most runs.
7. **Skills rise only from hits on enemies that still give experience, and
   never past the floor's cap** (`skillCap`). That is the rule that makes
   grinding impossible; do not add a way round it.
8. **The save is the top of a floor.** `nextFloor` snapshots before the
   floor spawns (`save.ts`); death clears it. Nothing mid-floor is saved.
9. **Two languages, English in the code.** Every player-facing string is
   `L(fi, en)` or `tr(fi, en)`.
10. **Nothing in the HUD covers the hero's part of the screen.** Every
    element lives in a column at an edge (`docs/loot-ui.md`); `loot-check`
    asserts it in portrait and in a short landscape viewport.
11. **Prose style:** no em dashes, no "this, not that", no metaphors.
    Commit messages in English.

## Workflow

- `make dev` (http://localhost:5173, also on the LAN for a phone).
- **Before committing:** `make check` (typecheck, build, `sim-check`,
  `gauntlet`, `loot-check`, `phone-run`) must pass. `phone-run` drives an emulated iPhone,
  so it needs `make shots-setup` once.
- **Balance with `make balance [RUNS=6] [STYLE=best|sword|bow] [WHO=bot|human]`.**
- **URL knobs:** `?seed=N` fixes the run, `?bot=1` plays the bot, `?bot=human`
  the bot with a person's limits, `?speed=3` runs the sim at three times
  real time, `?lang=en`.
- `make shots` / `make shots-en` for phone screenshots.
- Deploy is automatic: every push to `main` builds and publishes to GitHub
  Pages at https://vesahyp.github.io/hiisi/.
- When a change alters what the player sees or does, update `README.md` in
  player words.
