'use strict';

const MIN_IMAGE_SIZE = 24;

/** Place pasted images at their intrinsic pixel size (never downscale to fit). */
function naturalPasteSize(naturalW, naturalH, minSize = MIN_IMAGE_SIZE) {
  return {
    w: Math.max(minSize, Number(naturalW) || 0),
    h: Math.max(minSize, Number(naturalH) || 0),
  };
}

/** Grow the document canvas so a full-resolution paste still fits. */
function expandCanvasToFitImage(canvasW, canvasH, imgW, imgH) {
  return {
    width: Math.max(Math.ceil(canvasW), Math.ceil(imgW)),
    height: Math.max(Math.ceil(canvasH), Math.ceil(imgH)),
  };
}

/** Zoom out (never above maxScale) so the whole document fits in the stage. */
function viewScaleToFit(contentW, contentH, viewportW, viewportH, maxScale = 1) {
  if (contentW <= 0 || contentH <= 0 || viewportW <= 0 || viewportH <= 0) {
    return maxScale;
  }
  return Math.min(viewportW / contentW, viewportH / contentH, maxScale);
}

function centerRect(outerW, outerH, innerW, innerH) {
  return {
    x: (outerW - innerW) / 2,
    y: (outerH - innerH) / 2,
  };
}

/**
 * Convert a pointer event's client coords into canvas layout pixels when the
 * canvas may be CSS-scaled for "fit whole image" viewing.
 */
function layoutPointerPos(clientX, clientY, visualRect, layoutW, layoutH) {
  const vw = visualRect.width || 1;
  const vh = visualRect.height || 1;
  return {
    x: ((clientX - visualRect.left) * layoutW) / vw,
    y: ((clientY - visualRect.top) * layoutH) / vh,
  };
}

/**
 * Soft-clamp selection so images can move freely (including mostly off-canvas)
 * while keeping a small grab margin visible on the document.
 */
function clampSelectionPosition(x, y, w, h, canvasW, canvasH, margin = 40) {
  const nextW = Math.max(MIN_IMAGE_SIZE, w);
  const nextH = Math.max(MIN_IMAGE_SIZE, h);
  return {
    x: Math.min(canvasW - margin, Math.max(margin - nextW, x)),
    y: Math.min(canvasH - margin, Math.max(margin - nextH, y)),
    w: nextW,
    h: nextH,
  };
}

/** Layout box for the scaled viewport shell (so CSS zoom-out actually shows). */
function viewportScaledSize(contentW, contentH, scale) {
  return {
    width: contentW * scale,
    height: contentH * scale,
  };
}

const pasteViewApi = {
  MIN_IMAGE_SIZE,
  naturalPasteSize,
  expandCanvasToFitImage,
  viewScaleToFit,
  centerRect,
  layoutPointerPos,
  clampSelectionPosition,
  viewportScaledSize,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = pasteViewApi;
}
if (typeof window !== 'undefined') {
  window.PaintPasteView = pasteViewApi;
}
