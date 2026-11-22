// alarm.js -- the meter and its three moods. Calm while nothing has seen you,
// suspicious once a lens or torch has had a nibble, alert past the hot line.
// At alert the eyes stop sweeping their beat and fix on the last sighting.
import { ALARM } from './tuning.js';

export const MOOD = { CALM: 'calm', SUSPICIOUS: 'suspicious', ALERT: 'alert', LOCKDOWN: 'lockdown' };

export function moodOf(alarm) {
  if (alarm >= ALARM.lockAt) return MOOD.LOCKDOWN;
  if (alarm >= ALARM.hotAt) return MOOD.ALERT;
  if (alarm >= ALARM.waryAt) return MOOD.SUSPICIOUS;
  return MOOD.CALM;
}

// A sighting drops a pin: the wardens stare at where you were for a heartbeat.
export function noteSighting(run, seen, wasSeen) {
  if (!seen) return;
  run.lastSeen = { x: run.burglar.x, y: run.burglar.y };
  if (!wasSeen) run.hunt = { at: run.lastSeen, life: ALARM.huntFor };
}

export function tickHunt(run, dt) {
  if (!run.hunt) return;
  run.hunt.life -= dt;
  if (run.hunt.life <= 0) run.hunt = null;
}

// One frame of the meter: a torch on you is the fastest way up, a lens slower,
// and it all cools at the same rate once the eyes come off you.
export function tickAlarm(run, dt, watchers) {
  if (watchers > 0) {
    const share = watchers >= 1 ? ALARM.warden : ALARM.eye;
    const mul = run.alarm >= ALARM.hotAt ? ALARM.panic : 1;
    run.alarm = Math.min(1.2, run.alarm + Math.min(watchers, 1) * share * mul * dt);
  } else {
    run.alarm = Math.max(0, run.alarm - ALARM.cool * dt);
  }
}