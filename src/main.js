const els = {
    canvas: document.getElementById("canvas"),
    stage: document.getElementById("stage"),
    fileInput: document.getElementById("fileInput"),
    newBtn: document.getElementById("newBtn"),
    emptyCanvasBtn: document.getElementById("emptyCanvasBtn"),
    emptyFontBtn: document.getElementById("emptyFontBtn"),
    exportBtn: document.getElementById("exportBtn"),
    saveSvgBtn: document.getElementById("saveSvgBtn"),
    brandMode: document.getElementById("brandMode"),
    togglePoints: document.getElementById("togglePoints"),
    toggleFill: document.getElementById("toggleFill"),
    toggleMetrics: document.getElementById("toggleMetrics"),
    toggleGrid: document.getElementById("toggleGrid"),
    toggleSnap: document.getElementById("toggleSnap"),
    toggleMirror: document.getElementById("toggleMirror"),
    canvasW: document.getElementById("canvasW"),
    canvasH: document.getElementById("canvasH"),
    canvasStroke: document.getElementById("canvasStroke"),
    canvasFill: document.getElementById("canvasFill"),
    canvasLineWidth: document.getElementById("canvasLineWidth"),
    canvasGridSize: document.getElementById("canvasGridSize"),
    canvasGridRow: document.getElementById("canvasGridRow"),
    fitBtn: document.getElementById("fitBtn"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    glyphList: document.getElementById("glyphlist"),
    glyphSearch: document.getElementById("glyphSearch"),
    addGlyphInput: document.getElementById("addGlyphInput"),
    addGlyphBtn: document.getElementById("addGlyphBtn"),
    addShape: document.getElementById("addShape"),
    polygonPop: document.getElementById("polygonPop"),
    polygonSides: document.getElementById("polygonSides"),
    polygonAdd: document.getElementById("polygonAdd"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalOk: document.getElementById("modalOk"),
    modalCancel: document.getElementById("modalCancel"),
    status: document.getElementById("status"),
    empty: document.getElementById("empty-state"),
    preview: document.getElementById("preview"),
    previewText: document.getElementById("previewText"),
    hint: document.getElementById("insp-hint"),
    inspName: document.getElementById("insp-name"),
    inspUnicode: document.getElementById("insp-unicode"),
    inspAdvance: document.getElementById("insp-advance"),
    inspLsb: document.getElementById("insp-lsb"),
    inspRsb: document.getElementById("insp-rsb"),
    inspAscender: document.getElementById("insp-ascender"),
    inspDescender: document.getElementById("insp-descender"),
    inspXHeight: document.getElementById("insp-xheight"),
    inspCapHeight: document.getElementById("insp-capheight"),
    inspLineGap: document.getElementById("insp-linegap"),
    btnReverse: document.getElementById("btn-reverse"),
    btnClose: document.getElementById("btn-closecontour"),
    btnDelete: document.getElementById("btn-delete-points"),
    bgInput: document.getElementById("bgInput"),
    bgToggle: document.getElementById("bgToggle"),
    bgClear: document.getElementById("bgClear"),
    bgOpacity: document.getElementById("bgOpacity"),
    bgScale: document.getElementById("bgScale"),
    bgX: document.getElementById("bgX"),
    bgY: document.getElementById("bgY"),
    saveProjectBtn: document.getElementById("saveProjectBtn"),
    restoreBtn: document.getElementById("restoreBtn"),
    addGlyphSet: document.getElementById("addGlyphSet"),
    freehandMode: document.getElementById("freehandMode"),
    brushSize: document.getElementById("brushSize"),
    brushSizeRow: document.getElementById("brushSizeRow"),
    smoothing: document.getElementById("smoothing"),
    usePressure: document.getElementById("usePressure"),
    pressureRow: document.getElementById("pressureRow"),
    inspFamily: document.getElementById("insp-family"),
    inspStyle: document.getElementById("insp-style"),
    btnDirection: document.getElementById("btn-direction"),
};

const TOOL_HINTS = {
    edit: "Edit: click to select, shift-click to add, drag to move. Double-click a segment to insert a point. Arrow keys nudge; Delete removes. Ctrl+A selects all, Ctrl+C / Ctrl+X / Ctrl+V copy, cut and paste contours (also between glyphs), Ctrl+D duplicates.",
    pen: "Pen: click to add a point, drag to pull curve handles, click the first point to close. Alt breaks the handle. Enter finishes open; Esc cancels.",
    freehand: "Freehand: drag to draw and a smooth curve is fitted on release. Line draws a centre-line (end near the start to close it); Brush paints a filled stroke — pen pressure varies its width. B switches style. Esc cancels.",
    metrics: "Metrics: drag the purple advance guide or the sidebearing guide. Edit exact values in the panel.",
    background: "Image: drag the tracing image to move it, drag the bottom-right handle to scale. Load an image or tweak opacity, scale and position in the panel.",
};

const CANVAS_HINT = "Draw: use Pen or Freehand to draw, add shapes from the toolbar. Edit moves points; colour changes apply to the selected strokes. Space-drag or middle-drag pans. Save keeps an editable project; Save SVG exports the artboard.";

const AUTOSAVE_KEY = "scalarcanvas.autosave";

// Freehand defaults per document type: glyphs need filled outlines, so the
// brush is the natural default there; the canvas starts with line art.
const freehandPrefs = {
    font: { mode: "brush", size: null },
    canvas: { mode: "line", size: 12 },
};

const TOOL_ORDER = ["edit", "pen", "freehand", "metrics", "background"];

let font = null;
let mode = "none";
const history = new History();
const renderer = new CanvasRenderer(els.canvas, null, new ViewTransform(0.6, 260, 520));
const editor = new Editor(null, renderer, history);

let panning = false;
let lastPan = null;
let spaceHeld = false;
let dirty = false;
let autosaveTimer = 0;
let redrawFrame = 0;
let lastDown = { time: 0, x: 0, y: 0 };

/* ── sizing ─────────────────────────────────────────── */

function resize() {
    renderer.resize(els.stage.clientWidth, els.stage.clientHeight);
    resizePreview();
    redraw();
    drawPreview();
}

function resizePreview() {
    const dpr = window.devicePixelRatio || 1;
    els.preview.width = Math.round(els.preview.clientWidth * dpr);
    els.preview.height = Math.round(els.preview.clientHeight * dpr);
}

/* ── font loading ───────────────────────────────────── */

function loadFont(arrayBuffer) {
    let parsed;
    try {
        parsed = new TTFReader(arrayBuffer).parse();
    } catch (err) {
        showAlert("Could not read font:\n" + err.message, "Open failed");
        return;
    }
    setFont(parsed);
}

/* ── projects, autosave ─────────────────────────────── */

function projectData() {
    const data = {
        format: "scalarcanvas-project",
        version: 1,
        mode,
        glyphIndex: editor.glyphIndex,
        document: font.toJSON(),
    };
    if (mode === "canvas") {
        data.settings = {
            stroke: els.canvasStroke.value,
            fill: els.canvasFill.value,
            lineWidth: parseFloat(els.canvasLineWidth.value),
            gridSize: parseFloat(els.canvasGridSize.value),
        };
    }
    return data;
}

function loadProject(data) {
    if (!data || data.format !== "scalarcanvas-project") throw new Error("This file is not a ScalarCanvas project.");
    if (data.mode === "canvas") {
        const settings = data.settings || {};
        if (settings.stroke) els.canvasStroke.value = settings.stroke;
        if (settings.fill) els.canvasFill.value = settings.fill;
        if (Number.isFinite(settings.lineWidth)) els.canvasLineWidth.value = settings.lineWidth;
        if (Number.isFinite(settings.gridSize)) els.canvasGridSize.value = settings.gridSize;
        setCanvas(CanvasDocument.fromJSON(data.document));
    } else {
        setFont(FontDocument.fromJSON(data.document));
        const index = Number(data.glyphIndex) || 0;
        if (index > 0 && index < font.numGlyphs) selectGlyph(index);
    }
}

function projectFileName() {
    if (mode === "font") return (font.postScriptName || "font") + ".scalarcanvas.json";
    return "drawing.scalarcanvas.json";
}

function saveProject() {
    if (!font) return;
    const blob = new Blob([JSON.stringify(projectData())], { type: "application/json" });
    downloadBlob(blob, projectFileName());
    dirty = false;
    autosaveNow();
    toast("Project saved");
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);
}

function markDirty() {
    dirty = true;
    scheduleAutosave();
}

function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, 800);
}

