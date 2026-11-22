// tools/test.mjs — headless checks on the rules layer (never shipped; main.ts
// copies only game/ and screenshots/). Run: node tools/test.mjs
import { FLOORS } from './floors.mjs';
import { CELL, GRID_W, GRID_H, RAID, BURGLAR, WARDEN, EYE, ALARM } from '../game/src/tuning.js';
import {
  freshRun, beginNight, advance, WHEN, catches, squeezed, openLine,
} from '../game/src/rules.js';
import { loadFloor, tileChar, isWallTile, isVentTile } from '../game/src/layout.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const centre = (tx, ty) => ({ x: tx * CELL + CELL / 2, y: ty * CELL + CELL / 2 });
const tileOf = p => ({ tx: Math.floor(p.x / CELL), ty: Math.floor(p.y / CELL) });

// --- the plans themselves -------------------------------------------------------
ok('three floors', FLOORS.length === 3, `got ${FLOORS.length}`);
FLOORS.forEach((plan, i) => {
  ok(`floor ${i + 1} has ${GRID_H} rows`, plan.grid.length === GRID_H, `got ${plan.grid.length}`);
  const bad = plan.grid.map((r, y) => [y, r.length]).filter(([, n]) => n !== GRID_W);
  ok(`floor ${i + 1} rows are ${GRID_W} wide`, bad.length === 0, JSON.stringify(bad));
  const flat = plan.grid.join('');
  ok(`floor ${i + 1} has one entry`, (flat.match(/S/g) ?? []).length === 1);
  ok(`floor ${i + 1} has one staircase`, (flat.match(/X/g) ?? []).length === 1);
  ok(`floor ${i + 1} holds at least two pieces`, (flat.match(/[LGV]/g) ?? []).length >= 2);
  ok(`floor ${i + 1} fields at least two wardens`, (flat.match(/[123]/g) ?? []).length >= 2);
  ok(`floor ${i + 1} has a camera`, (flat.match(/[ab]/g) ?? []).length >= 1);
});
const vaultPlans = FLOORS.filter(p => p.grid.join('').includes('V'));
ok('the vault is on the last floor', FLOORS[2].grid.join('').includes('V') && vaultPlans.length === 1);

// --- reachability, floor by floor ------------------------------------------------
function flood(floor) {
  const seen = new Set();
  const q = [tileOf(floor.entry)];
  seen.add(`${q[0].tx},${q[0].ty}`);
  while (q.length) {
    const { tx, ty } = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy, k = `${nx},${ny}`;
      if (seen.has(k) || isWallTile(floor, nx, ny)) continue;
      seen.add(k); q.push({ tx: nx, ty: ny });
    }
  }
  return seen;
}

for (let i = 0; i < 3; i++) {
  const floor = loadFloor(i);
  const seen = flood(floor);
  const key = p => `${tileOf(p).tx},${tileOf(p).ty}`;
  ok(`floor ${i + 1}: stairs reachable`, seen.has(key(floor.stairs)));
  for (const item of floor.loot) ok(`floor ${i + 1}: ${item.kind} reachable`, seen.has(key(item)));
  for (const w of floor.wardens) {
    for (const [tx, ty] of w.beat) {
      ok(`floor ${i + 1}: warden ${w.mark} beat ${tx},${ty} walkable`, tileChar(floor, tx, ty) !== '#');
      ok(`floor ${i + 1}: warden ${w.mark} beat ${tx},${ty} reachable`, seen.has(`${tx},${ty}`));
    }
  }
  const vents = [];
  for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) if (isVentTile(floor, tx, ty)) vents.push(`${tx},${ty}`);
  ok(`floor ${i + 1}: has a duct`, vents.length >= 1, `got ${vents.length}`);
  ok(`floor ${i + 1}: ducts connected`, vents.every(k => seen.has(k)), vents.filter(k => !seen.has(k)).join(' '));
  ok(`floor ${i + 1}: entry is not inside a wall`, !squeezed(floor, floor.entry.x, floor.entry.y, BURGLAR.radius));
}

