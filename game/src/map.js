// map.js — the museum floor plan and every spawn on it.
// Legend: # wall  . floor  d duct (walkable, blocks sight, slow, silent with cutter)
//         S thief start  X exit  1/2/3 guards  a/b/c cameras
//         L display case  B bonds  V vault (must be cracked on the pad)
import { TILE } from './constants.js';

export const MAP_ROWS = [
  '################################',
  '#S.....#........a......#.......#',
  '#......#..##########..#........#',
  '#..1...#..#........#..#...2....#',
  '#......d..#..L.....#..d........#',
  '#......#............#..#.......#',
  '#......#..##########..#........#',
  '#............................X.#',
  '#.....#....b..........#........#',
  '#..d..#..######.......#...c....#',
  '#..d..#..#....#.......#........#',
  '#..d..#....B..#.......#........#',
  '#..d..#..#....#.......#........#',
  '#..d..#..######.......#...L....#',
  '#.....#...............#........#',
  '#.....#..3.......V....#........#',
  '#.....#...............#........#',
  '################################',
];

// Patrols are pairs of tiles the guard walks between (tile coords).
const PATROLS = [
  [ [5, 4],  [5, 15] ],    // guard 1 — west wing, one long beat down the far column
  [ [26, 3], [27, 6] ],    // guard 2 — east gallery, diagonal beat
  [ [10, 15], [18, 15] ],  // guard 3 — vault room, long beat straight over the pad
];

// Which way each camera stares when the run starts (down = π/2, left = π).
const CAMERA_FACING = { a: Math.PI / 2, b: Math.PI / 2, c: Math.PI };

export function buildLevel() {
  const wall = [], duct = [];
  let spawn = null, exit = null;
  const guards = [], cameras = [], loot = [];
  MAP_ROWS.forEach((row, r) => {
    wall[r] = []; duct[r] = [];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      wall[r][c] = ch === '#';
      duct[r][c] = ch === 'd';
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      if (ch === 'S') spawn = { x, y };
      else if (ch === 'X') exit = { x, y };
      else if ('123'.includes(ch)) {
        const [a, b] = PATROLS[Number(ch) - 1];
        guards.push({ id: ch, x, y, a, b, heading: a, face: Math.PI / 2, reactTimer: 0 });
      } else if ('abc'.includes(ch)) {
        cameras.push({ id: ch, x, y, base: CAMERA_FACING[ch], phase: 0 });
      } else if (ch === 'L') loot.push({ kind: 'case', x, y, taken: false });
      else if (ch === 'B') loot.push({ kind: 'bonds', x, y, taken: false });
      else if (ch === 'V') loot.push({ kind: 'vault', x, y, taken: false, progress: 0 });
    }
  });
  return { wall, duct, spawn, exit, guards, cameras, loot };
}

export const tileAt = (level, tx, ty) => {
  if (ty < 0 || ty >= level.wall.length || tx < 0 || tx >= level.wall[0].length) return '#';
  if (level.wall[ty][tx]) return '#';
  return level.duct[ty][tx] ? 'd' : '.';
};
export const isDuct = (level, tx, ty) => tileAt(level, tx, ty) === 'd';