// Keeps the latest session in localStorage so a refresh or crash loses
// nothing. Very large fonts can exceed the storage quota; that is reported
// once and otherwise ignored (Save still works).
let autosaveWarned = false;
function autosaveNow() {
    clearTimeout(autosaveTimer);
    if (!font) return;
    try {
        const payload = { savedAt: Date.now(), name: mode === "font" ? font.familyName : "Canvas", project: projectData() };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    } catch (err) {
        if (!autosaveWarned) {
            autosaveWarned = true;
            toast("Autosave unavailable (document too large) — use Save");
        }
        console.warn("Autosave failed:", err);
    }
}

function readAutosave() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

function timeAgo(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} days ago`;
}

function updateRestoreButton() {
    const saved = readAutosave();
    const show = !font && saved && saved.project;
    els.restoreBtn.hidden = !show;
    if (show) {
        const kind = saved.project.mode === "canvas" ? "canvas" : `font “${saved.name}”`;
        els.restoreBtn.textContent = `Restore last session — ${kind}, ${timeAgo(saved.savedAt)}`;
    }
}

function restoreAutosave() {
    const saved = readAutosave();
    if (!saved) return;
    try {
        loadProject(saved.project);
    } catch (err) {
        showAlert("Could not restore the last session:\n" + err.message, "Restore failed");
    }
}

async function openFile(file) {
    if (!file) return;
    if (isImageFile(file)) {
        loadBackground(file);
        return;
    }
    if (font && dirty && !(await showConfirm("The current document has unsaved changes. Discard them and open the file?", "Open file", "Discard"))) return;

    const isJson = /\.json$/i.test(file.name) || file.type === "application/json";
    const reader = new FileReader();
    if (isJson) {
        reader.onload = () => {
            try {
                loadProject(JSON.parse(reader.result));
            } catch (err) {
                showAlert("Could not open project:\n" + err.message, "Open failed");
            }
        };
        reader.readAsText(file);
    } else {
        reader.onload = () => loadFont(reader.result);
        reader.readAsArrayBuffer(file);
    }
}

/* ── toast ──────────────────────────────────────────── */

let toastEl = null;
let toastTimer = 0;
function toast(message) {
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "toast";
        els.stage.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function setModeUI(next) {
    mode = next;
    document.body.dataset.mode = next;
    els.brandMode.textContent =
        next === "canvas" ? "canvas editor" : next === "font" ? "font editor" : "editor";
    els.newBtn.title = next === "canvas" ? "Start a new blank canvas" : "Start a new blank font";
}

function updateGridSnap() {
    editor.snap = els.toggleSnap.classList.contains("active");
    editor.gridSize =
        mode === "canvas" && renderer.showGrid && editor.snap ? renderer.gridSize : 0;
    els.canvasGridRow.style.display =
        mode === "canvas" && renderer.showGrid ? "" : "none";
}

const MIRROR_LABELS = {
    [MirrorMode.None]: "Mirror: Off",
    [MirrorMode.Vertical]: "Mirror: V",
    [MirrorMode.Horizontal]: "Mirror: H",
    [MirrorMode.Both]: "Mirror: Both",
};

const MIRROR_ORDER = [MirrorMode.None, MirrorMode.Vertical, MirrorMode.Horizontal, MirrorMode.Both];

function updateMirrorButton() {
    els.toggleMirror.textContent = MIRROR_LABELS[editor.mirror] || "Mirror: Off";
    els.toggleMirror.classList.toggle("active", editor.mirror !== MirrorMode.None);
}

function cycleMirror() {
    const i = MIRROR_ORDER.indexOf(editor.mirror);
    editor.setMirror(MIRROR_ORDER[(i + 1) % MIRROR_ORDER.length]);
    updateMirrorButton();
    updateStatus();
}

function configureRenderer(forMode) {
    editor.setMirror(MirrorMode.None);
    updateMirrorButton();
    if (forMode === "canvas") {
        renderer.showGrid = false;
        renderer.showMetrics = false;
        renderer.showAdvance = false;
        renderer.strokeStyle = els.canvasStroke.value || "#64ffda";
        renderer.fillStyle = els.canvasFill.value || "#ccd6f6";
        const lw = parseFloat(els.canvasLineWidth.value);
        renderer.lineWidth = Number.isFinite(lw) ? lw : 1.5;
        const gs = parseFloat(els.canvasGridSize.value);
        renderer.gridSize = Number.isFinite(gs) ? gs : 50;
        els.toggleGrid.classList.toggle("active", renderer.showGrid);
        els.toggleSnap.classList.toggle("active", true);
        els.togglePoints.classList.toggle("active", renderer.showPoints);
        els.toggleFill.classList.toggle("active", renderer.showFill);
        updateGridSnap();
        updatePaint();
    } else {
        renderer.showGrid = false;
        renderer.showMetrics = true;
        renderer.showAdvance = true;
        renderer.strokeStyle = "#64ffda";
        renderer.fillStyle = "#ccd6f6";
        renderer.lineWidth = 1.5;
        editor.gridSize = 0;
        els.toggleMetrics.classList.toggle("active", renderer.showMetrics);
        els.togglePoints.classList.toggle("active", renderer.showPoints);
        els.toggleFill.classList.toggle("active", renderer.showFill);
    }
}

// The paint new canvas contours are stamped with.
function updatePaint() {
    editor.paint = {
        stroke: els.canvasStroke.value || "#64ffda",
        fill: els.canvasFill.value || "#ccd6f6",
        width: renderer.lineWidth,
    };
}

/* ── freehand settings ──────────────────────────────── */

function applyFreehandPrefs(forMode) {
    const prefs = freehandPrefs[forMode];
    if (!prefs) return;
    // Font brush sizes are in font units, so rescale when the em size changes.
    const upm = font ? font.unitsPerEm : 1000;
    if (forMode === "font" && prefs.upm && prefs.upm !== upm && prefs.size != null) {
        prefs.size = Math.round((prefs.size * upm) / prefs.upm);
    }
    if (prefs.size == null) prefs.size = Math.round(upm * 0.08);
    if (forMode === "font") prefs.upm = upm;
    editor.freehandMode = prefs.mode;
    editor.brushSize = prefs.size;
    updateFreehandControls();
}

function updateFreehandControls() {
    const brush = editor.freehandMode === "brush";
    els.freehandMode.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.value === editor.freehandMode);
    });
    els.brushSizeRow.style.display = brush ? "" : "none";
    els.pressureRow.style.display = brush ? "" : "none";
    if (document.activeElement !== els.brushSize) els.brushSize.value = editor.brushSize;
    els.smoothing.value = editor.smoothing;
    els.usePressure.checked = editor.usePressure;
}

function setFreehandMode(value) {
    editor.freehandMode = value === "brush" ? "brush" : "line";
    if (freehandPrefs[mode]) freehandPrefs[mode].mode = editor.freehandMode;
    updateFreehandControls();
    redraw();
}

function syncCanvasControls() {
    if (!font || !font.canvas) return;
    if (document.activeElement !== els.canvasW) els.canvasW.value = font.width;
    if (document.activeElement !== els.canvasH) els.canvasH.value = font.height;
}

function applyDocument(next, nextMode) {
    font = next;
    setModeUI(nextMode);

    renderer.doc = font;
    els.empty.style.display = "none";

    const isFont = nextMode === "font";
    els.exportBtn.disabled = !isFont;
    els.saveSvgBtn.disabled = isFont;
    els.fitBtn.disabled = false;
    els.glyphSearch.disabled = !isFont;
    els.previewText.disabled = !isFont;
    els.addGlyphInput.disabled = !isFont;
    els.addGlyphBtn.disabled = !isFont;
    els.addGlyphSet.disabled = !isFont;
    els.inspFamily.disabled = !isFont;
    els.inspStyle.disabled = !isFont;
    els.addShape.disabled = false;
    els.saveProjectBtn.disabled = false;
    els.restoreBtn.hidden = true;

    editor.setDocument(font);
    history.clear();
    dirty = false;
    applyFreehandPrefs(nextMode);

    // The stage column changes width between modes (the glyph sidebar is only
    // present in font mode). Force a reflow, then size the canvas to match so
    // it can never overflow into the inspector.
    void document.body.offsetHeight;
    renderer.resize(els.stage.clientWidth, els.stage.clientHeight);
    resizePreview();

    if (isFont) {
        els.glyphSearch.value = "";
        buildGlyphList("");
        configureRenderer("font");
    } else {
        syncCanvasControls();
        configureRenderer("canvas");
    }

    renderer.fitToGlyph(editor.glyph);
    redraw();
    updateStatus();
    updateInspector();
    updateButtons();
    updateBackgroundControls();
    if (isFont) drawPreview();
}

function setFont(next) {
    applyDocument(next, "font");
}

function setCanvas(doc) {
    applyDocument(doc, "canvas");
}

function newCanvas() {
    const doc = new CanvasDocument(1000, 1000);
    setCanvas(doc);
}

function newFont() {
    const doc = new FontDocument();
    doc.setName(1, "New Font");
    doc.setName(2, "Regular");
    doc.setName(4, "New Font Regular");
    doc.setName(6, "NewFont-Regular");

    // .notdef is conventionally a hollow box; space is needed by every font.
    const notdef = doc.addGlyph(new Glyph(".notdef"));
    notdef.advanceWidth = Math.round(doc.unitsPerEm * 0.5);
    notdef.leftSideBearing = 50;
    notdef.addContour(rectContour({ x0: 50, y0: 0, x1: 450, y1: 700 }));
    notdef.addContour(rectContour({ x0: 100, y0: 50, x1: 400, y1: 650 }).reverse());

    const space = doc.addGlyph(new Glyph("space"));
    space.unicodes = [0x20];
    space.advanceWidth = Math.round(doc.unitsPerEm * 0.25);

    setFont(doc);
}

/* ── character sets ─────────────────────────────────── */

function codeRange(from, to) {
    const out = [];
    for (let cp = from; cp <= to; cp++) out.push(cp);
    return out;
}

const isAlnum = (cp) => (cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);

const GLYPH_SETS = {
    upper: () => codeRange(0x41, 0x5a),
    lower: () => codeRange(0x61, 0x7a),
    digits: () => codeRange(0x30, 0x39),
    punct: () => codeRange(0x20, 0x7e).filter((cp) => !isAlnum(cp)),
    ascii: () => codeRange(0x20, 0x7e),
};

function defaultAdvance(cp) {
    const upm = font.unitsPerEm;
    if (cp === 0x20) return Math.round(upm * 0.25);
    if (cp >= 0x30 && cp <= 0x39) return Math.round(upm * 0.55);
    if (cp >= 0x61 && cp <= 0x7a) return Math.round(upm * 0.5);
    return Math.round(upm * 0.6);
}

function addGlyphSet(kind) {
    if (!font || !GLYPH_SETS[kind]) return;
    let added = 0;
    let firstNew = -1;
    for (const cp of GLYPH_SETS[kind]()) {
        if (font.getGlyphByCodepoint(cp)) continue;
        const glyph = new Glyph(unicodeToGlyphName(cp));
        glyph.unicodes = [cp];
        glyph.advanceWidth = defaultAdvance(cp);
        font.addGlyph(glyph);
        if (firstNew === -1) firstNew = font.numGlyphs - 1;
        added++;
    }
    els.glyphSearch.value = "";
    if (added) {
        markDirty();
        selectGlyph(firstNew);
        updateStatus();
    }
    buildGlyphList("");
    toast(added ? `Added ${added} glyph${added === 1 ? "" : "s"}` : "All of those glyphs already exist");
}

function parseGlyphQuery(query) {
    const text = (query || "").trim();
    if (!text) return null;

    let hex = null;
    if (/^U\+[0-9a-fA-F]{1,6}$/i.test(text)) hex = text.slice(2);
    else if (/^uni[0-9a-fA-F]{4}$/.test(text)) hex = text.slice(3);
    else if (/^u[0-9a-fA-F]{4,6}$/.test(text)) hex = text.slice(1);

    if (hex !== null) {
        const cp = parseInt(hex, 16);
        if (cp <= 0x10ffff) return { name: unicodeToGlyphName(cp), unicodes: [cp] };
    }

    if ([...text].length === 1) {
        const cp = text.codePointAt(0);
        return { name: unicodeToGlyphName(cp), unicodes: [cp] };
    }

    const cp = glyphNameToUnicode(text);
    return { name: text, unicodes: cp !== null ? [cp] : [] };
}

function addGlyphFromInput() {
    if (!font) return;
    const spec = parseGlyphQuery(els.addGlyphInput.value);
    if (!spec) return;

    const existing = spec.unicodes.length ? font.getGlyphByCodepoint(spec.unicodes[0]) : null;
    if (existing) {
        const index = font.glyphs.indexOf(existing);
        els.addGlyphInput.value = "";
        selectGlyph(index);
        return;
    }

    const glyph = font.addGlyph(new Glyph(spec.name));
    glyph.unicodes = spec.unicodes.slice();
    glyph.advanceWidth = spec.unicodes.length ? defaultAdvance(spec.unicodes[0]) : Math.round(font.unitsPerEm * 0.6);
    markDirty();

    els.addGlyphInput.value = "";
    els.glyphSearch.value = "";
    selectGlyph(font.numGlyphs - 1);
}

/* ── tracing background ─────────────────────────────── */

function loadBackground(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const image = new Image();
        image.onload = () => {
            const unitsPerEm = font ? font.unitsPerEm : 1000;
            const ascender = font ? font.metrics.ascender : 800;
            const opacity = parseFloat(els.bgOpacity.value);
            renderer.background = {
                image,
                opacity: Number.isFinite(opacity) ? opacity : 0.5,
                scale: unitsPerEm / Math.max(1, image.height),
                x: 0,
                y: ascender,
                visible: true,
                smoothing: true,
            };
            updateBackgroundControls();
            redraw();
        };
        image.onerror = () => showAlert("Could not load image.", "Image failed");
        image.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function updateBackgroundControls() {
    const bg = renderer.background;
    const has = !!bg;

    els.bgToggle.disabled = !has;
    els.bgClear.disabled = !has;
    els.bgOpacity.disabled = !has;
    els.bgScale.disabled = !has;
    els.bgX.disabled = !has;
    els.bgY.disabled = !has;
    if (!has) return;

    els.bgToggle.textContent = bg.visible ? "Hide" : "Show";
    if (document.activeElement !== els.bgOpacity) els.bgOpacity.value = bg.opacity;
    if (document.activeElement !== els.bgScale) els.bgScale.value = Number(bg.scale.toFixed(4));
    if (document.activeElement !== els.bgX) els.bgX.value = Math.round(bg.x);
    if (document.activeElement !== els.bgY) els.bgY.value = Math.round(bg.y);
}

/* ── glyph list ─────────────────────────────────────── */

// Trace contours into `ctx` with a font-unit → pixel mapping.
function traceContours(ctx, contours, originX, baseline, scale) {
    const px = (p) => originX + p.x * scale;
    const py = (p) => baseline - p.y * scale;
    for (const contour of contours) {
        let started = false;
        for (const seg of contour.segments()) {
            if (!started) {
                ctx.moveTo(px(seg.p0), py(seg.p0));
                started = true;
            }
            if (seg.type === "line") {
                ctx.lineTo(px(seg.p1), py(seg.p1));
            } else if (seg.type === "quad") {
                ctx.quadraticCurveTo(px(seg.control), py(seg.control), px(seg.p1), py(seg.p1));
            } else {
                ctx.bezierCurveTo(px(seg.control1), py(seg.control1), px(seg.control2), py(seg.control2), px(seg.p1), py(seg.p1));
            }
        }
        if (contour.closed) ctx.closePath();
    }
}

const THUMB_SIZE = 30;

function drawGlyphThumb(canvas, glyph) {
    const dpr = window.devicePixelRatio || 1;
    const size = THUMB_SIZE;
    if (canvas.width !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (!font || !glyph) return;

    const m = font.metrics;
    const span = Math.max(1, m.ascender - m.descender);
    const scale = (size * 0.82) / Math.max(span, glyph.advanceWidth || 0);
    const baseline = size / 2 + ((m.ascender + m.descender) / 2) * scale;
    const originX = (size - (glyph.advanceWidth || 0) * scale) / 2;

    const contours = glyph.getOutlineContours((i) => font.resolveGlyph(i));
    const closed = contours.filter((c) => c.closed);
    const open = contours.filter((c) => !c.closed);
    if (closed.length) {
        ctx.beginPath();
        traceContours(ctx, closed, originX, baseline, scale);
        ctx.fillStyle = "#ccd6f6";
        ctx.fill("nonzero");
    }
    if (open.length) {
        ctx.beginPath();
        traceContours(ctx, open, originX, baseline, scale);
        ctx.strokeStyle = "#ccd6f6";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Thumbnails are drawn only once their row scrolls into view.
const thumbObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const item = entry.target;
            thumbObserver.unobserve(item);
            const glyph = font && font.glyphs[Number(item.dataset.index)];
            drawGlyphThumb(item.querySelector(".gthumb"), glyph);
        }
    }, { root: els.glyphList, rootMargin: "200px 0px" })
    : null;

function glyphLabels(glyph, i) {
    const cp = glyph.codepoint;
    const cpHex = cp !== null ? "U+" + cp.toString(16).toUpperCase().padStart(4, "0") : "";
    const char = cp !== null && cp >= 32 && cp !== 127 ? String.fromCodePoint(cp) : "";
    return { cpHex, char, haystack: `${glyph.name} ${cpHex} ${char} ${i}`.toLowerCase() };
}

function buildGlyphList(filter) {
    if (thumbObserver) thumbObserver.disconnect();
    els.glyphList.innerHTML = "";
    if (!font) return;

    const term = filter.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    let shown = 0;

    for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs[i];
        const { cpHex, char, haystack } = glyphLabels(glyph, i);
        if (term && !haystack.includes(term)) continue;

        const item = document.createElement("div");
        item.className = "glyph-item" + (i === editor.glyphIndex ? " selected" : "");
        item.dataset.index = String(i);

        const thumb = document.createElement("canvas");
        thumb.className = "gthumb";

        const gid = document.createElement("span");
        gid.className = "gid";
        gid.textContent = "#" + i;

        const meta = document.createElement("div");
        meta.className = "gmeta";

        const name = document.createElement("span");
        name.className = "gname";
        name.textContent = glyph.name || "(unnamed)";

        const cpEl = document.createElement("span");
        cpEl.className = "gcp";
        cpEl.textContent = char ? `${char} ${cpHex}` : cpHex;

        meta.append(name, cpEl);
        item.append(thumb, meta, gid);
        fragment.appendChild(item);
        if (thumbObserver) thumbObserver.observe(item);
        else drawGlyphThumb(thumb, glyph);

        shown++;
        if (shown >= 800) break;
    }

    els.glyphList.appendChild(fragment);
}

function glyphItem(index) {
    return els.glyphList.querySelector(`.glyph-item[data-index="${index}"]`);
}

// Refresh one row (thumbnail and labels) after its glyph changed.
function refreshGlyphItem(index) {
    const item = glyphItem(index);
    const glyph = font && font.glyphs[index];
    if (!item || !glyph) return;
    const { cpHex, char } = glyphLabels(glyph, index);
    item.querySelector(".gname").textContent = glyph.name || "(unnamed)";
    item.querySelector(".gcp").textContent = char ? `${char} ${cpHex}` : cpHex;
    drawGlyphThumb(item.querySelector(".gthumb"), glyph);
}

function markSelectedGlyph() {
    els.glyphList.querySelectorAll(".glyph-item.selected").forEach((el) => el.classList.remove("selected"));
    const item = glyphItem(editor.glyphIndex);
    if (item) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
    }
}

function selectGlyph(index) {
    if (!font || !font.glyphs[index]) return;
    editor.setGlyphIndex(index);
    if (glyphItem(index)) markSelectedGlyph();
    else buildGlyphList(els.glyphSearch.value);
    renderer.fitToGlyph(editor.glyph);
    redraw();
    updateStatus();
    updateInspector();
    drawPreview();
}

/* ── drawing ────────────────────────────────────────── */

function redraw() {
    if (!font || !editor.glyph) {
        renderer.clear();
        return;
    }
    renderer.render(editor.glyph);
    editor.drawOverlay(renderer.ctx);
}

// Coalesces redraws from high-frequency input (pointer moves, pen samples)
// into one per animation frame.
function scheduleRedraw() {
    if (redrawFrame) return;
    redrawFrame = requestAnimationFrame(() => {
        redrawFrame = 0;
        redraw();
    });
}

function updateStatus() {
    if (!font) {
        els.status.innerHTML = "No font loaded";
        return;
    }
    const glyph = editor.glyph;
    if (mode === "canvas") {
        els.status.innerHTML =
            `<span>Canvas <b>${font.width}×${font.height}</b></span>` +
            `<span>Tool <b>${editor.tool}</b></span>` +
            `<span>Contours <b>${glyph ? glyph.contours.length : 0}</b></span>` +
            `<span>Selected <b>${editor.selection.size}</b></span>` +
            `<span>Mirror <b>${MIRROR_LABELS[editor.mirror].replace("Mirror: ", "")}</b></span>` +
            `<span>Zoom <b>${(renderer.view.scale * 100).toFixed(0)}%</b></span>`;
        return;
    }
    if (!glyph) {
        els.status.innerHTML = `<span>Family <b>${font.familyName}</b></span><span>Glyphs <b>${font.numGlyphs}</b></span>`;
        return;
    }
    els.status.innerHTML =
        `<span>Family <b>${font.familyName}</b></span>` +
        `<span>Tool <b>${editor.tool}</b></span>` +
        `<span>Glyphs <b>${font.numGlyphs}</b></span>` +
        `<span>Glyph <b>#${editor.glyphIndex} ${glyph.name}</b></span>` +
        `<span>Selected <b>${editor.selection.size}</b></span>` +
        `<span>Adv <b>${glyph.advanceWidth}</b></span>`;
}

