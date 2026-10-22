# CLAUDE.md

Guidance for AI agents working in this repo. `README.md` is the player page.
`TODO.md` is forward-looking only.

## What this is

**Hiisi** (working name) is a NetHack-style action RPG for the phone, played
like Höyry (`../hoyry`): twin-stick, phones first, Canvas 2D. Experience
levels, a skill tree, and six skills that improve by use. Bigger levels than
Höyry's arenas: floors of rooms and corridors.

**The repo is in the design phase.** There is no game code, and none is
written until Vesa says yes to `docs/plan.md`. What exists is the plan, the
research behind it, and static mockups rendered on an emulated iPhone.

## Commands

```bash
make mockups-setup   # once: install Playwright and Chromium
make mockups         # render every mockup, portrait and landscape, into mockups/shots/
make serve           # serve mockups/ on http://localhost:5190 for a phone on the LAN
make check           # the mockups render without page errors
```

Deploy is automatic: every push to `main` publishes `mockups/` to GitHub
Pages (`.github/workflows/deploy.yml`) at https://vesahyp.github.io/hiisi/.

## Layout

```
docs/
  plan.md            the one-page plan: loop, decisions, skills and tree,
                       controls, the first slice, what is cut
  research.md        what players say about the reference games, with sources
mockups/
  index.html         the gallery with the note on what the player decides per screen
  map.html           the floor view; ?full=1 opens the whole-floor map
  combat.html        a fight; ?style=sword|bow|magic|shadow
  tree.html          the skill tree
  character.html     the character sheet with the use-levels
  items.html         the pack and the item card
  scene.js           the static scene painter (tiles, light, sprites, effects)
  floors.js          the hand-laid floors the scenes are drawn on
  shared.css         the HUD and screen styles, following Höyry's styles.css
  shoot.mjs          Playwright: every page on an iPhone 15, both orientations
  shots/             the rendered PNGs, committed
```

## Rules

1. **No game code before the yes.** The mockup painter draws static scenes;
   it is not the start of the renderer. When the game starts, it starts from
   Höyry's architecture (`../hoyry/CLAUDE.md`), and the mockups stay as the
   design record.
2. **Two languages, English in the code.** Player-facing text in the mockups
   is Finnish; docs, identifiers and comments are English.
3. **Mockups are rendered by the script.** `make mockups` must pass before a commit that touches `mockups/`.
4. **Prose style:** no em dashes, no "this, not that" constructions, no
   metaphors, plain words. Commit messages in English.
