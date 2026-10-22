# Research: what players say about the reference games

Written 2026-10-22 for the design in `plan.md`. Sources are player reviews,
forums and wikis. Reddit blocked the fetches, so the quotes come from Steam
reviews and forums, Crate and Chillyroom forums, UESP, the NetHack and Brogue
wikis, and reviewer sites. Lines marked (inferred) are my reading of the
mechanics with no player quote behind them.

## NetHack

- **Decides minute to minute:** fight or retreat (and engrave Elbereth); which
  unknown item to try and how; which skill to `#enhance`; when to pray or
  spend an escape item; which way to go. (inferred from the
  [emergency page](https://nethackwiki.com/wiki/Things_To_Do_If_You%27re_Going_to_Die_Next_Turn))
- **Progression:** skills train by use, but a slot to raise one opens only
  with an experience level, and a role's unusable skills stay capped
  ([Skill](https://nethackwiki.com/wiki/Skill)). So "use" and "level" gate
  each other. That pairing is the core of this design.
- **Identification is loved and hated:** "saving yourself with some
  unidentified item feels amazing", and price identification is "the worst
  offender", "uninteresting and tedious" once learned
  ([Golden Krone Hotel](https://www.goldenkronehotel.com/wp/2017/06/25/things-i-hate-about-roguelikes-part-2-identification/)).
- **Grinding:** pudding farming on a permanent Elbereth is the wiki's own
  example of "greatly increasing your boredom"
  ([Fun](https://nethackwiki.com/wiki/Fun)).
- **Touch:** iNetHack was "rough around the edges" with no zoom; the ports pan
  by swipe. No touch version is praised.
- **Copy:** the unknown item used in desperation. **Avoid:** price-ID rituals
  and any farmable loop.

## Brogue

- **No XP at all.** Growth is enchant scrolls and potions. "Pouring everything
  into a single item can make it obscenely powerful, but leave you lacking in
  other areas" ([GamingOnLinux](http://www.gamingonlinux.com/2018/03/confessions-of-a-brogue-junkie)).
  Rationing "creates strategic dilemmas not found in other roguelikes"
  ([Waltorious](https://waltoriouswritesaboutgames.com/2011/10/26/roguelike-highlights-brogue/)).
- **No grind because killing gives nothing.** Failure: an early commitment to
  the wrong item can lose the run.
- **Screen:** the sidebar shows hit chances on hover; auto-explore stops when
  an enemy appears. Click-to-travel praised.
- **Copy:** few, visible, permanent choices; odds shown on tap. **Avoid:**
  waiting 1000 turns to auto-identify worn gear.

## Caves of Qud

- **Progression:** attribute points at creation, mutation points at level-up,
  skills bought from a tree. Some stats are traps: Will and Ego are "basically
  a dump stat" without mental mutations
  ([Steam](https://steamcommunity.com/app/333640/discussions/0/3563973712299295643)).
  Combat gets "too easy" near level 30
  ([RPG Codex](https://rpgcodex.net/content.php?id=12491)).
- **UI:** "a cryptic, keyboard-heavy user interface" that "rewards the effort"
  ([Matt Keeter](https://mattkeeter.com/blog/2025-12-29-qud)); the 2024 UI
  overhaul added full controller support.
- **Copy:** several ways to solve a room. **Avoid:** dead picks on the sheet;
  choices whose effect is not shown before purchase.

## Diablo 2

- **Skill tree:** synergies reward spending early ("players are rewarded for
  using skill points earlier rather than hoarding them",
  [Battle.net](https://classic.battle.net/diablo2exp/skills/basics.shtml)).
  Respec is scarce: three free per character, then a Token of Absolution
  from four Hell bosses, so players lean on build guides.
- **Loot:** "a single drop can overhaul the way your character plays"
  (Steam review). Potions still do not stack.
- **Touch (Diablo Immortal):** auto-aim to the nearest enemy, hold a skill to
  aim by hand. "It's just too difficult to aim complicated attacks in the
  middle of a fight using only touchscreen controls"; "My thumb is constantly
  going numb" ([Den of Geek](https://www.denofgeek.com/games/diablo-immortal-control-options-supported-controllers-mouse-keyboard)).
- **Copy:** a drop that changes the build; cheap early synergies. **Avoid:**
  scarce respec; a cluttered skill overlay.

## Path of Exile

- **The passive tree** "can drastically change your character's build", and
  the same beginner guide says to follow a build guide and "not deviate from
  it" ([Maxroll](https://maxroll.gg/poe/getting-started/passive-skill-tree-for-beginners)).
  PoE 2 respec is gold per point and grows with depth.
- **Loot filter** is the most important quality-of-life feature; "playing
  without a filter will chip away at your sanity" (Steam review).
- **Controller:** ranged builds work, spellcasters need precise targeting
  ([Steam](https://steamcommunity.com/app/2694490/discussions/0/596260925367912393)).
- **Copy:** loot that announces itself (beam, sound). **Avoid:** a tree that
  needs an outside guide.

## Grim Dawn

- **Dual mastery:** "combine classes generates dozens of build combinations";
  mastery picks cannot be refunded, skill respec costs rise each time
  ([Crate forum](https://forums.crateentertainment.com/t/is-a-full-respec-possible-masteries-stats-and-devotion/30102)).
- **Controller:** "a huge improvement", but "targeting with the red triangles
  is a lot less precise", and the map is "a bit of a pain during gameplay"
  ([Crate forum](https://forums.crateentertainment.com/t/feedback-controller-functionality/43141)).
- **Copy:** two masteries combined. **Avoid:** permanent picks; affix
  clutter on items.

## The Elder Scrolls (skills by use)

- **Morrowind:** misses give nothing; "walking mostly levels acrobatics and
  athletics"; falling damage "grants massive amounts of experience" to
  Acrobatics ([UESP](https://content1.uesp.net/wiki/Morrowind:Acrobatics)).
  Players swim into corners to train Athletics.
- **Oblivion:** enemies scale to level, so players kept the skills they used
  as minors to avoid levelling; "you won't have the equipment or learned
  spells yet to do much damage"
  ([Steam](https://steamcommunity.com/app/2623190/discussions/0/604154270792642370/)).
- **Skyrim:** flat 25 XP per crafted item, so "it usually is of greater
  benefit to craft many cheap items than few valuable items"
  ([UESP](https://en.uesp.net/wiki/Skyrim:Smithing)): the iron dagger grind.
  Perk trees gate on skill level and give the choices; a modder's complaint
  is that the forced perks ("armsman") leave no points for the interesting
  ones.
- **The lesson:** count only hits on enemies that still give XP. A skill
  choice must not raise enemy strength.

## Dungeon Siege

- Four skills (melee, ranged, nature magic, combat magic), levelled by use.
  "There are a limited amount of enemies in the game and ultimately a
  limited amount of XP", so "it is generally best to pick one skill and
  specialize"; "melee tends to earn the most experience, so other classes
  fall behind" ([Steam](https://steamcommunity.com/app/39190/discussions/0/558748822109927848)).
  Switching mid-game was punished because the new skill started at zero
  against enemies tuned for the old one.
- GameSpot called the system shallower than Diablo II's trees.
- **The lesson:** a late switch needs a catch-up rate, and the skill number
  must gate what you can do (the tree), not only the damage you deal.

## Vampire Survivors

- Movement only; "the player choice and control comes in the form of
  choosing when and how to move around"
  ([Steam](https://steamcommunity.com/app/1794680/discussions/0/595141473937133142)).
- The level-up pick every 20 seconds: "the options you decline will probably
  show up again in the next few minutes anyway", upgrading "is more on
  auto-pilot" ([Substack](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors)).
- Touch: "perfect for portable and portrait play with your thumb"
  ([TouchArcade](https://toucharcade.com/2022/12/09/vampire-survivors-mobile-review-controller-cloud-save-sync-dlc-unlock-iphone-ipad-pro/));
  "unreliable controls easily become the main enemy" when the crowd grows
  ([PocketGamer](https://www.pocketgamer.com/vampire-survivors/review)).
- **Copy:** a quick pick with real branches. **Avoid:** a pick that returns
  if declined.

## Soul Knight

- Twin-stick with auto-aim: "Targeting is done completely automatically",
  rooms gate the fight, class skills recharge fast
  ([TouchArcade](https://toucharcade.com/?p=212191)). Complaints: shops sell
  duplicates, runs "become a bit too repetitive", a third moving thing on
  screen makes "figuring out who to shoot at a little confusing".
- **Copy:** rooms as fight units, auto-aim first. **Avoid:** repetition
  without build change.

## What the design takes from this

1. **Use and level gate each other** (NetHack): use-levels rise from hits on
   enemies that still give experience; the tree's nodes cost level points and
   require use-levels. Neither alone makes a build.
2. **No farmable loop** (Elder Scrolls, NetHack): enemies do not respawn, a
   floor's experience is finite, a hit on a weak enemy trains nothing, and a
   use-level cannot pass the floor's cap. A capped skill rises only on the next floor.
3. **Switching is cheap** (Dungeon Siege, Diablo 2, Grim Dawn): low
   use-levels climb fast, and tree points can be moved at the stairs.
4. **One unknown item at a time** (NetHack, Brogue): potions, scrolls and
   rings start unknown; drinking is the identification. No price-ID.
5. **Auto-aim first, drag to aim** (Soul Knight, Diablo Immortal, Höyry).
6. **Loot announces itself** (PoE, Diablo): rarity colour and a beam.
7. **The screen shows odds and effects before the choice** (Brogue, Qud).
