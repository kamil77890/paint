# Sketchpad Design

Desktop Electron sketch pad for quick freehand doodles with light shape/text tools and clipboard-first save flows.

## Goals

- Freehand-first drawing with rectangles, arrows, and text
- Brush size, color, undo/redo, clear
- Ctrl+S saves PNG and copies image to clipboard
- Ctrl+C copies image to clipboard and saves PNG
- Ctrl+V pastes clipboard images onto the canvas
- Import image via button / file dialog

## Architecture

- **main.js** — BrowserWindow, app menu accelerators, save dialog, clipboard image read/write, import dialog
- **preload.js** — contextBridge IPC API (`sketchAPI`)
- **renderer.js** — canvas tools, history, export PNG buffer, UI events
- **index.html / styles.css** — toolbar + paper canvas UI

## Tools

- Pen: freehand strokes
- Rect: drag rectangle outline
- Arrow: line with filled arrowhead
- Text: click to place, Enter to commit, Esc to cancel

## Clipboard / file flow

1. Export canvas to PNG bytes in renderer
2. Main process writes file and/or `clipboard.writeImage`
3. Paste/import returns a data URL; renderer draws centered/scaled image

## Non-goals (v1)

- Layers, selection/move, infinite canvas, vector export, collaboration
