// patrol.js -- the wardens' night: two-tile beats walked back and forth, a
// stop at each end to sweep the torch, a head turned at the sound of a dash,
// and once the meter is hot, a stare fixed on the last place they saw you.
import { CELL, BURGLAR, WARDEN, ALARM } from './tuning.js';
import { span } from './detection.js';

export function steer(face, want, most) {
  const gap = Math.atan2(Math.sin(want - face), Math.cos(want - face));
  return face + Math.max(-most, Math.min(most, gap));
}

export function tickWardens(run, dt) {
  const body = run.burglar;
  const loud = body.dashing && !run.kit.slippers;
  const hurry = run.alarm >= ALARM.hotAt ? 1.25 : 1;
  const hunt = run.hunt;

  for (const w of run.wardens) {
    const other = w.aim === w.beat[0] ? w.beat[1] : w.beat[0];
    const ox = other[0] * CELL + CELL / 2, oy = other[1] * CELL + CELL / 2;
    const leg = span(w.x, w.y, ox, oy);

    if (loud && span(w.x, w.y, body.x, body.y) < BURGLAR.heard) w.nose = WARDEN.hark;

    if (w.nose > 0) {
      w.nose -= dt;
      w.face = steer(w.face, Math.atan2(body.y - w.y, body.x - w.x), WARDEN.swivel * dt);
      continue;
    }

    // the meter is hot: the warden stands his ground and stares at the spot
    if (hunt && span(w.x, w.y, hunt.at.x, hunt.at.y) < WARDEN.huntReach) {
      w.face = steer(w.face, Math.atan2(hunt.at.y - w.y, hunt.at.x - w.x), WARDEN.swivel * dt);
      continue;
    }

    if (leg < 2) {
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
}