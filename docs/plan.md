# Hiisi: the plan

Working name **Hiisi**. A NetHack-style action RPG for the phone, played with
Höyry's hands. Written 2026-10-22, before any game code. The mockups are at
https://vesahyp.github.io/hiisi/ and the research behind the choices in
[`research.md`](research.md).

## Name

Three short Finnish names. The working name is the first until Vesa picks.

| Name | Why |
|------|-----|
| **Hiisi** | The hill spirit of Finnish folk belief and its hill. The run is a descent into Hiisi's hill, and *hiidet* are the first enemies. |
| **Louhi** | The mistress of Pohjola in the Kalevala. *Louhia* also means to quarry, so the name says both the mine and the witch at the bottom. |
| **Manala** | The underworld. Three syllables, and it says "descent" by itself. |

## What it is

Höyry's twin-stick play on NetHack's floors: real-time fights with two
thumbs, on floors of rooms and corridors that take two to four minutes each,
with experience levels, a skill tree, and six skills that improve by use.
The weapon in the hand sets the style, so a run can be a swordsman, an
archer, a mage, an assassin, or a mix that the game names from the two
highest skills ("Liekkimiekka", "Varjojousi"). Setting: a Finnish hill, from
the root cellar through the mine to the river of Tuonela. Finnish and
English, chosen from the browser, as in Höyry.

## The core loop

1. **A floor** is a generated map of six to nine rooms, about three screens
   wide. Only the rooms you have been in are remembered; the light radius
   shows the rest. Enemies live in rooms and come when they see or hear you.
2. **A fight** is a room or a doorway. The style decides it: the arc of the
   sword at the door, the draw of the bow down a corridor, the fireball's
   circle on a pack, the backstab from the dark.
3. **Loot** drops from enemies and lies in chests: weapons, armour, rings,
   potions, scrolls. Rarity has a colour and a beam. Potions, scrolls and
   rings start unknown.
4. **The stairs** are the pause: health returns, the tree opens, the run is
   saved. Every fifth floor is a boss.
5. **Death ends the run.** The character goes to the leaderboard with depth,
   level and build name. One character at a time, saved at every stairs, so
   a run spans sessions the way a NetHack game does.

## The decisions per minute

- **Where next:** three exits, a closed door, a chest behind water, the
  stairs already seen. The minimap and the whole-floor map carry this.
- **Fight here or there:** the doorway or the open room, this pack now or
  after the potion.
- **Which hand:** two weapons are one tap apart (Höyry's swap). Sword for
  the pack at the door, bow for the witch across the room.
- **When to spend:** the two techniques on cooldown, the mana bar, the
  potion count.
- **Take, drink, drop:** the blue sword under the hiisi, the unknown potion
  at full health, what leaves the pack when it is full.
- **At the stairs:** where the point goes, and which skill the next floor
  should train.

## Skills by use and the tree, without grinding

**Six skills rise by use:** Miekka (sword), Jousi (bow), Varjo (sneaking
and the dagger), and three schools of magic, Tuli (fire), Halla (frost),
Henki (spirit). A skill gains from hits that land on an enemy that still
gives experience. A swing at a wall, a hit on a rat ten floors below you,
and a miss all give nothing (Morrowind's wall-jumping and Skyrim's iron
daggers are the failures this avoids). Enemies do not respawn, so a floor's
experience is finite and there is nothing to farm.

**The floor caps the skills.** A skill cannot pass floor + 5. On floor 3 the
cap is 8. The only way to raise a capped skill is to go down a floor. This is the
one rule that makes grinding impossible by construction, and the character
screen shows the cap beside the number.

**The tree spends character levels.** Experience gives levels, a level gives
one point. The tree has four rows (sword, bow, magic, shadow) of five nodes
each plus small side passives. A node costs a point, and the deeper nodes
require the row's use-level (Syöksy needs Miekka 6, Pyörre needs Miekka
10). So the tree can only follow what the player actually fights with: a
mage cannot buy sword techniques with hoarded points, and a swordsman who
starts shooting unlocks the bow row as the bow skill climbs. This is
NetHack's pairing of `#enhance` slots with experience levels, made visible.

**Switching is cheap.** A low skill climbs fast (a few hits per level under
5), so the cost of picking up a bow on floor 3 is one floor, and the player
can be an archer by floor 6. Tree points move freely at the stairs, so a
wrong early node is one floor's regret (the research says scarce respec is
what forces players onto build guides in Diablo 2, Path of Exile and Grim
Dawn).

## The controls on a phone

Höyry's hands, unchanged where they fit:

- **Left thumb walks.** Half a stick is a sneak: slower, a smaller light,
  unseen by an enemy whose cone you are not in.
- **Right thumb attacks.** A tap hits the nearest enemy you can see with the
  weapon in hand. A drag shows the aim and releases the attack along it:
  the sword's arc, the bow's line, the staff's landing circle. A hold is the
  weapon's second verb: the sword parries, the bow draws, the staff
  channels.
- **Two technique buttons and a potion** sit above the right thumb, with
  cooldown rings. The techniques are the active nodes from the tree.
- **The swap button** changes hands. Pick-ups show a card beside what is in
  the hand, as Höyry's gun pickup does.
- **The minimap** in the corner opens the whole floor; a tap on a room walks
  there, and the walk stops when an enemy appears (Brogue's travel).
- **Keyboard:** WASD, mouse to aim, click to attack, hold to draw or parry,
  shift to sneak, Q to swap, 1 and 2 for techniques, E to pick up, M for the
  map, I for the pack.

Enemies attack slowly enough to see and dodge, Höyry's rule, and the bot
with a person's limits (Höyry's gauntlet) stays the proof.

## The first playable slice

The slice must already be a game. It is **floors 1 to 5 of the hill,
the sword and the bow, and levelling:**

- Generated floors of rooms and corridors with doors, a chest, stairs, a
  light radius and remembered rooms, the minimap and the whole-floor map.
- Two styles: sword (arc, parry, Halkaisu, Torjunta, Syöksy) and bow (draw,
  pierce, Jännitys, Ansa, Nuolisade). The use-levels for both with the floor
  cap, and the two tree rows with their side nodes.
- Experience, levels 1 to 8, the character screen and the tree screen.
- Four enemies (hiisi, rotta, luuranko, karhu as the floor-5 boss), each
  with a telegraphed attack.
- Items: swords and bows at three rarities, a coat, healing potions and one
  unknown potion type, the pack and the card.
- Death ends the run, the stairs save it, local records; the leaderboard
  from Höyry when the loop is good.
- Both languages from the first commit, the headless sim, the bot, the
  gauntlet and Playwright shots, all on Höyry's architecture (Vite,
  TypeScript, React for menus, Canvas 2D, fixed-step sim, seeded RNG).

Code reused from Höyry where it fits: the input sticks, the HUD and card
CSS, i18n, audio, the version check, the records API and its Terraform, the
screenshot and gauntlet scripts, the sprite cache. The sim, the map
generator and the renderer are new, since floors are no longer arenas.

## Cut from the first slice

Magic and shadow (slices two and three; the mockups show them so the hands
are designed for all four from the start). Rings, scrolls and the
identification of more than one potion. Shops and coins. The remaining
bosses and floors 6 and down. The workshop meta between runs. Co-op. Portal
builds. The global leaderboard until the loop is proven.

## What Vesa decides now

1. The name.
2. Death ends the run, with a save at the stairs. The alternative is a
   persistent character with floors that reset, the Diablo shape. The plan
   assumes the roguelike shape.
3. Yes or no to building the first slice.
