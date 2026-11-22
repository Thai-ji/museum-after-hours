// getaway.js -- the clock that starts the moment the first piece leaves its
// case, and the stairs that are the only way out before it dies.
import { RAID, SAFE } from './tuning.js';
import { span } from './detection.js';

export function tickGetaway(run, dt) {
  if (!run.clockOn) return false;
  run.clock -= dt;
  return run.clock <= 0;
}

export function atStairs(run) {
  const s = run.floor.stairs;
  return span(run.burglar.x, run.burglar.y, s.x, s.y) < SAFE.reach;
}

export const clockLost = () => RAID.dock;