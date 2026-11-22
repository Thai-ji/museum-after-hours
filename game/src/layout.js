// layout.js — the three floors of the museum, as plain text, plus the loader
// that turns a floor's grid into walls, vents, wardens, cameras and loot.
//
// Grid legend, one char per cell:
//   #  wall            .  open marble
//   ~  air duct (walkable, blocks sight, slow, silent)
//   S  service door the burglar enters by
//   X  stairs down / the way out
//   1 2 3  wardens, tied to BEATS[i]
//   a b  cameras, gazing where GAZE says
//   L  display case, G  gem pedestal, V  the vault safe
import { CELL, GRID_W, GRID_H } from './tuning.js';

// Each warden walks the two tiles of its beat, back and forth. Each camera
// rests its gaze on GAZE.a / GAZE.b (radians: 0 = east, PI/2 = south).
export const FLOORS = [
  {
    id: 'gallery',
    name: 'Floor 1 · The Long Gallery',
    grid: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#....1.......a.......G........X#',
      '#........########..............#',
      '#........#......#..............#',
      '#........~......~.....L........#',
      '#........#......#..............#',
      '#........########..............#',
      '#..............................#',
      '#.......2..........b...........#',
      '#..............................#',
      '#....##########................#',
      '#.........................3....#',
      '#..............................#',
      '#.S............................#',
      '#..............................#',
      '################################',
    ],
    BEATS: [[[5, 3], [20, 3]], [[8, 10], [24, 10]], [[26, 13], [26, 16]]],
    GAZE: { a: Math.PI / 2, b: 0 },
  },
  {
    id: 'stacks',
    name: 'Floor 2 · The Stacks',
    grid: [
      '################################',
      '#...............a..............#',
      '#.......#.............#........#',
      '#.......#...1.........#........#',
      '#.......#.............#........#',
      '#.......#......................#',
      '#.......#..L...................#',
      '#..............................#',
      '#.......~.............~........#',
      '#.......#.............#........#',
      '#.......#.............#.b......#',
      '#.......#.............#...G....#',
      '#.......#...2.........#........#',
      '#.......#.............#....3...#',
      '#..............................#',
      '#..S...........................#',
      '#...........................X..#',
      '################################',
    ],
    BEATS: [[[12, 3], [12, 10]], [[12, 12], [20, 12]], [[27, 13], [27, 16]]],
    GAZE: { a: Math.PI / 2, b: Math.PI },
  },
  {
    id: 'vault',
    name: 'Floor 3 · The Vault Court',
    grid: [
      '################################',
      '#..............................#',
      '#..S....1......................#',
      '#..............................#',
      '#.........a..............G.....#',
      '#...............2..............#',
      '#..............................#',
      '#............##########........#',
      '#............#......#....3.....#',
      '#............#.....b~..........#',
      '#............#......#..........#',
      '#............D......#..........#',
      '#............#..V...#..........#',
      '#............#......#..........#',
      '#............##########........#',
      '#..............................#',
      '#.............................X#',
      '################################',
    ],
    // 'D' is the vault door tile: a locked wall until the safe is emptied.
    BEATS: [[[8, 2], [8, 13]], [[16, 5], [4, 5]], [[25, 8], [25, 16]]],
    GAZE: { a: Math.PI / 2, b: Math.PI },
  },
];

export const FLOOR_COUNT = FLOORS.length;

const LOOT_CHARS = { L: 'case', G: 'gem', V: 'vault' };
const center = (tx, ty) => ({ x: tx * CELL + CELL / 2, y: ty * CELL + CELL / 2 });

export function loadFloor(index) {
  const plan = FLOORS[index];
  const walls = [], vents = [];
  let entry = null, stairs = null, door = null;
  const wardens = [], cameras = [], loot = [];
  plan.grid.forEach((row, ty) => {
    walls[ty] = []; vents[ty] = [];
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      const lockedDoor = ch === 'D';           // vault door: a wall for now
      walls[ty][tx] = ch === '#' || lockedDoor;
      vents[ty][tx] = ch === '~';
      const at = center(tx, ty);
      if (ch === 'D') door = { tx, ty, ...at };
      if (ch === 'S') entry = at;
      else if (ch === 'X') stairs = at;
      else if (ch >= '1' && ch <= '3') {
        const beat = plan.BEATS[Number(ch) - 1];
        wardens.push({ mark: ch, ...at, beat, step: 0 });
      } else if (ch === 'a' || ch === 'b') {
        cameras.push({ mark: ch, ...at, gaze: plan.GAZE[ch] });
      } else if (LOOT_CHARS[ch]) {
        loot.push({ kind: LOOT_CHARS[ch], ...at, gone: false, worked: 0 });
      }
    }
  });
  return {
    id: plan.id, name: plan.name, index,
    walls, vents, entry, stairs, door, wardens, cameras, loot,
    width: GRID_W, height: GRID_H,
  };
}

export function tileChar(floor, tx, ty) {
  if (ty < 0 || ty >= floor.height || tx < 0 || tx >= floor.width) return '#';
  if (floor.walls[ty][tx]) return '#';
  return floor.vents[ty][tx] ? '~' : '.';
}

export const isWallTile = (floor, tx, ty) => tileChar(floor, tx, ty) === '#';
export const isVentTile = (floor, tx, ty) => tileChar(floor, tx, ty) === '~';
export const isVent = (floor, x, y) => isVentTile(floor, Math.floor(x / CELL), Math.floor(y / CELL));
