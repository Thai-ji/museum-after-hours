// rules.js -- the heist's frame: who moves, what is bought, what is lifted, and
// how the night ends. No canvas and no DOM in sight; the same functions run in
// the browser loop and headless in tools/test.mjs.
import {
  CELL, BURGLAR, VENT, EYE, ALARM, RAID, SAFE, PURSE,
} from './tuning.js';
import { FLOOR_COUNT, loadFloor, isVent } from './layout.js';
import { squeezed, openLine, catches, span, watch } from './detection.js';
import { tickWardens } from './patrol.js';
import { moodOf, tickAlarm, noteSighting, tickHunt } from './alarm.js';
import { buyGear, tickSmoke } from './gear.js';
import { tickLoot } from './vault.js';
import { tickGetaway, atStairs } from './getaway.js';

export { squeezed, openLine, catches, watch };
export { moodOf };

export const WHEN = {
  LIFT: 1,      // a piece was lifted
  DRILLED: 2,   // the safe cracked open
  CAUGHT: 3,    // alarm tripped or the clock died
  STAIRS: 4,    // took the stairs to the next floor
  OUT: 5,       // out of the building with the night's haul
  GEAR: 6,      // a tool came out of the purse
  NOTICED: 7,   // first frame someone is looking at you
};

export function freshRun() {
  return {
    phase: 'title',          // title | play | caught | cleared
    floor: loadFloor(0),
    floorNo: 0,
    t: 0,
    fade: 0,
    burglar: { x: 0, y: 0, dashing: false },
    alarm: 0,
    seen: false,
    lastSeen: null,          // where the eyes last caught him
    hunt: null,              // { at, life } the stare after a sighting
    haul: 0,
    pieces: 0,               // lifted this night
    floorPieces: 0,          // lifted on the current floor
    purse: PURSE,
    kit: {},
    smoke: null,
    clock: 0,
    clockOn: false,
    wardens: [],
    cameras: [],
    loot: [],
  };
}

export function beginNight(run) {
  const fresh = freshRun();
  Object.assign(run, fresh);
  enterFloor(run, 0);
  run.phase = 'play';
}

// A warden starts facing down his beat: from the first tile of the beat toward
// the second, so the torch already points along the walk.
const beatFace = w => Math.atan2(w.beat[1][1] - w.beat[0][1], w.beat[1][0] - w.beat[0][0]);

export function enterFloor(run, n) {
  run.floorNo = n;
  run.floor = loadFloor(n);
  run.wardens = run.floor.wardens.map(w => ({ ...w, face: beatFace(w), aim: w.beat[0], rest: 0, nose: 0 }));
  run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
  run.loot = run.floor.loot.map(l => ({ ...l }));
  run.burglar.x = run.floor.entry.x;
  run.burglar.y = run.floor.entry.y;
  run.floorPieces = 0;
  run.clockOn = false;
  run.clock = 0;
  run.smoke = null;
  run.lastSeen = null;
  run.hunt = null;
  run.fade = 0;
}

function respawn(run) {
  run.burglar.x = run.floor.entry.x;
  run.burglar.y = run.floor.entry.y;
  run.alarm = 0;
  run.smoke = null;
  run.lastSeen = null;
  run.hunt = null;
  run.clock = Math.max(RAID.floor, run.clock - RAID.dock);
  run.wardens = run.floor.wardens.map(w => ({ ...w, face: beatFace(w), aim: w.beat[0], rest: 0, nose: 0 }));
  run.phase = 'play';
}

// act = { mx, my, dash, buy } -- mx/my a direction vector, buy a kit key or null.
export function advance(run, dt, act) {
  const log = [];
  if (run.phase === 'caught') {
    run.fade += dt;
    if (run.fade >= RAID.fade) respawn(run);
    return log;
  }
  if (run.phase !== 'play') return log;
  run.t += dt;
  const floor = run.floor;
  const body = run.burglar;

  // -- the burglar moves ------------------------------------------------------
  const crawling = isVent(floor, body.x, body.y);
  let speed = BURGLAR.pad;
  if (act.dash && !crawling) speed = BURGLAR.dash;
  if (crawling) speed *= VENT.pace;
  const mag = Math.hypot(act.mx, act.my);
  if (mag > 0) {
    const nx = body.x + act.mx / mag * speed * dt;
    const ny = body.y + act.my / mag * speed * dt;
    if (!squeezed(floor, nx, body.y, BURGLAR.radius)) body.x = nx;
    if (!squeezed(floor, body.x, ny, BURGLAR.radius)) body.y = ny;
  }
  body.dashing = !!act.dash && mag > 0 && !crawling;

  // -- gear out of the purse --------------------------------------------------
  buyGear(run, act.buy, WHEN, log);

  // -- wardens walk their beat, or turn toward a noise -------------------------
  tickWardens(run, dt);

  // -- cameras sweep unless blinded ---------------------------------------------
  for (const c of run.cameras) {
    if (c.dark > 0) { c.dark -= dt; continue; }
    const pace = run.alarm >= ALARM.hotAt ? 0.55 : 1;
    c.phase = (c.phase + dt / (EYE.cycle * pace)) % 1;
    c.face = c.gaze + Math.sin(c.phase * Math.PI * 2) * EYE.sway;
  }

  // -- lifting loot and drilling the safe ----------------------------------------
  tickLoot(run, dt, WHEN, log);

  // -- smoke thins out ------------------------------------------------------------
  tickSmoke(run, dt);

  // -- who can see the burglar ------------------------------------------------------
  const watchers = watch(floor, run);
  const wasSeen = run.seen;
  run.seen = watchers > 0;
  if (run.seen && !wasSeen) log.push({ k: WHEN.NOTICED });
  noteSighting(run, run.seen, wasSeen);
  tickAlarm(run, dt, watchers);
  tickHunt(run, dt);

  // -- tripped? -----------------------------------------------------------------------
  if (run.alarm >= ALARM.trip) {
    run.phase = 'caught'; run.fade = 0;
    log.push({ k: WHEN.CAUGHT, why: 'alarm' });
    return log;
  }

  // -- the getaway clock -----------------------------------------------------------------
  if (tickGetaway(run, dt)) {
    run.phase = 'caught'; run.fade = 0;
    log.push({ k: WHEN.CAUGHT, why: 'clock' });
    return log;
  }

  // -- the stairs: locked until this floor has paid -----------------------------------------
  if (run.floorPieces > 0 && atStairs(run)) {
    if (run.floorNo + 1 < FLOOR_COUNT) {
      log.push({ k: WHEN.STAIRS, to: run.floorNo + 1 });
      enterFloor(run, run.floorNo + 1);
    } else {
      run.phase = 'cleared';
      log.push({ k: WHEN.OUT });
    }
  }
  return log;
}

export const stairReach = () => SAFE.reach;
export const cellSize = () => CELL;