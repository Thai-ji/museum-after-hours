// stealth.js — pure rules, no DOM: movement, collision, sight, alarm, tools, the run clock.
// Everything here runs headless in Node too (tools/test.mjs drives it).
import { TILE, THIEF, GUARD, CAMERA, ALARM, HEIST, DUCT, VAULT, BUDGET, HAUL } from './constants.js';
import { tileAt, isDuct } from './map.js';

export const EVENTS = { LOOT: 1, CRACKED: 2, CAUGHT: 3, CLEARED: 4, BOUGHT: 5, SEEN: 6 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function tileOf(level, x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

export function blocked(level, x, y, r) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const { tx, ty } = tileAt2(level, x + dx * r, y + dy * r);
    if (tileAt(level, tx, ty) === '#') {
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if (dist(x, y, cx, cy) < r) return true;
    }
  }
  return false;
}
const tileAt2 = (level, x, y) => ({ tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) });

// True when nothing solid (walls or ducts) stands between two points.
export function lineClear(level, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by), steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i <= steps; i++) {
    const x = ax + (bx - ax) * i / steps, y = ay + (by - ay) * i / steps;
    const { tx, ty } = tileAt2(level, x, y);
    if (tileAt(level, tx, ty) === '#' || isDuct(level, tx, ty)) return false;
  }
  return true;
}

// Cone test: within range, inside the half-angle, and line of sight clear.
export function coneSees(level, cx, cy, face, range, halfAngle, px, py) {
  const d = dist(cx, cy, px, py);
  if (d > range) return false;
  let da = Math.atan2(py - cy, px - cx) - face;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= halfAngle && lineClear(level, cx, cy, px, py);
}

export function inDuct(level, x, y) {
  const { tx, ty } = tileAt2(level, x, y);
  return isDuct(level, tx, ty);
}

export function makeGame(level) {
  return {
    level, state: 'title', t: 0, clock: 0, clockRunning: false,
    thief: { x: level.spawn.x, y: level.spawn.y, sprint: false },
    alarm: 0, haul: 0, grabbed: 0, spent: 0,
    tools: {}, smoke: null, crack: 0,
    events: [], flash: 0, seenBy: 0,
    guards: level.guards.map(g => ({ ...g, heading: g.a, t: 0 })),
    cameras: level.cameras.map(c => ({ ...c, phase: 0, down: 0 })),
    loot: level.loot.map(l => ({ ...l })),
  };
}

export function startRun(game) {
  const fresh = makeGame(game.level);
  Object.assign(game, fresh);
  game.state = 'playing';
}