function updateButtons() {
    els.undoBtn.disabled = !history.canUndo;
    els.redoBtn.disabled = !history.canRedo;
}

/* ── inspector ──────────────────────────────────────── */

function glyphWidth(glyph) {
    const box = glyph.getBoundingBox((i) => font.resolveGlyph(i));
    return box ? box.width : 0;
}

function updateInspector() {
    const glyph = font ? editor.glyph : null;
    const editable = !!glyph;

    els.inspAdvance.disabled = !editable;
    els.inspLsb.disabled = !editable;
    els.inspRsb.disabled = !editable;
    els.btnReverse.disabled = !editable;
    els.btnClose.disabled = !editable;
    els.btnDelete.disabled = !editable;
    els.btnDirection.disabled = !editable;
    els.inspName.disabled = !editable || mode !== "font";
    els.inspUnicode.disabled = !editable || mode !== "font";

    if (font && mode === "font") {
        if (document.activeElement !== els.inspFamily) els.inspFamily.value = font.familyName;
        if (document.activeElement !== els.inspStyle) els.inspStyle.value = font.styleName;
    }

    const metricInputs = [
        [els.inspAscender, "ascender"],
        [els.inspDescender, "descender"],
        [els.inspXHeight, "xHeight"],
        [els.inspCapHeight, "capHeight"],
        [els.inspLineGap, "lineGap"],
    ];
    for (const [input, key] of metricInputs) {
        input.disabled = !font;
        if (font && document.activeElement !== input) input.value = Math.round(font.metrics[key]);
    }

    if (!glyph) {
        els.inspName.value = "";
        els.inspUnicode.value = "";
        return;
    }

    if (document.activeElement !== els.inspName) els.inspName.value = glyph.name || "";
    if (document.activeElement !== els.inspUnicode) {
        els.inspUnicode.value = glyph.unicodes.length
            ? "U+" + glyph.unicodes[0].toString(16).toUpperCase().padStart(4, "0")
            : "";
    }
    if (document.activeElement !== els.inspAdvance) els.inspAdvance.value = glyph.advanceWidth;
    if (document.activeElement !== els.inspLsb) els.inspLsb.value = glyph.leftSideBearing;
    if (document.activeElement !== els.inspRsb) {
        els.inspRsb.value = Math.round(glyph.advanceWidth - glyph.leftSideBearing - glyphWidth(glyph));
    }
}

