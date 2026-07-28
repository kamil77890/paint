const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { localPathFromFileUrlOrPath } = require('./lib/local-path');
const { imageRefFromClipboardHtml } = require('./lib/clipboard-html');

app.setName('Paint');

let mainWindow;
let lastSavePath = null;
/** Absolute path from `--open=` / `--open <path>` — loaded once after the canvas resets. */
let pendingOpenImagePath = null;

function parseOpenImageArg(argv = process.argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--open=')) {
      const p = a.slice('--open='.length).trim();
      return p || null;
    }
    if (a === '--open' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      return argv[i + 1];
    }
  }
  return null;
}

function queueOpenImagePath(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;
  pendingOpenImagePath = resolved;
}

queueOpenImagePath(parseOpenImageArg());

/**
 * True when the on-canvas text field or a toolbar form control (color, brush
 * size, …) is focused. Menu accelerators would otherwise steal keys — e.g.
 * Ctrl+C while picking a color would export the canvas instead of a native copy.
 */
async function isEditingTextOrForm() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    return await mainWindow.webContents.executeJavaScript(
      `(() => {
        const el = document.activeElement;
        if (!el) return false;
        const t = document.getElementById('textInput');
        if (t && el === t && !t.hidden) return true;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      })()`
    );
  } catch {
    return false;
  }
}

/** Run a canvas menu action, or a native editing fallback while typing / editing a form control. */
async function whenNotTyping(canvasAction, typingFallback) {
  if (await isEditingTextOrForm()) {
    typingFallback?.();
    return;
  }
  canvasAction();
}

/** Fresh reload — clear last save path so the next Save doesn't reuse a stale default. */
function reloadSketch() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  lastSavePath = null;
  mainWindow.webContents.reloadIgnoringCache();
}

/** Apply Backspace inside the on-canvas text field (no webContents.backspace API). */
async function backspaceInTextField() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    await mainWindow.webContents.executeJavaScript(`(() => {
      const t = document.getElementById('textInput');
      if (!t || t.hidden || document.activeElement !== t) return;
      const start = t.selectionStart ?? 0;
      const end = t.selectionEnd ?? 0;
      if (start !== end) {
        t.setRangeText('', start, end, 'end');
      } else if (start > 0) {
        t.setRangeText('', start - 1, start, 'end');
      }
    })()`);
  } catch {
    // ignore
  }
}

