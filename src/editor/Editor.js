function parseKey(key) {
    const [ci, pi] = key.split(":").map(Number);
    return { ci, pi };
}

function applyGlyphState(glyph, state) {
    glyph.name = state.name;
    glyph.contours = state.contours.map((c) => c.clone());
    glyph.components = state.components.map((c) => c.clone());
    glyph.instructions = new Uint8Array(state.instructions);
    glyph.advanceWidth = state.advanceWidth;
    glyph.leftSideBearing = state.leftSideBearing;
    glyph.unicodes = state.unicodes.slice();
}

class GlyphEditCommand {
    constructor(glyph, before, after, label = "edit") {
        this.glyph = glyph;
        this.before = before;
        this.after = after;
        this.label = label;
    }

    apply() {
        applyGlyphState(this.glyph, this.after);
    }

    revert() {
        applyGlyphState(this.glyph, this.before);
    }
}

const EditorTool = Object.freeze({
    Edit: "edit",
    Pen: "pen",
    Metrics: "metrics",
    Background: "background",
    Freehand: "freehand",
});

const MirrorMode = Object.freeze({
    None: "none",
    Vertical: "v",
    Horizontal: "h",
    Both: "both",
});

class Editor {
    constructor(document, renderer, history) {
        this.doc = document;
        this.renderer = renderer;
        this.history = history;
        this.glyphIndex = 0;
        this.tool = EditorTool.Freehand;
        this.selection = new Set();
        this.mouse = { x: 0, y: 0 };
        this.pointer = { x: 0, y: 0 };
        this.drag = null;
        this.pen = null;
        this.freehand = null;
        this.snap = true;
        this.gridSize = 0;
        this.mirror = MirrorMode.None;
        // Freehand settings: "line" fits a centre-line curve, "brush" builds a
        // filled outline of a (pressure-sensitive) brush of `brushSize` units.
        this.freehandMode = "line";
        this.brushSize = 80;
        this.smoothing = 3;
        this.usePressure = true;
        // Paint applied to new contours on the drawing canvas.
        this.paint = null;
        this.clipboard = null;
        this.onChange = null;
        this.onSelectionChange = null;
    }

    setMirror(mode) {
        this.mirror = mode;
        this.requestRender();
    }

    get glyph() {
        return this.doc ? this.doc.glyphs[this.glyphIndex] : null;
    }

    get view() {
        return this.renderer.view;
    }

    setDocument(doc) {
        this.doc = doc;
        this.glyphIndex = 0;
        this.selection.clear();
        this.pen = null;
        this.freehand = null;
        this.drag = null;
        this.requestRender();
        this.emitSelection();
    }

    setGlyphIndex(index) {
        this.glyphIndex = index;
        this.selection.clear();
        this.pen = null;
        this.freehand = null;
        this.drag = null;
        this.requestRender();
        this.emitSelection();
    }

    setTool(tool) {
        this.tool = tool;
        this.pen = null;
        this.freehand = null;
        this.drag = null;
        this.requestRender();
        this.emitSelection();
    }

    toFont(sx, sy) {
        return { x: this.view.toFontX(sx), y: this.view.toFontY(sy) };
    }

    tolerance(px = 8) {
        return px / this.view.scale;
    }

    requestRender() {
        if (this.onChange) this.onChange();
    }

    emitSelection() {
        if (this.onSelectionChange) this.onSelectionChange();
    }

    commit(before, label = "edit") {
        const glyph = this.glyph;
        if (!glyph) return;
        const after = glyph.clone();
        this.history.execute(new GlyphEditCommand(glyph, before, after, label));
        this.requestRender();
        this.emitSelection();
    }

    captureSelection() {
        const glyph = this.glyph;
        const map = {};
        for (const key of this.selection) {
            const { ci, pi } = parseKey(key);
            const p = glyph.contours[ci] && glyph.contours[ci].points[pi];
            if (p) map[key] = { x: p.x, y: p.y };
        }
        return map;
    }

    snapPosition(contours, x, y, excludeKey) {
        const exclude = excludeKey ? new Set([excludeKey]) : new Set();
        const near = nearestPoint(contours, x, y, this.tolerance(8), exclude);
        if (near) return { x: near.x, y: near.y };
        if (this.snap && this.gridSize > 0) return snapToGrid(x, y, this.gridSize);
        return { x, y };
    }