function updateHint() {
    if (mode === "canvas" && editor.tool === "edit") {
        els.hint.textContent = CANVAS_HINT;
        return;
    }
    els.hint.textContent = TOOL_HINTS[editor.tool] || "";
}

/* ── tools ──────────────────────────────────────────── */

function setTool(name) {
    editor.setTool(name);
    document.querySelectorAll("header .tool").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tool === name);
    });
    updateCursor();
    updateHint();
    updateStatus();
}

function updateCursor() {
    if (panning) {
        els.canvas.style.cursor = "grabbing";
        return;
    }
    if (spaceHeld) {
        els.canvas.style.cursor = "grab";
        return;
    }
    if (editor.tool === "pen") els.canvas.style.cursor = "crosshair";
    else if (editor.tool === "freehand") els.canvas.style.cursor = "crosshair";
    else if (editor.tool === "metrics") els.canvas.style.cursor = "ew-resize";
    else if (editor.tool === "background") els.canvas.style.cursor = "move";
    else els.canvas.style.cursor = "default";
}

/* ── preview ────────────────────────────────────────── */

// Horizontal extents of the glyphs drawn in the preview, for click-to-select.
let previewHits = [];

function drawPreview() {
    if (mode !== "font") return;
    const ctx = els.preview.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = els.preview.clientWidth;
    const h = els.preview.clientHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#14161f";
    ctx.fillRect(0, 0, w, h);
    previewHits = [];
    if (!font) return;

    ctx.strokeStyle = "#2a2d3e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.lineTo(w, h * 0.78);
    ctx.stroke();

    const text = els.previewText.value || "";
    const scale = (h * 0.72) / font.unitsPerEm;
    const baseline = h * 0.78;
    const current = editor.glyph;
    let cursorX = 10;

    for (const char of text) {
        const cp = char.codePointAt(0);
        const glyph = font.getGlyphByCodepoint(cp);
        if (!glyph) {
            // Missing glyphs show as a faint box so gaps in the set are visible.
            const boxW = font.unitsPerEm * 0.4 * scale;
            ctx.strokeStyle = "#3a3f58";
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(cursorX + 2, baseline - font.metrics.capHeight * scale, boxW - 4, font.metrics.capHeight * scale);
            ctx.setLineDash([]);
            cursorX += boxW;
            continue;
        }

        const contours = glyph.getOutlineContours((i) => font.resolveGlyph(i));
        ctx.beginPath();
        traceContours(ctx, contours, cursorX, baseline, scale);
        ctx.fillStyle = glyph === current ? "#64ffda" : "#ccd6f6";
        ctx.fill("nonzero");

        const advance = Math.max(glyph.advanceWidth * scale, 4);
        previewHits.push({ x0: cursorX, x1: cursorX + advance, index: font.glyphs.indexOf(glyph) });
        cursorX += glyph.advanceWidth * scale;
        if (cursorX > w) break;
    }
}

