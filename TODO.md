# TODO

Forward-looking only. Shipped items are deleted; git history is the record.
The design is in `docs/plan.md`.

## Next

- Playtest by hand on a phone. The bot clears the slice; a person has to
  say whether the sword and the bow feel different enough, and whether a
  windup reads in time on a small screen.
- Stamina and the melee rhythms: play each family by hand and tune the
  numbers in `content/weapons.ts` (`windup`, `recover`, `cost`) and the
  refill rates in `attacks.ts`. Decide whether the bow's draw should
  spend stamina too.
- A drawn guide, as in Höyry: every control with its own element.
- The bear: the bot wins against it almost every time. Decide by hand
  whether the charge needs a second pattern.

## Slice two: magic

Staffs as the third hand kind, mana, the fire school (Tulipallo,
Liekkiseinä), the frost school (Hallanuoli), the spirit school (Suoja,
Henkiapuri). The tree's magic row opens. Enemies: the frost witch.

## Slice three: shadow

Sneaking on half a stick, sight cones, the dagger and the backstab, smoke,
poison. The tree's shadow row opens.

## Later

- Floors 6 and down, more bosses, a floor theme each.
- Rings and scrolls, with the same unknown-until-used rule as potions.
- The global leaderboard, copied from Höyry (`docs/adr/0002` there).
- The workshop meta between runs.
- Co-op on one phone.
