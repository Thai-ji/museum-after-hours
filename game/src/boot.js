// boot.js 鈥?canvas, the fixed-step loop, and the ?shot= staging used to take
// the screenshots. Every staged frame is a state the rules really produce.
import { DT, CELL } from './tuning.js';
import { loadFloor } from './layout.js';
import { freshRun, beginNight, advance, WHEN } from './rules.js';
import { attachKeys } from './keys.js';
import { backdrop, paint } from './view.js';

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const keys = attachKeys();
const run = freshRun();
let still = backdrop(run.floor);

const at = (tx, ty) => ({ x: tx * CELL + CELL / 2, y: ty * CELL + CELL / 2 });

function reloadStill() {
  still = backdrop(run.floor);
}

// ---------------------------------------------------------------- staging

function stage(kind) {
  document.body.classList.add('still');
  if (kind !== 'title') beginNight(run);

  const setFloor = (n) => {
    run.floorNo = n; run.floor = loadFloor(n); reloadStill();
    run.wardens = run.floor.wardens.map(w => ({ ...w, aim: w.beat[0], rest: 0, nose: 0 }));
    run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
    run.loot = run.floor.loot.map(l => ({ ...l }));
  };

  if (kind === 'cover') {
    // the vault court, mid-job: the door behind him, the safe half drilled,
    // a torch coming round the door, a lens on the room, the meter climbing
    setFloor(2);
    run.view = { s: 1.44, x: 640, y: 430 };
    run.burglar.x = 700; run.burglar.y = 404;
    run.pieces = 4; run.floorPieces = 0; run.haul = 1220;
    run.clockOn = true; run.clock = 34.2; run.alarm = 0.56;
    const safe = run.loot.find(l => l.kind === 'vault');
    if (safe) safe.worked = 2.1;
    run.wardens[1].x = 660; run.wardens[1].y = 236; run.wardens[1].face = Math.PI * 0.62;
    run.wardens[2].x = 986; run.wardens[2].y = 436; run.wardens[2].face = Math.PI * 0.94;
    run.wardens[0].x = 160; run.wardens[0].y = 40; run.wardens[0].face = -0.5;
    run.cameras[1].face = Math.PI * 0.74;
    run.cameras[0].face = -Math.PI * 0.4;
  } else if (kind === 'gallery') {
    // the long gallery: the jewel on its pedestal, the case lit, a torch sweeping
    setFloor(0);
    run.view = { s: 1.18, x: 780, y: 320 };
    run.burglar.x = 800; run.burglar.y = 290;
    run.pieces = 3; run.floorPieces = 1; run.haul = 600;
    run.clockOn = true; run.clock = 52.6; run.alarm = 0.30;
    run.wardens[0].x = 600; run.wardens[0].y = 300; run.wardens[0].face = 0.1;
    run.wardens[1].x = 380; run.wardens[1].y = 430; run.wardens[1].face = -1.05;
    run.wardens[2].x = 1060; run.wardens[2].y = 600; run.wardens[2].face = -2.4;
    run.cameras[0].face = Math.PI / 2 - 0.2;
    run.cameras[1].face = Math.PI + 0.2;
  } else if (kind === 'escape') {
    // the last twenty seconds: the stairwell lit, the bag full, a torch behind
    setFloor(2);
    run.view = { s: 1.26, x: 1130, y: 590 };
    run.burglar.x = 1178; run.burglar.y = 622;
    run.pieces = 4; run.floorPieces = 4; run.haul = 2100;
    run.clockOn = true; run.clock = 6.4; run.alarm = 0.18;
    run.wardens[2].x = 1046; run.wardens[2].y = 470; run.wardens[2].face = Math.PI * 0.75;
    run.wardens[1].x = 620; run.wardens[1].y = 240; run.wardens[1].face = Math.PI * 0.55;
    run.cameras[1].face = Math.PI * 0.8;
  } else if (kind === 'alarm') {
    // the second beat: the torch is a step away and the meter is nearly full
    setFloor(2);
    run.view = { s: 1.30, x: 700, y: 380 };
    run.burglar.x = 690; run.burglar.y = 410;
    run.pieces = 4; run.floorPieces = 0; run.haul = 1220;
    run.clockOn = true; run.clock = 18.5; run.alarm = 0.84;
    const safe = run.loot.find(l => l.kind === 'vault');
    if (safe) safe.worked = 3.0;
    run.wardens[1].x = 772; run.wardens[1].y = 316; run.wardens[1].face = Math.PI * 0.74;
    run.wardens[2].x = 952; run.wardens[2].y = 470; run.wardens[2].face = Math.PI * 0.88;
    run.wardens[0].x = 176; run.wardens[0].y = 60; run.wardens[0].face = 0.3;
    run.cameras[1].face = Math.PI * 0.86;
    run.cameras[0].face = -Math.PI * 0.35;
  } else if (kind === 'looted') {
    // the third beat: the safe is empty, the bag is full, the door is in reach
    setFloor(2);
    run.view = { s: 1.36, x: 640, y: 430 };
    run.burglar.x = 606; run.burglar.y = 432;
    run.pieces = 4; run.floorPieces = 4; run.haul = 2100;
    run.clockOn = true; run.clock = 41.0; run.alarm = 0.12;
    for (const l of run.loot) l.gone = true;
    run.wardens[1].x = 470; run.wardens[1].y = 214; run.wardens[1].face = Math.PI * 0.35;
    run.wardens[2].x = 980; run.wardens[2].y = 520; run.wardens[2].face = -Math.PI * 0.4;
    run.wardens[0].x = 180; run.wardens[0].y = 60; run.wardens[0].face = 0.3;
    run.cameras[1].face = Math.PI * 0.9;
    run.cameras[0].face = -Math.PI * 0.4;
  } else if (kind === 'caught') {
    // the meter full: the torch found him and the night is over
    setFloor(1);
    run.view = { s: 1.16, x: 540, y: 380 };
    run.burglar.x = 520; run.burglar.y = 380;
    run.pieces = 2; run.floorPieces = 1; run.haul = 600;
    run.clockOn = true; run.clock = 27.4; run.alarm = 1;
    run.phase = 'caught'; run.fade = 0.2;
    run.wardens[1].x = 632; run.wardens[1].y = 380; run.wardens[1].face = Math.PI;
    run.wardens[0].x = 300; run.wardens[0].y = 300; run.wardens[0].face = 0.9;
  }

  paint(ctx, run, run.floor, still);
  window.__shotReady = true;
}

// ---------------------------------------------------------------- loop

function needle() {
  return keys.read();
}

let carry = 0;
let last = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  carry += dt;

  if (run.phase === 'title' && (keys.down('enter'))) beginNight(run);
  else if (run.phase === 'cleared' && keys.down('r')) beginNight(run);

  let steps = 0;
  while (carry >= DT && steps < 6) {
    advance(run, DT, run.phase === 'play' ? needle() : { mx: 0, my: 0, dash: false, buy: null });
    carry -= DT; steps += 1;
  }
  paint(ctx, run, run.floor, still);
}

addEventListener('keydown', e => {
  if (run.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) beginNight(run);
  if (run.phase === 'cleared' && e.key.toLowerCase() === 'r') beginNight(run);
});
addEventListener('pointerdown', () => {
  if (run.phase === 'title') beginNight(run);
});

const shot = new URLSearchParams(location.search).get('shot');
if (shot) stage(shot);
else requestAnimationFrame(frame);