/* ── editor hooks ───────────────────────────────────── */

editor.onChange = () => {
    scheduleRedraw();
    updateBackgroundControls();
};
editor.onSelectionChange = () => {
    updateInspector();
    updateStatus();
    updateButtons();
};

history.onChange(() => {
    updateInspector();
    updateStatus();
    updateButtons();
    redraw();
    if (!font || !history.lastCommand) return;
    markDirty();
    if (mode === "font") {
        const changed = history.lastCommand.glyph;
        const index = changed ? font.glyphs.indexOf(changed) : editor.glyphIndex;
        refreshGlyphItem(index >= 0 ? index : editor.glyphIndex);
        drawPreview();
    }
});

/* ── modal popups ───────────────────────────────────── */

let modalResolve = null;

function openModal({ title = "", message = "", confirm = false, okLabel = "OK", cancelLabel = "Cancel" } = {}) {
    if (modalResolve) {
        const previous = modalResolve;
        modalResolve = null;
        previous(false);
    }

    return new Promise((resolve) => {
        modalResolve = resolve;
        els.modalTitle.textContent = title;
        els.modalMessage.textContent = message;
        els.modalOk.textContent = okLabel;
        els.modalCancel.textContent = cancelLabel;
        els.modalCancel.hidden = !confirm;
        els.modal.hidden = false;
        els.modalOk.focus();
    });
}

