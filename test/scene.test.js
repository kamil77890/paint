const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  cloneScene,
  objectBounds,
  hitTest,
  moveObject,
  setObjectBounds,
  normalizeRect,
  nextId,
  resetIdCounter,
} = require('../lib/scene');

describe('cloneScene', () => {
  it('deep-clones so undo snapshots are isolated', () => {
    const scene = [{ id: 'a', type: 'rect', x: 1, y: 2, w: 3, h: 4, color: '#f00', width: 2 }];
    const copy = cloneScene(scene);
    copy[0].x = 99;
    assert.equal(scene[0].x, 1);
  });
});

describe('objectBounds', () => {
  it('bounds a pen stroke from its points', () => {
    const b = objectBounds({
      type: 'pen',
      width: 2,
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
    });
    assert.equal(b.x, 9);
    assert.equal(b.y, 19);
    assert.equal(b.w, 22);
    assert.equal(b.h, 22);
  });

  it('normalizes inverted rects', () => {
    assert.deepEqual(normalizeRect(10, 10, -40, -20), { x: -30, y: -10, w: 40, h: 20 });
  });
});

describe('hitTest', () => {
  it('returns the topmost object under a point', () => {
    const scene = [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, color: '#0', width: 1 },
      { id: 'b', type: 'rect', x: 20, y: 20, w: 20, h: 20, color: '#0', width: 1 },
    ];
    assert.equal(hitTest(scene, 25, 25).id, 'b');
    assert.equal(hitTest(scene, 5, 5).id, 'a');
    assert.equal(hitTest(scene, 500, 500), null);
  });
});

describe('moveObject / setObjectBounds', () => {
  it('moves arrow endpoints together', () => {
    const arrow = { type: 'arrow', x1: 0, y1: 0, x2: 10, y2: 10, width: 2, color: '#0' };
    moveObject(arrow, 5, -2);
    assert.deepEqual(
      { x1: arrow.x1, y1: arrow.y1, x2: arrow.x2, y2: arrow.y2 },
      { x1: 5, y1: -2, x2: 15, y2: 8 }
    );
  });

  it('scales pen points into a new box', () => {
    const pen = {
      type: 'pen',
      width: 2,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    };
    const prev = objectBounds(pen);
    setObjectBounds(pen, { x: 0, y: 0, w: 20, h: 20 }, prev);
    assert.ok(pen.points[1].x > 10);
  });
});

describe('nextId', () => {
  it('issues unique ids', () => {
    resetIdCounter(1);
    assert.notEqual(nextId(), nextId());
  });
});