function createWindow() {
  // Always start fresh — no leftover save path / stale renderer cache.
  lastSavePath = null;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#1a1c1e',
    title: 'Paint',
    icon: path.join(__dirname, 'assets', 'paint.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Avoid serving stale HTML/JS after edits
      v8CacheOptions: 'none',
    },
  });

  // Defense in depth: renderer drop handlers call preventDefault, but if a
  // navigation still starts (or window.open), block leaving our index.html so
  // the sketch is never replaced by a dropped file URL.
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const target = path.resolve(localPathFromFileUrlOrPath(navUrl));
      const indexPath = path.resolve(__dirname, 'index.html');
      if (target === indexPath) return;
    } catch {
      // malformed URL — block
    }
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Chromium still reloads on F5 / Ctrl+Shift+R even without role:'reload'.
  // Those bypass the View → Reload menu guard and wipe the sketch mid-edit.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isF5 = input.key === 'F5';
    const isHardReload =
      (input.control || input.meta) &&
      input.shift &&
      String(input.key).toLowerCase() === 'r';
    if (!isF5 && !isHardReload) return;
    event.preventDefault();
    whenNotTyping(() => reloadSketch());
  });

  mainWindow.loadFile('index.html', {
    query: { t: String(Date.now()) },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    // Ensure toolbar defaults + blank canvas after every launch/reload
    mainWindow.webContents.send('app-reset');
    sendPendingOpenImage();
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Save & Copy',
          accelerator: 'CmdOrCtrl+S',
          // Same guard as Import/Clear — Ctrl+S while typing or editing color/size
          // stole focus into a native save dialog mid-edit. No native fallback;
          // no-op while editing (toolbar Save button still works).
          click: () =>
            whenNotTyping(() => mainWindow.webContents.send('menu-save-copy')),
        },
        {
          label: 'Copy & Save',
          // No accelerator — Ctrl+C is handled in the renderer (same as Paste).
          // Menu accelerators + whenNotTyping treated color/brush focus as
          // "typing" and fell back to webContents.copy(), so Copy did nothing
          // until a Save dialog stole focus away from those inputs.
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-copy-save'),
              () => mainWindow.webContents.copy()
            ),
        },
        {
          label: 'Paste Image',
          // No accelerator here — Ctrl+V is handled in the renderer so the
          // Chromium paste event can deliver image data (more reliable on Wayland).
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-paste'),
              // While typing, paste clipboard text into the field (same as Copy).
              () => mainWindow.webContents.paste()
            ),
        },
        { type: 'separator' },
        {
          label: 'Import Image…',
          accelerator: 'CmdOrCtrl+O',
          // Same guard as Clear/Paste — Ctrl+O while typing or editing color/size
          // stole focus into a native file dialog mid-edit. No native fallback;
          // no-op while editing (toolbar Import button still works).
          click: () =>
            whenNotTyping(() => mainWindow.webContents.send('menu-import')),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-undo'),
              () => mainWindow.webContents.undo()
            ),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-redo'),
              () => mainWindow.webContents.redo()
            ),
        },
        {
          // Alternate redo shortcut documented in README (common on Windows/Linux).
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-redo'),
              () => mainWindow.webContents.redo()
            ),
        },
        { type: 'separator' },
        {
          label: 'Delete Selection',
          accelerator: 'Delete',
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-delete'),
              () => mainWindow.webContents.delete()
            ),
        },
        {
          // Same action as Delete — Backspace is the usual remove key on macOS
          // and many Linux layouts; without this, the accelerator never fires
          // when a toolbar control is focused (renderer keydown may not run).
          label: 'Delete Selection',
          accelerator: 'Backspace',
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () =>
            whenNotTyping(
              () => mainWindow.webContents.send('menu-delete'),
              () => backspaceInTextField()
            ),
        },
        {
          label: 'Clear Canvas',
          // Same guard as Undo/Delete — clearing while the text field or a
          // toolbar control is focused discarded in-progress typing / looked
          // like a random wipe. No native fallback; no-op while editing.
          click: () => whenNotTyping(() => mainWindow.webContents.send('menu-clear')),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          // Same guard as Clear/Save/Import — Ctrl+R while typing or editing
          // color/size used to wipe the sketch mid-edit. No native fallback;
          // no-op while editing (View → Reload menu item still works when idle).
          // F5 / Ctrl+Shift+R are intercepted in before-input-event the same way.
          click: () => whenNotTyping(() => reloadSketch()),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function writePngToPath(pngBuffer, filePath) {
  // Case-insensitive: users (and some dialogs) may provide `.PNG` / `.Png`.
  // endsWith('.png') alone would create `sketch.PNG.png`.
  const out = /\.png$/i.test(filePath) ? filePath : `${filePath}.png`;
  // Write via temp + replace so a crash/full-disk mid-write cannot leave a
  // truncated .png at the destination (direct writeFileSync would).
  const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, Buffer.from(pngBuffer));
    try {
      fs.renameSync(tmp, out);
    } catch {
      // Windows cannot rename onto an existing path; copy then remove temp.
      fs.copyFileSync(tmp, out);
      try {
        fs.unlinkSync(tmp);
      } catch {
        // Destination is already written — don't treat leftover temp as save failure.
      }
    }
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // temp may never have been created
    }
    return { ok: false, error: err?.message || String(err) };
  }
  return { ok: true, path: out };
}

/** Silent save — reuse last path, or create a timestamped PNG in Pictures. */
async function savePngBufferAuto(pngBuffer) {
  const target =
    lastSavePath || path.join(app.getPath('pictures'), `paint-${Date.now()}.png`);
  const result = await writePngToPath(pngBuffer, target);
  if (result.ok) lastSavePath = result.path;
  return result;
}

async function savePngBuffer(pngBuffer) {
  // After the first save, Ctrl+S overwrites quietly (no dialog every time).
  if (lastSavePath) {
    const quiet = await writePngToPath(pngBuffer, lastSavePath);
    if (quiet.ok) {
      lastSavePath = quiet.path;
      return quiet;
    }
  }

  const defaultPath =
    lastSavePath || path.join(app.getPath('pictures'), `paint-${Date.now()}.png`);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save sketch',
    defaultPath,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  const result = await writePngToPath(pngBuffer, filePath);
  if (result.ok) lastSavePath = result.path;
  return result;
}

