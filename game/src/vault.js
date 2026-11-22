// vault.js -- the night's takings: display cases and pedestals lifted by touch,
// the safe on the last floor drilled by standing at it, and the steel door in
// the wall that only opens once the safe is empty.
import { SAFE, VALUE, RAID } from './tuning.js';
import { span } from './detection.js';

export function startClock(run) {
  if (run.clockOn) return;
  run.clockOn = true;
  run.clock = RAID.clock;
}

export const drillNeed = kit => (kit.crowbar ? SAFE.drilled : SAFE.drill);

// How far the drill has got, 0..1, for the ring painted on the safe.
export function drillShare(safe, kit) {
  if (!safe) return 0;
  const need = drillNeed(kit);
  return Math.max(0, Math.min(1, safe.worked / need));
}

export function tickLoot(run, dt, WHEN, log) {
  const body = run.burglar;

  for (const item of run.loot) {
    if (item.gone || item.kind === 'vault') continue;
    if (span(body.x, body.y, item.x, item.y) < SAFE.reach) {
      item.gone = true;
      run.haul += VALUE[item.kind];
      run.pieces++; run.floorPieces++;
      startClock(run);
      log.push({ k: WHEN.LIFT, kind: item.kind });
    }
  }

  const safe = run.loot.find(l => l.kind === 'vault');
  if (!safe || safe.gone) return;

  const atSafe = span(body.x, body.y, safe.x, safe.y) < SAFE.reach;
  if (atSafe) {
    safe.worked += dt * (run.kit.crowbar ? 3 : 1);
    if (safe.worked >= drillNeed(run.kit)) {
      safe.gone = true;
      run.haul += VALUE.vault;
      run.pieces++; run.floorPieces++;
      openVaultDoor(run.floor);
      startClock(run);
      log.push({ k: WHEN.DRILLED });
    }
  } else if (safe.worked > 0) {
    safe.worked = Math.max(0, safe.worked - dt);
  }
}

export function openVaultDoor(floor) {
  if (!floor.door) return;
  floor.walls[floor.door.ty][floor.door.tx] = false;
}