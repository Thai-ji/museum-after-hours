// rules.js — the heist's laws, with no canvas and no DOM in sight. The same
// functions run in the browser loop and headless in tools/test.mjs.
import {
  CELL, DT, BURGLAR, WARDEN, EYE, ALARM, RAID, VENT, SAFE, KIT, PURSE, VALUE,
} from './tuning.js';
import { FLOOR_COUNT, loadFloor, isWallTile, isVentTile, isVent } from './layout.js';

export const WHEN = {
  LIFT: 1,      // a piece was lifted
  DRILLED: 2,   // the safe cracked open
  CAUGHT: 3,    // alarm tripped or the clock died
  STAIRS: 4,    // took the stairs to the next floor
  OUT: 5,       // out of the building with the night's haul
  GEAR: 6,      // a tool came out of the purse
  NOTICED: 7,   // first frame someone is looking at you
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const span = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const cellOf = (x, y) => ({ tx: Math.floor(x / CELL), ty: Math.floor(y / CELL) });

// Solid for the burglar's body: any wall cell whose square the circle overlaps.
export function squeezed(floor, x, y, r) {
  const { tx, ty } = cellOf(x, y);
  for (let j = ty - 1; j <= ty + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
    if (!isWallTile(floor, i, j)) continue;
    const nearX = clamp(x, i * CELL, i * CELL + CELL);
    const nearY = clamp(y, j * CELL, j * CELL + CELL);
    if (span(x, y, nearX, nearY) < r) return true;
  }
  return false;
}

// Open line between two points: a wall or a duct breaks it.
export function openLine(floor, ax, ay, bx, by) {
  const d = span(ax, ay, bx, by);
  const hops = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i <= hops; i++) {
    const x = ax + (bx - ax) * i / hops, y = ay + (by - ay) * i / hops;
    const { tx, ty } = cellOf(x, y);
    if (isWallTile(floor, tx, ty) || isVentTile(floor, tx, ty)) return false;
  }
  return true;
}

// Inside the cone: within reach, within the angle, with a clear line.
export function catches(floor, cx, cy, gaze, reach, half, px, py) {
  if (span(cx, cy, px, py) > reach) return false;
  let off = Math.atan2(py - cy, px - cx) - gaze;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) <= half && openLine(floor, cx, cy, px, py);
}

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

function enterFloor(run, n) {
  run.floorNo = n;
  run.floor = loadFloor(n);
  run.wardens = run.floor.wardens.map(w => ({ ...w, aim: w.beat[0], rest: 0, nose: 0 }));
  run.cameras = run.floor.cameras.map(c => ({ ...c, face: c.gaze, phase: 0, dark: 0 }));
  run.loot = run.floor.loot.map(l => ({ ...l }));
  run.burglar.x = run.floor.entry.x;
  run.burglar.y = run.floor.entry.y;
  run.floorPieces = 0;
  run.clockOn = false;
  run.clock = 0;
  run.smoke = null;
  run.fade = 0;
}

function respawn(run) {
  run.burglar.x = run.floor.entry.x;
  run.burglar.y = run.floor.entry.y;
  run.alarm = 0;
  run.smoke = null;
  run.clock = Math.max(RAID.floor, run.clock - RAID.dock);
  run.wardens = run.floor.wardens.map(w => ({ ...w, aim: w.beat[0], rest: 0, nose: 0 }));
  run.phase = 'play';
}

const priceOf = key => KIT.find(t => t.key === key)?.cost ?? 0;

