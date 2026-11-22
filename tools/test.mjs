// tools/test.mjs — headless checks for the rules layer (never shipped: main.ts copies only game/).
// Run: node tools/test.mjs
import { MAP_ROWS, buildLevel, tileAt } from '../game/src/map.js';
import { TILE, COLS, ROWS, HEIST } from '../game/src/constants.js';
import { makeGame, startRun, step, EVENTS, coneSees, blocked, inDuct } from '../game/src/stealth.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

// --- map shape -----------------------------------------------------------------
ok('18 rows', MAP_ROWS.length === ROWS, `got ${MAP_ROWS.length}`);
const badRows = MAP_ROWS.map((r, i) => [i, r.length]).filter(([, n]) => n !== COLS);
ok('every row is 32 cols', badRows.length === 0, JSON.stringify(badRows));

const level = buildLevel();
ok('spawn exists', !!level.spawn);
ok('exit exists', !!level.exit);
ok('3 guards', level.guards.length === 3, `got ${level.guards.length}`);
ok('3 cameras', level.cameras.length === 3, `got ${level.cameras.length}`);
ok('4 loot', level.loot.length === 4, level.loot.map(l => l.kind).join(','));

// patrol endpoints must be walkable floor (the classic "doorway sealed" bug)
for (const g of level.guards) {
  for (const [tx, ty] of [g.a, g.b]) {
    ok(`guard ${g.id} waypoint ${tx},${ty} walkable`, tileAt(level, tx, ty) === '.');
  }
}

// --- connectivity --------------------------------------------------------------
function flood(from) {
  const seen = new Set([`${Math.floor(from.x / TILE)},${Math.floor(from.y / TILE)}`]);
  const q = [[Math.floor(from.x / TILE), Math.floor(from.y / TILE)]];
  while (q.length) {
    const [tx, ty] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy, k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      const ch = tileAt(level, nx, ny);
      if (ch === '#') continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
const reach = flood(level.spawn);
const tileKey = (p) => `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`;
ok('exit reachable from spawn', reach.has(tileKey(level.exit)));
for (const l of level.loot) ok(`loot ${l.kind} reachable`, reach.has(tileKey(l)));
for (const g of level.guards) for (const [tx, ty] of [g.a, g.b]) ok(`guard ${g.id} beat reachable`, reach.has(`${tx},${ty}`));
// ducts must be on the reachable side too, otherwise the stealth route is a lie
const ductTiles = [];
MAP_ROWS.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'd') ductTiles.push(`${x},${y}`); }));
ok('at least 4 duct tiles', ductTiles.length >= 4, `got ${ductTiles.length}`);
ok('all ducts connected', ductTiles.every(k => reach.has(k)), ductTiles.filter(k => !reach.has(k)).join(' '));

// --- collision & sight ---------------------------------------------------------
ok('spawn not blocked', !blocked(level, level.spawn.x, level.spawn.y, 11));
ok('wall blocks', blocked(level, TILE * 0.5, TILE * 0.5, 11));
ok('duct is not a wall', !blocked(level, ductTiles.length ? Number(ductTiles[0].split(',')[0]) * TILE + 20 : 60,
  ductTiles.length ? Number(ductTiles[0].split(',')[1]) * TILE + 20 : 60, 6));
ok('duct sensed as duct', ductTiles.length > 0 && inDuct(level, Number(ductTiles[0].split(',')[0]) * TILE + 20, Number(ductTiles[0].split(',')[1]) * TILE + 20));

const g0 = level.guards[0];
ok('cone sees straight ahead', coneSees(level, g0.x, g0.y, Math.PI / 2, 210, 0.58, g0.x, g0.y + 120));
ok('cone blind behind', !coneSees(level, g0.x, g0.y, Math.PI / 2, 210, 0.58, g0.x, g0.y - 120));

// --- getting caught ------------------------------------------------------------
{
  const game = makeGame(level);
  startRun(game);
  const guard = game.guards[0];
  game.thief.x = guard.x; game.thief.y = guard.y + 100;
  guard.face = Math.PI / 2; guard.reactTimer = 1e9; // stare at the thief
  let caught = false;
  for (let i = 0; i < 60 * 8 && !caught; i++) {
    for (const e of step(game, 1 / 60, { dx: 0, dy: 0 })) if (e.k === EVENTS.CAUGHT) caught = true;
  }
  ok('standing in a cone ends the run', caught, `alarm=${game.alarm.toFixed(2)} state=${game.state}`);
}

