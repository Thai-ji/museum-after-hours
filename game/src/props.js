// props.js -- the museum itself, painted once per floor: marble slabs and their
// veins, the ceiling light pools, the ducts, the walls with their brass inlay,
// the plinths, the hung paintings, the warden beats drawn on the floor and the
// green stairwell. The steel vault door is not here: that door changes state, so
// actors.js draws it every frame.
import {
  CELL, GRID_W, GRID_H, VIEW_W, VIEW_H, INK, WARDEN_ROUTE,
} from './tuning.js';
import { canvasOf, rrect, noise, halo } from './art.js';

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

  // ---- the wardens' beats: a dashed line on the marble, so the room reads as
  // a patrol even in a still frame (criterion: the patrol is visible)
  ctx.save();
  ctx.strokeStyle = WARDEN_ROUTE;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 10]);
  ctx.lineCap = 'round';
  for (const w of floor.wardens) {
    const a = { x: w.beat[0][0] * CELL + CELL / 2, y: w.beat[0][1] * CELL + CELL / 2 };
    const b = { x: w.beat[1][0] * CELL + CELL / 2, y: w.beat[1][1] * CELL + CELL / 2 };
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    for (const p of [a, b]) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setLineDash([5, 10]);
  }
  ctx.restore();

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
      if (!open(tx, ty + 1)) continue;
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
  ctx.strokeStyle = INK.stairs;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, -8); ctx.lineTo(0, 2); ctx.lineTo(8, -8);
  ctx.moveTo(-8, 2); ctx.lineTo(0, 12); ctx.lineTo(8, 2);
  ctx.stroke();
  ctx.fillStyle = INK.stairs;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(floor.index === 2 ? 'OUT' : 'DOWN', 0, 24);
  ctx.restore();

  // ---- vignette, so the eye settles on the room
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.46)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  return c;
}