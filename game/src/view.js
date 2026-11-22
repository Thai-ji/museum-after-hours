// view.js 鈥?the museum at night. A still backdrop is painted once per floor
// (marble floor, ceiling pools, walls, the vault door, props) and blitted after;
// on top go the torch and lens cones, the loot, the cast, the alarm HUD.
// Every frame the screenshots show is a state the rules really produced.
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

const rrect = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

// a stable pseudo-random from tile coordinates, so the painted props never move
const noise = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const halo = (ctx, x, y, r, rgb, a) => {
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
};

// ---------------------------------------------------------------- backdrop

export function backdrop(floor) {
  const c = canvasOf(VIEW_W, VIEW_H);
  const ctx = c.getContext('2d');
  const W = floor.walls;
  const open = (tx, ty) => tx >= 0 && ty >= 0 && tx < GRID_W && ty < GRID_H && !W[ty][tx];

  ctx.fillStyle = INK.void;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ---- marble floor: alternating slabs, thin grout, faint veins
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      if (W[ty][tx]) continue;
      const x = tx * CELL, y = ty * CELL;
      const n = noise(tx, ty);
      ctx.fillStyle = (tx + ty) % 2 ? INK.slab : INK.slabAlt;
      ctx.fillRect(x, y, CELL, CELL);
      if (n > 0.62) {
        ctx.fillStyle = `rgba(150,180,240,${0.010 + n * 0.016})`;
        ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      }
      ctx.fillStyle = 'rgba(4,7,14,0.5)';
      ctx.fillRect(x, y + CELL - 1, CELL, 1);
      ctx.fillRect(x + CELL - 1, y, 1, CELL);
      // a marble vein
      if (n > 0.9) {
        ctx.strokeStyle = 'rgba(190,215,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + CELL - 6);
        ctx.quadraticCurveTo(x + CELL / 2, y + CELL / 2 + 4, x + CELL - 5, y + 7);
        ctx.stroke();
      }
    }
  }

  // ---- ceiling pools: warm light on the marble, the room's only real light
  const pools = [];
  for (let ty = 2; ty < GRID_H - 2; ty += 5) {
    for (let tx = 3; tx < GRID_W - 2; tx += 6) {
      if (!open(tx, ty) || !open(tx, ty + 1)) continue;
      pools.push([tx * CELL + CELL / 2, ty * CELL + CELL / 2 + 8]);
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of pools) halo(ctx, x, y, 128, '255,205,130', 0.18);
  ctx.globalCompositeOperation = 'source-over';

  // ---- air ducts: dark channel, slatted grate
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      if (!floor.vents[ty][tx]) continue;
      const x = tx * CELL, y = ty * CELL;
      ctx.fillStyle = '#05080f';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = 'rgba(110,140,205,0.30)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 3, y + i * 7);
        ctx.lineTo(x + CELL - 3, y + i * 7);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(110,140,205,0.45)';
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
    }
  }

  // ---- wall shadow: walls throw a lip of shade onto the marble beside them
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      if (!W[ty][tx]) continue;
      const x = tx * CELL, y = ty * CELL;
      if (open(tx, ty + 1)) ctx.fillRect(x, y + CELL, CELL, 5);
      if (open(tx + 1, ty)) ctx.fillRect(x + CELL, y, 5, CELL);
    }
  }

  // ---- walls: marble blocks, bevel top, dark foot, brass inlay line
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      if (!W[ty][tx]) continue;
      const x = tx * CELL, y = ty * CELL;
      ctx.fillStyle = INK.marble;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = INK.marbleLit;
      ctx.fillRect(x, y, CELL, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, y, 2, CELL);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y + CELL - 5, CELL, 5);
      ctx.strokeStyle = 'rgba(6,10,20,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      if (noise(tx * 3, ty * 7) > 0.86) {
        ctx.fillStyle = 'rgba(243,198,107,0.16)';
        ctx.fillRect(x + 6, y + CELL / 2, CELL - 12, 1);
      }
    }
  }

  // ---- museum props along the walls: a few plinths, framed paintings
  for (let ty = 1; ty < GRID_H - 1; ty++) {
    for (let tx = 1; tx < GRID_W - 1; tx++) {
      if (W[ty][tx]) continue;
      const n = noise(tx * 5, ty * 11);
      const x = tx * CELL, y = ty * CELL;
      const nearWall = W[ty - 1][tx] || W[ty + 1][tx] || W[ty][tx - 1] || W[ty][tx + 1];
      if (nearWall && n > 0.93) {
        // a stone plinth with a dim bust on it
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(x + CELL / 2, y + CELL - 8, 13, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c2536';
        rrect(ctx, x + 9, y + 13, CELL - 18, CELL - 21, 3); ctx.fill();
        ctx.fillStyle = '#31415f';
        rrect(ctx, x + 9, y + 13, CELL - 18, 4, 2); ctx.fill();
        ctx.fillStyle = 'rgba(206,220,245,0.28)';
        ctx.beginPath(); ctx.arc(x + CELL / 2, y + 9, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---- paintings hung on the walls: a brass frame and a lit canvas
  for (let ty = 1; ty < GRID_H - 1; ty++) {
    for (let tx = 1; tx < GRID_W - 1; tx++) {
      if (!W[ty][tx]) continue;
      const n = noise(tx * 13, ty * 7);
      if (n < 0.55) continue;
      const below = open(tx, ty + 1);
      if (!below) continue;
      const x = tx * CELL, y = ty * CELL;
      const hue = Math.floor(n * 360);
      ctx.fillStyle = 'rgba(6,10,18,0.9)';
      ctx.fillRect(x + 7, y + 6, CELL - 14, 20);
      const art = ctx.createLinearGradient(x + 9, y + 8, x + CELL - 9, y + 24);
      art.addColorStop(0, `hsla(${hue}, 58%, 46%, 0.85)`);
      art.addColorStop(1, `hsla(${(hue + 70) % 360}, 46%, 28%, 0.85)`);
      ctx.fillStyle = art;
      ctx.fillRect(x + 9, y + 8, CELL - 18, 16);
      ctx.strokeStyle = 'rgba(243,198,107,0.55)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 8, y + 7, CELL - 16, 18);
      ctx.fillStyle = 'rgba(255,225,160,0.35)';
      ctx.fillRect(x + 12, y + 3, CELL - 24, 2);
    }
  }

  // ---- the way out: green stairwell glow, readable even shrunk
  const st = floor.stairs;
  ctx.save();
  ctx.translate(st.x, st.y);
  halo(ctx, 0, 0, 62, '90,240,150', 0.30);
  ctx.fillStyle = 'rgba(80,225,140,0.18)';
  rrect(ctx, -19, -19, 38, 38, 5); ctx.fill();
  ctx.strokeStyle = INK.stairs;
  ctx.lineWidth = 2.4;
  rrect(ctx, -19, -19, 38, 38, 5); ctx.stroke();
  // a descending chevron
  ctx.strokeStyle = INK.stairs;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, -8); ctx.lineTo(0, 2); ctx.lineTo(8, -8);
  ctx.moveTo(-8, 2); ctx.lineTo(0, 12); ctx.lineTo(8, 2);
  ctx.stroke();
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 9px ${FACE}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(floor.index === 2 ? 'OUT' : 'DOWN', 0, 24);
  ctx.restore();

  // ---- the vault door: a round steel leaf in the wall, lit, unmistakable
  if (floor.door) {
    const { x, y } = floor.door;
    ctx.save();
    ctx.translate(x, y);
    halo(ctx, 0, 0, 78, '243,198,107', 0.20);
    // the stone arch it sits in
    ctx.fillStyle = '#0c1320';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1b2740'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    // the leaf
    ctx.fillStyle = '#3c4d63';
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke();
    // spokes
    ctx.strokeStyle = 'rgba(232,242,255,0.34)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
      ctx.stroke();
    }
    // rivets
    ctx.fillStyle = 'rgba(240,248,255,0.6)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 22, Math.sin(a) * 22, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // the dial hub
    ctx.fillStyle = '#10182a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = INK.brass; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -3); ctx.stroke();
    // the plaque above the door
    ctx.fillStyle = INK.brass;
    ctx.font = `bold 9px ${FACE}`;
    ctx.textAlign = 'center';
    ctx.fillText('VAULT', 0, -40);
    // warm light thrown into the room in front of it
    ctx.globalCompositeOperation = 'lighter';
    halo(ctx, 44, 0, 96, '255,206,140', 0.14);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // ---- vignette, so the eye settles on the room
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.46)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  return c;
}

// ---------------------------------------------------------------- light cones

function cone(ctx, cx, cy, face, reach, half, inner, outer, dashed) {
  ctx.save();
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, reach, face - half, face + half);
    ctx.closePath();
  };
  path();
  const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, reach);
  g.addColorStop(0, `rgba(${inner},0.55)`);
  g.addColorStop(0.55, `rgba(${inner},0.26)`);
  g.addColorStop(1, `rgba(${inner},0.03)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(${outer},0.85)`;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.stroke();
  ctx.restore();
}

