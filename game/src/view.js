// view.js — everything the eye gets: one static backdrop per floor, painted
// once and blitted after, then cones, loot, the cast and the HUD on top.
import {
  CELL, GRID_W, GRID_H, VIEW_W, VIEW_H, WARDEN, EYE, ALARM, KIT, PURSE, INK, VALUE,
} from './tuning.js';

const FACE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TRAY_Y = VIEW_H - 64;

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

const box = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

// ---------------------------------------------------------------- backdrop

export function backdrop(floor) {
  const c = canvasOf(VIEW_W, VIEW_H);
  const ctx = c.getContext('2d');

  ctx.fillStyle = INK.slab;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // parquet: long boards with a seam every other row
  for (let ty = 1; ty < GRID_H - 1; ty++) {
    for (let tx = 1; tx < GRID_W - 1; tx++) {
      if (floor.walls[ty][tx]) continue;
      const x = tx * CELL, y = ty * CELL;
      ctx.fillStyle = (tx + ty) % 2 ? INK.slab : INK.slabAlt;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      ctx.fillRect(x, y + CELL - 3, CELL, 3);
      if ((tx * 7 + ty * 3) % 5 === 0) {
        ctx.fillStyle = 'rgba(120,150,210,0.05)';
        ctx.fillRect(x + 6, y + 8, CELL - 12, 1);
      }
    }
  }

  // air ducts: a dark channel with grate slats
  for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
    if (!floor.vents[ty][tx]) continue;
    const x = tx * CELL, y = ty * CELL;
    ctx.fillStyle = '#080c16';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = 'rgba(110,140,205,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + i * 8);
      ctx.lineTo(x + CELL - 3, y + i * 8);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,140,205,0.5)';
    ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  }

  // walls: marble blocks, lit on top, dark under the lip
  for (let ty = 0; ty < GRID_H; ty++) for (let tx = 0; tx < GRID_W; tx++) {
    if (!floor.walls[ty][tx]) continue;
    const x = tx * CELL, y = ty * CELL;
    ctx.fillStyle = INK.marble;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = INK.marbleLit;
    ctx.fillRect(x, y, CELL, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x, y + CELL - 4, CELL, 4);
    ctx.strokeStyle = 'rgba(8,12,22,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL);
    ctx.stroke();
  }

  // the way out / the stairs down
  const st = floor.stairs;
  ctx.save();
  ctx.translate(st.x, st.y);
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  halo.addColorStop(0, 'rgba(105,222,140,0.32)');
  halo.addColorStop(1, 'rgba(105,222,140,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-46, -46, 92, 92);
  ctx.fillStyle = 'rgba(105,222,140,0.12)';
  box(ctx, -17, -17, 34, 34, 4); ctx.fill();
  ctx.strokeStyle = INK.stairs; ctx.lineWidth = 2.2;
  box(ctx, -17, -17, 34, 34, 4); ctx.stroke();
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 9px ${FACE}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(floor.index === 2 ? 'OUT' : 'DOWN', 0, 1);
  ctx.restore();

  // the vault door sits shut in the wall
  if (floor.door && floor.walls[floor.door.ty][floor.door.tx]) {
    const { tx, ty } = floor.door;
    const x = tx * CELL, y = ty * CELL;
    ctx.fillStyle = '#3a2b18';
    ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = INK.brassDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3.5, y + 3.5, CELL - 7, CELL - 7);
    ctx.fillStyle = INK.brass;
    ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 4, 0, Math.PI * 2); ctx.fill();
  }

  // a cold vignette, so the eye settles on the middle of the room
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.98);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  return c;
}

// ---------------------------------------------------------------- light

