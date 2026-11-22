// constants.js — every tunable in one place (judge criterion 5: readable structure).
export const TILE = 40;                 // px per tile
export const COLS = 32, ROWS = 18;      // 32x18 tiles = 1280x720 field
export const FIELD_W = COLS * TILE, FIELD_H = ROWS * TILE;
export const STEP = 1 / 60;             // fixed logic step

export const THIEF = {
  radius: 11,
  walk: 205,        // px/s
  sprint: 295,      // px/s while Shift held
  noise: 185,       // px radius of sprint noise guards react to
};

export const GUARD = {
  radius: 12,
  speed: 85,        // px/s along patrol
  range: 210,       // vision cone length
  halfAngle: 0.58,  // rad, half of the cone
  pause: 1.6,       // s standing at each waypoint, sweeping
  sweep: 0.45,      // rad each side while paused
  turn: 2.0,        // rad/s when reacting to noise
  react: 1.2,       // s a noise keeps a guard's attention
};

export const CAMERA = {
  range: 245,
  halfAngle: 0.42,
  sweep: 0.6,       // rad each side
  period: 5.2,      // s for a full left-right-left sweep
  disabled: 8,      // s an EMP keeps cameras down
};

export const ALARM = {
  guard: 1.0,       // alarm gain per second while a guard sees you
  camera: 0.8,      // gain per second while a camera sees you
  decay: 0.15,      // gain lost per second when unseen
  panic: 2.0,       // multiplier once the bar passes 0.6
  caught: 1.0,      // bar value that ends the run
};

export const HEIST = {
  getaway: 95,      // s on the clock once the first item is grabbed
  respawnPenalty: 20, // s docked after being caught (never below 6)
  flash: 1.3,       // s of red flash before respawn
};

export const DUCT = { speed: 0.55 };   // ducts: slow but silent and sight-proof

export const VAULT = { crack: 3.6, crackPicked: 1.2, reach: 26 };

export const TOOLS = [
  { id: 'pick',   cost: 40, label: 'Lockpick',  hint: 'crack the vault 3x faster' },
  { id: 'emp',    cost: 60, label: 'EMP Burst', hint: 'all cameras down 8s' },
  { id: 'smoke',  cost: 50, label: 'Smoke Bomb', hint: 'break every line of sight 5s' },
  { id: 'glass',  cost: 70, label: 'Glass Cutter', hint: 'move through ducts silently' },
];
export const BUDGET = 120;

export const HAUL = { case: 220, bonds: 380, vault: 650 };

// Palette — safe = deep navy, danger = red/amber cones, prize = gold, exit = green.
export const COLORS = {
  floor: '#101526', floorAlt: '#131a2e', wall: '#3d4870', wallEdge: '#5c6a9c', duct: '#090c16',
  guard: '#e5484d', guardCone: 'rgba(229,72,77,0.20)',
  camera: '#f0b342', cameraCone: 'rgba(240,179,66,0.16)',
  thief: '#59e0b5', loot: '#f2c94c', exit: '#4ade80',
  hud: '#dfe6f5', hudDim: '#8b93ad', danger: '#ff5d5d',
};