function lights(ctx, run) {
  for (const w of run.wardens) {
    halo(ctx, w.x, w.y, 40, '255,120,90', 0.20);
    cone(ctx, w.x, w.y, w.face, WARDEN.cone, WARDEN.half, '255,96,80', '255,150,120', false);
  }
  for (const c of run.cameras) {
    if (c.dark > 0) continue;
    cone(ctx, c.x, c.y, c.face, EYE.cone, EYE.half, '255,196,80', '255,214,120', true);
  }
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
      // the safe: a squat steel box with a dial, half drilled
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
      if (item.worked > 0) {
        const need = run.kit.crowbar ? 1.1 : 3.4;
        ctx.strokeStyle = '#8df7c9'; ctx.lineWidth = 3.8; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -1, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, item.worked / need));
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

// ---------------------------------------------------------------- cast

function guard(ctx, w) {
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(w.face);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 11, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  // shoulders
  ctx.fillStyle = INK.warden;
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

  if (w.nose > 0) {
    ctx.fillStyle = INK.alarm;
    ctx.font = `bold 20px ${FACE}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', w.x, w.y - 26);
  }
}

function camera(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.face);
  // mount
  ctx.strokeStyle = 'rgba(150,175,220,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-8, 0); ctx.stroke();
  // body
  ctx.fillStyle = c.dark > 0 ? '#3d4352' : '#232c40';
  rrect(ctx, -9, -7, 24, 14, 4); ctx.fill();
  ctx.strokeStyle = c.dark > 0 ? '#707a8c' : INK.eye; ctx.lineWidth = 1.8;
  rrect(ctx, -9, -7, 24, 14, 4); ctx.stroke();
  // lens
  ctx.fillStyle = '#070b14';
  ctx.beginPath(); ctx.arc(12, 0, 5.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,120,0.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(12, 0, 5.2, 0, Math.PI * 2); ctx.stroke();
  if (c.dark > 0) {
    ctx.strokeStyle = '#94a0b4'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(8, 8); ctx.stroke();
  } else {
    ctx.fillStyle = INK.alarm;
    ctx.beginPath(); ctx.arc(-4, -5, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function burglar(ctx, run) {
  const b = run.burglar;
  ctx.save();
  ctx.translate(b.x, b.y);
  halo(ctx, 0, 0, 40, '92,232,192', 0.30);
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
  ctx.strokeStyle = 'rgba(240,255,250,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // the kit bag over the shoulder
  ctx.fillStyle = '#17342c';
  ctx.beginPath(); ctx.arc(8, 4, 5, 0, Math.PI * 2); ctx.fill();
  // mask
  ctx.fillStyle = '#08111f';
  rrect(ctx, -6, -13, 12, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(150,255,225,0.95)';
  ctx.fillRect(-4, -10, 2.6, 2);
  ctx.fillRect(1.4, -10, 2.6, 2);
  ctx.restore();

  // the bag: every piece on him shows as a small cut stone riding with him
  if (run.pieces > 0) {
    const n = Math.min(3, run.pieces);
    for (let i = 0; i < n; i++) {
      const a = run.t * 1.4 + i * 2.1;
      const px = Math.cos(a) * 15;
      const py = -24 + Math.sin(a) * 3;
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

  if (b.dashing && !run.kit.slippers) {
    const ring = (run.t * 1.7) % 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = `rgba(255,140,110,${0.55 * (1 - ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 28 + ring * 150, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (run.smoke) {
    ctx.save();
    const k = Math.min(1, run.smoke.life);
    halo(ctx, run.smoke.x, run.smoke.y, 92, '210,225,245', 0.28 * k);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- HUD

function hud(ctx, run, floor) {
  // top strip
  const top = ctx.createLinearGradient(0, 0, 0, 62);
  top.addColorStop(0, 'rgba(6,9,17,0.96)');
  top.addColorStop(1, 'rgba(6,9,17,0.72)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VIEW_W, 62);
  ctx.fillStyle = 'rgba(130,155,215,0.28)';
  ctx.fillRect(0, 61, VIEW_W, 1);

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 24px ${FACE}`;
  ctx.fillText(`$${run.haul}`, 22, 24);
  ctx.fillStyle = INK.textDim;
  ctx.font = `11px ${FACE}`;
  ctx.fillText(`${run.pieces} PIECES 路 ${floor.name.toUpperCase()}`, 22, 46);

  // alarm meter
  const w = 470, h = 26, x = (VIEW_W - w) / 2, y = 16;
  const lvl = Math.min(1, run.alarm / ALARM.trip);
  ctx.fillStyle = 'rgba(18,24,40,0.95)';
  rrect(ctx, x, y, w, h, 5); ctx.fill();
  const hot = lvl > ALARM.hotAt;
  const fill = ctx.createLinearGradient(x, 0, x + w, 0);
  ctx.save();
  rrect(ctx, x, y, w, h, 5); ctx.clip();
  fill.addColorStop(0, hot ? '#ff4d57' : '#e8a93c');
  fill.addColorStop(1, hot ? '#ff8a6a' : '#f5c863');
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(4, w * lvl), h);
  for (let i = 1; i < 12; i++) {
    ctx.fillStyle = 'rgba(6,9,16,0.55)';
    ctx.fillRect(x + (w / 12) * i, y + 3, 1.6, h - 6);
  }
  ctx.restore();
  ctx.strokeStyle = `rgba(230,240,255,${hot ? 0.55 : 0.28})`;
  ctx.lineWidth = 1.2;
  rrect(ctx, x, y, w, h, 5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `bold 12px ${FACE}`;
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', x + 12, y + h / 2 + 1);
  if (hot) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText('SPOTTED', x + w - 12, y + h / 2 + 1);
  }

  // getaway clock
  ctx.textAlign = 'right';
  if (run.clockOn) {
    const low = run.clock < 20;
    ctx.fillStyle = low ? INK.alarm : INK.text;
    ctx.font = `bold 24px ${FACE}`;
    ctx.fillText(`GETAWAY ${run.clock.toFixed(1)}s`, VIEW_W - 22, 22);
    ctx.fillStyle = INK.textDim;
    ctx.font = `11px ${FACE}`;
    ctx.fillText('reach the stairs before it dies', VIEW_W - 22, 45);
  } else {
    ctx.fillStyle = INK.textDim;
    ctx.font = `bold 20px ${FACE}`;
    ctx.fillText('CLOCK ARMING', VIEW_W - 22, 24);
    ctx.fillStyle = 'rgba(230,236,248,0.5)';
    ctx.font = `11px ${FACE}`;
    ctx.fillText('first piece starts it', VIEW_W - 22, 45);
  }

  // gear tray
  ctx.fillStyle = 'rgba(6,9,17,0.92)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 64);
  ctx.fillStyle = 'rgba(130,155,215,0.28)';
  ctx.fillRect(0, TRAY_Y, VIEW_W, 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = INK.textDim;
  ctx.font = `11px ${FACE}`;
  ctx.fillText(`PURSE $${run.purse}`, 22, TRAY_Y + 20);
  ctx.fillStyle = run.floorPieces > 0 ? INK.stairs : INK.textDim;
  ctx.font = `bold 11px ${FACE}`;
  ctx.fillText(run.floorPieces > 0 ? 'STAIRS OPEN' : 'STAIRS LOCKED 鈥?lift something', 22, TRAY_Y + 43);

  KIT.forEach((tool, i) => {
    const bx = 258 + i * 218;
    const had = !!run.kit[tool.key];
    const can = run.purse >= tool.cost && !had;
    ctx.fillStyle = had ? 'rgba(92,232,192,0.16)' : can ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)';
    rrect(ctx, bx, TRAY_Y + 9, 204, 46, 6); ctx.fill();
    ctx.strokeStyle = had ? INK.burglar : can ? 'rgba(210,222,245,0.42)' : 'rgba(130,140,160,0.22)';
    ctx.lineWidth = 1.4;
    rrect(ctx, bx, TRAY_Y + 9, 204, 46, 6); ctx.stroke();
    ctx.fillStyle = had ? INK.burglar : can ? INK.text : '#5d6678';
    ctx.font = `bold 13px ${FACE}`;
    ctx.fillText(`[${i + 1}] ${tool.tag}`, bx + 11, TRAY_Y + 26);
    ctx.fillStyle = INK.textDim;
    ctx.font = `10px ${FACE}`;
    ctx.fillText(had ? 'IN THE BAG' : `$${tool.cost} 路 ${tool.blurb}`, bx + 11, TRAY_Y + 43);
  });

  if (hot) {
    const beat = 0.14 + 0.10 * Math.sin(run.t * 9);
    const edge = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H);
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

  // a vault door looming behind the title
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
  ctx.fillText('THREE FLOORS 路 ONE NIGHT 路 NO SECOND CHANCES', VIEW_W / 2, 256);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText('Slip past the wardens and their torches, lift what the museum has on show,', VIEW_W / 2, 312);
  ctx.fillText('crack the vault on the last floor, and be on the stairs before the clock dies.', VIEW_W / 2, 340);
  ctx.fillStyle = INK.textDim;
  ctx.font = `14px ${FACE}`;
  ctx.fillText('WASD / arrows to move 路 SHIFT to dash (loud) 路 1-4 buy gear 路 ducts hide you and slow you', VIEW_W / 2, 398);
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 18px ${FACE}`;
  ctx.fillText('PRESS ENTER', VIEW_W / 2, 458);
  ctx.fillStyle = 'rgba(143,154,180,0.75)';
  ctx.font = `12px ${FACE}`;
  ctx.fillText(`purse $${PURSE} 路 a full bag is ${VALUE.case}+${VALUE.gem}+${VALUE.vault}`, VIEW_W / 2, 492);
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
  ctx.fillText('dragged back to the service door 路 18s off the clock', VIEW_W / 2, VIEW_H / 2 + 26);
}

function cleared(ctx, run) {
  ctx.fillStyle = 'rgba(5,8,16,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = INK.stairs;
  ctx.font = `bold 48px ${FACE}`;
  ctx.fillText('OUT CLEAN', VIEW_W / 2, 232);
  ctx.fillStyle = INK.brass;
  ctx.font = `bold 64px ${FACE}`;
  ctx.fillText(`$${run.haul}`, VIEW_W / 2, 322);
  ctx.fillStyle = INK.text;
  ctx.font = `17px ${FACE}`;
  ctx.fillText(`${run.pieces} pieces 路 purse left $${run.purse} 路 alarm survived`, VIEW_W / 2, 382);
  ctx.fillStyle = INK.textDim;
  ctx.font = `15px ${FACE}`;
  ctx.fillText('R runs the night again', VIEW_W / 2, 436);
}

// ---------------------------------------------------------------- frame

export function paint(ctx, run, floor, still) {
  const view = run.view || { s: 1, x: VIEW_W / 2, y: VIEW_H / 2 };
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(view.s, view.s);
  ctx.translate(-view.x, -view.y);
  ctx.drawImage(still, 0, 0);
  lights(ctx, run);
  drawLoot(ctx, run);
  for (const w of run.wardens) guard(ctx, w);
  for (const c of run.cameras) camera(ctx, c);
  burglar(ctx, run);
  ctx.restore();
  hud(ctx, run, floor);
  if (run.phase === 'title') titles(ctx);
  else if (run.phase === 'caught') caught(ctx, run);
  else if (run.phase === 'cleared') cleared(ctx, run);
}
