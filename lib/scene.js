'use strict';

let _nextId = 1;
function nextId() {
  return `obj_${_nextId++}`;
}

function resetIdCounter(n = 1) {
  _nextId = n;
}

function cloneScene(scene) {
  return JSON.parse(JSON.stringify(scene || []));
}

function normalizeRect(x, y, w, h) {
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;
  if (nw < 0) {
    nx += nw;
    nw = -nw;
  }
  if (nh < 0) {
    ny += nh;
    nh = -nh;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

function objectBounds(obj) {
  if (!obj) return { x: 0, y: 0, w: 0, h: 0 };
  if (obj.type === 'pen') {
    const pts = obj.points || [];
    if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = pts[0].x;
    let minY = pts[0].y;
    let maxX = pts[0].x;
    let maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (obj.width || 1) / 2;
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(1, maxX - minX) + pad * 2,
      h: Math.max(1, maxY - minY) + pad * 2,
    };
  }
  if (obj.type === 'rect' || obj.type === 'image') {
    return normalizeRect(obj.x, obj.y, obj.w, obj.h);
  }
  if (obj.type === 'arrow') {
    const minX = Math.min(obj.x1, obj.x2);
    const minY = Math.min(obj.y1, obj.y2);
    const maxX = Math.max(obj.x1, obj.x2);
    const maxY = Math.max(obj.y1, obj.y2);
    const pad = Math.max(8, (obj.width || 1) * 2);
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(1, maxX - minX) + pad * 2,
      h: Math.max(1, maxY - minY) + pad * 2,
    };
  }
  if (obj.type === 'text') {
    const lines = String(obj.value || '').split('\n');
    const size = obj.size || 14;
    const w = Math.max(
      size,
      ...lines.map((line) => Math.max(size, line.length * size * 0.55))
    );
    const h = Math.max(size, lines.length * size * 1.25);
    return { x: obj.x, y: obj.y, w, h };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

function pointInBounds(x, y, b, pad = 4) {
  return (
    x >= b.x - pad &&
    y >= b.y - pad &&
    x <= b.x + b.w + pad &&
    y <= b.y + b.h + pad
  );
}

/** Topmost object under (x,y), or null. */
function hitTest(scene, x, y, pad = 6) {
  const list = scene || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const obj = list[i];
    if (pointInBounds(x, y, objectBounds(obj), pad)) return obj;
  }
  return null;
}

function moveObject(obj, dx, dy) {
  if (!obj || (!dx && !dy)) return obj;
  if (obj.type === 'pen') {
    for (const p of obj.points || []) {
      p.x += dx;
      p.y += dy;
    }
    return obj;
  }
  if (obj.type === 'rect' || obj.type === 'image' || obj.type === 'text') {
    obj.x += dx;
    obj.y += dy;
    return obj;
  }
  if (obj.type === 'arrow') {
    obj.x1 += dx;
    obj.y1 += dy;
    obj.x2 += dx;
    obj.y2 += dy;
    return obj;
  }
  return obj;
}

/**
 * Fit object into a new axis-aligned box (from transform handles).
 * Pen points are scaled relative to the previous bounds.
 */
function setObjectBounds(obj, nextBox, prevBox) {
  if (!obj || !nextBox) return obj;
  const prev = prevBox || objectBounds(obj);
  const nx = nextBox.x;
  const ny = nextBox.y;
  const nw = Math.max(1, nextBox.w);
  const nh = Math.max(1, nextBox.h);

  if (obj.type === 'image' || obj.type === 'rect') {
    obj.x = nx;
    obj.y = ny;
    obj.w = nw;
    obj.h = nh;
    return obj;
  }

  if (obj.type === 'text') {
    obj.x = nx;
    obj.y = ny;
    if (prev.h > 0) {
      obj.size = Math.max(10, (obj.size || 14) * (nh / prev.h));
    }
    return obj;
  }

  if (obj.type === 'arrow') {
    const sx = prev.w ? nw / prev.w : 1;
    const sy = prev.h ? nh / prev.h : 1;
    obj.x1 = nx + (obj.x1 - prev.x) * sx;
    obj.y1 = ny + (obj.y1 - prev.y) * sy;
    obj.x2 = nx + (obj.x2 - prev.x) * sx;
    obj.y2 = ny + (obj.y2 - prev.y) * sy;
    return obj;
  }

  if (obj.type === 'pen') {
    const sx = prev.w ? nw / prev.w : 1;
    const sy = prev.h ? nh / prev.h : 1;
    for (const p of obj.points || []) {
      p.x = nx + (p.x - prev.x) * sx;
      p.y = ny + (p.y - prev.y) * sy;
    }
    return obj;
  }

  return obj;
}

function drawArrowPath(ctx, x1, y1, x2, y2, width) {
  const head = Math.max(10, (width || 4) * 3.5);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle - Math.PI / 6),
    y2 - head * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - head * Math.cos(angle + Math.PI / 6),
    y2 - head * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawObject(ctx, obj, imageEl) {
  if (!ctx || !obj) return;
  if (obj.type === 'pen') {
    const pts = obj.points || [];
    if (pts.length < 1) return;
    ctx.save();
    ctx.strokeStyle = obj.color || '#000';
    ctx.lineWidth = obj.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (pts.length === 1) {
      ctx.lineTo(pts[0].x + 0.01, pts[0].y + 0.01);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (obj.type === 'rect') {
    const b = normalizeRect(obj.x, obj.y, obj.w, obj.h);
    ctx.save();
    ctx.strokeStyle = obj.color || '#000';
    ctx.lineWidth = obj.width || 4;
    ctx.lineJoin = 'round';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();
    return;
  }
  if (obj.type === 'arrow') {
    ctx.save();
    ctx.strokeStyle = obj.color || '#000';
    ctx.fillStyle = obj.color || '#000';
    ctx.lineWidth = obj.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawArrowPath(ctx, obj.x1, obj.y1, obj.x2, obj.y2, obj.width);
    ctx.restore();
    return;
  }
  if (obj.type === 'text') {
    ctx.save();
    ctx.font = `${obj.size || 14}px "DM Sans", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = obj.color || '#000';
    String(obj.value || '')
      .split('\n')
      .forEach((line, i) => {
        ctx.fillText(line, obj.x, obj.y + i * (obj.size || 14) * 1.25);
      });
    ctx.restore();
    return;
  }
  if (obj.type === 'image') {
    const img = imageEl || null;
    if (img && img.complete) {
      ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
    }
  }
}

function drawScene(ctx, scene, opts = {}) {
  const skipId = opts.skipId || null;
  const images = opts.images || {};
  for (const obj of scene || []) {
    if (skipId && obj.id === skipId) continue;
    drawObject(ctx, obj, obj.type === 'image' ? images[obj.id] : null);
  }
}

const sceneApi = {
  nextId,
  resetIdCounter,
  cloneScene,
  normalizeRect,
  objectBounds,
  hitTest,
  moveObject,
  setObjectBounds,
  drawObject,
  drawScene,
  drawArrowPath,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = sceneApi;
}
if (typeof window !== 'undefined') {
  window.PaintScene = sceneApi;
}
