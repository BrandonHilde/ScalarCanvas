## Scalar Canvas

A browser-based editor with two modes:

- **Font editor** — create a font from scratch or open a `.ttf`, draw glyphs, set metrics and export TrueType.
- **Canvas** — a free-drawing artboard that exports SVG.

Open `index.html` in a browser; there is no build step. Run the tests by opening `tests/index.html`.

### Drawing

- **Freehand (F)** fits smooth Bézier curves to your stroke.
  - **Line** draws a centre-line; end near the start to close the shape.
  - **Brush** paints a filled outline, which is what glyphs need. With a pen, pressure varies the width.
  - **B** switches between the two; **Smoothing** sets how closely the curve follows your hand.
- **Pen (P)**, **Edit (E)**, shapes, mirroring and a tracing image (**I**) are available in both modes.
- On the canvas, every stroke keeps its own colours and width. Changing a colour while strokes are selected repaints them.

### Path operations

- **Union, Subtract, Intersect, Exclude** act on the contours that have a selected point. The last-drawn contour is the one that cuts.
- **Remove overlap** merges overlapping and self-intersecting contours (for example, brush strokes) into clean outlines. With nothing selected it acts on the whole glyph.
- Results come out with TrueType direction: outer contours clockwise, holes counter-clockwise. Curves that weren't cut keep their original points.
- In font mode, **Remove overlaps** under Font is on by default. It cleans every glyph in the exported TTF without changing your project.

### Font tools

- Add single glyphs or whole character sets (A–Z, a–z, 0–9, punctuation, ASCII).
- Edit the family and style names, glyph names and Unicode values in the inspector.
- The glyph list shows thumbnails. Click a letter in the preview strip to jump to it.
- **Fix direction** corrects contour winding so the counters of letters like “o” are cut out.

### Saving

- **Save (Ctrl+S)** downloads an editable `.json` project, which **Open…** loads again.
- Work is autosaved in the browser; the start screen offers to restore the last session.

### Shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+A | Select all points |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / cut / paste contours (also between glyphs) |
| Ctrl+D | Duplicate |
| Space-drag or middle-drag | Pan |
| Wheel | Zoom |
| [ / ] | Previous / next glyph |