    // Snap an arbitrary drawing point to the active grid (no-op when snapping
    // is off or no grid size is configured).
    snapPoint(x, y) {
        if (this.snap && this.gridSize > 0) return snapToGrid(x, y, this.gridSize);
        return { x, y };
    }

    // ── mirror tool ──────────────────────────────────────
    // Mirrors newly drawn contours across the document centre, matching the
    // prototype's mirror aid (Off / Vertical / Horizontal / Both).

    mirrorAxes() {
        if (!this.doc) return { x: 0, y: 0 };
        if (this.doc.canvas) return { x: this.doc.width / 2, y: this.doc.height / 2 };
        const m = this.doc.metrics || {};
        const glyph = this.glyph;
        return {
            x: glyph ? glyph.advanceWidth / 2 : 0,
            y: ((m.ascender || 0) + (m.descender || 0)) / 2,
        };
    }

    // [[mirrorX, mirrorY], ...] variants implied by the current mode.
    mirrorVariants() {
        switch (this.mirror) {
            case MirrorMode.Vertical:
                return [[true, false]];
            case MirrorMode.Horizontal:
                return [[false, true]];
            case MirrorMode.Both:
                return [[true, false], [false, true], [true, true]];
            default:
                return [];
        }
    }

    mirrorContour(contour, mirrorX, mirrorY) {
        const { x: ax, y: ay } = this.mirrorAxes();
        const copy = contour.clone();
        for (const p of copy.points) {
            if (mirrorX) p.x = 2 * ax - p.x;
            if (mirrorY) p.y = 2 * ay - p.y;
        }
        return copy;
    }

    addMirrors(glyph, contour) {
        for (const [mx, my] of this.mirrorVariants()) {
            glyph.contours.push(this.mirrorContour(contour, mx, my));
        }
    }

    // ── mouse input ──────────────────────────────────────

    onMouseDown(sx, sy, ev) {
        const glyph = this.glyph;
        if (!glyph) return;
        const p = this.toFont(sx, sy);
        const shift = ev && ev.shiftKey;
        const alt = ev && ev.altKey;
        const dbl = ev && ev.detail >= 2;

        this.pointer = p;

        if (this.tool === EditorTool.Pen) {
            this.penDown(this.snapPoint(p.x, p.y), alt);
            return;
        }
        if (this.tool === EditorTool.Metrics) {
            this.metricsDown(p);
            return;
        }
        if (this.tool === EditorTool.Background) {
            this.backgroundDown(p);
            return;
        }
        if (this.tool === EditorTool.Freehand) {
            this.freehandDown(p, this.pressureOf(ev));
            return;
        }

        if (glyph.isComposite) return;

        if (dbl) {
            const seg = hitTestSegment(glyph.contours, p.x, p.y, this.tolerance(8));
            if (seg) {
                const before = glyph.clone();
                const inserted = splitSegment(glyph.contours[seg.ci], seg.seg.p0, seg.t);
                if (inserted) {
                    const pi = glyph.contours[seg.ci].points.indexOf(inserted);
                    this.selection = new Set([`${seg.ci}:${pi}`]);
                    this.commit(before, "add point");
                }
            }
            return;
        }

        const hit = hitTestPoint(glyph.contours, p.x, p.y, this.tolerance(9));
        if (hit) {
            const key = `${hit.ci}:${hit.pi}`;
            if (shift) {
                if (this.selection.has(key)) this.selection.delete(key);
                else this.selection.add(key);
            } else if (!this.selection.has(key)) {
                this.selection = new Set([key]);
            }
            this.drag = {
                type: "move",
                before: glyph.clone(),
                start: { x: p.x, y: p.y },
                orig: this.captureSelection(),
                moved: false,
            };
        } else {
            this.drag = {
                type: "marquee",
                start: { x: p.x, y: p.y },
                current: { x: p.x, y: p.y },
                additive: shift,
            };
            if (!shift) this.selection.clear();
        }
        this.emitSelection();
        this.requestRender();
    }

