// The floors the mockups are drawn on. Hand-laid rooms and corridors; the
// game will generate its own.

// Floor 3 of the hill: nine rooms, a water cellar, two sets of stairs.
export const FLOOR3 = {
  cols: 56, rows: 44,
  rooms: [
    [4, 4, 8, 6],     // 0 the arrival, stairs up
    [18, 3, 10, 7],   // 1
    [34, 5, 9, 6],    // 2
    [6, 16, 7, 8],    // 3 the water cellar
    [20, 15, 12, 10], // 4 the hall, where the hero stands
    [38, 16, 10, 8],  // 5 the chest room
    [10, 30, 10, 8],  // 6
    [26, 30, 9, 7],   // 7
    [40, 30, 11, 9],  // 8 stairs down
  ],
  corridors: [
    [[12, 7], [18, 7]], [[28, 6], [34, 6]], [[23, 10], [23, 15]], [[8, 10], [8, 16]],
    [[13, 20], [20, 20]], [[32, 19], [38, 19]], [[39, 11], [39, 16]], [[28, 25], [28, 30]],
    [[10, 24], [10, 30]], [[20, 34], [26, 34]], [[35, 33], [40, 33]], [[45, 24], [45, 30]],
  ],
  doors: [[12, 7], [23, 14], [19, 20], [37, 19], [28, 29], [45, 29]],
  water: [[7, 18, 5, 4]],
  traps: [[23, 12]],
  up: [6, 6],
  down: [48, 36],
};

// A cave room for the combat scenes: one hall, a corridor in
// from the left and a door on the right.
export const CAVE = {
  cols: 40, rows: 30,
  rooms: [[12, 9, 16, 12], [2, 13, 6, 4], [32, 12, 6, 6], [15, 24, 10, 4]],
  corridors: [[[8, 15], [12, 15]], [[28, 15], [32, 15]], [[20, 21], [20, 24]]],
  doors: [[31, 15], [20, 23]],
  lit: [[12, 9, 16, 12]],
  down: [36, 16],
};