function closeModal(result) {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    const resolve = modalResolve;
    modalResolve = null;
    if (resolve) resolve(result);
}

function showAlert(message, title = "ScalarCanvas") {
    return openModal({ title, message });
}

function showConfirm(message, title = "ScalarCanvas", okLabel = "OK") {
    return openModal({ title, message, confirm: true, okLabel });
}

els.modalOk.addEventListener("click", () => closeModal(true));
els.modalCancel.addEventListener("click", () => closeModal(false));
els.modal.querySelector(".modal-backdrop").addEventListener("click", () => closeModal(false));

/* ── event wiring ───────────────────────────────────── */

els.fileInput.addEventListener("change", (e) => {
    openFile(e.target.files[0]);
    // Reset so choosing the same file again still fires "change".
    e.target.value = "";
});

els.saveProjectBtn.addEventListener("click", saveProject);
els.restoreBtn.addEventListener("click", restoreAutosave);

els.newBtn.addEventListener("click", async () => {
    const isCanvas = mode === "canvas";
    const label = isCanvas ? "New canvas" : "New font";
    if (font && !(await showConfirm(`Discard the current ${isCanvas ? "canvas" : "font"} and start a new one?`, label, "Discard"))) return;
    if (isCanvas) newCanvas();
    else newFont();
});

els.emptyCanvasBtn.addEventListener("click", () => newCanvas());
els.emptyFontBtn.addEventListener("click", () => newFont());

els.addGlyphBtn.addEventListener("click", addGlyphFromInput);
els.addGlyphInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addGlyphFromInput();
});

function isImageFile(file) {
    if (file.type) return file.type.startsWith("image/");
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
});

function exportSVG() {
    if (!font || !font.canvas || !editor.glyph) return;
    const svg = glyphToSVG(editor.glyph, {
        width: font.width,
        height: font.height,
        stroke: els.canvasStroke.value || "#64ffda",
        fill: els.canvasFill.value || "#ccd6f6",
        lineWidth: parseFloat(els.canvasLineWidth.value) || 0,
    });
    downloadSVG(svg, "design.svg");
    toast("SVG exported");
}

els.saveSvgBtn.addEventListener("click", exportSVG);

els.exportBtn.addEventListener("click", async () => {
    if (!font) return;
    // TrueType has no open contours: every outline is closed and filled.
    const withOpen = font.glyphs.filter((g) => g.contours.some((c) => !c.closed));
    if (withOpen.length) {
        const names = withOpen.slice(0, 6).map((g) => g.name || "(unnamed)").join(", ") + (withOpen.length > 6 ? ", …" : "");
        const ok = await showConfirm(
            `${withOpen.length} glyph${withOpen.length === 1 ? " has" : "s have"} open contours (${names}). ` +
            "TrueType closes every contour, so these will export as filled shapes. " +
            "Tip: draw glyphs with the Brush style, or close contours with Open / Close.",
            "Open contours",
            "Export anyway"
        );
        if (!ok) return;
    }
    try {
        const buffer = new TTFWriter(font, { correctDirection: false }).write();
        downloadBlob(new Blob([buffer], { type: "font/ttf" }), (font.postScriptName || "export") + ".ttf");
        toast("Font exported");
    } catch (err) {
        showAlert("Export failed:\n" + err.message, "Export failed");
        console.error(err);
    }
});

document.querySelectorAll("header .tool").forEach((btn) => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
});

function closePolygonPop() {
    els.polygonPop.hidden = true;
    els.addShape.value = "";
}

function commitPolygon() {
    const raw = parseFloat(els.polygonSides.value);
    const sides = Math.max(3, Math.min(24, Math.round(Number.isFinite(raw) ? raw : 6)));
    els.polygonSides.value = String(sides);
    if (font && editor.glyph) editor.addShape("polygon", sides);
    closePolygonPop();
}

els.addShape.addEventListener("change", () => {
    const kind = els.addShape.value;
    if (!kind || !font || !editor.glyph) {
        els.addShape.value = "";
        return;
    }

    if (kind === "polygon") {
        els.polygonPop.hidden = false;
        els.polygonSides.focus();
        els.polygonSides.select();
        return;
    }

    editor.addShape(kind);
    els.addShape.value = "";
});

els.polygonAdd.addEventListener("click", commitPolygon);

els.polygonSides.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        commitPolygon();
    } else if (e.key === "Escape") {
        e.preventDefault();
        closePolygonPop();
    }
});

document.addEventListener("mousedown", (e) => {
    if (els.polygonPop.hidden) return;
    if (e.target.closest(".shape-add")) return;
    closePolygonPop();
});

els.togglePoints.addEventListener("click", () => {
    renderer.showPoints = !renderer.showPoints;
    els.togglePoints.classList.toggle("active", renderer.showPoints);
    redraw();
});

els.toggleFill.addEventListener("click", () => {
    renderer.showFill = !renderer.showFill;
    els.toggleFill.classList.toggle("active", renderer.showFill);
    redraw();
});

els.toggleMetrics.addEventListener("click", () => {
    renderer.showMetrics = !renderer.showMetrics;
    els.toggleMetrics.classList.toggle("active", renderer.showMetrics);
    redraw();
});