// --- collision and sight ---------------------------------------------------------
{
  const floor = loadFloor(0);
  ok('a wall cell is solid', squeezed(floor, CELL * 0.5, CELL * 0.5, BURGLAR.radius));
  ok('open marble is not solid', !squeezed(floor, CELL * 3.5, CELL * 9.5, BURGLAR.radius));
  const vent = loadFloor(0);
  ok('a duct tile is walkable', !isWallTile(vent, 9, 6));
  const ductEntry = centre(9, 6);
  ok('a duct is a vent tile', isVentTile(vent, 9, 6));
  ok('a duct breaks the line of sight',
    !openLine(vent, centre(8, 6).x, centre(8, 6).y, centre(17, 6).x, centre(17, 6).y));
  const open = centre(4, 9);
  const w = centre(8, 9);
  ok('a torch sees straight down its beam', catches(floor, open.x, open.y, 0, WARDEN.cone, WARDEN.half, w.x, w.y));
  ok('a torch is blind behind itself', !catches(floor, w.x, w.y, 0, WARDEN.cone, WARDEN.half, open.x, open.y));
  ok('a wall stops the lens',
    !catches(floor, centre(2, 4).x, centre(2, 4).y, 0, 400, 0.6, centre(19, 4).x, centre(19, 4).y));
}

// --- the alarm trips -------------------------------------------------------------
{
  const run = freshRun();
  beginNight(run);
  const w = run.wardens[0];
  run.burglar.x = w.x + 60; run.burglar.y = w.y;
  w.face = 0; w.nose = 1e9;
  let tripped = false;
  for (let i = 0; i < 60 * 10 && !tripped; i++) {
    for (const e of advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: null })) {
      if (e.k === WHEN.CAUGHT) tripped = true;
    }
  }
  ok('standing in a torch trips the alarm', tripped, `alarm=${run.alarm.toFixed(2)}`);
  ok('the trip puts the run in the caught phase', run.phase === 'caught');
}

// --- lifting and the clock -------------------------------------------------------
{
  const run = freshRun();
  beginNight(run);
  const item = run.loot.find(l => l.kind === 'case');
  run.burglar.x = item.x; run.burglar.y = item.y;
  for (let i = 0; i < 6; i++) advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: null });
  ok('a display case is lifted by walking onto it', run.loot.find(l => l.kind === 'case').gone);
  ok('the haul counts the case', run.haul === 220, `haul=${run.haul}`);
  ok('the getaway clock starts on the first piece', run.clockOn && run.clock > RAID.clock - 1, `clock=${run.clock.toFixed(1)}`);
}

// --- the vault takes standing time ------------------------------------------------
{
  const run = freshRun();
  beginNight(run);
  const b = run.burglar;
  const safeFloor = loadFloor(2);
  run.floorNo = 2; run.floor = safeFloor;
  run.loot = safeFloor.loot.map(l => ({ ...l }));
  const safe = run.loot.find(l => l.kind === 'vault');
  b.x = safe.x; b.y = safe.y;
  for (let i = 0; i < 120; i++) advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: null });
  ok('the safe is not cracked in two seconds by hand', !run.loot.find(l => l.kind === 'vault').gone);
  const run2 = freshRun();
  beginNight(run2);
  run2.floorNo = 2; run2.floor = loadFloor(2);
  run2.loot = run2.floor.loot.map(l => ({ ...l }));
  const safe2 = run2.loot.find(l => l.kind === 'vault');
  run2.burglar.x = safe2.x; run2.burglar.y = safe2.y;
  advance(run2, 1 / 60, { mx: 0, my: 0, dash: false, buy: 'crowbar' });
  let drilled = false;
  for (let i = 0; i < 60 * 2 && !drilled; i++) {
    for (const e of advance(run2, 1 / 60, { mx: 0, my: 0, dash: false, buy: null })) if (e.k === WHEN.DRILLED) drilled = true;
  }
  ok('the crowbar cracks the safe inside two seconds', drilled);
  ok('cracking the safe opens the vault door', !run2.floor.walls[run2.floor.door.ty][run2.floor.door.tx]);
}

// --- gear costs its price ----------------------------------------------------------
{
  const run = freshRun();
  beginNight(run);
  const before = run.purse;
  advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: 'flash' });
  ok('buying gear spends the purse', run.purse === before - 55, `purse=${run.purse}`);
  ok('the flashbulb blinds every camera', run.cameras.every(c => c.dark > 0));
  const run2 = freshRun();
  beginNight(run2);
  run2.purse = 10;
  advance(run2, 1 / 60, { mx: 0, my: 0, dash: false, buy: 'crowbar' });
  ok('gear is refused without the money', !run2.kit.crowbar && run2.purse === 10);
}