function copyPngToClipboard(pngBuffer) {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(pngBuffer));
    if (image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  } catch {
    // Wayland / permission / encode failures — don't reject the IPC handler
    // after a successful save (save-and-copy would otherwise look like total failure).
    return false;
  }
}

ipcMain.handle('save-and-copy', async (_event, pngBuffer) => {
  const saved = await savePngBuffer(pngBuffer);
  if (!saved.ok) return saved;
  const copied = copyPngToClipboard(pngBuffer);
  return { ok: true, path: saved.path, copied };
});

ipcMain.handle('copy-and-save', async (_event, pngBuffer) => {
  // Copy first, then auto-save (no dialog) so Ctrl+C works without a prior Ctrl+S.
  const copied = copyPngToClipboard(pngBuffer);
  const saved = await savePngBufferAuto(pngBuffer);
  if (!saved.ok) return { ok: false, canceled: false, copied, error: saved.error };
  return { ok: true, path: saved.path, copied };
});

/** Decode an on-disk image to a data URL (nativeImage, then Chromium fallback for SVG). */
function imageDataUrlFromFilePath(filePath) {
  let image = nativeImage.createFromPath(filePath);
  const data = image.isEmpty() ? fs.readFileSync(filePath) : null;
  if (image.isEmpty()) {
    image = nativeImage.createFromBuffer(data);
  }
  if (!image.isEmpty()) return image.toDataURL();

  // SVG (and rare formats) often yield an empty nativeImage — hand raw bytes
  // to the renderer so Chromium's <img> decoder can place them like file-drop.
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    {
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.jpe': 'image/jpeg',
      '.jfif': 'image/jpeg',
      '.pjpeg': 'image/jpeg',
      // Chromium progressive-JPEG short alias (distinct from .pjpeg).
      '.pjp': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.avif': 'image/avif',
      '.ico': 'image/x-icon',
      // Scanner / photo-app TIFF — nativeImage often decodes; Chromium <img>
      // may still accept image/tiff data URLs on some Electron builds.
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    }[ext] || null;
  if (!mime || !data?.length) return null;
  return `data:${mime};base64,${data.toString('base64')}`;
}