    onMouseMove(sx, sy, ev) {
        const glyph = this.glyph;
        this.mouse = { x: sx, y: sy };
        this.pointer = this.toFont(sx, sy);
        if (!glyph) {
            this.requestRender();
            return;
        }
        const p = this.pointer;
        const alt = ev && ev.altKey;
        const drag = this.drag;

        if (this.pen && this.tool === EditorTool.Pen && drag && drag.type === "pen") {
            const node = this.pen.nodes[drag.nodeIndex];
            if (node) {
                node.out = { x: p.x, y: p.y };
                if (!alt) node.in = { x: 2 * node.x - p.x, y: 2 * node.y - p.y };
            }
            this.requestRender();
            return;
        }

        if (drag && drag.type === "freehand") {
            this.freehandMove(p, this.pressureOf(ev));
            return;
        }

        if (!drag) {
            this.requestRender();
            return;
        }

        if (drag.type === "move") {
            const dx = p.x - drag.start.x;
            const dy = p.y - drag.start.y;
            for (const key of this.selection) {
                const { ci, pi } = parseKey(key);
                const orig = drag.orig[key];
                const pt = glyph.contours[ci] && glyph.contours[ci].points[pi];
                if (orig && pt) {
                    pt.x = orig.x + dx;
                    pt.y = orig.y + dy;
                }
            }
            if (this.selection.size === 1 && this.snap && !alt) {
                const key = [...this.selection][0];
                const { ci, pi } = parseKey(key);
                const pt = glyph.contours[ci].points[pi];
                const snapped = this.snapPosition(glyph.contours, pt.x, pt.y, key);
                pt.x = snapped.x;
                pt.y = snapped.y;
            }
            drag.moved = true;
            this.requestRender();
        } else if (drag.type === "marquee") {
            drag.current = { x: p.x, y: p.y };
            this.requestRender();
        } else if (drag.type === "advance") {
            glyph.advanceWidth = Math.max(0, Math.round(p.x));
            this.requestRender();
            this.emitSelection();
        } else if (drag.type === "lsb") {
            glyph.leftSideBearing = Math.round(p.x);
            this.requestRender();
            this.emitSelection();
        } else if (drag.type === "bgmove") {
            drag.bg.x = drag.origX + (p.x - drag.start.x);
            drag.bg.y = drag.origY + (p.y - drag.start.y);
            this.requestRender();
        } else if (drag.type === "bgscale") {
            const bg = drag.bg;
            const h = Math.max(1, bg.image.height);
            const scale = (bg.y - p.y) / h;
            bg.scale = Math.max(0.01, scale);
            this.requestRender();
        }
    }

    onMouseUp() {
        const drag = this.drag;
        if (!drag) return;

        if (drag.type === "move" && drag.moved) {
            this.commit(drag.before, "move points");
        } else if (drag.type === "marquee") {
            this.finishMarquee(drag);
        } else if (drag.type === "advance" || drag.type === "lsb") {
            this.commit(drag.before, "metrics");
        } else if (drag.type === "freehand") {
            this.finishFreehand();
            return;
        }

        this.drag = null;
        this.requestRender();
    }

    finishMarquee(drag) {
        const glyph = this.glyph;
        const xMin = Math.min(drag.start.x, drag.current.x);
        const xMax = Math.max(drag.start.x, drag.current.x);
        const yMin = Math.min(drag.start.y, drag.current.y);
        const yMax = Math.max(drag.start.y, drag.current.y);

        if (!drag.additive) this.selection.clear();
        for (let ci = 0; ci < glyph.contours.length; ci++) {
            const points = glyph.contours[ci].points;
            for (let pi = 0; pi < points.length; pi++) {
                const pt = points[pi];
                if (pt.x >= xMin && pt.x <= xMax && pt.y >= yMin && pt.y <= yMax) {
                    this.selection.add(`${ci}:${pi}`);
                }
            }
        }
        this.emitSelection();
    }

    // ── pen tool ─────────────────────────────────────────

    penDown(p, alt) {
        if (!this.glyph) return;
        const q = this.snapPoint(p.x, p.y);
        if (!this.pen || this.pen.nodes.length === 0) {
            this.pen = { nodes: [{ x: q.x, y: q.y, in: null, out: null }] };
            this.drag = { type: "pen", nodeIndex: 0 };
            this.requestRender();
            return;
        }

        const first = this.pen.nodes[0];
        if (
            this.pen.nodes.length >= 2 &&
            Math.hypot(q.x - first.x, q.y - first.y) <= this.tolerance(10)
        ) {
            this.finishPen(true);
            return;
        }

        this.pen.nodes.push({ x: q.x, y: q.y, in: null, out: null });
        this.drag = { type: "pen", nodeIndex: this.pen.nodes.length - 1 };
        this.requestRender();
    }

