// view.js - the museum at night: what the player sees. A still backdrop is
// painted once per floor (props.js) and blitted after; on top go the torch and
// lens cones, the vault door, the loot, the cast, and the HUD. A warden is
// drawn in one of three states (calm / ? / !) so his intent is legible in a
// still frame. Every frame a screenshot shows is a state the rules produced.
import {
  VIEW_W, VIEW_H, CELL, WARDEN, EYE, ALARM, KIT, PURSE, INK,
} from './tuning.js';
import { catches } from './detection.js';
import { moodOf } from './alarm.js';
import { drillShare } from './vault.js';
import { FACE, rrect, halo } from './art.js';

const TOP_H = 88;
const TRAY_Y = VIEW_H - 76;

const STATE_COLOR = {
  calm: '#5ff0a0',
  suspicious: '#ffc247',
  alert: '#ff7a4d',
  lockdown: '#ff2f44',
};
const STATE_WORD = {
  calm: 'CALM',
  suspicious: 'SUSPECT',
  alert: 'ALERT',
  lockdown: 'LOCKDOWN',
};

const mmss = s => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const r = Math.floor(t % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- light cones

// A cone stops at the first wall or duct it meets, so the drawn beam is the
// same beam detection.js tests: a torch through a wall would be a lie.
function conePath(cx, cy, face, half, reach, floor) {
  const steps = Math.max(16, Math.ceil((half * 2) / 0.028));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = face - half + (2 * half) * i / steps;
    const dx = Math.cos(a), dy = Math.sin(a);
    let hit = reach;
    for (let s = 6; s <= reach; s += 5) {
      const tx = Math.floor((cx + dx * s) / CELL);
      const ty = Math.floor((cy + dy * s) / CELL);
      if (tx < 0 || ty < 0 || tx >= floor.width || ty >= floor.height
        || floor.walls[ty][tx] || floor.vents[ty][tx]) { hit = Math.max(0, s - 5); break; }
    }
    pts.push([cx + dx * hit, cy + dy * hit]);
  }
  return pts;
}

function cone(ctx, cx, cy, face, reach, half, inner, outer, dashed, floor, weight = 2) {
  const pts = conePath(cx, cy, face, half, reach, floor);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, reach);
  g.addColorStop(0, `rgba(${inner},0.55)`);
  g.addColorStop(0.55, `rgba(${inner},0.26)`);
  g.addColorStop(1, `rgba(${inner},0.03)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${outer},0.8)`;
  ctx.lineWidth = weight;
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.stroke();
  ctx.restore();
}

// What a warden believes right now: nothing (calm), a noise or a fresh
// sighting nearby (suspicious), or the burglar in his torch beam (alert).
function guardMood(floor, run, w) {
  if (run.phase === 'caught') return 'alert';
  if (catches(floor, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, run.burglar.x, run.burglar.y)) return 'alert';
  if (run.alarm >= ALARM.hotAt) return 'alert';
  if (w.nose > 0) return 'suspicious';
  if (run.hunt && Math.hypot(w.x - run.hunt.at.x, w.y - run.hunt.at.y) < WARDEN.huntReach) return 'suspicious';
  return 'calm';
}

function lights(ctx, run, floor) {
  const b = run.burglar;
  for (const w of run.wardens) {
    const mood = guardMood(floor, run, w);
    halo(ctx, w.x, w.y, 44, mood === 'calm' ? '255,170,100' : mood === 'suspicious' ? '255,204,84' : '255,60,60', 0.24);
    if (mood === 'alert') cone(ctx, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, '255,58,58', '255,78,78', false, floor, 2.6);
    else if (mood === 'suspicious') cone(ctx, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, '255,204,84', '255,226,120', false, floor, 2.4);
    else cone(ctx, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, '255,178,104', '255,206,146', false, floor, 1.8);
    if (mood === 'alert') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,70,70,0.55)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
  }
  for (const c of run.cameras) {
    if (c.dark > 0) continue;
    const hot = !run.smoke && catches(floor, c.x, c.y, c.face, EYE.cone, EYE.half, b.x, b.y);
    cone(ctx, c.x, c.y, c.face, EYE.cone, EYE.half,
      hot ? '255,70,70' : '255,196,80', hot ? '255,90,90' : '255,214,120', !hot, floor, hot ? 2.4 : 2);
    if (hot) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,90,0.6)';
      ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- the cast