// act = { mx, my, dash, buy } — mx/my a direction vector, buy a kit key or null.
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
  if (act.buy && !run.kit[act.buy]) {
    const cost = priceOf(act.buy);
    if (cost > 0 && cost <= run.purse) {
      run.purse -= cost;
      run.kit[act.buy] = true;
      if (act.buy === 'flash') run.cameras.forEach(c => { c.dark = EYE.blind; });
      if (act.buy === 'smoke') run.smoke = { x: body.x, y: body.y, life: 5 };
      log.push({ k: WHEN.GEAR, tool: act.buy });
    }
  }

  // -- wardens walk their beat, or turn toward a noise -------------------------
  const loud = body.dashing && !run.kit.slippers;
  const hurry = run.alarm >= ALARM.hotAt ? 1.25 : 1;
  for (const w of run.wardens) {
    const other = w.aim === w.beat[0] ? w.beat[1] : w.beat[0];
    const ox = other[0] * CELL + CELL / 2, oy = other[1] * CELL + CELL / 2;
    const leg = span(w.x, w.y, ox, oy);
    if (loud && span(w.x, w.y, body.x, body.y) < BURGLAR.heard) w.nose = WARDEN.hark;
    if (w.nose > 0) {
      w.nose -= dt;
      w.face = steer(w.face, Math.atan2(body.y - w.y, body.x - w.x), WARDEN.swivel * dt);
    } else if (leg < 2) {
      w.rest += dt;
      const next = w.aim === w.beat[0] ? w.beat[1] : w.beat[0];
      const restGaze = Math.atan2(next[1] * CELL + CELL / 2 - w.y, next[0] * CELL + CELL / 2 - w.x);
      w.face = restGaze + Math.sin(w.rest * 1.5) * WARDEN.sway;
      if (w.rest >= WARDEN.dwell) { w.rest = 0; w.aim = other; }
    } else {
      const dir = Math.atan2(oy - w.y, ox - w.x);
      w.x += Math.cos(dir) * WARDEN.pace * hurry * dt;
      w.y += Math.sin(dir) * WARDEN.pace * hurry * dt;
      w.face = steer(w.face, dir, WARDEN.swivel * 2 * dt);
    }
  }

  // -- cameras sweep unless blinded ---------------------------------------------
  for (const c of run.cameras) {
    if (c.dark > 0) { c.dark -= dt; continue; }
    c.phase = (c.phase + dt / EYE.cycle) % 1;
    c.face = c.gaze + Math.sin(c.phase * Math.PI * 2) * EYE.sway;
  }

  // -- lifting loot and drilling the safe ----------------------------------------
  for (const item of run.loot) {
    if (item.gone || item.kind === 'vault') continue;
    if (span(body.x, body.y, item.x, item.y) < SAFE.reach) {
      item.gone = true;
      run.haul += VALUE[item.kind];
      run.pieces++; run.floorPieces++;
      if (!run.clockOn) { run.clockOn = true; run.clock = RAID.clock; }
      log.push({ k: WHEN.LIFT, kind: item.kind });
    }
  }
  const safe = run.loot.find(l => l.kind === 'vault');
  if (safe && !safe.gone) {
    const atSafe = span(body.x, body.y, safe.x, safe.y) < SAFE.reach;
    const rate = run.kit.crowbar ? 3 : 1;
    if (atSafe) {
      safe.worked += dt * rate;
      const need = run.kit.crowbar ? SAFE.drilled : SAFE.drill;
      if (safe.worked >= need) {
        safe.gone = true;
        run.haul += VALUE.vault;
        run.pieces++; run.floorPieces++;
        if (floor.door) floor.walls[floor.door.ty][floor.door.tx] = false;  // the way opens
        if (!run.clockOn) { run.clockOn = true; run.clock = RAID.clock; }
        log.push({ k: WHEN.DRILLED });
      }
    } else if (safe.worked > 0) {
      safe.worked = Math.max(0, safe.worked - dt);
    }
  }

  // -- smoke thins out ------------------------------------------------------------
  if (run.smoke) { run.smoke.life -= dt; if (run.smoke.life <= 0) run.smoke = null; }

  // -- who can see the burglar ------------------------------------------------------
  let watchers = 0;
  for (const w of run.wardens) {
    if (catches(floor, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, body.x, body.y)) watchers += 1;
  }
  for (const c of run.cameras) {
    if (c.dark > 0) continue;
    if (catches(floor, c.x, c.y, c.face, EYE.cone, EYE.half, body.x, body.y)) watchers += 0.75;
  }
  if (run.smoke) watchers = 0;
  const wasSeen = run.seen;
  run.seen = watchers > 0;
  if (run.seen && !wasSeen) log.push({ k: WHEN.NOTICED });
  if (run.seen) {
    const wardenShare = watchers >= 1 ? ALARM.warden : ALARM.eye;
    const mul = run.alarm >= ALARM.hotAt ? ALARM.panic : 1;
    run.alarm = clamp(run.alarm + Math.min(watchers, 1) * wardenShare * mul * dt, 0, 1.2);
  } else {
    run.alarm = clamp(run.alarm - ALARM.cool * dt, 0, 1.2);
  }

  // -- tripped? -----------------------------------------------------------------------
  if (run.alarm >= ALARM.trip) {
    run.phase = 'caught'; run.fade = 0;
    log.push({ k: WHEN.CAUGHT, why: 'alarm' });
    return log;
  }

  // -- the getaway clock -----------------------------------------------------------------
  if (run.clockOn) {
    run.clock -= dt;
    if (run.clock <= 0) {
      run.phase = 'caught'; run.fade = 0;
      log.push({ k: WHEN.CAUGHT, why: 'clock' });
      return log;
    }
  }

  // -- the stairs: locked until this floor has paid -----------------------------------------
  if (run.floorPieces > 0 && span(body.x, body.y, floor.stairs.x, floor.stairs.y) < SAFE.reach) {
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

function steer(face, want, most) {
  let gap = Math.atan2(Math.sin(want - face), Math.cos(want - face));
  return face + clamp(gap, -most, most);
}