// --- loot + getaway ------------------------------------------------------------
{
  const game = makeGame(level);
  startRun(game);
  const item = game.loot.find(l => l.kind === 'case');
  game.thief.x = item.x; game.thief.y = item.y;
  for (let i = 0; i < 10; i++) step(game, 1 / 60, { dx: 0, dy: 0 });
  ok('case picked up', game.loot.find(l => l.kind === 'case').taken);
  ok('haul counted', game.haul === 220, `haul=${game.haul}`);
  ok('getaway clock started', game.clockRunning && game.clock > 80, `clock=${game.clock.toFixed(1)}`);
}

// --- vault needs standing time --------------------------------------------------
{
  const game = makeGame(level);
  startRun(game);
  const vault = game.loot.find(l => l.kind === 'vault');
  game.thief.x = vault.x; game.thief.y = vault.y;
  for (let i = 0; i < 60 * 2; i++) step(game, 1 / 60, { dx: 0, dy: 0 });
  ok('vault not cracked in 2s', !game.loot.find(l => l.kind === 'vault').taken);
  game.tools.pick = true;
  for (let i = 0; i < 60 * 2; i++) step(game, 1 / 60, { dx: 0, dy: 0 });
  ok('vault cracked with lockpick in 4s', game.loot.find(l => l.kind === 'vault').taken);
}

// --- escape --------------------------------------------------------------------
{
  const game = makeGame(level);
  startRun(game);
  game.grabbed = 1; game.haul = 220; game.clockRunning = true; game.clock = 60;
  game.thief.x = level.exit.x; game.thief.y = level.exit.y;
  let cleared = false;
  for (let i = 0; i < 10; i++) for (const e of step(game, 1 / 60, { dx: 0, dy: 0 })) if (e.k === EVENTS.CLEARED) cleared = true;
  ok('exit clears the run with loot', cleared && game.state === 'cleared');
}

// --- respawn after being caught ------------------------------------------------
{
  const game = makeGame(level);
  startRun(game);
  game.clockRunning = true; game.clock = 60;
  game.state = 'caught'; game.flash = HEIST.flash - 0.01;
  step(game, 0.02, null);
  ok('respawn restores playing', game.state === 'playing');
  ok('respawn docks the clock', game.clock <= 40.01, `clock=${game.clock.toFixed(1)}`);
  ok('respawn resets the alarm', game.alarm === 0);
  ok('respawn puts thief at start', game.thief.x === level.spawn.x && game.thief.y === level.spawn.y);
}

// --- full playthrough: spawn → case → exit must be a real winnable route -------
{
  const game = makeGame(level);
  startRun(game);
  const goTo = async (target, seconds = 14) => {
    // being caught respawns the thief at the entrance; keep steering and retry
    for (let i = 0; i < 60 * seconds; i++) {
      if (game.state === 'cleared') return true;
      const dx = target[0] - game.thief.x, dy = target[1] - game.thief.y;
      if (Math.hypot(dx, dy) < 12) return true;
      step(game, 1 / 60, { dx, dy, sprint: false });
    }
    return false;
  };
  const caseAt = [13 * TILE + 20, 4 * TILE + 20];   // display case in the north plinth
  const exitAt = [level.exit.x, level.exit.y];
  const leg1 = await goTo([420, 300]);               // into the corridor
  ok('route: corridor', leg1 && game.state === 'playing');
  const leg2 = await goTo([360, 220]);               // up the col-8/9 gap into the gallery row
  ok('route: into the plinth', leg2 && game.state === 'playing');
  const leg3 = await goTo(caseAt);                   // grab the case
  ok('route: case taken on the way', game.loot.find(l => l.kind === 'case').taken);
  const leg4 = await goTo([360, 220]) && await goTo([420, 300]); // back out to the corridor
  ok('route: back out', leg4 && game.state === 'playing');
  const leg5 = await goTo(exitAt, 20);               // straight down the corridor to the EXIT
  ok('route: full heist clears', leg5 && game.state === 'cleared',
    `state=${game.state} alarm=${game.alarm.toFixed(2)} at=${Math.round(game.thief.x)},${Math.round(game.thief.y)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
