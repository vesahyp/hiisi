# Loot on a phone: the rule and the chip

Written 2026-10-22 after Vesa's first playtest of Hiisi in landscape: "Loot
popups get in the way. Same issue as Höyry." The item card and its Take
button sat on the hero in the middle of the screen and stopped play. This
is the solution, written so Höyry can take it next.

## The rule

A drop under the hero is judged once, on the walk, and the walk never
stops for it (`autoTake` in `src/game/sim.ts`):

1. **A consumable joins the pack.** Potions stack. The log says what was
   taken, named by colour when the kind is unknown.
2. **A coat with more armour is worn.** The old coat goes into the pack
   when there is room, else it lies where the new one lay.
3. **A weapon goes into an empty hand**, or **in place of the same kind
   when it is plainly better**: a sixth more worth by `weaponScore`
   (average damage, rarity, an affix). The replaced weapon goes into the
   pack when there is room, else onto the floor. The active hand does not
   change, so a better sword found while holding the bow goes to the sword
   hand quietly. The log line says "Parempi: name (käsi 1)".
4. **Everything else waits as a chip.** Nothing is lost by walking past.

What makes this safe to automate: the replaced thing is never destroyed,
and a wrong automatic choice is undone in the pack sheet in two taps.

## Nothing vanishes

Every path that moves an item keeps the count (`countItems` in
`sim.ts`): a thing taken off the hero goes into the pack, or onto the
floor where the new one lay when the pack is full, and the log line says
which ("Käsi 2: Hiidenmiekka. Ruosteinen jousi reppuun."). Vesa's second
playtest read a swap into the wrong hand as the old weapon destroyed; it
had gone to the pack in silence. `sim-check` now runs every path (take
into either hand, a full pack, a coat, the pack, equip, the hands swapped,
stow, drop, drink) and asserts the count, and watches two floors of bot
play step by step for a count that falls without a potion drunk.

## The comparison

The card from the chip shows the new item, then one choice per place it
could go: hand 1 and hand 2 for a weapon, worn for a coat. Each choice
names what is there now, lists the numbers that would change with the
new value and the old beside it (green better, red worse, an affix lost
or gained as its own line), and its button says in words what the swap
does: "Vaihda käteen 2: Ruosteinen jousi reppuun". The pack sheet uses
the same choice panels, so a pack weapon into a hand is one tap after
the tap that selects it, and the hands change places with one button.

## The chip

What the rule leaves lying under the hero shows as one line in the HUD's
left column, under the two hands, outside the play area: the item's name
in its rarity colour and its numbers beside the hand it would replace
(`.lootchip` in `Game.tsx`). The chip is small, it takes only its own
touches, and the sticks keep working around it. A tap opens the full
comparison card as a paused overlay with the choices: hand 1, hand 2, the
pack, or leave it. The keyboard's E takes it into the hand of its kind
without opening anything.

## The rest of the screen

Vesa's fifth playtest set the rule for the whole screen: **the top strip
is the HUD, the bottom half is the controls, the play area round the hero
stays clear**, in both orientations.

- **The top strip.** One compact block at the left: floor, level and
  experience on a row, the health bar, the two hands as pills (icon,
  damage, the skill number; a tap on the other swaps). The last log line
  runs between that block and the right-hand buttons. The minimap, the
  sheet button and pause are small at the right. The loot chip hangs
  under the block.
- **The bottom half.** A faint dashed ring where the left thumb rests
  (the move zone, "kävele") and one under the right thumb (the attack
  zone, "lyö · pito lataa"), drawn always so a new player sees where to
  touch; they brighten while touched. The technique buttons, the potion
  and the swap sit in an arc round the attack ring, drawn as outlines
  even when empty. The real stick still starts where the thumb lands.
- **Portrait.** The camera keeps the hero in the upper part of the
  screen (15 % of the view above centre), so the controls own the bottom
  half and the hero's part of the screen stays clear.
- **Where the thumbs rest.** Vesa's sixth playtest: the rings sat too
  near the centre. Held sideways, a phone's thumbs rest about 13 % of the
  width in from the edges and low; the ring centres go there (never
  inside the notch's inset), the arc wraps the right ring on its inner
  side, and in portrait the rings sit 18 % in.
- **A charge survives walking.** A thumb down longer than a tap is a
  hold whether or not it drifts; a drift is the aim while it holds, and
  the release fires the charge along the drag. The old input dropped the
  charge on a drift of 16 px and fired a tap on the lift. `charge-check`
  holds, walks with a second touch in six directions, drifts the right
  thumb, lifts the left, and fails if the charge drops; it also asserts a
  part charge fires with that much.
- **A swap says where the old thing went** as a toast by the hands
  ("Ruosteinen nuija → reppu"), and the pack opens with that item
  selected and glowing. The pack grid is fixed-size cells, as many
  columns as fit, 54 px in a short landscape so all twelve show; a sheet
  that still scrolls shows a fade at its bottom.
- **Rotation.** iOS does not always resize a fixed body after a turn, so
  the root is sized from the live viewport on every resize, orientation
  change and visual-viewport change (twice, since iOS reports the old
  size at the moment of the event), sheets scroll to their top, and
  nothing scrolls sideways. `sheets-check` opens every sheet, turns the
  viewport and back, and fails on overflow, overlap or a cut-off header.
- **The proof.** `screen-check` asserts every element inside the safe
  area, both rings and every button in the bottom half on their own
  side, and the rings dashed before a touch; `loot-check` asserts that no
  HUD element or control covers the box round where the hero is drawn.

## Porting to Höyry

Höyry's gun pickup is the same shape: a card at top centre with a Take
button. The port is:

- `autoTake` in `sim.ts`: a gun into an empty slot, or in place of the
  same type when `gunScore` is a sixth higher; the old gun stays on the
  floor (Höyry has no pack) and the card logic goes.
- The chip under the slots, in Höyry's `.slots` column, with the full card
  as a pause overlay on tap.
- The proof: `scripts/loot-check.mjs` here, which places drops beside the
  hero through a test hook and asserts that no HUD element covers the
  hero's part of the screen in portrait or in a short landscape viewport.
