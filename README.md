# Paint

Desktop paint app built with Electron.

## Features

- Freehand pen, rectangles, arrows, and text
- Color picker and brush size
- Undo / redo and clear canvas
- **Ctrl+S** — save PNG (dialog first time, then overwrite) and copy to clipboard
- **Ctrl+C** — copy image to clipboard and auto-save PNG (Pictures folder)
- **Ctrl+V** — paste image from clipboard onto canvas
- **Import** / **Ctrl+O** — load an image from disk

## Run

```bash
cd ~/drawing-app
npm install
npm start      # kills any old instance, then launches fresh
npm restart    # same as start — always a clean reset
```

## Shortcuts

| Shortcut | Action |
|----------|--------|
| P / R / A / T | Pen / Rect / Arrow / Text |
| [ / ] | Smaller / larger brush |
| Ctrl+S | Save & copy (dialog first time) |
| Ctrl+C | Copy & auto-save |
| Ctrl+V | Paste image |
| Ctrl+O | Import image |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
