// detection.js -- what the museum can see: the burglar's body against the
// walls, whether an open line exists, the torch and lens cones, and the tally
// of eyes on him this frame. Pure geometry, no canvas and no DOM.
import { CELL, WARDEN, EYE } from './tuning.js';
import { isWallTile, isVentTile } from './layout.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const span = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
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

// How many eyes are on the burglar: a torch counts one, a lens three quarters.
// Smoke breaks every line of sight while it lasts; so does practice mode, which
// the headless walk test uses to exercise the night's structure without asking
// a bot to play stealth.
export function watch(floor, run) {
  if (run.practice || run.smoke) return 0;
  const b = run.burglar;
  let watchers = 0;
  for (const w of run.wardens) {
    if (catches(floor, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, b.x, b.y)) watchers += 1;
  }
  for (const c of run.cameras) {
    if (c.dark > 0) continue;
    if (catches(floor, c.x, c.y, c.face, EYE.cone, EYE.half, b.x, b.y)) watchers += 0.75;
  }
  return watchers;
}

// The angle from an eye to a point, in the radian convention the cones use.
export const gazeTo = (fromX, fromY, toX, toY) => Math.atan2(toY - fromY, toX - fromX);