function cone(ctx, cx, cy, face, reach, half, fill, edge, dashed) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, reach, face - half, face + half);
  ctx.closePath();
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, reach);
  glow.addColorStop(0, fill.replace('0.22', '0.40').replace('0.17', '0.34'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.4;
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the cast

function drawLoot(ctx, run) {
  for (const item of run.loot) {
    if (item.gone) continue;
    const pulse = 0.86 + 0.14 * Math.sin(run.t * 3.4 + item.x);
    ctx.save();
    ctx.translate(item.x, item.y);

    if (item.kind === 'vault') {
      ctx.fillStyle = 'rgba(240,196,99,0.12)';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2114';
      box(ctx, -20, -20, 40, 40, 5); ctx.fill();
      ctx.strokeStyle = INK.brass; ctx.lineWidth = 2.4;
      box(ctx, -20, -20, 40, 40, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.strokeStyle = INK.brass; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = INK.brass;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
      if (item.worked > 0) {
        const need = run.kit.crowbar ? 1.1 : 3.4;
        ctx.strokeStyle = '#8df7c9'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, item.worked / need));
        ctx.stroke();
      }
    } else if (item.kind === 'gem') {
      ctx.fillStyle = `rgba(240,196,99,${0.16 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(9, -2); ctx.lineTo(0, 12); ctx.lineTo(-9, -2);
      ctx.closePath();
      ctx.fillStyle = '#8fe8ff';
      ctx.fill();
      ctx.strokeStyle = '#e9fbff'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(9, -2); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(240,196,99,${0.13 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
      // a glass display case
      ctx.fillStyle = 'rgba(180,215,255,0.10)';
      box(ctx, -13, -15, 26, 30, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(196,224,255,0.75)'; ctx.lineWidth = 1.6;
      box(ctx, -13, -15, 26, 30, 3); ctx.stroke();
      ctx.fillStyle = INK.brass;
      ctx.fillRect(-6, -5, 12, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-5, -14, 2, 28);
    }
    ctx.restore();
  }
}

function drawLights(ctx, run) {
  for (const w of run.wardens) {
    cone(ctx, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, INK.wardenCone, 'rgba(225,77,77,0.5)', false);
  }
  for (const c of run.cameras) {
    if (c.dark > 0) continue;
    cone(ctx, c.x, c.y, c.face, EYE.cone, EYE.half, INK.eyeCone, 'rgba(245,181,68,0.5)', true);
  }
}

function drawCast(ctx, run) {
  for (const w of run.wardens) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.fillStyle = INK.warden;
    box(ctx, -10, -6, 20, 18, 7); ctx.fill();
    ctx.fillStyle = '#8d2626';
    box(ctx, -10, 6, 20, 6, 3); ctx.fill();
    ctx.fillStyle = '#f3d3d3';
    ctx.beginPath(); ctx.arc(0, -9, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b0f1a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, 1); ctx.lineTo(-15, 8);
    ctx.moveTo(7, 1); ctx.lineTo(15, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(w.face) * 16, -2 + Math.sin(w.face) * 16); ctx.stroke();
    if (w.nose > 0) {
      ctx.fillStyle = INK.alarm;
      ctx.font = `bold 17px ${FACE}`; ctx.textAlign = 'center';
      ctx.fillText('!', 0, -24);
    }
    ctx.restore();
  }
  for (const c of run.cameras) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.strokeStyle = 'rgba(160,185,230,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -18); ctx.stroke();
    ctx.fillStyle = c.dark > 0 ? '#4a4a58' : '#20283b';
    box(ctx, -11, -8, 22, 15, 4); ctx.fill();
    ctx.strokeStyle = c.dark > 0 ? '#6a6a78' : INK.eye; ctx.lineWidth = 1.6;
    box(ctx, -11, -8, 22, 15, 4); ctx.stroke();
    ctx.fillStyle = c.dark > 0 ? '#3a3a46' : '#0b0e18';
    ctx.beginPath(); ctx.arc(0, -0.5, 4.2, 0, Math.PI * 2); ctx.fill();
    if (c.dark > 0) {
      ctx.strokeStyle = '#8a8a99'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, 5); ctx.stroke();
    } else {
      ctx.fillStyle = INK.alarm;
      ctx.beginPath(); ctx.arc(8, -5, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const b = run.burglar;
  ctx.save();
  ctx.translate(b.x, b.y);
  const lamp = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
  lamp.addColorStop(0, 'rgba(97,230,192,0.34)');
  lamp.addColorStop(1, 'rgba(97,230,192,0)');
  ctx.fillStyle = lamp;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  // hooded coat
  ctx.fillStyle = INK.burglar;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(11, -9, 9, 10);
  ctx.quadraticCurveTo(0, 14, -9, 10);
  ctx.quadraticCurveTo(-11, -9, 0, -13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.8; ctx.stroke();
  // kit bag
  ctx.fillStyle = '#1b2a26';
  ctx.beginPath(); ctx.arc(5, 5, 4.2, 0, Math.PI * 2); ctx.fill();
  // the masked face
  ctx.fillStyle = '#0b1220';
  ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // a dash is loud: the ring is what a warden can hear
  if (b.dashing && !run.kit.slippers) {
    const ring = (run.t * 1.7) % 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = `rgba(255,140,110,${0.5 * (1 - ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 26 + ring * 150, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (run.smoke) {
    ctx.save();
    ctx.fillStyle = `rgba(190,205,225,${0.16 * Math.min(1, run.smoke.life)})`;
    ctx.beginPath(); ctx.arc(run.smoke.x, run.smoke.y, 78, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = 'rgba(210,222,240,0.4)'; ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- HUD

function strip(ctx) {
  ctx.fillStyle = 'rgba(7,10,19,0.86)';
  ctx.fillRect(0, 0, VIEW_W, 56);
  ctx.fillStyle = 'rgba(120,145,205,0.22)';
  ctx.fillRect(0, 56, VIEW_W, 1);
  ctx.fillStyle = 'rgba(7,10,19,0.9)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 64);
  ctx.fillStyle = 'rgba(120,145,205,0.22)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 1);
}

function alarmBar(ctx, x, y, w, h, level) {
  ctx.fillStyle = '#141b2c';
  box(ctx, x, y, w, h, 4); ctx.fill();
  const hot = level > ALARM.hotAt;
  ctx.fillStyle = hot ? INK.alarm : '#f0b040';
  box(ctx, x, y, Math.max(3, w * Math.min(1, level)), h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(230,236,248,0.28)';
  ctx.lineWidth = 1;
  box(ctx, x, y, w, h, 4); ctx.stroke();
  for (let i = 1; i < 8; i++) {
    ctx.fillStyle = 'rgba(6,9,16,0.5)';
    ctx.fillRect(x + (w / 8) * i, y + 2, 1.5, h - 4);
  }
  ctx.fillStyle = INK.text;
  ctx.font = `bold 11px ${FACE}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('ALARM', x + 9, y + h / 2 + 1);
  if (hot) {
    ctx.fillStyle = INK.alarm;
    ctx.font = `bold 11px ${FACE}`;
    ctx.textAlign = 'right';
    ctx.fillText('SPOTTED', x + w - 9, y + h / 2 + 1);
  }
}

function hud(ctx, run, floor) {
  strip(ctx);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

  ctx.fillStyle = INK.brass;
  ctx.font = `bold 21px ${FACE}`;
  ctx.fillText(`$${run.haul}`, 20, 24);
  ctx.fillStyle = INK.textDim;
  ctx.font = `11px ${FACE}`;
  ctx.fillText(`${run.pieces} PIECES · ${floor.name}`, 20, 43);

  alarmBar(ctx, 352, 16, 380, 22, run.alarm / ALARM.trip);

  ctx.textAlign = 'right';
  if (run.clockOn) {
    const low = run.clock < 20;
    ctx.fillStyle = low ? INK.alarm : INK.text;
    ctx.font = `bold 22px ${FACE}`;
    ctx.fillText(`GETAWAY ${run.clock.toFixed(1)}s`, VIEW_W - 20, 22);
    ctx.fillStyle = INK.textDim;
    ctx.font = `11px ${FACE}`;
    ctx.fillText('reach the stairs before it dies', VIEW_W - 20, 42);
  } else {
    ctx.fillStyle = INK.textDim;
    ctx.font = `bold 20px ${FACE}`;
    ctx.fillText('CLOCK ARMING', VIEW_W - 20, 24);
    ctx.fillStyle = 'rgba(230,236,248,0.5)';
    ctx.font = `11px ${FACE}`;
    ctx.fillText('first piece starts it', VIEW_W - 20, 42);
  }

  // gear tray
  ctx.textAlign = 'left';
  ctx.fillStyle = INK.textDim;
  ctx.font = `11px ${FACE}`;
  ctx.fillText(`PURSE $${run.purse}`, 20, TRAY_Y + 20);
  ctx.fillStyle = run.floorPieces > 0 ? INK.stairs : INK.textDim;
  ctx.font = `bold 11px ${FACE}`;
  ctx.fillText(run.floorPieces > 0 ? 'STAIRS OPEN' : 'STAIRS LOCKED — lift something', 20, TRAY_Y + 42);

  KIT.forEach((tool, i) => {
    const x = 250 + i * 220;
    const had = !!run.kit[tool.key];
    const can = run.purse >= tool.cost && !had;
    ctx.fillStyle = had ? 'rgba(97,230,192,0.15)' : can ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)';
    box(ctx, x, TRAY_Y + 9, 206, 46, 6); ctx.fill();
    ctx.strokeStyle = had ? INK.burglar : can ? 'rgba(210,222,245,0.4)' : 'rgba(130,140,160,0.25)';
    ctx.lineWidth = 1.4;
    box(ctx, x, TRAY_Y + 9, 206, 46, 6); ctx.stroke();
    ctx.fillStyle = had ? INK.burglar : can ? INK.text : '#5d6678';
    ctx.font = `bold 12px ${FACE}`;
    ctx.fillText(`[${i + 1}] ${tool.tag}`, x + 11, TRAY_Y + 26);
    ctx.fillStyle = INK.textDim;
    ctx.font = `10px ${FACE}`;
    ctx.fillText(had ? 'IN THE BAG' : `$${tool.cost} · ${tool.blurb}`, x + 11, TRAY_Y + 43);
  });

  if (run.alarm > ALARM.hotAt) {
    const beat = 0.16 + 0.1 * Math.sin(run.t * 9);
    const edge = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H);
    edge.addColorStop(0, 'rgba(255,40,40,0)');
    edge.addColorStop(1, `rgba(255,40,40,${beat})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------------------------------------------------------- screens

const headline = (ctx, text, sub, colour, sub2) => {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = colour;
  ctx.font = `bold 54px ${FACE}`;
  ctx.fillText(text, VIEW_W / 2, 250);
  ctx.fillStyle = INK.text;
  ctx.font = `19px ${FACE}`;
  ctx.fillText(sub, VIEW_W / 2, 306);
  ctx.fillStyle = INK.textDim;
  ctx.font = `15px ${FACE}`;
  if (sub2) ctx.fillText(sub2, VIEW_W / 2, 338);
};

function titles(ctx, run) {
  ctx.fillStyle = 'rgba(5,8,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 64px ${FACE}`;
  ctx.fillText('VAULT RUNNER', VIEW_W / 2, 214);
  ctx.fillStyle = INK.burglar;
  ctx.font = `bold 15px ${FACE}`;
  ctx.fillText('THREE FLOORS · ONE NIGHT · NO SECOND CHANCES', VIEW_W / 2, 262);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText('Slip past the wardens and their torches, lift what the museum has on show,', VIEW_W / 2, 312);
  ctx.fillText('crack the vault on the last floor, and be on the stairs before the clock dies.', VIEW_W / 2, 340);
  ctx.fillStyle = INK.textDim;
  ctx.font = `14px ${FACE}`;
  ctx.fillText('WASD / arrows to move · SHIFT to dash (loud) · 1-4 buy gear · ducts hide you and slow you', VIEW_W / 2, 400);
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 18px ${FACE}`;
  ctx.fillText('PRESS ENTER', VIEW_W / 2, 462);
  ctx.fillStyle = 'rgba(143,154,180,0.75)';
  ctx.font = `12px ${FACE}`;
  ctx.fillText(`purse $${PURSE} · a full bag is ${VALUE.case}+${VALUE.gem}+${VALUE.vault}`, VIEW_W / 2, 494);
}

function caught(ctx, run) {
  const flash = Math.min(1, run.fade * 2.4);
  ctx.fillStyle = `rgba(190,30,40,${0.42 * flash})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `bold 46px ${FACE}`;
  ctx.fillText('TAKEN', VIEW_W / 2, VIEW_H / 2 - 14);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = `16px ${FACE}`;
  ctx.fillText('dragged back to the service door · 18s off the clock', VIEW_W / 2, VIEW_H / 2 + 28);
}

function cleared(ctx, run) {
  ctx.fillStyle = 'rgba(5,8,16,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 46px ${FACE}`;
  ctx.fillText('OUT CLEAN', VIEW_W / 2, 236);
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 62px ${FACE}`;
  ctx.fillText(`$${run.haul}`, VIEW_W / 2, 322);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText(`${run.pieces} pieces · purse left $${run.purse} · alarm survived`, VIEW_W / 2, 382);
  ctx.fillStyle = INK.textDim;
  ctx.font = `15px ${FACE}`;
  ctx.fillText('R runs the night again', VIEW_W / 2, 436);
}

// ---------------------------------------------------------------- frame

export function paint(ctx, run, floor, still) {
  ctx.drawImage(still, 0, 0);
  drawLights(ctx, run);
  drawLoot(ctx, run);
  drawCast(ctx, run);
  hud(ctx, run, floor);
  if (run.phase === 'title') titles(ctx, run);
  else if (run.phase === 'caught') caught(ctx, run);
  else if (run.phase === 'cleared') cleared(ctx, run);
}
