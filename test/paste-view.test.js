const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  naturalPasteSize,
  expandCanvasToFitImage,
  viewScaleToFit,
  centerRect,
  layoutPointerPos,
  clampSelectionPosition,
  viewportScaledSize,
} = require('../lib/paste-view');

describe('naturalPasteSize', () => {
  it('keeps the image at its natural pixel size (no downscale)', () => {
    assert.deepEqual(naturalPasteSize(2400, 1600), { w: 2400, h: 1600 });
  });

  it('enforces a minimum size for tiny images', () => {
    assert.deepEqual(naturalPasteSize(8, 10), { w: 24, h: 24 });
  });
});

describe('expandCanvasToFitImage', () => {
  it('grows the canvas when the image is larger than the current canvas', () => {
    assert.deepEqual(expandCanvasToFitImage(1100, 680, 2400, 1600), {
      width: 2400,
      height: 1600,
    });
  });

  it('keeps the canvas when the image already fits', () => {
    assert.deepEqual(expandCanvasToFitImage(1100, 680, 400, 300), {
      width: 1100,
      height: 680,
    });
  });
});

describe('viewScaleToFit', () => {
  it('zooms out so a large canvas fits entirely in the viewport', () => {
    const scale = viewScaleToFit(2400, 1600, 1200, 800);
    assert.ok(Math.abs(scale - 0.5) < 1e-9);
  });

  it('does not zoom in past 1 when content already fits', () => {
    assert.equal(viewScaleToFit(800, 600, 1200, 800), 1);
  });
});

describe('centerRect', () => {
  it('centers an image on the canvas', () => {
    assert.deepEqual(centerRect(1100, 680, 400, 300), { x: 350, y: 190 });
  });
});

describe('layoutPointerPos', () => {
  it('maps visual pointer coords back to unscaled canvas layout pixels', () => {
    // Visual rect is half size because viewScale=0.5
    const pos = layoutPointerPos(100, 50, {
      left: 0,
      top: 0,
      width: 550,
      height: 340,
    }, 1100, 680);
    assert.deepEqual(pos, { x: 200, y: 100 });
  });
});

describe('clampSelectionPosition', () => {
  it('allows moving a full-canvas image (not locked at 0,0)', () => {
    const next = clampSelectionPosition(-120, 50, 2400, 1600, 2400, 1600, 40);
    assert.equal(next.x, -120);
    assert.equal(next.y, 50);
  });

  it('keeps a grab margin on-canvas so the selection cannot fully disappear', () => {
    const next = clampSelectionPosition(-5000, -5000, 400, 300, 1100, 680, 40);
    assert.equal(next.x, 40 - 400);
    assert.equal(next.y, 40 - 300);
  });
});

describe('viewportScaledSize', () => {
  it('sizes the viewport to the scaled document so zoom-out is visible', () => {
    assert.deepEqual(viewportScaledSize(2400, 1600, 0.5), {
      width: 1200,
      height: 800,
    });
  });
});
