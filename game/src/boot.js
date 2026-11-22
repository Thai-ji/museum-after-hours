// boot.js - canvas, the fixed-step loop, and the ?shot= staging used to take
// the screenshots. Every staged frame is a state the rules really produce.
import { DT, CELL } from './tuning.js';
import { loadFloor } from './layout.js';
import { freshRun, beginNight, advance, WHEN } from './rules.js';
import { attachKeys } from './keys.js';
import { backdrop } from './props.js';
import { paint } from './view.js';

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const keys = attachKeys();
const run = freshRun();
let still = backdrop(run.floor);

const at = (tx, ty) => ({ x: tx * CELL + CELL / 2, y: ty * CELL + CELL / 2 });
const beatFace = w => Math.atan2(w.beat[1][1] - w.beat[0][1], w.beat[1][0] - w.beat[0][0]);

function reloadStill() {
  still = backdrop(run.floor);
}

// ---------------------------------------------------------------- staging
//
// Four beats, each a frame a player could really sit in:
//   cover    the whole vault court, mid-night, all seven pieces of the game in
//            one frame: the room, the thief, three wardens, their torches, the
//            two lenses, the steel door and the safe, and the HUD.
//   drill    the safe half drilled, the ring climbing, a warden turning toward
//            the racket with a ?
//   lockdown the meter past the lock line: three torches closing, the dash
//            rings loud, the red edge on.
//   escape   the vault open, the bag full, the stairs lit, the clock nearly out
//            and the night cleared.
function stage(kind) {
  document.body.classList.add('still');
  if (kind !== 'title') beginNight(run);

  const setFloor = (n) => {
    run.floorNo = n;
    run.floor = loadFloor(n);
    reloadStill();
    run.wardens = run.floor.wardens.map(w => ({ ...w, face: beatFace(w), aim: w.beat[0], rest: 0, nose: 0 }));
    run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
    run.loot = run.floor.loot.map(l => ({ ...l }));
    run.burglar.x = run.floor.entry.x;
    run.burglar.y = run.floor.entry.y;
    run.burglar.dashing = false;
    run.phase = 'play';
  };

  if (kind === 'cover') {
    setFloor(2);
    run.view = { s: 0.82, x: 640, y: 360 };
    const b = at(12, 11);
    run.burglar.x = b.x; run.burglar.y = b.y;
    run.pieces = 3; run.haul = 980; run.floorPieces = 0;
    run.clockOn = true; run.clock = 74.6;
    run.alarm = 0.42;
    run.purse = 25; run.kit = { crowbar: true, flash: true };
    const w = run.wardens;
    w[0].x = at(8, 7).x; w[0].y = at(8, 7).y; w[0].face = 0.28;
    w[1].x = at(16, 5).x; w[1].y = at(16, 5).y; w[1].face = Math.PI / 2; w[1].nose = 1.2;
    w[2].x = at(25, 12).x; w[2].y = at(25, 12).y; w[2].face = Math.PI;
    run.cameras[0].face = Math.PI / 2;
    run.cameras[1].face = Math.PI / 2;
  } else if (kind === 'drill') {
    setFloor(2);
    run.view = { s: 1.36, x: 660, y: 400 };
    const safe = run.loot.find(l => l.kind === 'vault');
    const b = { x: safe.x - 23, y: safe.y + 6 };
    run.burglar.x = b.x; run.burglar.y = b.y;
    safe.worked = 2.06;
    run.pieces = 2; run.haul = 600; run.floorPieces = 0;
    run.clockOn = true; run.clock = 41.0;
    run.alarm = 0.58;
    run.hunt = { at: { x: safe.x, y: safe.y }, life: 2.2 };
    run.purse = 120; run.kit = {};
    const w = run.wardens;
    w[0].x = at(8, 10).x; w[0].y = at(8, 10).y; w[0].face = 0.35;
    w[1].x = at(11, 7).x; w[1].y = at(11, 7).y;
    w[1].face = Math.atan2(safe.y - w[1].y, safe.x - w[1].x); w[1].nose = 1.4;
    w[2].x = at(22, 5).x; w[2].y = at(22, 5).y; w[2].face = Math.PI * 0.75;
    run.cameras[0].face = 0.5;
    run.cameras[1].face = Math.PI / 2;
  } else if (kind === 'lockdown') {
    setFloor(2);
    run.view = { s: 1.30, x: 690, y: 420 };
    const b = at(17, 12);
    run.burglar.x = b.x; run.burglar.y = b.y; run.burglar.dashing = true;
    run.pieces = 5; run.haul = 1580; run.floorPieces = 0;
    run.clockOn = true; run.clock = 18.5;
    run.alarm = 0.97;
    run.hunt = { at: { x: b.x, y: b.y }, life: 2.6 };
    run.purse = 25; run.kit = { crowbar: true, flash: true };
    const w = run.wardens;
    w[0].x = at(14, 9).x; w[0].y = at(14, 9).y;
    w[0].face = Math.atan2(b.y - w[0].y, b.x - w[0].x);
    w[1].x = at(18, 10).x; w[1].y = at(18, 10).y;
    w[1].face = Math.atan2(b.y - w[1].y, b.x - w[1].x);
    w[2].x = at(20, 13).x; w[2].y = at(20, 13).y;
    w[2].face = Math.atan2(b.y - w[2].y, b.x - w[2].x);
    run.cameras[0].face = -Math.PI / 2;
    run.cameras[1].face = 2.1;
  } else if (kind === 'escape') {
    setFloor(2);
    run.floor.walls[run.floor.door.ty][run.floor.door.tx] = false;
    run.view = { s: 1.12, x: 760, y: 466 };
    const s = at(29, 16);
    run.burglar.x = s.x; run.burglar.y = s.y;
    for (const l of run.loot) { l.gone = true; }
    run.pieces = 6; run.haul = 2230; run.floorPieces = 2;
    run.clockOn = true; run.clock = 6.4;
    run.alarm = 0.12;
    run.purse = 25; run.kit = { crowbar: true, flash: true };
    run.phase = 'cleared';
    const w = run.wardens;
    w[0].x = at(20, 10).x; w[0].y = at(20, 10).y; w[0].face = Math.PI * 0.55;
    w[1].x = at(24, 13).x; w[1].y = at(24, 13).y; w[1].face = Math.PI * 0.95;
    w[2].x = at(25, 8).x; w[2].y = at(25, 8).y; w[2].face = Math.PI * 0.6;
    run.cameras[0].face = -Math.PI / 2;
    run.cameras[1].face = Math.PI;
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