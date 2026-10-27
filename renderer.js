(() => {
  const canvas = document.getElementById('canvas');
  const canvasWrap = document.getElementById('canvasWrap');
  const canvasViewport = document.getElementById('canvasViewport');
  const objectOverlaysEl = document.getElementById('objectOverlays');
  const stageEl = document.querySelector('.stage');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const textInput = document.getElementById('textInput');
  const colorInput = document.getElementById('color');
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeValue = document.getElementById('brushSizeValue');
  const toastEl = document.getElementById('toast');
  const imageTransform = document.getElementById('imageTransform');
  const imageTransformFrame = document.getElementById('imageTransformFrame');
  const imageTransformImg = document.getElementById('imageTransformImg');
  const imageMoveBtn = document.getElementById('imageMoveBtn');
  const imageDeleteBtn = document.getElementById('imageDeleteBtn');

  const {
    MIN_IMAGE_SIZE,
    naturalPasteSize,
    expandCanvasToFitImage,
    viewScaleToFit,
    centerRect,
    layoutPointerPos,
    clampSelectionPosition,
    viewportScaledSize,
  } = window.PaintPasteView;
  const { shouldStartImageMove } = window.PaintMoveMode;
  const {
    nextId,
    cloneScene,
    objectBounds,
    hitTest,
    setObjectBounds,
    normalizeRect,
    drawObject,
    drawScene,
  } = window.PaintScene;

  const DEFAULT_COLOR = '#ff0000';
  colorInput.value = DEFAULT_COLOR;

  /** True once paste/import expands the document beyond the default CSS wrap size. */
  let customDocumentSize = false;
  let viewScale = 1;
  /** Tool to restore when leaving Move with Escape. */
  let toolBeforeMove = 'pen';

  /** Placed drawable objects (pen, rect, arrow, text, image). */
  let scene = [];
  /** HTMLImageElement cache keyed by object id. */
  const imageEls = new Map();
  /** In-progress stroke not yet pushed to scene. */
  let draft = null;
  /** Shift key held — reveal pick overlays for all objects. */
  let shiftHeld = false;
  /** Object id currently under the pointer (hover). */
  let hoverObjectId = null;

  const state = {
    tool: 'pen',
    color: DEFAULT_COLOR,
    brushSize: Number(brushSizeInput.value),
    drawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    undoStack: [],
    redoStack: [],
    maxHistory: 40,
    /** True when pointerdown pushed a history frame for the current stroke. */
    strokeCheckpoint: false,
    /** True once the pointer moved enough to count as a real shape stroke. */
    strokeMoved: false,
  };

  const selection = {
    active: false,
    /** 'floating' | 'placed' | 'multi' */
    kind: null,
    objectId: null,
    /** Object ids when kind === 'multi' (Ctrl+A). */
    selectedIds: [],
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    aspect: 1,
    blobUrl: null,
    drag: null,
    origBounds: null,
    objectSnapshot: null,
    historyPushed: false,
  };

  function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.toggle('error', isError);
    // Failures must interrupt — polite status can be delayed or dropped while
    // the user is still interacting (Save/Paste/Import errors especially).
    toastEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.setAttribute('aria-live', 'polite');
    }, 2200);
  }

  function layoutSize() {
    return {
      width: Math.max(1, canvasWrap.offsetWidth || canvas.offsetWidth || 1),
      height: Math.max(1, canvasWrap.offsetHeight || canvas.offsetHeight || 1),
    };
  }

  function stageViewportSize() {
    const style = stageEl ? getComputedStyle(stageEl) : null;
    const padX = style
      ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      : 48;
    const padY = style
      ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      : 48;
    return {
      width: Math.max(1, (stageEl?.clientWidth || window.innerWidth) - padX),
      height: Math.max(1, (stageEl?.clientHeight || window.innerHeight) - padY),
    };
  }

  function applyViewScale(scale) {
    viewScale = scale;
    const layout = layoutSize();
    canvasWrap.style.transformOrigin = '0 0';
    canvasWrap.style.transform = scale === 1 ? '' : `scale(${scale})`;
    if (!canvasViewport) return;
    // Keep the default CSS-sized wrap fluid until a large paste locks document size.
    if (scale === 1 && !customDocumentSize) {
      canvasViewport.style.width = '';
      canvasViewport.style.height = '';
      return;
    }
    const box = viewportScaledSize(layout.width, layout.height, scale);
    canvasViewport.style.width = `${box.width}px`;
    canvasViewport.style.height = `${box.height}px`;
  }

  function fitViewToDocument() {
    const layout = layoutSize();
    const viewport = stageViewportSize();
    applyViewScale(
      viewScaleToFit(layout.width, layout.height, viewport.width, viewport.height)
    );
  }

  /**
   * @param {{ preserveContent?: boolean }} [opts]
   *   preserveContent kept for callers; scene redraw replaces bitmap stretch.
   */
  function resizeCanvas() {
    const layout = layoutSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(layout.width * dpr));
    canvas.height = Math.max(1, Math.floor(layout.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redraw();
  }

  function setDocumentSize(width, height) {
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    const layout = layoutSize();
    if (w === layout.width && h === layout.height && customDocumentSize) {
      return false;
    }
    customDocumentSize = true;
    canvasWrap.style.width = `${w}px`;
    canvasWrap.style.height = `${h}px`;
    resizeCanvas();
    return true;
  }

  function clearCustomDocumentSize() {
    customDocumentSize = false;
    canvasWrap.style.width = '';
    canvasWrap.style.height = '';
    canvasWrap.style.transform = '';
    if (canvasViewport) {
      canvasViewport.style.width = '';
      canvasViewport.style.height = '';
    }
    viewScale = 1;
  }

  function fillPaper() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function imageMapForDraw() {
    const map = {};
    for (const obj of scene) {
      if (obj.type !== 'image') continue;
      map[obj.id] = ensureImageEl(obj);
    }
    return map;
  }

  function ensureImageEl(obj) {
    let img = imageEls.get(obj.id);
    if (img) return img;
    img = new Image();
    img.decoding = 'async';
    img.onload = () => redraw();
    img.src = obj.src;
    imageEls.set(obj.id, img);
    return img;
  }

  function redraw() {
    fillPaper();
    // Always draw placed objects in-place; selection is border-only overlays.
    drawScene(ctx, scene, { images: imageMapForDraw() });
    if (draft) drawObject(ctx, draft, null);
    syncObjectOverlays();
  }

  function overlaysShouldShow() {
    const multi = selection.kind === 'multi' && selection.selectedIds.length > 0;
    const placed = selection.kind === 'placed' && !!selection.objectId;
    return (
      (shiftHeld || state.tool === 'move' || multi || placed) &&
      scene.length > 0 &&
      !state.drawing
    );
  }

  function syncObjectOverlays() {
    if (!objectOverlaysEl) return;
    if (!overlaysShouldShow()) {
      objectOverlaysEl.hidden = true;
      objectOverlaysEl.innerHTML = '';
      objectOverlaysEl.setAttribute('aria-hidden', 'true');
      return;
    }
    objectOverlaysEl.hidden = false;
    objectOverlaysEl.setAttribute('aria-hidden', 'false');
    const selectedId =
      selection.active && selection.kind === 'placed' ? selection.objectId : null;
    const multiIds = new Set(
      selection.kind === 'multi' ? selection.selectedIds || [] : []
    );
    const html = scene
      .map((obj) => {
        // While dragging a placed object, use live selection box so the border follows.
        let b = objectBounds(obj);
        if (selectedId && obj.id === selectedId && selection.drag) {
          b = { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
        } else if (selectedId && obj.id === selectedId) {
          b = { x: selection.x, y: selection.y, w: selection.w, h: selection.h };
        }
        const w = Math.max(2, b.w);
        const h = Math.max(2, b.h);
        const classes = ['object-overlay'];
        if (obj.id === hoverObjectId && obj.id !== selectedId && !multiIds.has(obj.id)) {
          classes.push('is-hover');
        }
        if (multiIds.has(obj.id)) classes.push('is-multi-selected');
        else if (obj.id === selectedId) classes.push('is-selected');
        const label = obj.type || 'object';
        return (
          `<div class="${classes.join(' ')}" data-id="${obj.id}" ` +
          `style="left:${b.x}px;top:${b.y}px;width:${w}px;height:${h}px">` +
          `<span class="object-overlay-label">${label}</span></div>`
        );
      })
      .join('');
    objectOverlaysEl.innerHTML = html;
  }

  function clearMultiSelect() {
    selection.selectedIds = [];
    if (selection.kind === 'multi') {
      selection.active = false;
      selection.kind = null;
    }
    syncObjectOverlays();
  }

  function selectAllObjects() {
    if (fileDialogBusy) return;
    if (state.drawing) endActiveStroke({ discardPen: true });
    if (!textInput.hidden) hideTextInput();
    if (selection.active && selection.kind === 'floating') {
      cancelImageSelection();
    } else if (selection.active && selection.kind === 'placed') {
      deselectPlacedObject({ revert: false });
    }
    if (!scene.length) {
      showToast('Nothing to select');
      return;
    }
    selection.active = true;
    selection.kind = 'multi';
    selection.objectId = null;
    selection.selectedIds = scene.map((o) => o.id);
    selection.drag = null;
    imageTransform.hidden = true;
    imageTransformImg.removeAttribute('src');
    syncObjectOverlays();
    showToast(
      selection.selectedIds.length === 1
        ? 'Selected 1 object'
        : `Selected ${selection.selectedIds.length} objects`
    );
  }

  function updateHoverFromPoint(x, y) {
    if (!overlaysShouldShow()) {
      if (hoverObjectId) {
        hoverObjectId = null;
        syncObjectOverlays();
      }
      return null;
    }
    const hit = hitTest(scene, x, y);
    const nextId = hit ? hit.id : null;
    if (nextId !== hoverObjectId) {
      hoverObjectId = nextId;
      syncObjectOverlays();
    }
    return hit;
  }

  function pointerPos(e) {
    const layout = layoutSize();
    return layoutPointerPos(
      e.clientX,
      e.clientY,
      canvas.getBoundingClientRect(),
      layout.width,
      layout.height
    );
  }

  /**
   * @param {{ keepRedo?: boolean }} [opts]
   *   keepRedo — stroke checkpoints only. Redo is cleared when the stroke
   *   actually commits; canceling (Escape / Undo) must not wipe redo history.
   */
  function pushHistory(opts = {}) {
    state.undoStack.push(cloneScene(scene));
    if (state.undoStack.length > state.maxHistory) state.undoStack.shift();
    if (!opts.keepRedo) state.redoStack.length = 0;
    return true;
  }

  function undo() {
    // Native Save/Import dialogs are modal on most platforms, but menu/toolbar
    // actions can still fire — mutating the canvas then would desync the PNG
    // already encoded for the dialog (and cancel would leave a wiped sketch).
    if (fileDialogBusy) return;
    // Discard floating paste/import — committing first would stamp the image
    // and then undo the previous stroke instead.
    if (selection.active && selection.kind === 'floating') {
      cancelImageSelection();
      showToast('Selection discarded');
      return;
    }
    if (selection.active && selection.kind === 'multi') {
      clearMultiSelect();
      showToast('Selection cleared');
      return;
    }
    if (selection.active && selection.kind === 'placed') {
      deselectPlacedObject({ revert: true });
      showToast('Selection discarded');
      return;
    }
    // Same for an open text field (toolbar Undo bypasses whenNotTyping).
    if (!textInput.hidden) {
      hideTextInput();
      showToast('Text discarded');
      return;
    }
    // Mid-drag Undo must cancel the stroke first — otherwise drawing stays true,
    // the checkpoint is popped, and further pointermove inks on a restored frame.
    if (state.drawing) {
      endActiveStroke({ discardPen: true });
      showToast('Stroke canceled');
      return;
    }
    // Match Clear / Delete — a silent no-op made Ctrl+Z look broken.
    if (!state.undoStack.length) {
      showToast('Nothing to undo');
      return;
    }
    state.redoStack.push(cloneScene(scene));
    scene = state.undoStack.pop();
    pruneImageCache();
    redraw();
    showToast('Undo');
  }

  function redo() {
    if (fileDialogBusy) return;
    if (selection.active && selection.kind === 'floating') {
      cancelImageSelection();
      showToast('Selection discarded');
      return;
    }
    if (selection.active && selection.kind === 'multi') {
      clearMultiSelect();
      showToast('Selection cleared');
      return;
    }
    if (selection.active && selection.kind === 'placed') {
      deselectPlacedObject({ revert: true });
      showToast('Selection discarded');
      return;
    }
    if (!textInput.hidden) {
      hideTextInput();
      showToast('Text discarded');
      return;
    }
    if (state.drawing) {
      endActiveStroke({ discardPen: true });
      showToast('Stroke canceled');
      return;
    }
    if (!state.redoStack.length) {
      showToast('Nothing to redo');
      return;
    }
    state.undoStack.push(cloneScene(scene));
    scene = state.redoStack.pop();
    pruneImageCache();
    redraw();
    showToast('Redo');
  }

  function pruneImageCache() {
    const ids = new Set(scene.filter((o) => o.type === 'image').map((o) => o.id));
    for (const id of imageEls.keys()) {
      if (!ids.has(id)) imageEls.delete(id);
    }
  }

  /**
   * End an in-progress stroke.
   * @param {{ discardPen?: boolean }} [opts]
   *   discardPen — Escape cancel: drop draft / checkpoint.
   *   Tool switch / clear / paste leave committed drafts via commit path.
   */
  function endActiveStroke(opts = {}) {
    if (!state.drawing) return;
    if (opts.discardPen || state.tool !== 'pen') {
      if (state.strokeCheckpoint && state.undoStack.length) {
        state.undoStack.pop();
      }
      draft = null;
      redraw();
    } else if (draft) {
      // Pen ink left on the canvas counts as a committed change.
      scene.push(draft);
      draft = null;
      state.redoStack.length = 0;
      redraw();
    }
    state.drawing = false;
    state.strokeCheckpoint = false;
    state.strokeMoved = false;
  }

  function sceneHasContent() {
    return scene.length > 0 || !!draft;
  }

  function clearCanvas() {
    if (fileDialogBusy) return;
    const textOpen = !textInput.hidden;
    const textHasContent = textOpen && !!textInput.value.trim();
    // Empty canvas + no overlays: skip so Clear cannot stack blank undo frames.
    if (
      !textHasContent &&
      !selection.active &&
      !state.drawing &&
      !sceneHasContent()
    ) {
      if (textOpen) hideTextInput();
      showToast('Nothing to clear');
      return;
    }
    // Menu Clear does not blur the text field first — dismiss it so typed
    // text cannot be stamped onto the freshly wiped canvas afterward.
    hideTextInput();
    cancelImageSelection();
    // Discard in-progress ink (not just end the drag) so Undo after Clear
    // restores the pre-stroke canvas instead of a partial pen stroke.
    endActiveStroke({ discardPen: true });
    pushHistory();
    scene = [];
    imageEls.clear();
    draft = null;
    redraw();
    showToast('Canvas cleared');
  }

  function syncMoveCursor() {
    if (state.tool === 'move') {
      canvas.style.cursor = hoverObjectId || selection.active ? 'grab' : 'grab';
      imageTransformFrame.style.cursor = selection.active ? 'grab' : 'default';
      syncObjectOverlays();
      return;
    }
    canvas.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
    imageTransformFrame.style.cursor = 'default';
    syncObjectOverlays();
  }

  function enterMoveMode() {
    if (state.tool !== 'move') toolBeforeMove = state.tool;
    setTool('move');
    if (selection.active) {
      showToast('Move mode — drag to reposition');
    } else {
      showToast('Shift+click any object to move it');
    }
  }

  /** Leave Move without placing/deselecting (Escape). */
  function leaveMoveMode() {
    if (state.tool !== 'move') return;
    const next = toolBeforeMove || 'pen';
    state.tool = next;
    document.querySelectorAll('.tool').forEach((btn) => {
      const on = btn.dataset.tool === next;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncMoveCursor();
    showToast('Move mode off');
  }

  function setTool(tool) {
    // Don't stamp floating text/image while Save/Import is open — cancel must
    // leave those overlays uncommitted (same rule as finalizeExportOverlays).
    if (fileDialogBusy) return;
    // Keyboard tool switches (P/R/A/T/V) can fire mid-drag; end the stroke first
    // or rect/arrow preview logic runs without a snapshot / wrong tool.
    endActiveStroke();
    // Move keeps the current selection so it can be repositioned; other tools commit.
    if (tool !== 'move') {
      commitImageSelection();
      commitTextIfOpen();
    } else {
      commitTextIfOpen();
    }
    if (tool === 'move' && state.tool !== 'move') {
      toolBeforeMove = state.tool;
    }
    state.tool = tool;
    document.querySelectorAll('.tool').forEach((btn) => {
      const on = btn.dataset.tool === tool;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    syncMoveCursor();
  }

  function syncSelectionFrame() {
    imageTransformFrame.style.left = `${selection.x}px`;
    imageTransformFrame.style.top = `${selection.y}px`;
    imageTransformFrame.style.width = `${selection.w}px`;
    imageTransformFrame.style.height = `${selection.h}px`;
  }

  function clearSelectionBlob() {
    if (selection.blobUrl) {
      URL.revokeObjectURL(selection.blobUrl);
      selection.blobUrl = null;
    }
  }

  function hideImageSelection() {
    selection.active = false;
    selection.kind = null;
    selection.objectId = null;
    selection.selectedIds = [];
    selection.origBounds = null;
    selection.objectSnapshot = null;
    selection.historyPushed = false;
    selection.drag = null;
    imageTransform.hidden = true;
    imageTransformImg.hidden = false;
    imageTransformImg.removeAttribute('src');
    clearSelectionBlob();
    redraw();
  }

  function cancelImageSelection() {
    if (!selection.active) return false;
    if (selection.kind === 'multi') {
      clearMultiSelect();
      showToast('Selection cleared');
      return true;
    }
    if (selection.kind === 'placed') {
      deselectPlacedObject({ revert: true });
      return true;
    }
    hideImageSelection();
    return true;
  }

  function findSceneObject(id) {
    return scene.find((o) => o.id === id) || null;
  }

  function deselectPlacedObject(opts = {}) {
    if (!selection.active || selection.kind !== 'placed') return;
    if (opts.revert && selection.objectSnapshot && selection.objectId) {
      const idx = scene.findIndex((o) => o.id === selection.objectId);
      if (idx >= 0) scene[idx] = cloneScene([selection.objectSnapshot])[0];
      if (selection.historyPushed && state.undoStack.length) {
        state.undoStack.pop();
      }
    } else if (!opts.revert) {
      applySelectionToPlacedObject();
    }
    selection.active = false;
    selection.kind = null;
    selection.objectId = null;
    selection.origBounds = null;
    selection.objectSnapshot = null;
    selection.historyPushed = false;
    selection.drag = null;
    imageTransform.hidden = true;
    imageTransformImg.hidden = false;
    imageTransformImg.removeAttribute('src');
    clearSelectionBlob();
    redraw();
  }

  function applySelectionToPlacedObject() {
    const obj = findSceneObject(selection.objectId);
    if (!obj) return;
    setObjectBounds(
      obj,
      { x: selection.x, y: selection.y, w: selection.w, h: selection.h },
      selection.origBounds || objectBounds(obj)
    );
  }

  function selectPlacedObject(obj) {
    if (!obj) return;
    clearMultiSelect();
    if (selection.active && selection.kind === 'floating') {
      commitImageSelection();
    } else if (selection.active && selection.kind === 'placed') {
      deselectPlacedObject({ revert: false });
    }
    const b = objectBounds(obj);
    selection.active = true;
    selection.kind = 'placed';
    selection.objectId = obj.id;
    selection.x = b.x;
    selection.y = b.y;
    selection.w = Math.max(1, b.w);
    selection.h = Math.max(1, b.h);
    selection.aspect = selection.w / Math.max(1, selection.h);
    selection.origBounds = { ...b, w: selection.w, h: selection.h };
    selection.objectSnapshot = cloneScene([obj])[0];
    selection.historyPushed = false;
    selection.drag = null;
    selection.blobUrl = null;

    // Border-only selection — keep the real element visible; no paste chrome.
    imageTransform.hidden = true;
    imageTransformImg.hidden = true;
    imageTransformImg.removeAttribute('src');
    syncMoveCursor();
    redraw();
  }

  function deleteSelected() {
    if (fileDialogBusy) return;
    // Toolbar Delete steals focus; without this, blur can stamp typed text
    // and then this path reports "Nothing selected".
    if (!textInput.hidden) {
      hideTextInput();
      showToast('Text discarded');
      return;
    }
    if (!selection.active) {
      showToast('Nothing selected', true);
      return;
    }
    if (selection.kind === 'multi' && selection.selectedIds.length) {
      const ids = new Set(selection.selectedIds);
      const count = ids.size;
      pushHistory();
      scene = scene.filter((o) => !ids.has(o.id));
      pruneImageCache();
      hideImageSelection();
      showToast(count === 1 ? 'Object deleted' : `Deleted ${count} objects`);
      return;
    }
    if (selection.kind === 'placed' && selection.objectId) {
      pushHistory();
      scene = scene.filter((o) => o.id !== selection.objectId);
      pruneImageCache();
      hideImageSelection();
      showToast('Object deleted');
      return;
    }
    cancelImageSelection();
    showToast('Selection deleted');
  }

  function commitImageSelection() {
    if (!selection.active) return;
    if (selection.kind === 'multi') {
      clearMultiSelect();
      return;
    }
    if (selection.kind === 'placed') {
      // History was pushed when the edit drag started (if any).
      applySelectionToPlacedObject();
      hideImageSelection();
      return;
    }
    // Floating paste/import → scene image object
    pushHistory();
    const obj = {
      id: nextId(),
      type: 'image',
      x: selection.x,
      y: selection.y,
      w: selection.w,
      h: selection.h,
      src: imageTransformImg.src,
    };
    scene.push(obj);
    ensureImageEl(obj);
    hideImageSelection();
  }

  function beginImageSelection(img, blobUrl = null) {
    // Paste/import can arrive mid-drag (Ctrl+V during a stroke). End that first
    // or pointermove keeps inking under the floating image with drawing=true.
    endActiveStroke();
    // Import (and any other path here) can fire while the text field is open —
    // stamp it first so typed content is not left floating beside the image.
    commitTextIfOpen();
    clearMultiSelect();
    // Replace any existing floating image — do NOT stamp it onto the canvas
    // (that caused a "copy left behind" when paste fired twice or on remount).
    if (selection.active && selection.kind === 'placed') {
      deselectPlacedObject({ revert: false });
    } else if (selection.active) {
      cancelImageSelection();
    }

    const { w, h } = naturalPasteSize(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height
    );
    const layout = layoutSize();
    const next = expandCanvasToFitImage(layout.width, layout.height, w, h);
    if (next.width !== layout.width || next.height !== layout.height) {
      setDocumentSize(next.width, next.height);
      state.undoStack.length = 0;
      state.redoStack.length = 0;
    }
    fitViewToDocument();

    const canvasLayout = layoutSize();
    const { x, y } = centerRect(canvasLayout.width, canvasLayout.height, w, h);

    selection.active = true;
    selection.kind = 'floating';
    selection.objectId = null;
    selection.objectSnapshot = null;
    selection.origBounds = null;
    selection.x = x;
    selection.y = y;
    selection.w = w;
    selection.h = h;
    selection.aspect = w / h;
    selection.blobUrl = blobUrl;
    selection.drag = null;

    imageTransformImg.hidden = false;
    imageTransformImg.src = img.src;
    imageTransform.hidden = false;
    syncSelectionFrame();
    syncMoveCursor();
    redraw();
  }

  function clampSelection() {
    const layout = layoutSize();
    const next = clampSelectionPosition(
      selection.x,
      selection.y,
      selection.w,
      selection.h,
      layout.width,
      layout.height
    );
    selection.x = next.x;
    selection.y = next.y;
    selection.w = next.w;
    selection.h = next.h;
  }

  function startSelectionDrag(mode, e) {
    e.preventDefault();
    e.stopPropagation();
    if (selection.kind === 'placed' && !selection.historyPushed) {
      pushHistory();
      selection.historyPushed = true;
    }
    const { x, y } = pointerPos(e);
    selection.drag = {
      mode,
      startX: x,
      startY: y,
      origX: selection.x,
      origY: selection.y,
      origW: selection.w,
      origH: selection.h,
      origBounds: selection.origBounds
        ? { ...selection.origBounds }
        : { x: selection.x, y: selection.y, w: selection.w, h: selection.h },
      objectSnapshot:
        selection.kind === 'placed' && selection.objectSnapshot
          ? cloneScene([selection.objectSnapshot])[0]
          : null,
      pointerId: e.pointerId,
    };
    if (mode === 'move') {
      imageTransformFrame.style.cursor = 'grabbing';
      canvas.style.cursor = 'grabbing';
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      try {
        imageTransformFrame.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }

  function onSelectionPointerMove(e) {
    if (!selection.drag) return;
    const { x, y } = pointerPos(e);
    const dx = x - selection.drag.startX;
    const dy = y - selection.drag.startY;
    const { mode, origX, origY, origW, origH } = selection.drag;
    const keepRatio = !e.shiftKey;

    if (mode === 'move') {
      selection.x = origX + dx;
      selection.y = origY + dy;
    } else {
      let nextX = origX;
      let nextY = origY;
      let nextW = origW;
      let nextH = origH;

      if (mode.includes('e')) nextW = origW + dx;
      if (mode.includes('s')) nextH = origH + dy;
      if (mode.includes('w')) {
        nextW = origW - dx;
        nextX = origX + dx;
      }
      if (mode.includes('n')) {
        nextH = origH - dy;
        nextY = origY + dy;
      }

      if (keepRatio && (mode === 'nw' || mode === 'ne' || mode === 'sw' || mode === 'se')) {
        const absW = Math.max(MIN_IMAGE_SIZE, nextW);
        const absH = Math.max(MIN_IMAGE_SIZE, absW / selection.aspect);
        if (mode.includes('w')) nextX = origX + origW - absW;
        if (mode.includes('n')) nextY = origY + origH - absH;
        nextW = absW;
        nextH = absH;
      }

      selection.x = nextX;
      selection.y = nextY;
      selection.w = nextW;
      selection.h = nextH;
    }

    clampSelection();
    if (selection.kind === 'floating') syncSelectionFrame();

    if (selection.kind === 'placed' && selection.objectId) {
      const idx = scene.findIndex((o) => o.id === selection.objectId);
      if (idx >= 0 && selection.drag.objectSnapshot) {
        scene[idx] = cloneScene([selection.drag.objectSnapshot])[0];
        setObjectBounds(
          scene[idx],
          { x: selection.x, y: selection.y, w: selection.w, h: selection.h },
          selection.drag.origBounds
        );
        redraw();
      }
    }
  }

  function endSelectionDrag(e) {
    if (!selection.drag) return;
    if (selection.kind === 'placed') {
      selection.origBounds = {
        x: selection.x,
        y: selection.y,
        w: selection.w,
        h: selection.h,
      };
      const obj = findSceneObject(selection.objectId);
      if (obj) selection.objectSnapshot = cloneScene([obj])[0];
    }
    selection.drag = null;
    syncMoveCursor();
    try {
      imageTransformFrame.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (fileDialogBusy) return;
    // Never stamp/draw while a floating image is being dragged
    if (selection.drag) return;

    const { x, y } = pointerPos(e);

    // Shift+click or Move tool: select topmost scene object
    if (
      (e.shiftKey || state.tool === 'move') &&
      !selection.drag
    ) {
      const hit = hitTest(scene, x, y);
      if (hit) {
        e.preventDefault();
        if (e.shiftKey || state.tool !== 'move') enterMoveMode();
        selectPlacedObject(hit);
        startSelectionDrag('move', e);
        return;
      }
      if (state.tool === 'move') {
        if (selection.active) commitImageSelection();
        return;
      }
    }

    // Text tool: grabbing existing text drags it instead of opening a new field.
    if (state.tool === 'text' && !selection.drag) {
      const hit = hitTest(scene, x, y);
      if (hit && hit.type === 'text') {
        e.preventDefault();
        commitTextIfOpen();
        selectPlacedObject(hit);
        startSelectionDrag('move', e);
        return;
      }
    }

    if (selection.active) {
      // Click on empty canvas places/deselects; don't also start a stroke
      commitImageSelection();
      if (state.tool === 'move') {
        syncMoveCursor();
        return;
      }
      // fall through to start a new stroke after placing
    }

    // Move tool does not draw when missing a hit.
    if (state.tool === 'move') return;

    // pointerdown runs before blur. If a text field is still open and we start a
    // pen/shape stroke, the deferred blur commit would pushHistory + stamp mid-drag
    // and interleave text into the new stroke's undo timeline.
    commitTextIfOpen();

    canvas.setPointerCapture(e.pointerId);

    if (state.tool === 'text') {
      openTextInput(x, y);
      return;
    }

    // keepRedo: an Escape/Undo cancel must not destroy redo; clear on commit.
    state.strokeCheckpoint = pushHistory({ keepRedo: true });
    state.drawing = true;
    state.strokeMoved = false;
    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;

    if (state.tool === 'pen') {
      draft = {
        id: nextId(),
        type: 'pen',
        color: state.color,
        width: state.brushSize,
        points: [{ x, y }],
      };
      redraw();
    } else if (state.tool === 'rect') {
      draft = {
        id: nextId(),
        type: 'rect',
        x,
        y,
        w: 0,
        h: 0,
        color: state.color,
        width: state.brushSize,
      };
      redraw();
    } else if (state.tool === 'arrow') {
      draft = {
        id: nextId(),
        type: 'arrow',
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color: state.color,
        width: state.brushSize,
      };
      redraw();
    }
  }

  function onPointerMove(e) {
    // Hover pick targets while Shift is held / Move tool is active.
    if (!state.drawing && !selection.drag) {
      const pos = pointerPos(e);
      const hit = updateHoverFromPoint(pos.x, pos.y);
      if ((shiftHeld || state.tool === 'move') && hit) {
        canvas.style.cursor = 'grab';
      } else if (state.tool === 'move') {
        canvas.style.cursor = 'grab';
      } else if (!shiftHeld) {
        canvas.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
      }
    }

    if (!state.drawing || !draft) return;
    const { x, y } = pointerPos(e);
    if (Math.hypot(x - state.startX, y - state.startY) >= 2) {
      state.strokeMoved = true;
    }

    if (draft.type === 'pen') {
      draft.points.push({ x, y });
      state.lastX = x;
      state.lastY = y;
    } else if (draft.type === 'rect') {
      draft.w = x - state.startX;
      draft.h = y - state.startY;
      draft.x = state.startX;
      draft.y = state.startY;
    } else if (draft.type === 'arrow') {
      draft.x2 = x;
      draft.y2 = y;
    }
    redraw();
  }

  function onPointerUp(e) {
    if (!state.drawing) return;
    // Click-without-drag: shapes leave a blank checkpoint; pen leaves a
    // micro-dot from pointerdown and would clear redo. Discard both.
    if (!state.strokeMoved) {
      endActiveStroke({ discardPen: true });
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    if (draft) {
      if (draft.type === 'rect') {
        const n = normalizeRect(draft.x, draft.y, draft.w, draft.h);
        draft.x = n.x;
        draft.y = n.y;
        draft.w = n.w;
        draft.h = n.h;
      }
      scene.push(draft);
      draft = null;
    }
    state.drawing = false;
    state.strokeCheckpoint = false;
    state.strokeMoved = false;
    // Stroke committed — drop redo (deferred from the keepRedo checkpoint).
    state.redoStack.length = 0;
    redraw();
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function openTextInput(x, y) {
    // pointerdown on the canvas fires before blur on the open field, so clearing
    // value here would race ahead of the blur commit and drop typed text.
    if (!textInput.hidden) commitText();
    // textInput is position:absolute under .stage (not .canvas-wrap).
    // Using the wrap rect made the overlay sit up/left of the click by the
    // stage padding + centering offset. Layout x/y must be mapped through the
    // current view scale (paste fit-to-view) into the visual canvas rect.
    const stageNode = canvas.closest('.stage') || canvas.parentElement;
    const stageRect = stageNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const layout = layoutSize();
    const visualX = (x * canvasRect.width) / layout.width;
    const visualY = (y * canvasRect.height) / layout.height;
    textInput.hidden = false;
    textInput.value = '';
    textInput.style.left = `${canvasRect.left - stageRect.left + visualX}px`;
    textInput.style.top = `${canvasRect.top - stageRect.top + visualY}px`;
    textInput.style.color = state.color;
    textInput.style.fontSize = `${Math.max(14, state.brushSize * 4)}px`;
    textInput.dataset.x = String(x);
    textInput.dataset.y = String(y);
    textInput.focus();
  }

  function hideTextInput() {
    textInput.hidden = true;
    textInput.value = '';
  }

  /** Pending on-canvas text overlay, or null if none / empty. */
  function getOpenTextDraw() {
    if (textInput.hidden) return null;
    const value = textInput.value.trim();
    if (!value) return null;
    return {
      value,
      x: Number(textInput.dataset.x),
      y: Number(textInput.dataset.y),
      size: Math.max(14, state.brushSize * 4),
      color: state.color,
    };
  }

  function drawTextContent(targetCtx, t) {
    targetCtx.font = `${t.size}px "DM Sans", sans-serif`;
    targetCtx.textBaseline = 'top';
    targetCtx.fillStyle = t.color;
    const lines = t.value.split('\n');
    lines.forEach((line, i) => {
      targetCtx.fillText(line, t.x, t.y + i * t.size * 1.25);
    });
  }

  function commitText() {
    const t = getOpenTextDraw();
    if (!t) {
      hideTextInput();
      return;
    }
    pushHistory();
    scene.push({
      id: nextId(),
      type: 'text',
      x: t.x,
      y: t.y,
      value: t.value,
      size: t.size,
      color: t.color,
    });
    hideTextInput();
    redraw();
  }

  /** Stamp any open text field onto the canvas so export/tool switches don't drop it. */
  function commitTextIfOpen() {
    if (textInput.hidden) return;
    commitText();
  }

  function placeImageFromDataUrl(dataUrl, blobUrl = null) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        beginImageSelection(img, blobUrl);
        resolve();
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * Commit an in-progress stroke in place (keep ink/preview on the canvas).
   * Modal save dialogs can swallow pointerup mid-drag; without this, drawing
   * stays true and the next move keeps transforming from a stale snapshot.
   */
  function finishActiveStroke() {
    if (!state.drawing) return;
    // Click-without-drag (any tool): same discard as pointerup.
    if (!state.strokeMoved) {
      endActiveStroke({ discardPen: true });
      return;
    }
    if (draft) {
      if (draft.type === 'rect') {
        const n = normalizeRect(draft.x, draft.y, draft.w, draft.h);
        draft.x = n.x;
        draft.y = n.y;
        draft.w = n.w;
        draft.h = n.h;
      }
      scene.push(draft);
      draft = null;
    }
    state.drawing = false;
    state.strokeCheckpoint = false;
    state.strokeMoved = false;
    state.redoStack.length = 0;
    redraw();
  }

  async function exportPngBuffer() {
    // Finish mid-drag before encoding — Ctrl+S during a stroke must not leave
    // drawing=true after the modal dialog eats the pointerup.
    finishActiveStroke();
    // Composite open text / floating image onto an offscreen canvas only —
    // do not stamp them on the live bitmap until finalizeExportOverlays
    // (canceling the save dialog must leave the text field open).
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
    exportCtx.fillStyle = '#f3efe6';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(exportCtx, scene, { images: imageMapForDraw() });
    if (selection.active && selection.kind === 'floating') {
      exportCtx.drawImage(
        imageTransformImg,
        selection.x,
        selection.y,
        selection.w,
        selection.h
      );
    } else if (selection.active && selection.kind === 'placed') {
      const obj = findSceneObject(selection.objectId);
      if (obj) {
        drawObject(
          exportCtx,
          obj,
          obj.type === 'image' ? ensureImageEl(obj) : null
        );
      }
    }
    const pendingText = getOpenTextDraw();
    if (pendingText) {
      drawObject(exportCtx, {
        type: 'text',
        x: pendingText.x,
        y: pendingText.y,
        value: pendingText.value,
        size: pendingText.size,
        color: pendingText.color,
      });
    }
    const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to encode canvas as PNG');
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function finalizeExportOverlays() {
    if (selection.active) commitImageSelection();
    commitTextIfOpen();
  }

  // Save/Import open modal native dialogs — without this, double Ctrl+S / rapid
  // Save+Import clicks stack overlapping pickers (paste already has pasteInFlight).
  let fileDialogBusy = false;
  // Native dialogs blur the text field; skip auto-commit so Cancel can restore it.
  let ignoreTextBlurCommit = false;

  function beginFileDialog() {
    fileDialogBusy = true;
    ignoreTextBlurCommit = true;
  }

  function endFileDialog() {
    ignoreTextBlurCommit = false;
    fileDialogBusy = false;
    // Dialog stole focus — put the caret back if text was left open (cancel/fail).
    if (!textInput.hidden && document.activeElement !== textInput) {
      textInput.focus();
    }
  }

  /** True when Save/Copy would export more than blank paper. */
  function hasExportableContent() {
    const textHasContent = !textInput.hidden && !!textInput.value.trim();
    return textHasContent || selection.active || sceneHasContent();
  }

  async function saveAndCopy() {
    // Same dual lock as drop — a paste/import in flight can still be wiring the
    // floating image; opening a save dialog then would export a half-ready frame.
    if (fileDialogBusy || pasteInFlight) return;
    // Finish mid-drag first so canvasHasInk() sees committed ink; skip the
    // native dialog when there's only blank paper (matches Clear).
    finishActiveStroke();
    if (!hasExportableContent()) {
      showToast('Nothing to save');
      return;
    }
    beginFileDialog();
    try {
      const png = await exportPngBuffer();
      const result = await window.sketchAPI.saveAndCopy(png);
      if (result?.canceled) {
        showToast('Save canceled');
        return;
      }
      if (result?.ok) {
        finalizeExportOverlays();
        // Mirror copy-and-save: a Wayland/clipboard failure after a good write
        // used to toast plain "Saved", so Ctrl+S looked fully successful.
        showToast(
          result.copied ? 'Saved & copied' : 'Saved (copy failed)',
          !result.copied
        );
      } else {
        showToast('Save failed', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Save failed', true);
    } finally {
      endFileDialog();
    }
  }

  async function copyAndSave() {
    if (fileDialogBusy || pasteInFlight) return;
    finishActiveStroke();
    if (!hasExportableContent()) {
      showToast('Nothing to copy');
      return;
    }
    beginFileDialog();
    try {
      const png = await exportPngBuffer();
      const result = await window.sketchAPI.copyAndSave(png);
      if (result?.ok) {
        finalizeExportOverlays();
        const name = result.path ? result.path.split(/[/\\]/).pop() : '';
        showToast(
          result.copied
            ? name
              ? `Copied & saved (${name})`
              : 'Copied & saved'
            : name
              ? `Saved (${name}; copy failed)`
              : 'Saved (copy failed)',
          !result.copied
        );
      } else {
        showToast(
          result?.copied ? 'Copied (save failed)' : 'Copy/save failed',
          true
        );
      }
    } catch (err) {
      console.error(err);
      showToast('Copy/save failed', true);
    } finally {
      endFileDialog();
    }
  }

  async function placeImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    await placeImageFromDataUrl(url, url);
  }

  async function pasteImageFromClipboardApi() {
    if (!navigator.clipboard?.read) return false;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      await placeImageFromBlob(blob);
      return true;
    }
    return false;
  }

  async function pasteImageFromEvent(clipboardData) {
    if (!clipboardData) return false;
    const items = clipboardData.items || [];
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      await placeImageFromBlob(file);
      return true;
    }
    const files = clipboardData.files || [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      await placeImageFromBlob(file);
      return true;
    }
    return false;
  }

  let pasteInFlight = false;

  async function pasteImage(clipboardData) {
    // Guard against Ctrl+V firing both the paste event and the keydown fallback.
    // Also block while a native Save/Import dialog is open (drop already does).
    if (pasteInFlight || fileDialogBusy) return;
    pasteInFlight = true;
    try {
      if (await pasteImageFromEvent(clipboardData)) {
        showToast('Image pasted — drag or resize, Enter to place');
        return;
      }
      try {
        if (await pasteImageFromClipboardApi()) {
          showToast('Image pasted — drag or resize, Enter to place');
          return;
        }
      } catch (err) {
        console.warn('clipboard.read failed', err);
      }

      const dataUrl = await window.sketchAPI.readClipboardImage();
      if (!dataUrl) {
        showToast('No image in clipboard', true);
        return;
      }
      await placeImageFromDataUrl(dataUrl);
      showToast('Image pasted — drag or resize, Enter to place');
    } catch (err) {
      console.error(err);
      showToast('Paste failed', true);
    } finally {
      setTimeout(() => {
        pasteInFlight = false;
      }, 400);
    }
  }

  async function importImage() {
    // Don't open Import while paste/drop is still placing a floating image —
    // beginImageSelection would cancel the in-flight selection on resolve.
    if (fileDialogBusy || pasteInFlight) return;
    beginFileDialog();
    try {
      const result = await window.sketchAPI.importImage();
      // Legacy null = treat as cancel; object form distinguishes cancel vs failure.
      if (!result || result.canceled) {
        // Match Save/Copy cancel toasts — a silent return looked like a no-op.
        showToast('Import canceled');
        return;
      }
      if (!result.ok || !result.dataUrl) {
        showToast('Could not import that image', true);
        return;
      }
      await placeImageFromDataUrl(result.dataUrl);
      showToast('Image imported — drag or resize, Enter to place');
    } catch (err) {
      console.error(err);
      showToast('Import failed', true);
    } finally {
      endFileDialog();
    }
  }

  // UI bindings
  document.querySelectorAll('.tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tool === 'move') enterMoveMode();
      else setTool(btn.dataset.tool);
    });
  });

  colorInput.addEventListener('input', () => {
    state.color = colorInput.value;
    // Keep the live text overlay in sync — commitText stamps state.color, so a
    // stale textarea color made the preview disagree with what gets placed.
    if (!textInput.hidden) textInput.style.color = state.color;
  });

  function applyBrushSize(next) {
    const min = Number(brushSizeInput.min) || 1;
    const max = Number(brushSizeInput.max) || 48;
    const size = Math.min(max, Math.max(min, Math.round(Number(next))));
    brushSizeInput.value = String(size);
    state.brushSize = size;
    brushSizeValue.textContent = String(size);
    if (!textInput.hidden) {
      textInput.style.fontSize = `${Math.max(14, size * 4)}px`;
    }
  }

  brushSizeInput.addEventListener('input', () => {
    applyBrushSize(brushSizeInput.value);
  });

  // Keep the text field focused on pointerdown so blur does not commit/hide it
  // before Undo/Redo/Clear/Delete/Save/Import run — otherwise blur's microtask
  // stamps text before click handlers can set ignoreTextBlurCommit (Save cancel
  // would no longer restore the open field).
  function preserveTextFocus(e) {
    if (!textInput.hidden) e.preventDefault();
  }
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const importBtn = document.getElementById('importBtn');
  const saveBtn = document.getElementById('saveBtn');
  undoBtn.addEventListener('pointerdown', preserveTextFocus);
  redoBtn.addEventListener('pointerdown', preserveTextFocus);
  clearBtn.addEventListener('pointerdown', preserveTextFocus);
  deleteBtn.addEventListener('pointerdown', preserveTextFocus);
  importBtn.addEventListener('pointerdown', preserveTextFocus);
  saveBtn.addEventListener('pointerdown', preserveTextFocus);
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteSelected();
  });
  clearBtn.addEventListener('click', clearCanvas);
  importBtn.addEventListener('click', importImage);
  saveBtn.addEventListener('click', saveAndCopy);

  imageDeleteBtn.addEventListener('pointerdown', (e) => {
    // Don't start a move/resize drag from the delete control
    e.preventDefault();
    e.stopPropagation();
  });
  imageDeleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteSelected();
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideTextInput();
      // Match Undo/image Escape — silent dismiss looked like a no-op.
      showToast('Text discarded');
    }
  });
  textInput.addEventListener('blur', () => {
    // Defer: canvas pointerdown may commit+reopen in the same turn; a sync blur
    // would see the fresh empty field and hide it immediately.
    queueMicrotask(() => {
      // Native Save/Import dialogs blur the field — don't stamp text on Cancel.
      if (ignoreTextBlurCommit) return;
      if (textInput.hidden || document.activeElement === textInput) return;
      // Color/brush already sync the live overlay — committing here would stamp
      // text the moment you open the picker, so you could never recolor mid-edit.
      const focus = document.activeElement;
      if (focus === colorInput || focus === brushSizeInput) return;
      commitText();
    });
  });

  // Without preventDefault, Electron may navigate the window to a dropped
  // file URL and wipe the sketch. Block that globally; place images on the stage.
  function isImageFile(file) {
    // Keep in sync with Import / clipboard HTML (incl. .tif/.tiff — scanners /
    // photo apps). Some OSes leave file.type empty or octet-stream for TIFF,
    // so the extension check is required or drops toast "Drop an image file".
    return file && (file.type.startsWith('image/') || /\.(png|jpe?g|jpe|jfif|pjpeg|pjp|gif|webp|bmp|svg|avif|ico|tiff?)$/i.test(file.name || ''));
  }
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    // Only treat drops that land on the canvas stage as imports.
    if (!canvasWrap.contains(e.target) && e.target !== canvasWrap) return;
    if (isTyping() || pasteInFlight || fileDialogBusy) return;
    const files = Array.from(e.dataTransfer?.files || []);
    const file = files.find(isImageFile);
    if (!file) {
      showToast('Drop an image file', true);
      return;
    }
    // Reuse pasteInFlight so a drop cannot race a concurrent Ctrl+V/import
    // (the check above was previously a no-op for drop itself).
    pasteInFlight = true;
    try {
      await placeImageFromBlob(file);
      showToast('Image imported — drag or resize, Enter to place');
    } catch (err) {
      console.error(err);
      showToast('Import failed', true);
    } finally {
      setTimeout(() => {
        pasteInFlight = false;
      }, 400);
    }
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  // Alt-Tab / OS gesture can drop capture without pointerup — end the stroke
  // or shape tools keep previewing from a stale snapshot on the next move.
  canvas.addEventListener('lostpointercapture', (e) => {
    if (state.drawing) onPointerUp(e);
  });

  // Lock screen / workspace switch can hide the window without dropping pointer
  // capture — finish the stroke and clear image drags so drawing cannot stick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (state.drawing) finishActiveStroke();
    if (selection.drag) selection.drag = null;
  });

  imageTransformFrame.addEventListener('pointerdown', (e) => {
    if (e.target.classList?.contains('handle')) return;
    if (e.target.closest?.('.image-delete-btn')) return;
    const fromMoveButton = Boolean(e.target.closest?.('.image-move-btn'));
    if (!shouldStartImageMove(state.tool, e.shiftKey, fromMoveButton)) return;
    if (e.shiftKey || fromMoveButton || state.tool !== 'move') {
      enterMoveMode();
    }
    startSelectionDrag('move', e);
  });
  imageMoveBtn.addEventListener('pointerdown', (e) => {
    enterMoveMode();
    startSelectionDrag('move', e);
  });
  imageTransform.querySelectorAll('.handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      startSelectionDrag(handle.dataset.handle, e);
    });
  });
  window.addEventListener('pointermove', onSelectionPointerMove);
  window.addEventListener('pointerup', endSelectionDrag);
  window.addEventListener('pointercancel', endSelectionDrag);
  // Alt-Tab / OS gesture can drop capture mid move/resize — clear drag so the
  // next pointermove does not keep transforming from a stale origin.
  window.addEventListener('lostpointercapture', (e) => {
    if (selection.drag) endSelectionDrag(e);
  });

  // Ctrl+S / Undo / Redo are handled by the Electron menu accelerators.
  // Ctrl+C / Ctrl+V: handled in the renderer keydown/paste path.
  let pasteEventSeenAt = 0;

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      shiftHeld = false;
      if (state.tool !== 'move') {
        hoverObjectId = null;
        canvas.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
      }
      syncObjectOverlays();
    }
  });

  window.addEventListener('blur', () => {
    if (!shiftHeld) return;
    shiftHeld = false;
    if (state.tool !== 'move') hoverObjectId = null;
    syncObjectOverlays();
  });

  canvas.addEventListener('pointerleave', () => {
    if (!hoverObjectId) return;
    hoverObjectId = null;
    syncObjectOverlays();
    if (state.tool === 'move') canvas.style.cursor = 'grab';
    else if (!shiftHeld) canvas.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
  });

  window.addEventListener('paste', (e) => {
    // Color/size inputs can receive Ctrl+V — don't steal that for image paste.
    if (isTyping() || isFormControlFocused()) return;
    e.preventDefault();
    pasteEventSeenAt = Date.now();
    pasteImage(e.clipboardData);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      shiftHeld = true;
      syncObjectOverlays();
    }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // Same lock as toolbar/menu — don't place/discard overlays mid Save/Import.
    if (fileDialogBusy) return;

    if (selection.active && !isTyping()) {
      // Enter/Escape/Delete must work even mid-drag — pointer capture used to
      // leave them dead. Position is already updated by pointermove, so Enter
      // can safely place at the current frame (same as releasing then Enter).
      if (key === 'enter') {
        e.preventDefault();
        selection.drag = null;
        if (selection.kind === 'multi') {
          clearMultiSelect();
          showToast('Selection cleared');
          return;
        }
        const wasFloating = selection.kind === 'floating';
        commitImageSelection();
        showToast(wasFloating ? 'Image placed' : 'Object updated');
        return;
      }
      if (key === 'escape') {
        e.preventDefault();
        selection.drag = null;
        if (selection.kind === 'multi') {
          clearMultiSelect();
          showToast('Selection cleared');
          return;
        }
        // In Move mode, Escape exits move (keeps floating image). Otherwise discard.
        if (state.tool === 'move') {
          leaveMoveMode();
          return;
        }
        cancelImageSelection();
        showToast('Selection discarded');
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        selection.drag = null;
        deleteSelected();
        return;
      }
    }

    // Escape cancels an in-progress pen/rect/arrow drag (matches text/image Escape).
    if (key === 'escape' && state.drawing && !isTyping()) {
      e.preventDefault();
      endActiveStroke({ discardPen: true });
      showToast('Stroke canceled');
      return;
    }

    if (mod && key === 'a' && !isTyping() && !isFormControlFocused()) {
      e.preventDefault();
      selectAllObjects();
      return;
    }

    // Ctrl+C — handled here (not menu accelerator) so color/brush focus cannot
    // divert into a no-op native copy. Still allow native copy while typing text.
    if (mod && key === 'c') {
      if (isTyping()) return;
      e.preventDefault();
      copyAndSave();
      return;
    }

    if (mod && key === 'v' && !isTyping() && !isFormControlFocused()) {
      e.preventDefault();
      const started = Date.now();
      setTimeout(() => {
        // Skip if a paste event already handled this keypress (or is in flight)
        if (pasteEventSeenAt >= started - 20 || pasteInFlight) return;
        pasteImage(null);
      }, 120);
      return;
    }

    // Skip while typing or adjusting color/size — R/A/P/T must not steal focus.
    if (isTyping() || isFormControlFocused() || mod) return;
    // [ / ] nudge brush size (common sketch-app shortcut; clamps to the slider).
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      applyBrushSize(state.brushSize + (e.key === ']' ? 1 : -1));
      return;
    }
    if (key === 'p') setTool('pen');
    if (key === 'r') setTool('rect');
    if (key === 'a') setTool('arrow');
    if (key === 't') setTool('text');
    if (key === 'v') enterMoveMode();
  });

  function isTyping() {
    return document.activeElement === textInput && !textInput.hidden;
  }

  /** True when a toolbar form control (color, brush size, …) has focus. */
  function isFormControlFocused() {
    const el = document.activeElement;
    if (!el || el === textInput) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  // Menu IPC from main process
  if (window.sketchAPI?.onMenu) {
    window.sketchAPI.onMenu('save-copy', () => saveAndCopy());
    window.sketchAPI.onMenu('copy-save', () => copyAndSave());
    window.sketchAPI.onMenu('paste', () => pasteImage(null));
    window.sketchAPI.onMenu('import', () => importImage());
    window.sketchAPI.onMenu('undo', () => undo());
    window.sketchAPI.onMenu('redo', () => redo());
    window.sketchAPI.onMenu('clear', () => clearCanvas());
    window.sketchAPI.onMenu('delete', () => deleteSelected());
    window.sketchAPI.onMenu('reset', () => resetApp());
    window.sketchAPI.onMenu('open-image', (_e, dataUrl) => {
      if (!dataUrl) return;
      placeImageFromDataUrl(dataUrl).catch(() => {});
    });
  }

  let resizeTimer = null;
  function scheduleViewportChange() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Finish any in-progress drag first — resize clears snapshot/history, and
      // leaving drawing=true made shape tools stack previews with no restore.
      endActiveStroke();
      // Stamp overlays first — discarding open text here used to drop typed content.
      if (selection.active) commitImageSelection();
      commitTextIfOpen();
      if (customDocumentSize) {
        // Keep full-resolution document; only re-fit the camera to the stage.
        fitViewToDocument();
        resizeCanvas();
        return;
      }
      resizeCanvas();
      fitViewToDocument();
    }, 100);
  }

  window.addEventListener('resize', scheduleViewportChange);

  // OS scale / monitor DPI can change without a layout resize (e.g. dragging
  // between displays). Re-back the bitmap so strokes stay sharp.
  let dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  function onResolutionChange() {
    // Re-subscribe at the new DPR — a fixed query only fires once per value.
    if (dprMql.removeEventListener) {
      dprMql.removeEventListener('change', onResolutionChange);
    } else {
      dprMql.removeListener?.(onResolutionChange);
    }
    dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (dprMql.addEventListener) {
      dprMql.addEventListener('change', onResolutionChange);
    } else {
      dprMql.addListener?.(onResolutionChange);
    }
    scheduleViewportChange();
  }
  if (dprMql.addEventListener) {
    dprMql.addEventListener('change', onResolutionChange);
  } else {
    dprMql.addListener?.(onResolutionChange);
  }

  function resetApp() {
    hideTextInput();
    hideImageSelection();
    colorInput.value = DEFAULT_COLOR;
    state.color = DEFAULT_COLOR;
    brushSizeInput.value = '4';
    brushSizeValue.textContent = '4';
    state.brushSize = 4;
    state.drawing = false;
    state.strokeCheckpoint = false;
    state.strokeMoved = false;
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    state.tool = 'pen';
    scene = [];
    draft = null;
    imageEls.clear();
    document.querySelectorAll('.tool').forEach((btn) => {
      const on = btn.dataset.tool === 'pen';
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    canvas.style.cursor = 'crosshair';
    clearCustomDocumentSize();
    initCanvas();
  }

  function initCanvas() {
    const layout = layoutSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(layout.width * dpr));
    canvas.height = Math.max(1, Math.floor(layout.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redraw();
    fitViewToDocument();
    state.undoStack.length = 0;
    state.redoStack.length = 0;
  }

  // Wait a frame so CSS layout settles, then reset to defaults
  requestAnimationFrame(resetApp);
})();
