// boot.js — canvas, the fixed-step loop, and the ?shot= staging used to take
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

  if (kind === 'cover') {
    // mid-night on the Long Gallery: one piece already bagged, clock running,
    // a torch cone on the burglar, another sweeping in, lens lit, alarm hot
    run.burglar.x = 470; run.burglar.y = 390;
    const gem = run.loot.find(l => l.kind === 'gem');
    gem.gone = true;
    run.pieces = 1; run.floorPieces = 1; run.haul = 380;
    run.clockOn = true; run.clock = 34.2; run.alarm = 0.68;
    run.wardens[0].x = 330; run.wardens[0].y = 300; run.wardens[0].face = 0.62;
    run.wardens[1].x = 668; run.wardens[1].y = 396; run.wardens[1].face = Math.PI - 0.12;
    run.wardens[2].x = 1050; run.wardens[2].y = 600; run.wardens[2].face = -2.2;
    run.cameras[0].face = Math.PI / 2 + 0.22;
    run.cameras[1].face = 2.62;
  } else if (kind === 'vault') {
    // the last floor: inside the vault court, a warden on the far side of the
    // shut door, the camera watching the way in, the safe half drilled
    run.floorNo = 2; run.floor = loadFloor(2); reloadStill();
    run.wardens = run.floor.wardens.map(w => ({ ...w, aim: w.beat[0], rest: 0, nose: 0 }));
    run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
    run.loot = run.floor.loot.map(l => ({ ...l }));
    run.burglar.x = 700; run.burglar.y = 470;
    const safe = run.loot.find(l => l.kind === 'vault');
    safe.worked = 2.1;
    run.pieces = 4; run.floorPieces = 0; run.haul = 1220;
    run.clockOn = true; run.clock = 52.6; run.alarm = 0.44;
    run.wardens[2].x = 1010; run.wardens[2].y = 400; run.wardens[2].face = Math.PI * 0.72;
    run.wardens[1].x = 400; run.wardens[1].y = 220; run.wardens[1].face = 0.2;
    run.cameras[1].face = Math.PI + 0.18;
    run.cameras[0].face = Math.PI / 2 - 0.2;
  } else if (kind === 'caught') {
    run.floorNo = 1; run.floor = loadFloor(1); reloadStill();
    run.wardens = run.floor.wardens.map(w => ({ ...w, aim: w.beat[0], rest: 0, nose: 0 }));
    run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
    run.loot = run.floor.loot.map(l => ({ ...l }));
    run.burglar.x = 520; run.burglar.y = 380;
    run.pieces = 2; run.floorPieces = 1; run.haul = 600;
    run.clockOn = true; run.clock = 27.4; run.alarm = 1;
    run.phase = 'caught'; run.fade = 0.2;
    run.wardens[1].x = 640; run.wardens[1].y = 380; run.wardens[1].face = Math.PI;
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