els.toggleGrid.addEventListener("click", () => {
    renderer.showGrid = !renderer.showGrid;
    els.toggleGrid.classList.toggle("active", renderer.showGrid);
    updateGridSnap();
    redraw();
});

els.toggleSnap.addEventListener("click", () => {
    const active = !els.toggleSnap.classList.contains("active");
    els.toggleSnap.classList.toggle("active", active);
    updateGridSnap();
});

els.toggleMirror.addEventListener("click", cycleMirror);

// Colours/width set the paint for new strokes; committing a change while
// something is selected also repaints the selected strokes (undoable).
els.canvasStroke.addEventListener("input", () => {
    renderer.strokeStyle = els.canvasStroke.value;
    updatePaint();
    redraw();
});
els.canvasStroke.addEventListener("change", () => editor.applyStyleToSelection({ stroke: els.canvasStroke.value }));
els.canvasFill.addEventListener("input", () => {
    renderer.fillStyle = els.canvasFill.value;
    updatePaint();
    redraw();
});
els.canvasFill.addEventListener("change", () => editor.applyStyleToSelection({ fill: els.canvasFill.value }));
els.canvasLineWidth.addEventListener("change", () => {
    const value = parseFloat(els.canvasLineWidth.value);
    renderer.lineWidth = Number.isFinite(value) && value >= 0 ? value : 1.5;
    els.canvasLineWidth.value = renderer.lineWidth;
    updatePaint();
    if (!editor.applyStyleToSelection({ width: renderer.lineWidth })) redraw();
});
els.canvasGridSize.addEventListener("change", () => {
    const value = parseFloat(els.canvasGridSize.value);
    renderer.gridSize = Number.isFinite(value) ? value : 50;
    els.canvasGridSize.value = renderer.gridSize;
    updateGridSnap();
    redraw();
});
els.canvasW.addEventListener("change", () => {
    if (!font || !font.canvas) return;
    font.setSize(parseFloat(els.canvasW.value) || 1000, font.height);
    markDirty();
    syncCanvasControls();
    redraw();
    updateStatus();
});
els.canvasH.addEventListener("change", () => {
    if (!font || !font.canvas) return;
    font.setSize(font.width, parseFloat(els.canvasH.value) || 1000);
    markDirty();
    syncCanvasControls();
    redraw();
    updateStatus();
});

els.fitBtn.addEventListener("click", () => {
    if (!font) return;
    renderer.fitToGlyph(editor.glyph);
    redraw();
});

els.undoBtn.addEventListener("click", () => history.undo());
els.redoBtn.addEventListener("click", () => history.redo());

els.btnReverse.addEventListener("click", () => editor.reverseContours());
els.btnClose.addEventListener("click", () => editor.toggleContourClosed());
els.btnDelete.addEventListener("click", () => editor.deleteSelection());
els.btnDirection.addEventListener("click", () => editor.correctDirection());

els.freehandMode.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (btn) setFreehandMode(btn.dataset.value);
});
els.brushSize.addEventListener("change", () => {
    const value = parseFloat(els.brushSize.value);
    editor.brushSize = Number.isFinite(value) && value > 0 ? value : editor.brushSize;
    if (freehandPrefs[mode]) freehandPrefs[mode].size = editor.brushSize;
    updateFreehandControls();
});
els.smoothing.addEventListener("input", () => {
    editor.smoothing = parseFloat(els.smoothing.value) || 3;
});
els.usePressure.addEventListener("change", () => {
    editor.usePressure = els.usePressure.checked;
});

els.addGlyphSet.addEventListener("change", () => {
    const kind = els.addGlyphSet.value;
    els.addGlyphSet.value = "";
    addGlyphSet(kind);
});

function renameFont() {
    if (!font || mode !== "font") return;
    const family = els.inspFamily.value.trim() || font.familyName;
    const style = els.inspStyle.value.trim() || font.styleName;
    font.setName(1, family);
    font.setName(2, style);
    font.setName(4, `${family} ${style}`);
    font.setName(6, `${family}-${style}`.replace(/\s+/g, ""));
    // Typographic family/style names win over 1/2 when present; keep them in step.
    if (font.names.has(16)) font.setName(16, family);
    if (font.names.has(17)) font.setName(17, style);
    markDirty();
    updateInspector();
    updateStatus();
}
els.inspFamily.addEventListener("change", renameFont);
els.inspStyle.addEventListener("change", renameFont);

els.inspName.addEventListener("change", () => {
    editor.renameGlyph(els.inspName.value);
    updateInspector();
});

els.inspUnicode.addEventListener("change", () => {
    const glyph = editor.glyph;
    if (!glyph) return;
    const text = els.inspUnicode.value.trim();
    const spec = text ? parseGlyphQuery(text) : { unicodes: [] };
    if (text && !spec.unicodes.length) {
        showAlert(`"${text}" is not a character or code point. Use e.g. A, U+0041 or uni0041.`, "Unicode");
        updateInspector();
        return;
    }
    const cp = spec.unicodes[0];
    const owner = cp !== undefined ? font.getGlyphByCodepoint(cp) : null;
    if (owner && owner !== glyph) {
        showAlert(`U+${cp.toString(16).toUpperCase().padStart(4, "0")} is already mapped to "${owner.name}".`, "Unicode");
        updateInspector();
        return;
    }
    editor.setUnicodes(spec.unicodes);
    updateInspector();
});

els.bgInput.addEventListener("change", (e) => {
    loadBackground(e.target.files[0]);
    e.target.value = "";
});
els.bgToggle.addEventListener("click", () => {
    if (!renderer.background) return;
    renderer.background.visible = !renderer.background.visible;
    updateBackgroundControls();
    redraw();
});
els.bgClear.addEventListener("click", () => {
    renderer.background = null;
    updateBackgroundControls();
    redraw();
});
els.bgOpacity.addEventListener("input", () => {
    if (!renderer.background) return;
    renderer.background.opacity = Math.min(1, Math.max(0, parseFloat(els.bgOpacity.value) || 0));
    redraw();
});
els.bgScale.addEventListener("change", () => {
    if (!renderer.background) return;
    renderer.background.scale = Math.max(0.01, parseFloat(els.bgScale.value) || 0.01);
    redraw();
});
els.bgX.addEventListener("change", () => {
    if (!renderer.background) return;
    renderer.background.x = parseFloat(els.bgX.value) || 0;
    redraw();
});
els.bgY.addEventListener("change", () => {
    if (!renderer.background) return;
    renderer.background.y = parseFloat(els.bgY.value) || 0;
    redraw();
});

els.glyphSearch.addEventListener("input", () => buildGlyphList(els.glyphSearch.value));
els.previewText.addEventListener("input", drawPreview);

els.preview.addEventListener("click", (e) => {
    const x = e.clientX - els.preview.getBoundingClientRect().left;
    const hit = previewHits.find((h) => x >= h.x0 && x < h.x1);
    if (hit && hit.index >= 0) selectGlyph(hit.index);
});

els.glyphList.addEventListener("click", (e) => {
    const item = e.target.closest(".glyph-item");
    if (!item) return;
    selectGlyph(Number(item.dataset.index));
});

