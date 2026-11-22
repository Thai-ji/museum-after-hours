// gear.js -- the purse and the four things it buys. One purchase per item for
// the whole night; each spends its price once and takes effect the same frame.
import { KIT, EYE } from './tuning.js';

export const priceOf = key => KIT.find(t => t.key === key)?.cost ?? 0;

export function buyGear(run, key, WHEN, log) {
  if (!key || run.kit[key]) return false;
  const cost = priceOf(key);
  if (!(cost > 0 && cost <= run.purse)) return false;
  run.purse -= cost;
  run.kit[key] = true;
  if (key === 'flash') run.cameras.forEach(c => { c.dark = EYE.blind; });
  if (key === 'smoke') run.smoke = { x: run.burglar.x, y: run.burglar.y, life: 5 };
  log.push({ k: WHEN.GEAR, tool: key });
  return true;
}

export function tickSmoke(run, dt) {
  if (!run.smoke) return;
  run.smoke.life -= dt;
  if (run.smoke.life <= 0) run.smoke = null;
}