    finishPen(closed) {
        if (!this.pen || !this.glyph) {
            this.pen = null;
            return;
        }
        const contour = nodesToContour(this.pen.nodes, !!closed);
        this.applyPaint(contour);
        const glyph = this.glyph;
        const before = glyph.clone();
        glyph.contours.push(contour);
        this.addMirrors(glyph, contour);
        const ci = glyph.contours.length - 1;
        this.pen = null;
        this.drag = null;
        this.selection = new Set();
        this.commit(before, "draw contour");
    }

    // ── freehand tool ────────────────────────────────────

    // Brush width multiplier from a pointer event. Only pens report useful
    // pressure; mice and touch always draw at full size.
    pressureOf(ev) {
        if (!this.usePressure || !ev || ev.pointerType !== "pen") return 1;
        const p = ev.pressure;
        return p > 0 ? 0.15 + 0.85 * Math.min(1, p) : 1;
    }

    // Fit tolerance in font units (the smoothing setting is in screen pixels,
    // so strokes look equally smooth at every zoom level).
    freehandTolerance() {
        return this.tolerance(Math.max(0.5, this.smoothing));
    }

    freehandDown(p, pressure = 1) {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return;
        this.freehand = { points: [{ x: p.x, y: p.y, w: this.brushSize * pressure }] };
        this.drag = { type: "freehand" };
        this.selection.clear();
        this.requestRender();
    }

    freehandMove(p, pressure = 1) {
        if (!this.freehand) return;
        const points = this.freehand.points;
        const last = points[points.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= this.tolerance(1.5)) {
            points.push({ x: p.x, y: p.y, w: this.brushSize * pressure });
        }
        this.requestRender();
    }

    buildFreehandContour(points) {
        const tolerance = this.freehandTolerance();
        if (this.freehandMode === "brush") {
            const contour = fitBrushStroke(points, { tolerance });
            if (contour) this.applyPaint(contour, "brush");
            return contour;
        }
        if (points.length < 2) return null;
        const closed = strokeLooksClosed(points, this.tolerance(12));
        const contour = fitFreehandStroke(points, { tolerance, closed });
        if (contour) this.applyPaint(contour, "line");
        return contour;
    }

    finishFreehand() {
        const glyph = this.glyph;
        const stroke = this.freehand;
        this.freehand = null;
        this.drag = null;

        if (!glyph || !stroke) {
            this.requestRender();
            return;
        }

        const contour = this.buildFreehandContour(stroke.points);
        if (!contour) {
            this.requestRender();
            return;
        }

        const before = glyph.clone();
        glyph.contours.push(contour);
        this.addMirrors(glyph, contour);
        this.selection = new Set();
        this.commit(before, "freehand");
    }

    // Stamp the current canvas paint onto a new contour. Font glyphs have no
    // per-contour paint, so this is a no-op outside the drawing canvas.
    applyPaint(contour, kind = "shape") {
        if (!this.doc || !this.doc.canvas || !this.paint) return;
        const paint = this.paint;
        if (kind === "brush") {
            contour.style = { stroke: null, fill: paint.stroke, width: 0 };
        } else if (kind === "line") {
            contour.style = { stroke: paint.stroke, fill: null, width: paint.width };
        } else {
            contour.style = { stroke: paint.stroke, fill: paint.fill, width: paint.width };
        }
    }

    // ── add shape ────────────────────────────────────────

    defaultShapeBox() {
        const upm = this.doc ? this.doc.unitsPerEm : 1000;
        const m = this.doc ? this.doc.metrics : null;
        const cap = m && m.capHeight ? m.capHeight : upm * 0.7;
        const glyph = this.glyph;
        const advance = glyph && glyph.advanceWidth > 0 ? glyph.advanceWidth : upm * 0.6;
        const w = Math.min(advance, upm) * 0.8;
        const h = cap * 0.8;
        const cx = advance / 2;
        const cy = cap / 2;
        return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    }