// intent = { dx, dy, sprint, buy } — buy is a tool id string or null.
export function step(game, dt, intent) {
  const ev = [];
  if (game.state !== 'playing') {
    if (game.state === 'caught') {
      game.flash += dt;
      if (game.flash >= HEIST.flash) respawn(game);
    }
    return ev;
  }
  game.t += dt;
  const g = game.guards, th = game.thief;

  // 1. Move the thief (speed depends on duct / sprint).
  const onDuct = inDuct(game.level, th.x, th.y);
  let speed = THIEF.walk;
  if (th.sprint && !onDuct) speed = THIEF.sprint;
  if (onDuct) speed *= DUCT.speed;
  if (intent) {
    const m = Math.hypot(intent.dx, intent.dy);
    if (m > 0) {
      const nx = th.x + intent.dx / m * speed * dt, ny = th.y + intent.dy / m * speed * dt;
      if (!blocked(game.level, nx, th.y, THIEF.radius)) th.x = nx;
      if (!blocked(game.level, th.x, ny, THIEF.radius)) th.y = ny;
    }
    th.sprint = !!intent.sprint;

    // 2. Buy a tool.
    if (intent.buy && !game.tools[intent.buy]) {
      const cost = { pick: 40, emp: 60, smoke: 50, glass: 70 }[intent.buy];
      const left = BUDGET - game.spent;
      if (cost && cost <= left) {
        game.spent += cost;
        game.tools[intent.buy] = true;
        if (intent.buy === 'emp') game.cameras.forEach(c => c.down = CAMERA.disabled);
        if (intent.buy === 'smoke') game.smoke = { x: th.x, y: th.y, life: 5 };
        ev.push({ k: EVENTS.BOUGHT, tool: intent.buy });
      }
    }
  }

  // 3. Guards patrol / react.
  const noisy = th.sprint && !onDuct && !game.tools.glass;
  for (const gd of g) {
    const target = gd.heading === gd.a ? gd.b : gd.a;
    const tx = target[0] * TILE + TILE / 2, ty = target[1] * TILE + TILE / 2;
    let dir = Math.atan2(ty - gd.y, tx - gd.x);
    let d = dist(gd.x, gd.y, tx, ty);
    if (noisy && dist(gd.x, gd.y, th.x, th.y) < THIEF.noise) gd.reactTimer = GUARD.react;
    if (gd.reactTimer > 0) {
      gd.reactTimer -= dt;
      const want = Math.atan2(th.y - gd.y, th.x - gd.x);
      gd.face = turnToward(gd.face, want, GUARD.turn * dt);
    } else if (d < 2) {
      gd.t += dt;                       // waypoint pause: sweep around the next leg's direction
      const sweep = Math.sin(gd.t * 1.5) * GUARD.sweep;
      const next = gd.heading === gd.a ? gd.b : gd.a;
      gd.face = Math.atan2(next[1] * TILE + TILE / 2 - gd.y, next[0] * TILE + TILE / 2 - gd.x) + sweep;
      if (gd.t >= GUARD.pause) { gd.t = 0; gd.heading = gd.heading === gd.a ? gd.b : gd.a; }
    } else {
      gd.x += Math.cos(dir) * GUARD.speed * (game.alarm >= 0.6 ? 1.25 : 1) * dt;
      gd.y += Math.sin(dir) * GUARD.speed * (game.alarm >= 0.6 ? 1.25 : 1) * dt;
      gd.face = turnToward(gd.face, dir, GUARD.turn * 2 * dt);
    }
  }

  // 4. Cameras sweep, unless EMP'd.
  for (const c of game.cameras) {
    if (c.down > 0) { c.down -= dt; continue; }
    c.phase = (c.phase + dt / CAMERA.period) % 1;
    c.face = c.base + Math.sin(c.phase * Math.PI * 2) * CAMERA.sweep;
  }

  // 5. Loot pickup / vault cracking.
  for (const item of game.loot) {
    if (item.taken) continue;
    if (item.kind !== 'vault' && dist(th.x, th.y, item.x, item.y) < VAULT.reach) {
      item.taken = true; game.haul += HAUL[item.kind]; game.grabbed++;
      if (!game.clockRunning) { game.clockRunning = true; game.clock = HEIST.getaway; }
      ev.push({ k: EVENTS.LOOT, kind: item.kind });
    }
  }
  const vault = game.loot.find(l => l.kind === 'vault');
  if (vault && !vault.taken) {
    const onPad = dist(th.x, th.y, vault.x, vault.y) < VAULT.reach;
    const speedMul = game.tools.pick ? 3 : 1;
    if (onPad) {
      vault.progress += dt * speedMul;
      if (vault.progress >= (game.tools.pick ? VAULT.crackPicked : VAULT.crack)) {
        vault.taken = true; game.haul += HAUL.vault; game.grabbed++;
        if (!game.clockRunning) { game.clockRunning = true; game.clock = HEIST.getaway; }
        ev.push({ k: EVENTS.CRACKED });
      }
    } else if (vault.progress > 0) vault.progress = Math.max(0, vault.progress - dt);
  }

  // 6. Smoke fades.
  if (game.smoke) { game.smoke.life -= dt; if (game.smoke.life <= 0) game.smoke = null; }

  // 7. Detection fills the alarm bar.
  let seen = 0;
  for (const gd of g) if (coneSees(game.level, gd.x, gd.y, gd.face, GUARD.range, GUARD.halfAngle, th.x, th.y)) seen += 1;
  for (const c of game.cameras) {
    if (c.down > 0) continue;
    if (coneSees(game.level, c.x, c.y, c.face, CAMERA.range, CAMERA.halfAngle, th.x, th.y)) seen += 0.8;
  }
  if (game.smoke) seen = 0; // a smoke bomb breaks every line of sight
  game.seenBy = seen > 0 ? 1 : 0;
  if (seen > 0) {
    if (game.alarm === 0) ev.push({ k: EVENTS.SEEN });
    const mul = game.alarm >= 0.6 ? ALARM.panic : 1;
    game.alarm = clamp(game.alarm + seen * (seen >= 1 ? ALARM.guard : ALARM.camera) * mul * dt, 0, 1.2);
  } else {
    game.alarm = clamp(game.alarm - ALARM.decay * dt, 0, 1.2);
  }

  // 8. Caught?
  if (game.alarm >= ALARM.caught) {
    game.state = 'caught'; game.flash = 0; ev.push({ k: EVENTS.CAUGHT });
    return ev;
  }

  // 9. Getaway clock and the exit.
  if (game.clockRunning) {
    game.clock -= dt;
    if (game.clock <= 0) { game.state = 'caught'; game.flash = 0; ev.push({ k: EVENTS.CAUGHT }); return ev; }
  }
  if (game.grabbed > 0 && dist(th.x, th.y, game.level.exit.x, game.level.exit.y) < VAULT.reach) {
    game.state = 'cleared'; ev.push({ k: EVENTS.CLEARED });
  }
  return ev;
}

function respawn(game) {
  const th = game.thief;
  th.x = game.level.spawn.x; th.y = game.level.spawn.y;
  game.alarm = 0; game.smoke = null;
  game.clock = Math.max(6, game.clock - HEIST.respawnPenalty);
  game.guards = game.level.guards.map(g => ({ ...g, heading: g.a, t: 0 }));
  game.state = 'playing';
}

function turnToward(face, want, max) {
  let da = Math.atan2(Math.sin(want - face), Math.cos(want - face));
  return face + clamp(da, -max, max);
}