els.inspAdvance.addEventListener("change", () => editor.setAdvanceWidth(parseFloat(els.inspAdvance.value)));
els.inspLsb.addEventListener("change", () => editor.setLeftSideBearing(parseFloat(els.inspLsb.value)));
els.inspRsb.addEventListener("change", () => {
    if (!editor.glyph) return;
    const rsb = parseFloat(els.inspRsb.value) || 0;
    const advance = editor.glyph.leftSideBearing + glyphWidth(editor.glyph) + rsb;
    editor.setAdvanceWidth(advance);
});

const metricFields = [
    [els.inspAscender, "ascender"],
    [els.inspDescender, "descender"],
    [els.inspXHeight, "xHeight"],
    [els.inspCapHeight, "capHeight"],
    [els.inspLineGap, "lineGap"],
];
for (const [input, key] of metricFields) {
    input.addEventListener("change", () => {
        if (!font) return;
        font.metrics[key] = Math.round(parseFloat(input.value) || 0);
        markDirty();
        redraw();
        drawPreview();
    });
}

/* ── canvas interaction ─────────────────────────────── */

function localPos(e) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// Pointer events cover mouse, pen and touch. Pen pressure reaches the editor
// through the event (see Editor.pressureOf).
function pointerInfo(e, detail = 1) {
    return { shiftKey: e.shiftKey, altKey: e.altKey, pointerType: e.pointerType, pressure: e.pressure, detail };
}

// Keep receiving moves when the pointer leaves the canvas mid-drag.
function capturePointer(e) {
    try {
        els.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
        // Not an active pointer (e.g. a synthetic event); window listeners still work.
    }
}

function startPan(e) {
    panning = true;
    lastPan = { x: e.clientX, y: e.clientY };
    updateCursor();
    e.preventDefault();
}

els.canvas.addEventListener("pointerdown", (e) => {
    if (!font) return;
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        capturePointer(e);
        startPan(e);
        return;
    }
    if (e.button !== 0) return;
    capturePointer(e);
    e.preventDefault();

    // pointerdown has no click count, so detect double-clicks ourselves.
    const now = performance.now();
    const isDouble = now - lastDown.time < 400 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = { time: isDouble ? 0 : now, x: e.clientX, y: e.clientY };

    const p = localPos(e);
    editor.onMouseDown(p.x, p.y, pointerInfo(e, isDouble ? 2 : 1));
});

window.addEventListener("pointermove", (e) => {
    if (panning) {
        const view = renderer.view;
        view.panX += e.clientX - lastPan.x;
        view.panY += e.clientY - lastPan.y;
        lastPan = { x: e.clientX, y: e.clientY };
        scheduleRedraw();
        return;
    }
    if (!font) return;
    // While painting, use every sample the browser coalesced into this event
    // so fast strokes keep their shape.
    const samples = editor.drag && editor.drag.type === "freehand" && e.getCoalescedEvents
        ? e.getCoalescedEvents()
        : [];
    for (const sample of samples.length ? samples : [e]) {
        const p = localPos(sample);
        editor.onMouseMove(p.x, p.y, pointerInfo(sample));
    }
});

function endPointer() {
    if (panning) {
        panning = false;
        updateCursor();
        return;
    }
    if (!font) return;
    editor.onMouseUp();
}

window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);

els.canvas.addEventListener("wheel", (e) => {
    if (!font) return;
    e.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const view = renderer.view;
    view.panX = mx - (mx - view.panX) * factor;
    view.panY = my - (my - view.panY) * factor;
    view.scale *= factor;
    redraw();
}, { passive: false });

window.addEventListener("keydown", (e) => {
    if (!els.modal.hidden) {
        if (e.key === "Escape") {
            e.preventDefault();
            closeModal(false);
        }
        return;
    }
    if (!font) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === " ") {
        e.preventDefault();
        if (!spaceHeld) {
            spaceHeld = true;
            updateCursor();
        }
        return;
    }

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === "s") {
        e.preventDefault();
        saveProject();
        return;
    }
    if (mod && key === "a") {
        e.preventDefault();
        if (editor.tool !== "edit") setTool("edit");
        editor.selectAll();
        return;
    }
    if (mod && key === "c") {
        const n = editor.copySelection();
        if (n) toast(`Copied ${n} contour${n === 1 ? "" : "s"}`);
        return;
    }
    if (mod && key === "x") {
        const n = editor.cutSelection();
        if (n) toast(`Cut ${n} contour${n === 1 ? "" : "s"}`);
        return;
    }
    if (mod && key === "v") {
        e.preventDefault();
        if (editor.paste()) setTool("edit");
        return;
    }
    if (mod && key === "d") {
        e.preventDefault();
        if (editor.duplicateSelection()) setTool("edit");
        return;
    }

    if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        history.redo();
        return;
    }
    // Leave other browser shortcuts (Ctrl+P, Ctrl+F, ...) alone.
    if (mod) return;
    if (e.key === "Tab") {
        e.preventDefault();
        const order = mode === "font" ? TOOL_ORDER : TOOL_ORDER.filter((t) => t !== "metrics");
        const i = order.indexOf(editor.tool);
        const step = e.shiftKey ? -1 : 1;
        const next = order[(i + step + order.length) % order.length];
        setTool(next);
        return;
    }
    if (e.key === "e" || e.key === "E") { setTool("edit"); return; }
    if (e.key === "p" || e.key === "P") { setTool("pen"); return; }
    if (e.key === "f" || e.key === "F") { setTool("freehand"); return; }
    if (e.key === "b" || e.key === "B") {
        setTool("freehand");
        setFreehandMode(editor.freehandMode === "brush" ? "line" : "brush");
        toast(`Freehand: ${editor.freehandMode === "brush" ? "Brush" : "Line"}`);
        return;
    }
    if (mode === "canvas" && (e.key === "m" || e.key === "M")) { cycleMirror(); return; }
    if (mode === "font" && (e.key === "m" || e.key === "M")) { setTool("metrics"); return; }
    if (e.key === "i" || e.key === "I") { setTool("background"); return; }
    if (mode === "font" && e.key === "[") { selectGlyph((editor.glyphIndex - 1 + font.numGlyphs) % font.numGlyphs); return; }
    if (mode === "font" && e.key === "]") { selectGlyph((editor.glyphIndex + 1) % font.numGlyphs); return; }
    if (e.key === "r" || e.key === "R") { editor.reverseContours(); return; }

    editor.onKeyDown(e);
});

window.addEventListener("keyup", (e) => {
    if (e.key === " " && spaceHeld) {
        spaceHeld = false;
        updateCursor();
    }
});
window.addEventListener("blur", () => {
    spaceHeld = false;
    updateCursor();
});

window.addEventListener("resize", resize);

// Flush a pending autosave when the tab is hidden or closed.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && autosaveTimer) autosaveNow();
});
window.addEventListener("pagehide", () => {
    if (autosaveTimer) autosaveNow();
});

setModeUI("none");
resize();
updateHint();
updateCursor();
updateFreehandControls();
updateRestoreButton();
renderer.clear();
