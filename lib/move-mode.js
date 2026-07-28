'use strict';

/**
 * Floating-image body drag starts only in Move mode, via Shift+click, or the
 * move control — otherwise the body click is ignored so handles can resize.
 */
function shouldStartImageMove(tool, shiftKey, fromMoveButton = false) {
  return Boolean(fromMoveButton || shiftKey || tool === 'move');
}

const moveModeApi = { shouldStartImageMove };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = moveModeApi;
}
if (typeof window !== 'undefined') {
  window.PaintMoveMode = moveModeApi;
}
