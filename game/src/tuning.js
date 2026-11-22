// tuning.js — every number the heist runs on, in one place, so a balance pass
// never has to hunt through the renderer or the rules.
export const CELL = 40;             // px per tile
export const GRID_W = 32, GRID_H = 18;
export const VIEW_W = GRID_W * CELL, VIEW_H = GRID_H * CELL;
export const DT = 1 / 60;           // fixed simulation step

export const BURGLAR = {
  radius: 11,
  pad: 208,        // px/s sneaking
  dash: 302,       // px/s with Shift held
  heard: 190,      // px: a dash carries this far
};

export const WARDEN = {
  radius: 12,
  pace: 86,        // px/s on the beat
  cone: 212,       // px of torchlight
  half: 0.57,      // half-angle, radians
  dwell: 1.55,     // s stopped at each end of the beat
  sway: 0.46,      // rad swept while stopped
  swivel: 2.4,     // rad/s turning toward a noise
  hark: 1.25,      // s a noise holds a warden's head
};

export const EYE = {
  cone: 246,
  half: 0.41,
  sway: 0.6,       // rad either side of its resting gaze
  cycle: 5.4,      // s for one full sweep
  blind: 8,        // s a flashbulb keeps a camera down
};

export const ALARM = {
  warden: 1.05,    // meter gain per second in a torch cone
  eye: 0.78,       // per second in a lens cone
  cool: 0.17,      // per second lost while unseen
  panic: 2.1,      // multiplier once the meter is past hotAt
  hotAt: 0.6,
  trip: 1.0,       // meter value that ends the attempt
};

export const RAID = {
  clock: 88,       // s on a floor once its first piece is lifted
  dock: 18,        // s lost when the alarm trips
  floor: 6,        // the clock never falls below this
  fade: 1.25,      // s of red before the burglar is dragged back out
};

export const VENT = { pace: 0.56 };   // crawling a duct: slow, silent, sight-proof

export const SAFE = { drill: 3.4, drilled: 1.1, reach: 26 };

// Gear is bought from one purse for the whole night (keys 1-4).
export const KIT = [
  { key: 'crowbar',  cost: 40, tag: 'Crowbar',  blurb: 'safe drills 3x faster' },
  { key: 'flash',    cost: 55, tag: 'Flashbulb', blurb: 'every camera blind 8s' },
  { key: 'smoke',    cost: 50, tag: 'Smoke',    blurb: 'break all sight 5s' },
  { key: 'slippers', cost: 45, tag: 'Slippers', blurb: 'a dash makes no sound' },
];
export const PURSE = 120;

export const VALUE = { case: 220, gem: 380, vault: 650 };

// Palette: cold museum marble for cover, brass for valuable, red for danger.
export const INK = {
  void: '#06080f',
  slab: '#0f1626',
  slabAlt: '#121a2c',
  marble: '#232f4a',
  marbleLit: '#33436a',
  brass: '#f0c463',
  brassDim: '#8a6f32',
  burglar: '#61e6c0',
  warden: '#e14d4d',
  wardenCone: 'rgba(225,77,77,0.22)',
  eye: '#f5b544',
  eyeCone: 'rgba(245,181,68,0.17)',
  stairs: '#69de8c',
  text: '#e6ecf8',
  textDim: '#8f9ab4',
  alarm: '#ff5f5f',
};
