const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldStartImageMove } = require('../lib/move-mode');

describe('shouldStartImageMove', () => {
  it('starts move on Shift+click even when another tool is active', () => {
    assert.equal(shouldStartImageMove('pen', true, false), true);
  });

  it('starts move when the Move tool is active', () => {
    assert.equal(shouldStartImageMove('move', false, false), true);
  });

  it('starts move from the move control button', () => {
    assert.equal(shouldStartImageMove('pen', false, true), true);
  });

  it('does not start move on a plain click while drawing tools are active', () => {
    assert.equal(shouldStartImageMove('pen', false, false), false);
    assert.equal(shouldStartImageMove('rect', false, false), false);
  });
});
