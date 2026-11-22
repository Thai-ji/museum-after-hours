// run.js — boot, the fixed-step loop, and the ?shot= staging mode used for screenshots.
import { STEP } from './constants.js';
import { buildLevel } from './map.js';
import { makeGame, startRun, step } from './stealth.js';
import { attachControls } from './controls.js';
import { draw } from './painter.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const level = buildLevel();
let game = makeGame(level);
const controls = attachControls();

let wantStart = false;
addEventListener('keydown', e => {
  if (e.key === 'Enter') wantStart = true;
  if (e.key.toLowerCase() === 'r' && game.state === 'cleared') wantStart = true;
});
addEventListener('pointerdown', () => { if (game.state === 'title') wantStart = true; });

function frame() {
  const intent = controls.poll();
  if (wantStart && (game.state === 'title' || game.state === 'cleared')) {
    startRun(game); wantStart = false;
  } else wantStart = false;
  const ev = step(game, STEP, game.state === 'playing' ? intent : null);
  if (ev.length && window.__logEvents) console.log(ev.map(e => e.k).join(','));
  draw(ctx, game, level);
  requestAnimationFrame(frame);
}

// --- screenshot staging: real, reachable game states, drawn synchronously ------
// (no requestAnimationFrame here: offscreen windows never fire it)
function stageShot(kind) {
  document.body.classList.add('bare');   // canvas pinned to 0,0, exact 1280x720 crop
  if (kind !== 'title') startRun(game);
  if (kind === 'play') {
    // mid-run: one case already bagged, clock under 42s, alarm in the red zone,
    // sprinting so the noise ring is out, the vault guard paused mid-sweep,
    // two cones crossing right where you stand
    game.thief.x = 462; game.thief.y = 300; game.thief.sprint = true;
    const caseItem = game.loot.find(l => l.kind === 'case');
    caseItem.taken = true; game.grabbed = 1; game.haul = 220;
    game.clockRunning = true; game.clock = 41.2; game.alarm = 0.68;
    const g3 = game.guards[2];
    g3.x = 680; g3.y = 620; g3.t = 0.6; g3.reactTimer = 0.9;
    g3.heading = g3.b; g3.face = -Math.PI / 2 + 0.45;
    game.cameras[1].face = -0.32; game.cameras[2].face = Math.PI;
    game.tools.smoke = true; game.spent = 50;
  } else if (kind === 'caught') {
    game.thief.x = 462; game.thief.y = 300;
    game.grabbed = 1; game.haul = 220; game.clockRunning = true; game.clock = 28.4;
    game.alarm = 1.0; game.state = 'caught'; game.flash = 0.18;
    game.guards[2].face = -Math.PI / 2;
    game.cameras[1].face = -0.25;
  } else if (kind === 'clear') {
    for (const l of game.loot) { l.taken = true; }
    const v = game.loot.find(l => l.kind === 'vault'); v.taken = true; v.progress = 3.6;
    game.grabbed = 4; game.haul = 1470; game.clockRunning = true; game.clock = 12.4;
    game.thief.x = level.exit.x - 26; game.thief.y = level.exit.y; game.state = 'cleared';
  }
  draw(ctx, game, level);
  window.__shotReady = true;
}

const mode = new URLSearchParams(location.search).get('shot');
if (mode) stageShot(mode);
else requestAnimationFrame(frame);