function guard(ctx, w, mood) {
  const tint = mood === 'alert' ? '#ff5048' : mood === 'suspicious' ? '#ffb648' : INK.warden;
  const scale = mood === 'calm' ? 1 : 1.08;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.scale(scale, scale);
  ctx.rotate(w.face);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 12, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  // shoulders
  ctx.fillStyle = tint;
  rrect(ctx, -10, -10, 24, 21, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.4;
  rrect(ctx, -10, -10, 24, 21, 8); ctx.stroke();
  // hi-vis stripe
  ctx.fillStyle = 'rgba(255,236,180,0.85)';
  ctx.fillRect(-6, -9, 3, 19);
  ctx.fillRect(0, -9, 3, 19);
  // helmet
  ctx.fillStyle = '#f2d9cf';
  ctx.beginPath(); ctx.arc(4, -1, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b3040';
  ctx.beginPath(); ctx.arc(4, 4, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
  ctx.fillStyle = '#0b0f1a';
  ctx.beginPath(); ctx.arc(7, -2, 1.5, 0, Math.PI * 2); ctx.fill();
  // the torch
  ctx.strokeStyle = '#20283a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(15, 2); ctx.stroke();
  ctx.fillStyle = '#ffe7ae';
  ctx.beginPath(); ctx.arc(16, 1, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,231,174,0.35)';
  ctx.beginPath(); ctx.arc(16, 1, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // the state bubble: ? = heard something, ! = has eyes on you
  if (mood !== 'calm') {
    const alert = mood === 'alert';
    ctx.save();
    ctx.translate(w.x, w.y - 34);
    if (alert) halo(ctx, 0, 0, 26, '255,60,60', 0.45);
    ctx.fillStyle = alert ? '#ff3d43' : '#ffc247';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(6,10,18,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = alert ? '#fff' : '#101720';
    ctx.font = `bold 19px ${FACE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(alert ? '!' : '?', 0, 1);
    ctx.restore();
  }
}

function camera(ctx, c, hot) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.face);
  // mount
  ctx.strokeStyle = 'rgba(150,175,220,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-8, 0); ctx.stroke();
  // body
  ctx.fillStyle = c.dark > 0 ? '#3d4352' : '#232c40';
  rrect(ctx, -9, -7, 24, 14, 4); ctx.fill();
  ctx.strokeStyle = hot ? '#ff5a5a' : c.dark > 0 ? '#707a8c' : INK.eye; ctx.lineWidth = hot ? 2.4 : 1.8;
  rrect(ctx, -9, -7, 24, 14, 4); ctx.stroke();
  // lens
  ctx.fillStyle = '#070b14';
  ctx.beginPath(); ctx.arc(12, 0, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255,214,120,0.85)`; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(12, 0, 5.2, 0, Math.PI * 2); ctx.stroke();
  if (c.dark > 0) {
    ctx.strokeStyle = '#94a0b4'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(8, 8); ctx.stroke();
  } else {
    ctx.fillStyle = hot ? '#ff4d4d' : INK.alarm;
    ctx.beginPath(); ctx.arc(-4, -5, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function burglar(ctx, run) {
  const b = run.burglar;
  const hero = run.heroScale || 1;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (hero > 1) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 84);
    g.addColorStop(0, 'rgba(255,182,112,0.17)');
    g.addColorStop(1, 'rgba(255,182,112,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.fill();
  }
  halo(ctx, 0, 0, 44, '92,232,192', 0.34);
  ctx.scale(hero, hero);
  ctx.fillStyle = 'rgba(255,170,100,0.13)';
  ctx.beginPath(); ctx.ellipse(0, 15, 30, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 12, 14, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  // hooded coat
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.quadraticCurveTo(14, -11, 11, 9);
  ctx.quadraticCurveTo(0, 17, -11, 9);
  ctx.quadraticCurveTo(-14, -11, 0, -17);
  ctx.closePath();
  ctx.fillStyle = INK.burglar;
  ctx.fill();
  // the warm rim: a lit edge so the one moving body reads at 768 wide
  ctx.strokeStyle = 'rgba(255,196,132,0.62)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // the light comes from the upper left, so only that edge is white
  ctx.strokeStyle = 'rgba(240,255,250,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, 4);
  ctx.quadraticCurveTo(-14, -11, 0, -17);
  ctx.stroke();
  // brim of the hood, so the silhouette is a thief and not a blob
  ctx.fillStyle = '#0d272b';
  ctx.beginPath(); ctx.ellipse(0, -16, 9.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  // strap and kit bag
  ctx.strokeStyle = 'rgba(8,20,26,0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(9, 5); ctx.stroke();
  // the kit bag over the shoulder
  ctx.fillStyle = '#17342c';
  ctx.beginPath(); ctx.arc(8, 4, 5, 0, Math.PI * 2); ctx.fill();
  // mask
  ctx.fillStyle = '#08111f';
  rrect(ctx, -6.4, -12.6, 12.8, 7.2, 3); ctx.fill();
  ctx.fillStyle = 'rgba(150,255,225,0.95)';
  ctx.fillRect(-4.2, -9.9, 2.7, 2.1);
  ctx.fillRect(1.6, -9.9, 2.7, 2.1);
  ctx.restore();

  // the bag: every piece on him shows as a small cut stone riding with him
  if (run.pieces > 0) {
    const n = Math.min(3, run.pieces);
    for (let i = 0; i < n; i++) {
      const a = run.t * 1.4 + i * 2.1;
      const px = b.x + Math.cos(a) * 15 * hero;
      const py = b.y - 24 * hero + Math.sin(a) * 3 * hero;
      ctx.fillStyle = 'rgba(255,224,150,0.85)';
      ctx.beginPath();
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px + 4, py);
      ctx.lineTo(px, py + 4);
      ctx.lineTo(px - 4, py);
      ctx.closePath();
      ctx.fill();
    }
  }

  // a dash is loud: three rings of sound leaving the burglar
  if (b.dashing && !run.kit.slippers) {
    ctx.save();
    ctx.translate(b.x, b.y);
    for (let i = 0; i < 3; i++) {
      const ring = (run.t * 1.25 + i / 3) % 1;
      ctx.strokeStyle = `rgba(255,150,110,${0.5 * (1 - ring)})`;
      ctx.lineWidth = 2.4 - ring * 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 26 + ring * 150, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,170,120,0.9)';
    ctx.font = `bold 13px ${FACE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NOISE', 0, -34);
    ctx.restore();
  }

  if (run.smoke) {
    ctx.save();
    const k = Math.min(1, run.smoke.life);
    halo(ctx, run.smoke.x, run.smoke.y, 96, '210,225,245', 0.30 * k);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- footprints
// The cover points the eye at the burglar: a line of warm prints shows the
// route he has just run, from the service door to the atrium.

function footprints(ctx, run) {
  if (!run.trail || run.trail.length < 2) return;
  const pts = run.trail;
  ctx.save();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const k = i / Math.max(1, pts.length - 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(255,206,150,${0.20 + 0.42 * k})`;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 6, 0, 4.2, 8.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- loot

function drawLoot(ctx, run) {
  for (const item of run.loot) {
    if (item.gone) continue;
    const pulse = 0.8 + 0.2 * Math.sin(run.t * 3.4 + item.x);
    ctx.save();
    ctx.translate(item.x, item.y);
    halo(ctx, 0, 0, 56, '243,198,107', 0.16 * pulse);

    if (item.kind === 'vault') {
      // the safe: a squat steel box with a dial, and a ring that fills as it drills
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 21, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#24344c';
      rrect(ctx, -24, -22, 48, 43, 5); ctx.fill();
      ctx.fillStyle = 'rgba(190,214,255,0.16)';
      rrect(ctx, -24, -22, 48, 8, 5); ctx.fill();
      ctx.strokeStyle = INK.brass; ctx.lineWidth = 2.4;
      rrect(ctx, -24, -22, 48, 43, 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,220,180,0.65)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, -1, 10.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = INK.brass;
      ctx.beginPath(); ctx.arc(0, -1, 3, 0, Math.PI * 2); ctx.fill();
      const share = drillShare(item, run.kit);
      if (share > 0) {
        ctx.strokeStyle = '#8df7c9'; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -1, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
        ctx.stroke();
        // drill sparks
        for (let i = 0; i < 9; i++) {
          const t = run.t * 9 + i * 1.7;
          const r = 16 + ((t * 13) % 20);
          ctx.fillStyle = `rgba(255,214,130,${0.8 - (r - 16) / 30})`;
          ctx.beginPath();
          ctx.arc(Math.cos(t) * r, -1 + Math.sin(t * 1.3) * r, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#bfffee';
        ctx.font = `bold 13px ${FACE}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`DRILL ${Math.round(share * 100)}%`, 0, -44);
      }
    } else if (item.kind === 'gem') {
      // a pedestal and a lit stone
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 16, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b2334';
      rrect(ctx, -13, 4, 26, 13, 3); ctx.fill();
      ctx.fillStyle = '#2c3a53';
      rrect(ctx, -13, 4, 26, 3, 1.5); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(11, -4); ctx.lineTo(0, 6); ctx.lineTo(-11, -4);
      ctx.closePath();
      ctx.fillStyle = '#9df0ff'; ctx.fill();
      ctx.strokeStyle = '#f2ffff'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(11, -4); ctx.stroke();
    } else {
      // a display case with something small and bright inside
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 17, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(190,220,255,0.10)';
      rrect(ctx, -15, -18, 30, 34, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(208,232,255,0.85)'; ctx.lineWidth = 1.8;
      rrect(ctx, -15, -18, 30, 34, 3); ctx.stroke();
      ctx.fillStyle = INK.brass;
      rrect(ctx, -7, -5, 14, 11, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-6, -17, 2, 32);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- the vault door
// The door is a wall until the safe empties; after that it is an open doorway
// with warm light coming out. Painted every frame so the change reads.

function vaultDoor(ctx, floor) {
  const d = floor.door;
  if (!d) return;
  const open = !floor.walls[d.ty][d.tx];
  ctx.save();
  ctx.translate(d.x, d.y);
  if (!open) {
    halo(ctx, 0, 0, 78, '243,198,107', 0.20);
    ctx.fillStyle = '#0c1320';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b2740'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3c4d63';
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(232,242,255,0.34)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(240,248,255,0.6)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 22, Math.sin(a) * 22, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#10182a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -3); ctx.stroke();
    ctx.fillStyle = INK.brass;
    ctx.font = `bold 10px ${FACE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VAULT', 0, -40);
    ctx.globalCompositeOperation = 'lighter';
    halo(ctx, 44, 0, 96, '255,206,140', 0.14);
  } else {
    // the frame and the black of the room beyond
    ctx.fillStyle = '#05070d';
    rrect(ctx, -17, -20, 34, 40, 4); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2.6;
    rrect(ctx, -17, -20, 34, 40, 4); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    halo(ctx, 0, 0, 96, '255,206,140', 0.26);
    ctx.globalCompositeOperation = 'source-over';
    // the leaf, swung back against the wall
    ctx.fillStyle = '#3c4d63';
    rrect(ctx, -42, -20, 11, 40, 3); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2;
    rrect(ctx, -42, -20, 11, 40, 3); ctx.stroke();
    ctx.fillStyle = INK.stairs;
    ctx.font = `bold 10px ${FACE}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('OPEN', 0, 26);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function hud(ctx, run, floor) {
  const mood = moodOf(run.alarm);
  const color = STATE_COLOR[mood];
  const pct = Math.round(Math.min(1, run.alarm / ALARM.trip) * 100);

  // ---- top strip
  const top = ctx.createLinearGradient(0, 0, 0, TOP_H);
  top.addColorStop(0, 'rgba(6,9,17,0.97)');
  top.addColorStop(1, 'rgba(6,9,17,0.82)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VIEW_W, TOP_H);
  ctx.fillStyle = 'rgba(130,155,215,0.30)';
  ctx.fillRect(0, TOP_H - 1, VIEW_W, 1);

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 34px ${FACE}`;
  ctx.fillText(`$${run.haul}`, 24, 34);
  ctx.fillStyle = INK.textDim;
  ctx.font = `bold 14px ${FACE}`;
  ctx.fillText(`${run.pieces} PIECES  /  FLOOR ${run.floorNo + 1} OF 3`, 24, 64);

  // ---- alarm: state word, percentage, meter with its three thresholds
  const ax = 430, aw = 420;
  ctx.fillStyle = color;
  rrect(ctx, ax, 10, 172, 30, 6); ctx.fill();
  const onBright = mood === 'calm' || mood === 'suspicious';
  ctx.fillStyle = onBright ? '#08131f' : '#fff';
  ctx.font = `bold 18px ${FACE}`;
  ctx.textAlign = 'center';
  ctx.fillText(STATE_WORD[mood], ax + 86, 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = `bold 22px ${FACE}`;
  ctx.fillText(`${pct}%`, ax + aw, 26);

  const my = 48, mh = 18;
  ctx.fillStyle = 'rgba(18,24,40,0.95)';
  rrect(ctx, ax, my, aw, mh, 4); ctx.fill();
  ctx.save();
  rrect(ctx, ax, my, aw, mh, 4); ctx.clip();
  const fill = ctx.createLinearGradient(ax, 0, ax + aw, 0);
  fill.addColorStop(0, mood === 'calm' ? '#2f9f6e' : color);
  fill.addColorStop(1, mood === 'lockdown' ? '#ff6a6a' : color);
  ctx.fillStyle = fill;
  ctx.fillRect(ax, my, Math.max(5, aw * run.alarm / ALARM.trip), mh);
  for (let i = 1; i < 12; i++) {
    ctx.fillStyle = 'rgba(6,9,16,0.42)';
    ctx.fillRect(ax + (aw / 12) * i, my + 3, 1.4, mh - 6);
  }
  ctx.restore();
  for (const t of [ALARM.waryAt, ALARM.hotAt, ALARM.lockAt]) {
    const tx = ax + aw * t;
    ctx.fillStyle = 'rgba(6,9,16,0.85)';
    ctx.fillRect(tx - 1, my - 3, 2.4, mh + 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `bold 11px ${FACE}`;
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax + 9, my + mh / 2 + 1);
  ctx.strokeStyle = `rgba(230,240,255,${mood === 'calm' ? 0.22 : 0.5})`;
  ctx.lineWidth = 1.2;
  rrect(ctx, ax, my, aw, mh, 4); ctx.stroke();

  // ---- the sentence that tells the player what to do next
  let hint, hintColor;
  if (run.seen) { hint = 'SPOTTED - break the line of sight'; hintColor = STATE_COLOR.alert; }
  else if (run.hunt) { hint = 'HUNTED - they are closing on your last sight'; hintColor = STATE_COLOR.alert; }
  else if (mood === 'lockdown') { hint = 'LOCKDOWN - every warden is converging'; hintColor = STATE_COLOR.lockdown; }
  else if (mood === 'alert') { hint = 'ALERT - the house is hunting you'; hintColor = STATE_COLOR.alert; }
  else if (mood === 'suspicious') { hint = 'SUSPECT - stay out of the cones to cool off'; hintColor = STATE_COLOR.suspicious; }
  else { hint = 'CALM - nothing has seen you'; hintColor = INK.textDim; }
  ctx.textAlign = 'left';
  ctx.fillStyle = hintColor;
  ctx.font = `bold 13px ${FACE}`;
  ctx.fillText(hint, ax, 79);

  // ---- countdown
  ctx.textAlign = 'right';
  if (run.clockOn) {
    const low = run.clock < 20;
    ctx.fillStyle = low ? INK.alarm : INK.text;
    ctx.font = `bold 36px ${FACE}`;
    ctx.fillText(mmss(run.clock), VIEW_W - 24, 32);
    ctx.fillStyle = low ? STATE_COLOR.alert : INK.textDim;
    ctx.font = `bold 13px ${FACE}`;
    ctx.fillText(low ? 'GETAWAY - MOVE' : 'GETAWAY CLOCK', VIEW_W - 24, 61);
  } else {
    ctx.fillStyle = INK.text;
    ctx.font = `bold 30px ${FACE}`;
    ctx.fillText('ARMED', VIEW_W - 24, 32);
    ctx.fillStyle = INK.textDim;
    ctx.font = `bold 13px ${FACE}`;
    ctx.fillText('FIRST PIECE STARTS IT', VIEW_W - 24, 61);
  }
  ctx.fillStyle = 'rgba(230,236,248,0.45)';
  ctx.font = `11px ${FACE}`;
  ctx.fillText('reach the stairs before it dies', VIEW_W - 24, 79);

  // ---- gear tray
  ctx.fillStyle = 'rgba(6,9,17,0.94)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 76);
  ctx.fillStyle = 'rgba(130,155,215,0.30)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 17px ${FACE}`;
  ctx.fillText(`PURSE $${run.purse}`, 24, TRAY_Y + 23);
  ctx.fillStyle = run.floorPieces > 0 ? INK.stairs : INK.textDim;
  ctx.font = `bold 12px ${FACE}`;
  ctx.fillText(run.floorPieces > 0 ? 'STAIRS OPEN' : 'STAIRS LOCKED', 24, TRAY_Y + 45);
  ctx.fillStyle = 'rgba(230,236,248,0.5)';
  ctx.font = `11px ${FACE}`;
  ctx.fillText(run.floorPieces > 0 ? 'the green door is lit' : 'lift a piece to open them', 24, TRAY_Y + 62);

  const owned = KIT.filter(t => run.kit[t.key]).length;
  KIT.forEach((tool, i) => {
    const bx = 214 + i * 207;
    const had = !!run.kit[tool.key];
    const can = run.purse >= tool.cost && !had;
    ctx.fillStyle = had ? 'rgba(92,232,192,0.16)' : can ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)';
    rrect(ctx, bx, TRAY_Y + 9, 198, 58, 6); ctx.fill();
    ctx.strokeStyle = had ? INK.burglar : can ? 'rgba(210,222,245,0.42)' : 'rgba(130,140,160,0.22)';
    ctx.lineWidth = 1.4;
    rrect(ctx, bx, TRAY_Y + 9, 198, 58, 6); ctx.stroke();
    ctx.fillStyle = had ? INK.burglar : can ? INK.text : '#5d6678';
    ctx.font = `bold 15px ${FACE}`;
    ctx.fillText(`[${i + 1}] ${tool.tag.toUpperCase()}`, bx + 10, TRAY_Y + 29);
    ctx.fillStyle = had ? '#9ff7dc' : can ? 'rgba(214,226,248,0.82)' : 'rgba(130,140,160,0.62)';
    ctx.font = `11px ${FACE}`;
    ctx.fillText(had ? 'IN THE BAG' : `$${tool.cost}  ${tool.blurb}`, bx + 10, TRAY_Y + 50);
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 18px ${FACE}`;
  ctx.fillText(`BAG $${run.haul}`, VIEW_W - 24, TRAY_Y + 25);
  ctx.fillStyle = INK.textDim;
  ctx.font = `bold 12px ${FACE}`;
  ctx.fillText(`TOOLS ${owned}/4`, VIEW_W - 24, TRAY_Y + 46);
  ctx.fillStyle = 'rgba(230,236,248,0.45)';
  ctx.font = `11px ${FACE}`;
  ctx.fillText('three floors / one night', VIEW_W - 24, TRAY_Y + 63);

  // ---- the alarm speaks once, big, over the floor
  const loud = run.seen || run.hunt || mood === 'alert' || mood === 'lockdown';
  if (loud) {
    const text = mood === 'lockdown' ? 'LOCKDOWN - EVERY WARDEN IS COMING'
      : run.seen ? 'SPOTTED - BREAK THE LINE OF SIGHT'
        : 'HUNTED - MOVE, NOW';
    const pulse = 0.72 + 0.28 * Math.sin(run.t * 8);
    ctx.font = `bold 20px ${FACE}`;
    const w = ctx.measureText(text).width + 40;
    const bx = (VIEW_W - w) / 2, by = TRAY_Y - 52;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(10,12,20,0.9)';
    rrect(ctx, bx, by, w, 36, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    rrect(ctx, bx, by, w, 36, 7); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, VIEW_W / 2, by + 19);
    ctx.restore();
  }

  // ---- red edge when the house is awake
  if (run.alarm >= ALARM.hotAt || run.seen) {
    const beat = (mood === 'lockdown' ? 0.18 : 0.10) + 0.07 * Math.sin(run.t * 9);
    const edge = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.40, VIEW_W / 2, VIEW_H / 2, VIEW_H);
    edge.addColorStop(0, 'rgba(255,40,50,0)');
    edge.addColorStop(1, `rgba(255,40,50,${beat})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------------------------------------------------------- screens

function titles(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#070b15');
  g.addColorStop(0.55, '#0b1222');
  g.addColorStop(1, '#050810');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2 + 40);
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#101a2a';
  ctx.beginPath(); ctx.arc(0, 0, 236, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK.brassDim; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(0, 0, 236, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(243,198,107,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
    ctx.lineTo(Math.cos(a) * 226, Math.sin(a) * 226);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 66px ${FACE}`;
  ctx.fillText('VAULT RUNNER', VIEW_W / 2, 208);
  ctx.fillStyle = INK.burglar;
  ctx.font = `bold 15px ${FACE}`;
  ctx.fillText('THREE FLOORS  /  ONE NIGHT  /  FOUR ALARM STATES', VIEW_W / 2, 256);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText('Slip past the wardens and their torches, lift what the museum has on show,', VIEW_W / 2, 312);
  ctx.fillText('crack the vault on the last floor, and be on the stairs before the clock dies.', VIEW_W / 2, 340);
  ctx.fillStyle = INK.textDim;
  ctx.font = `14px ${FACE}`;
  ctx.fillText('WASD / arrows move  /  SHIFT dash (loud)  /  1-4 buy gear  /  ducts hide you, slow you', VIEW_W / 2, 398);
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 18px ${FACE}`;
  ctx.fillText('PRESS ENTER', VIEW_W / 2, 458);
  ctx.fillStyle = 'rgba(143,154,180,0.75)';
  ctx.font = `12px ${FACE}`;
  ctx.fillText(`purse $${PURSE}  /  the night is worth $${2230}`, VIEW_W / 2, 492);
}

function caught(ctx, run) {
  const flash = Math.min(1, run.fade * 2.4);
  ctx.fillStyle = `rgba(190,30,40,${0.40 * flash})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 48px ${FACE}`;
  ctx.fillText('TAKEN', VIEW_W / 2, VIEW_H / 2 - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `16px ${FACE}`;
  ctx.fillText('dragged back to the service door  /  18s off the clock', VIEW_W / 2, VIEW_H / 2 + 26);
}

// Cleared: a banner over the room, not a black card, so the stairs, the clock
// and the haul stay in the same frame as the word OUT CLEAN.
function cleared(ctx, run) {
  ctx.fillStyle = 'rgba(5,8,16,0.52)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 58px ${FACE}`;
  ctx.fillText('OUT CLEAN', VIEW_W / 2, 196);
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 72px ${FACE}`;
  ctx.fillText(`$${run.haul}`, VIEW_W / 2, 288);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText(`${run.pieces} PIECES  /  PURSE LEFT $${run.purse}  /  ALARM SURVIVED`, VIEW_W / 2, 352);
  ctx.fillStyle = INK.textDim;
  ctx.font = `15px ${FACE}`;
  ctx.fillText('R runs the night again', VIEW_W / 2, 392);
}

// ---------------------------------------------------------------- frame

export function paint(ctx, run, floor, still) {
  const view = run.view || { s: 1, x: VIEW_W / 2, y: VIEW_H / 2 };
  const b = run.burglar;
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(view.s, view.s);
  ctx.translate(-view.x, -view.y);
  ctx.drawImage(still, 0, 0);
  vaultDoor(ctx, floor);
  lights(ctx, run, floor);
  footprints(ctx, run);
  drawLoot(ctx, run);
  for (const w of run.wardens) guard(ctx, w, guardMood(floor, run, w));
  for (const c of run.cameras) {
    const hot = c.dark <= 0 && !run.smoke
      && catches(floor, c.x, c.y, c.face, EYE.cone, EYE.half, b.x, b.y);
    camera(ctx, c, hot);
  }
  burglar(ctx, run);
  ctx.restore();
  hud(ctx, run, floor);
  if (run.phase === 'title') titles(ctx);
  else if (run.phase === 'caught') caught(ctx, run);
  else if (run.phase === 'cleared') cleared(ctx, run);
}