    addShape(kind, sides) {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return;

        const contour = createShapeContour(kind, this.defaultShapeBox(), sides);
        if (!contour) return;

        this.applyPaint(contour);
        const before = glyph.clone();
        const ci = glyph.contours.length;
        glyph.contours.push(contour);
        if (!contour.isClockwise()) contour.reverse();
        this.addMirrors(glyph, contour);

        this.selection = new Set();
        for (let pi = 0; pi < glyph.contours[ci].points.length; pi++) {
            this.selection.add(`${ci}:${pi}`);
        }
        this.commit(before, "add " + kind);
    }

    // ── metrics tool ─────────────────────────────────────
    metricsDown(p) {
        const glyph = this.glyph;
        if (!glyph) return;
        const tol = this.tolerance(8);

        if (Math.abs(p.x - glyph.advanceWidth) <= tol) {
            this.drag = { type: "advance", before: glyph.clone() };
        } else if (Math.abs(p.x - glyph.leftSideBearing) <= tol) {
            this.drag = { type: "lsb", before: glyph.clone() };
        }
    }

    // ── background image tool ────────────────────────────

    backgroundDown(p) {
        const bg = this.renderer.background;
        if (!bg || !bg.image || !bg.visible) return;
        const b = this.renderer.backgroundBounds();
        if (!b) return;
        const tol = this.tolerance(12);

        const handle = { x: b.x1, y: b.y0 };
        if (Math.hypot(p.x - handle.x, p.y - handle.y) <= tol) {
            this.drag = { type: "bgscale", bg };
            return;
        }
        if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) {
            this.drag = {
                type: "bgmove",
                bg,
                start: { x: p.x, y: p.y },
                origX: bg.x,
                origY: bg.y,
            };
        }
    }

    // ── keyboard ────────────────────────────────────────

    onKeyDown(ev) {
        const tag = ev.target && ev.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        const glyph = this.glyph;
        if (!glyph) return;

        if (ev.key === "Delete" || ev.key === "Backspace") {
            ev.preventDefault();
            this.deleteSelection();
            return;
        }
        if (ev.key === "Escape") {
            this.pen = null;
            this.freehand = null;
            this.selection.clear();
            this.drag = null;
            this.requestRender();
            this.emitSelection();
            return;
        }
        if (ev.key === "Enter" && this.pen) {
            this.finishPen(false);
            return;
        }

        const step = ev.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (ev.key === "ArrowLeft") dx = -step;
        else if (ev.key === "ArrowRight") dx = step;
        else if (ev.key === "ArrowUp") dy = step;
        else if (ev.key === "ArrowDown") dy = -step;
        if (dx || dy) {
            ev.preventDefault();
            this.nudgeSelection(dx, dy);
        }
    }

    // ── operations ──────────────────────────────────────

    deleteSelection() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite || this.selection.size === 0) return;

        const before = glyph.clone();
        const byContour = new Map();
        for (const key of this.selection) {
            const { ci, pi } = parseKey(key);
            if (!byContour.has(ci)) byContour.set(ci, []);
            byContour.get(ci).push(pi);
        }

        const indices = [...byContour.keys()].sort((a, b) => b - a);
        for (const ci of indices) {
            const remaining = deletePoints(glyph.contours[ci], byContour.get(ci));
            if (remaining < 2) glyph.contours.splice(ci, 1);
        }

        this.selection.clear();
        this.commit(before, "delete points");
    }

    nudgeSelection(dx, dy) {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite || this.selection.size === 0) return;
        const before = glyph.clone();
        for (const key of this.selection) {
            const { ci, pi } = parseKey(key);
            const pt = glyph.contours[ci] && glyph.contours[ci].points[pi];
            if (pt) {
                pt.x += dx;
                pt.y += dy;
            }
        }
        this.commit(before, "nudge");
    }

    reverseContours() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return;
        const before = glyph.clone();
        if (this.selection.size === 0) {
            for (const contour of glyph.contours) contour.reverse();
        } else {
            const seen = new Set();
            for (const key of this.selection) {
                const { ci } = parseKey(key);
                if (!seen.has(ci) && glyph.contours[ci]) {
                    glyph.contours[ci].reverse();
                    seen.add(ci);
                }
            }
        }
        this.commit(before, "reverse contours");
    }

    toggleContourClosed() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return;
        const before = glyph.clone();
        const seen = new Set();
        const targets = this.selection.size
            ? [...this.selection].map((k) => parseKey(k).ci)
            : glyph.contours.map((_, i) => i);
        for (const ci of targets) {
            if (seen.has(ci) || !glyph.contours[ci]) continue;
            glyph.contours[ci].closed = !glyph.contours[ci].closed;
            seen.add(ci);
        }
        this.commit(before, "toggle closed");
    }

    // Indices of contours touched by the selection (all contours when empty).
    selectedContourIndices(fallbackToAll = true) {
        const glyph = this.glyph;
        if (!glyph) return [];
        if (this.selection.size === 0) return fallbackToAll ? glyph.contours.map((_, i) => i) : [];
        const set = new Set();
        for (const key of this.selection) {
            const { ci } = parseKey(key);
            if (glyph.contours[ci]) set.add(ci);
        }
        return [...set].sort((a, b) => a - b);
    }

    selectAll() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return;
        this.selection = new Set();
        glyph.contours.forEach((c, ci) => c.points.forEach((_, pi) => this.selection.add(`${ci}:${pi}`)));
        this.requestRender();
        this.emitSelection();
    }

    copySelection() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return 0;
        const indices = this.selectedContourIndices();
        if (!indices.length) return 0;
        this.clipboard = indices.map((ci) => glyph.contours[ci].clone());
        return indices.length;
    }

    cutSelection() {
        const glyph = this.glyph;
        const indices = this.selectedContourIndices();
        if (!this.copySelection()) return 0;
        const before = glyph.clone();
        for (const ci of indices.slice().reverse()) glyph.contours.splice(ci, 1);
        this.selection.clear();
        this.commit(before, "cut");
        return indices.length;
    }

    // Paste the clipboard into the current glyph, optionally offset, and
    // select the pasted points so they can be moved straight away.
    paste(offset = { x: 0, y: 0 }) {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite || !this.clipboard || !this.clipboard.length) return 0;
        const before = glyph.clone();
        const start = glyph.contours.length;
        for (const contour of this.clipboard) {
            const copy = contour.clone();
            for (const p of copy.points) {
                p.x += offset.x;
                p.y += offset.y;
            }
            if (!this.doc.canvas) delete copy.style;
            glyph.contours.push(copy);
        }
        this.selection = new Set();
        for (let ci = start; ci < glyph.contours.length; ci++) {
            glyph.contours[ci].points.forEach((_, pi) => this.selection.add(`${ci}:${pi}`));
        }
        this.commit(before, "paste");
        return glyph.contours.length - start;
    }

    duplicateSelection() {
        if (!this.copySelection()) return 0;
        const d = Math.round(this.tolerance(16));
        return this.paste({ x: d, y: -d });
    }

    // Boolean path operation on the closed contours touched by the selection.
    //   "removeOverlap": merge them all (also untangles self-intersections).
    //   "union" | "subtract" | "intersect" | "exclude": the topmost (last
    //   drawn) selected contour acts on the others, as in illustration tools.
    // Returns a short status message, or null when nothing could be done.
    pathOperation(op) {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite) return null;
        const indices = this.selectedContourIndices().filter((ci) => glyph.contours[ci].closed);
        const needed = op === "removeOverlap" ? 1 : 2;
        if (indices.length < needed) {
            return op === "removeOverlap"
                ? "No closed contours to merge"
                : "Select at least two closed contours";
        }

        const operands = indices.map((ci) => glyph.contours[ci]);
        const { contours, changed } = op === "removeOverlap"
            ? removeOverlap(operands)
            : booleanContours(operands.slice(0, -1), operands.slice(-1), op);
        if (!changed) return "Nothing to change";

        const style = operands[0].style;
        if (style) for (const c of contours) c.style = { ...style };

        const before = glyph.clone();
        for (const ci of indices.slice().reverse()) glyph.contours.splice(ci, 1);
        glyph.contours.splice(indices[0], 0, ...contours);

        this.selection = new Set();
        for (let ci = indices[0]; ci < indices[0] + contours.length; ci++) {
            glyph.contours[ci].points.forEach((_, pi) => this.selection.add(`${ci}:${pi}`));
        }
        this.commit(before, op);
        return `${operands.length} → ${contours.length} contour${contours.length === 1 ? "" : "s"}`;
    }

    // Normalise winding to the TrueType convention (outer clockwise, holes
    // counter-clockwise) so counters in letters like "o" are cut out.
    correctDirection() {
        const glyph = this.glyph;
        if (!glyph || glyph.isComposite || !glyph.contours.length) return;
        const before = glyph.clone();
        glyph.correctDirection();
        this.commit(before, "correct direction");
    }

    // Canvas mode: repaint the contours touched by the selection. Brush
    // outlines are painted by their fill, so "stroke colour" recolours their
    // ink and line width does not apply to them.
    applyStyleToSelection(partial) {
        const glyph = this.glyph;
        if (!glyph || !this.doc || !this.doc.canvas || this.selection.size === 0) return false;
        const before = glyph.clone();
        for (const ci of this.selectedContourIndices(false)) {
            const contour = glyph.contours[ci];
            const current = contour.style || {};
            const isBrush = !!contour.style && current.stroke == null && !!current.fill;
            const style = { ...current };
            if ("stroke" in partial) {
                if (isBrush) style.fill = partial.stroke;
                else style.stroke = partial.stroke;
            }
            if ("fill" in partial && !isBrush && current.fill !== null) style.fill = partial.fill;
            if ("width" in partial && !isBrush) style.width = partial.width;
            contour.style = style;
        }
        this.commit(before, "restyle");
        return true;
    }

    renameGlyph(name) {
        const glyph = this.glyph;
        const clean = String(name || "").trim();
        if (!glyph || !clean || clean === glyph.name) return;
        const before = glyph.clone();
        glyph.name = clean;
        this.commit(before, "rename glyph");
    }

    setUnicodes(unicodes) {
        const glyph = this.glyph;
        if (!glyph) return;
        const before = glyph.clone();
        glyph.unicodes = unicodes.slice();
        this.commit(before, "unicode");
    }

    setAdvanceWidth(value) {
        const glyph = this.glyph;
        if (!glyph) return;
        const before = glyph.clone();
        glyph.advanceWidth = Math.max(0, Math.round(value) || 0);
        this.commit(before, "advance width");
    }

    setLeftSideBearing(value) {
        const glyph = this.glyph;
        if (!glyph) return;
        const before = glyph.clone();
        glyph.leftSideBearing = Math.round(value) || 0;
        this.commit(before, "left sidebearing");
    }

    // ── overlay drawing ─────────────────────────────────

    drawOverlay(ctx) {
        const glyph = this.glyph;
        if (!glyph) return;
        const r = this.renderer;

        if (this.tool === EditorTool.Edit) this.drawSelection(ctx, r);
        if (this.pen) this.drawPen(ctx, r);
        if (this.freehand) this.drawFreehand(ctx, r);
        if (this.drag && this.drag.type === "marquee") this.drawMarquee(ctx, r);
        if (this.tool === EditorTool.Background) this.drawBackgroundOverlay(ctx, r);
        if (this.mirror !== MirrorMode.None) this.drawMirrorAxes(ctx, r);
    }

    drawMirrorAxes(ctx, r) {
        const { x, y } = this.mirrorAxes();
        const w = r.canvas.width / r.dpr;
        const h = r.canvas.height / r.dpr;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "rgba(199, 146, 234, 0.8)";
        ctx.lineWidth = 1;
        if (this.mirror === MirrorMode.Vertical || this.mirror === MirrorMode.Both) {
            const sx = r.sx(x);
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
            ctx.stroke();
        }
        if (this.mirror === MirrorMode.Horizontal || this.mirror === MirrorMode.Both) {
            const sy = r.sy(y);
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(w, sy);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Live stroke preview. The raw samples are drawn (no curve fitting) so the
    // preview stays responsive on long strokes; fitting happens on release.
    drawFreehand(ctx, r) {
        const points = this.freehand.points;
        if (!points.length) return;
        const variants = [[false, false], ...this.mirrorVariants()];
        const { x: ax, y: ay } = this.mirrorAxes();
        const map = (p, mx, my) => ({ x: mx ? 2 * ax - p.x : p.x, y: my ? 2 * ay - p.y : p.y });
        const paint = this.doc && this.doc.canvas && this.paint ? this.paint : null;
        const trace = (pts, mx, my) => {
            ctx.beginPath();
            pts.forEach((p, i) => {
                const q = map(p, mx, my);
                if (i === 0) ctx.moveTo(r.sx(q.x), r.sy(q.y));
                else ctx.lineTo(r.sx(q.x), r.sy(q.y));
            });
        };

        ctx.save();
        if (this.freehandMode === "brush") {
            const poly = brushOutlinePolygon(points, this.freehandTolerance());
            ctx.fillStyle = paint ? paint.stroke : "rgba(204, 214, 246, 0.85)";
            for (const [mx, my] of variants) {
                trace(poly, mx, my);
                ctx.closePath();
                ctx.fill("nonzero");
            }
        } else {
            ctx.strokeStyle = paint ? paint.stroke : "rgba(130, 170, 255, 0.9)";
            ctx.lineWidth = paint ? Math.max(0.75, paint.width * r.view.scale) : 1.5;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            for (const [mx, my] of variants) {
                trace(points, mx, my);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    drawBackgroundOverlay(ctx, r) {
        const b = r.backgroundBounds();
        if (!b) return;
        const x0 = r.sx(b.x0);
        const y0 = r.sy(b.y0);
        const x1 = r.sx(b.x1);
        const y1 = r.sy(b.y1);
        ctx.save();
        ctx.strokeStyle = "rgba(199, 146, 234, 0.9)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        ctx.setLineDash([]);
        ctx.fillStyle = "#c792ea";
        ctx.fillRect(x1 - 6, y0 - 6, 12, 12);
        ctx.restore();
    }

    drawSelection(ctx, r) {
        if (this.selection.size === 0) return;
        for (const key of this.selection) {
            const { ci, pi } = parseKey(key);
            const glyph = this.glyph;
            const p = glyph.contours[ci] && glyph.contours[ci].points[pi];
            if (!p) continue;
            const x = r.sx(p.x);
            const y = r.sy(p.y);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(100, 255, 218, 0.25)";
            ctx.fill();
            ctx.strokeStyle = "#64ffda";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    drawPen(ctx, r) {
        const nodes = this.pen.nodes;

        if (nodes.length >= 2) {
            const preview = nodesToContour(nodes, false);
            ctx.strokeStyle = "rgba(100, 255, 218, 0.7)";
            ctx.lineWidth = 1.5;
            r.pathContours([preview]);
            ctx.stroke();
            for (const [mx, my] of this.mirrorVariants()) {
                r.pathContours([this.mirrorContour(preview, mx, my)]);
                ctx.stroke();
            }
        }

        // rubber band to pointer
        if (!this.drag && nodes.length) {
            const last = nodes[nodes.length - 1];
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "rgba(130, 170, 255, 0.6)";
            ctx.beginPath();
            ctx.moveTo(r.sx(last.x), r.sy(last.y));
            ctx.lineTo(r.sx(this.pointer.x), r.sy(this.pointer.y));
            ctx.stroke();
            ctx.restore();
        }

        for (const node of nodes) {
            if (node.in) {
                ctx.strokeStyle = "#82aaff";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(r.sx(node.x), r.sy(node.y));
                ctx.lineTo(r.sx(node.in.x), r.sy(node.in.y));
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(r.sx(node.in.x), r.sy(node.in.y), 3.5, 0, Math.PI * 2);
                ctx.fillStyle = "#82aaff";
                ctx.fill();
            }
            if (node.out) {
                ctx.strokeStyle = "#82aaff";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(r.sx(node.x), r.sy(node.y));
                ctx.lineTo(r.sx(node.out.x), r.sy(node.out.y));
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(r.sx(node.out.x), r.sy(node.out.y), 3.5, 0, Math.PI * 2);
                ctx.fillStyle = "#82aaff";
                ctx.fill();
            }
            ctx.fillStyle = "#64ffda";
            ctx.fillRect(r.sx(node.x) - 4, r.sy(node.y) - 4, 8, 8);
        }
    }

    drawMarquee(ctx, r) {
        const drag = this.drag;
        const x0 = r.sx(drag.start.x);
        const y0 = r.sy(drag.start.y);
        const x1 = r.sx(drag.current.x);
        const y1 = r.sy(drag.current.y);
        ctx.save();
        ctx.fillStyle = "rgba(100, 255, 218, 0.08)";
        ctx.strokeStyle = "rgba(100, 255, 218, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        ctx.restore();
    }
}