// --- the stairs: locked until the floor pays ----------------------------------------
{
  const run = freshRun();
  beginNight(run);
  run.burglar.x = run.floor.stairs.x; run.burglar.y = run.floor.stairs.y;
  for (let i = 0; i < 20; i++) advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: null });
  ok('the stairs stay locked with an empty bag', run.floorNo === 0);

  const run2 = freshRun();
  beginNight(run2);
  const item = run2.loot.find(l => l.kind === 'case');
  run2.burglar.x = item.x; run2.burglar.y = item.y;
  advance(run2, 1 / 60, { mx: 0, my: 0, dash: false, buy: null });
  run2.burglar.x = run2.floor.stairs.x; run2.burglar.y = run2.floor.stairs.y;
  let down = false;
  for (let i = 0; i < 6; i++) for (const e of advance(run2, 1 / 60, { mx: 0, my: 0, dash: false, buy: null })) if (e.k === WHEN.STAIRS) down = true;
  ok('a paid floor opens the stairs', down && run2.floorNo === 1, `floor=${run2.floorNo} pieces=${run2.floorPieces}`);
}

// --- respawn after a trip -----------------------------------------------------------
{
  const run = freshRun();
  beginNight(run);
  const item = run.loot.find(l => l.kind === 'case');
  run.burglar.x = item.x; run.burglar.y = item.y;
  advance(run, 1 / 60, { mx: 0, my: 0, dash: false, buy: null });
  run.clock = 60;
  run.phase = 'caught'; run.fade = RAID.fade - 0.01;
  advance(run, 0.02, { mx: 0, my: 0, dash: false, buy: null });
  ok('the trip fades back into play', run.phase === 'play');
  ok('the trip docks the clock', run.clock <= 60 - RAID.dock + 0.01, `clock=${run.clock.toFixed(1)}`);
  ok('the trip clears the alarm', run.alarm === 0);
  ok('the trip puts the burglar back at the entry',
    run.burglar.x === run.floor.entry.x && run.burglar.y === run.floor.entry.y);
}

// --- a whole night, walked by a bot over BFS paths ------------------------------------
function route(floor, from, to) {
  const start = tileOf(from);
  const goal = tileOf(to);
  const keyOf = (tx, ty) => `${tx},${ty}`;
  const prev = new Map();
  const seen = new Set([keyOf(start.tx, start.ty)]);
  const q = [start];
  while (q.length) {
    const { tx, ty } = q.shift();
    if (tx === goal.tx && ty === goal.ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy, k = keyOf(nx, ny);
      if (seen.has(k) || isWallTile(floor, nx, ny)) continue;
      seen.add(k);
      prev.set(k, { tx, ty });
      q.push({ tx: nx, ty: ny });
    }
  }
  const path = [];
  let cur = { tx: goal.tx, ty: goal.ty };
  if (!seen.has(keyOf(cur.tx, cur.ty))) return null;
  while (!(cur.tx === start.tx && cur.ty === start.ty)) {
    path.push(centre(cur.tx, cur.ty));
    cur = prev.get(keyOf(cur.tx, cur.ty));
    if (!cur) return null;
  }
  return path.reverse();
}