function readClipboardImageDataUrl() {
  // 1) Native image API (works when the OS exposes a real image)
  let image = clipboard.readImage();
  if (!image.isEmpty()) return image.toDataURL();

  // 2) Raw buffers — common on Linux where readImage() is empty
  const formats = clipboard.availableFormats();
  const candidates = [
    // Include bare GIF / JPEG / BMP / WEBP / AVIF / ICO / TIFF / DIB / CUR
    // (like PNG/JFIF) — some Linux clipboards expose those atoms without an
    // image/* mime, and omitting them made Ctrl+V miss those buffers
    // (image/webp alone does not cover a bare WEBP atom; image/avif alone does
    // not cover bare AVIF; image/bmp alone does not cover bare BMP;
    // image/x-icon alone does not cover a bare ICO/CUR atom; image/tiff alone
    // does not cover a bare TIFF atom; JFIF alone does not cover a bare JPEG
    // atom). Windows "Copy" often exposes only a bare DIB atom (CF_DIB) with
    // empty readImage() — without listing DIB, Ctrl+V reported no image.
    ...formats.filter((f) =>
      /image|\bpng\b|\bjpe?g\b|\bgif\b|\bbmp\b|\bwebp\b|\bsvg\b|\bavif\b|\bico\b|\bcur\b|\bdib\b|\btiff?\b/i.test(
        f
      )
    ),
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/pjp',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/avif',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/tiff',
    'image/tif',
    'image/svg+xml',
    'PNG',
    'JFIF',
    'JPEG',
    'GIF',
    'BMP',
    'WEBP',
    'AVIF',
    'ICO',
    'CUR',
    'DIB',
    'TIFF',
    'TIF',
  ];

  const tried = new Set();
  for (const format of candidates) {
    if (tried.has(format)) continue;
    tried.add(format);
    try {
      const buf = clipboard.readBuffer(format);
      const isSvg = /svg/i.test(format);
      // Binary images need a minimum size; tiny SVG markup can be much smaller.
      if (buf && (buf.length > 32 || (isSvg && buf.length > 4))) {
        image = nativeImage.createFromBuffer(buf);
        if (!image.isEmpty()) return image.toDataURL();
        // nativeImage cannot decode SVG / some ICO / AVIF buffers — hand to Chromium.
        if (isSvg) {
          return `data:image/svg+xml;base64,${Buffer.from(buf).toString('base64')}`;
        }
        // CUR shares the ICO container; Chromium accepts image/x-icon for both.
        if (/x-icon|vnd\.microsoft\.icon|\bico\b|\bcur\b/i.test(format)) {
          return `data:image/x-icon;base64,${Buffer.from(buf).toString('base64')}`;
        }
        if (/\bavif\b/i.test(format)) {
          return `data:image/avif;base64,${Buffer.from(buf).toString('base64')}`;
        }
        if (/\btiff?\b/i.test(format)) {
          return `data:image/tiff;base64,${Buffer.from(buf).toString('base64')}`;
        }
      }
    } catch {
      // format not supported on this platform
    }
  }

  // 3) File path / URI list (copied from a file manager)
  const pathCandidates = [];
  try {
    const uriList = clipboard.readBuffer('text/uri-list').toString('utf8');
    uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => pathCandidates.push(line));
  } catch {
    // ignore
  }

  const text = clipboard.readText().trim();
  // 4) SVG markup as plain text (editor "Copy" / browser "Copy as SVG").
  // Without this, readImage/buffers are empty and paste reports no image.
  if (/^(<\?xml\b[^>]*>\s*)?<svg[\s>/]/i.test(text)) {
    return `data:image/svg+xml;base64,${Buffer.from(text, 'utf8').toString('base64')}`;
  }
  // 5) data:image/... copied as plain text (devtools, some web apps).
  // Otherwise path parsing treats it as a missing file and paste fails.
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(text)) {
    return text;
  }
  // 6) Browser "Copy image" often exposes only text/html with an <img src>.
  try {
    const htmlRef = imageRefFromClipboardHtml(clipboard.readHTML());
    if (htmlRef) {
      if (/^data:image\//i.test(htmlRef)) return htmlRef;
      pathCandidates.unshift(htmlRef);
    }
  } catch {
    // readHTML unavailable / empty on this platform
  }
  if (text) pathCandidates.push(...text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));

  for (const entry of pathCandidates) {
    try {
      const filePath = localPathFromFileUrlOrPath(entry);
      if (!fs.existsSync(filePath)) continue;
      if (!/\.(png|jpe?g|jpe|jfif|pjpeg|pjp|gif|webp|bmp|svg|avif|ico|tiff?)$/i.test(filePath)) continue;
      // Same decode path as Import — createFromPath alone fails for SVG.
      const dataUrl = imageDataUrlFromFilePath(filePath);
      if (dataUrl) return dataUrl;
    } catch {
      // ignore bad paths
    }
  }

  return null;
}

function sendPendingOpenImage() {
  if (!mainWindow || mainWindow.isDestroyed() || !pendingOpenImagePath) return;
  const filePath = pendingOpenImagePath;
  pendingOpenImagePath = null;
  try {
    const dataUrl = imageDataUrlFromFilePath(filePath);
    if (dataUrl) mainWindow.webContents.send('open-image', dataUrl);
  } catch {
    // ignore bad files
  }
}

ipcMain.handle('read-clipboard-image', async () => readClipboardImageDataUrl());

ipcMain.handle('clipboard-formats', async () => clipboard.availableFormats());

ipcMain.handle('import-image', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import image',
    properties: ['openFile'],
    filters: [
      // Include svg — drop/clipboard paste already accept it; omit here and
      // Import silently hides SVGs from the picker on many platforms.
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tif', 'tiff'] },
    ],
  });
  if (canceled || !filePaths.length) return { canceled: true };

  const filePath = filePaths[0];
  try {
    const dataUrl = imageDataUrlFromFilePath(filePath);
    if (!dataUrl) return { ok: false };
    return { ok: true, dataUrl };
  } catch {
    return { ok: false };
  }
});

// One Paint window — a second launch focuses the existing app instead of
// opening a duplicate (start.sh still force-restarts when you want a clean slate).
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    queueOpenImagePath(parseOpenImageArg(argv));
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    sendPendingOpenImage();
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