{
  const run = freshRun();
  beginNight(run);
  // practice mode: the eyes are off for this walk, so the test measures the
  // night's structure (routes, pieces, stairs chain, haul) rather than a bot's
  // stealth. The cones themselves are asserted further up.
  run.practice = true;
  let simTime = 0;
  const buys = ['crowbar', 'slippers'];
  const tick = act => {
    simTime += 1 / 60;
    const events = advance(run, 1 / 60, { buy: buys.shift() ?? null, dash: false, mx: 0, my: 0, ...act });
    return events;
  };
  // A simple stealth policy for the bot: when a cone is on him, run straight
  // away from every eye that can see him until the alarm lets go.
  const fleeStep = () => {
    const b = run.burglar;
    let vx = 0, vy = 0;
    for (const w of run.wardens) {
      const d = Math.hypot(b.x - w.x, b.y - w.y) + 1;
      vx += (b.x - w.x) / d; vy += (b.y - w.y) / d;
    }
    for (const c of run.cameras) {
      if (c.dark > 0) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y) + 1;
      vx += (b.x - c.x) / d; vy += (b.y - c.y) / d;
    }
    const m = Math.hypot(vx, vy) || 1;
    const awayX = vx / m, awayY = vy / m;
    // sidelong first: walking straight back into the eye's line is the usual way
    // a simple bot gets pinned, so try a step across the cone before retreating
    const tries = [
      [-awayY, awayX], [awayY, -awayX], [awayX, awayY], [-awayX, -awayY],
    ];
    let dir = null;
    for (const [dx, dy] of tries) {
      const nx = b.x + dx * 14, ny = b.y + dy * 14;
      if (!squeezed(run.floor, nx, ny, 11)) { dir = [dx, dy]; break; }
    }
    if (!dir) dir = [awayX, awayY];
    tick({ mx: dir[0], my: dir[1], dash: true });
  };
  const away = (target, limit = 40) => {
    let spent = 0;
    while (spent < limit * 60) {
      if (run.phase === 'cleared') return true;
      if (run.phase === 'caught') { tick(null); spent++; continue; }
      if (run.seen) { fleeStep(); spent++; continue; }
      const p = route(run.floor, run.burglar, target);
      if (!p) return false;
      for (const wp of p) {
        let guard = 0;
        while (Math.hypot(wp.x - run.burglar.x, wp.y - run.burglar.y) > 4 && guard++ < 240) {
          if (run.phase !== 'play') break;
          if (run.seen) { fleeStep(); spent++; guard--; continue; }
          const dx = wp.x - run.burglar.x, dy = wp.y - run.burglar.y;
          tick({ mx: dx, my: dy });
          spent += 1;
        }
        if (run.phase !== 'play') break;
      }
      if (Math.hypot(target.x - run.burglar.x, target.y - run.burglar.y) < 8) return true;
      if (run.phase === 'play') spent += 30;
    }
    return false;
  };
  const standStill = (frames) => {
    for (let i = 0; i < frames; i++) {
      if (run.phase !== 'play') { tick(null); continue; }
      if (run.seen) fleeStep(); else tick(null);
    }
  };

  let cleared = false;
  for (let f = 0; f < 3 && !cleared; f++) {
    ok(`walk: on floor ${f + 1}`, run.floorNo === f, `floor=${run.floorNo}`);
    for (const item of [...run.loot]) {
      if (item.gone) continue;
      if (item.kind === 'vault') {
        const reached = away(item);
        ok(`walk: reached the safe on floor ${f + 1}`, reached, `at=${Math.round(run.burglar.x)},${Math.round(run.burglar.y)}`);
        const safe = () => run.loot.find(l => l.kind === 'vault');
        for (let i = 0; i < 60 * 40 && !safe().gone; i++) {
          if (run.phase !== 'play') { tick(null); continue; }
          if (run.seen) { fleeStep(); continue; }
          const d = Math.hypot(run.burglar.x - safe().x, run.burglar.y - safe().y);
          if (d > 20) { tick({ mx: safe().x - run.burglar.x, my: safe().y - run.burglar.y, dash: true }); continue; }
          tick(null);
        }
        ok(`walk: the safe opens on floor ${f + 1}`, safe().gone);
      } else {
        ok(`walk: took the ${item.kind} on floor ${f + 1}`, away(item));
      }
    }
    const paid = away(run.floor.stairs);
    ok(`walk: reached the stairs on floor ${f + 1}`, paid, `at=${Math.round(run.burglar.x)},${Math.round(run.burglar.y)}`);
    if (f < 2) {
      // standing on the stairs is what takes them
      for (let i = 0; i < 60 * 20 && run.floorNo === f; i++) {
        if (run.phase !== 'play') { tick(null); continue; }
        if (run.seen) { fleeStep(); continue; }
        tick({ mx: run.floor.stairs.x - run.burglar.x, my: run.floor.stairs.y - run.burglar.y });
      }
      ok(`walk: down the stairs to floor ${f + 2}`, run.floorNo === f + 1, `floor=${run.floorNo}`);
    }
    if (run.phase === 'cleared') cleared = true;
  }
  for (let i = 0; i < 60 * 4 && run.phase !== 'cleared'; i++) {
    if (run.phase !== 'play') { tick(null); continue; }
    if (run.seen) fleeStep(); else tick(null);
  }
  ok('walk: the night ends out of the building', run.phase === 'cleared', `phase=${run.phase} floor=${run.floorNo}`);
  ok('walk: the whole night fits a sane clock', simTime < 1200, `sim=${simTime.toFixed(0)}s`);
  ok('walk: the haul is the full museum', run.haul === 3 * 380 + 2 * 220 + 650, `haul=${run.haul}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
