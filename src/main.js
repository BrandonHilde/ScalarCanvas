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
};

const TOOL_HINTS = {
    edit: "Edit: click to select, shift-click to add, drag to move. Double-click a segment to insert a point. Arrow keys nudge; Delete removes.",
    pen: "Pen: click to add a point, drag to pull curve handles, click the first point to close. Alt breaks the handle. Enter finishes open; Esc cancels.",
    freehand: "Freehand: drag to draw freely and a smooth curve is fitted to the stroke. The contour stays open and unfilled. Esc cancels.",
    metrics: "Metrics: drag the purple advance guide or the sidebearing guide. Edit exact values in the panel.",
    background: "Image: drag the tracing image to move it, drag the bottom-right handle to scale. Load an image or tweak opacity, scale and position in the panel.",
};

const CANVAS_HINT = "Draw: use Pen or Freehand to draw. Edit moves points. Add shapes from the toolbar. Save SVG exports your artboard.";

const TOOL_ORDER = ["edit", "pen", "freehand", "metrics", "background"];

let font = null;
let mode = "none";
const history = new History();
const renderer = new CanvasRenderer(els.canvas, null, new ViewTransform(0.6, 260, 520));
const editor = new Editor(null, renderer, history);

let panning = false;
let lastPan = null;

/* ── sizing ─────────────────────────────────────────── */

function resize() {
    renderer.resize(els.stage.clientWidth, els.stage.clientHeight);
    resizePreview();
    redraw();
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
    els.addShape.disabled = false;

    editor.setDocument(font);
    history.clear();

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

    const notdef = doc.addGlyph(new Glyph(".notdef"));
    notdef.advanceWidth = Math.round(doc.unitsPerEm * 0.5);

    setFont(doc);
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
    glyph.advanceWidth = spec.unicodes[0] === 0x20 ? 250 : Math.round(font.unitsPerEm * 0.6);

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

function buildGlyphList(filter) {
    els.glyphList.innerHTML = "";
    if (!font) return;

    const term = filter.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    let shown = 0;

    for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs[i];
        const cp = glyph.codepoint;
        const cpHex = cp !== null ? "U+" + cp.toString(16).toUpperCase().padStart(4, "0") : "";
        const char = cp !== null && cp >= 32 && cp !== 127 ? String.fromCodePoint(cp) : "";
        const haystack = `${glyph.name} ${cpHex} ${char} ${i}`.toLowerCase();
        if (term && !haystack.includes(term)) continue;

        const item = document.createElement("div");
        item.className = "glyph-item" + (i === editor.glyphIndex ? " selected" : "");
        item.dataset.index = String(i);

        const gid = document.createElement("span");
        gid.className = "gid";
        gid.textContent = "#" + i;

        const name = document.createElement("span");
        name.className = "gname";
        name.textContent = glyph.name || "(unnamed)";

        const cpEl = document.createElement("span");
        cpEl.className = "gcp";
        cpEl.textContent = char ? `${char} ${cpHex}` : cpHex;

        item.append(gid, name, cpEl);
        fragment.appendChild(item);

        shown++;
        if (shown >= 800) break;
    }

    els.glyphList.appendChild(fragment);
}

function selectGlyph(index) {
    if (!font || !font.glyphs[index]) return;
    editor.setGlyphIndex(index);
    buildGlyphList(els.glyphSearch.value);
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
    if (editor.tool === "pen") els.canvas.style.cursor = "crosshair";
    else if (editor.tool === "freehand") els.canvas.style.cursor = "crosshair";
    else if (editor.tool === "metrics") els.canvas.style.cursor = "ew-resize";
    else if (editor.tool === "background") els.canvas.style.cursor = "move";
    else els.canvas.style.cursor = "default";
}

/* ── preview ────────────────────────────────────────── */

function drawPreview() {
    if (mode !== "font") return;
    const ctx = els.preview.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = els.preview.clientWidth;
    const h = els.preview.clientHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#14161f";
    ctx.fillRect(0, 0, w, h);
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
    let cursorX = 10;

    ctx.fillStyle = "#ccd6f6";
    for (const char of text) {
        const cp = char.codePointAt(0);
        const glyph = font.getGlyphByCodepoint(cp);
        if (!glyph) {
            cursorX += font.unitsPerEm * 0.4 * scale;
            continue;
        }

        const contours = glyph.getOutlineContours((i) => font.resolveGlyph(i));
        ctx.beginPath();
        for (const contour of contours) {
            let started = false;
            for (const seg of contour.segments()) {
                const px = (p) => cursorX + p.x * scale;
                const py = (p) => baseline - p.y * scale;
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
        ctx.fill("nonzero");

        cursorX += glyph.advanceWidth * scale;
        if (cursorX > w) break;
    }
}

/* ── editor hooks ───────────────────────────────────── */

editor.onChange = () => {
    redraw();
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
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFont(reader.result);
    reader.readAsArrayBuffer(file);
});

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
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (isImageFile(file)) {
        loadBackground(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = () => loadFont(reader.result);
    reader.readAsArrayBuffer(file);
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
}

els.saveSvgBtn.addEventListener("click", exportSVG);

els.exportBtn.addEventListener("click", () => {
    if (!font) return;
    try {
        const buffer = new TTFWriter(font, { correctDirection: false }).write();
        const blob = new Blob([buffer], { type: "font/ttf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (font.postScriptName || "export") + ".ttf";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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

els.canvasStroke.addEventListener("input", () => {
    renderer.strokeStyle = els.canvasStroke.value;
    redraw();
});
els.canvasFill.addEventListener("input", () => {
    renderer.fillStyle = els.canvasFill.value;
    redraw();
});
els.canvasLineWidth.addEventListener("change", () => {
    const value = parseFloat(els.canvasLineWidth.value);
    renderer.lineWidth = Number.isFinite(value) ? value : 1.5;
    els.canvasLineWidth.value = renderer.lineWidth;
    redraw();
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
    syncCanvasControls();
    redraw();
    updateStatus();
});
els.canvasH.addEventListener("change", () => {
    if (!font || !font.canvas) return;
    font.setSize(font.width, parseFloat(els.canvasH.value) || 1000);
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
        renderer.render(editor.glyph);
        editor.drawOverlay(renderer.ctx);
        drawPreview();
    });
}

/* ── canvas interaction ─────────────────────────────── */

function localPos(e) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

els.canvas.addEventListener("mousedown", (e) => {
    if (!font) return;
    if (e.button === 1) {
        panning = true;
        lastPan = { x: e.clientX, y: e.clientY };
        updateCursor();
        e.preventDefault();
        return;
    }
    if (e.button !== 0) return;
    const p = localPos(e);
    editor.onMouseDown(p.x, p.y, e);
});

window.addEventListener("mousemove", (e) => {
    if (panning) {
        const view = renderer.view;
        view.panX += e.clientX - lastPan.x;
        view.panY += e.clientY - lastPan.y;
        lastPan = { x: e.clientX, y: e.clientY };
        redraw();
        return;
    }
    if (!font) return;
    const p = localPos(e);
    editor.onMouseMove(p.x, p.y, e);
});

window.addEventListener("mouseup", () => {
    if (panning) {
        panning = false;
        updateCursor();
        return;
    }
    if (!font) return;
    editor.onMouseUp();
});

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
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
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
    if (mode === "canvas" && (e.key === "m" || e.key === "M")) { cycleMirror(); return; }
    if (mode === "font" && (e.key === "m" || e.key === "M")) { setTool("metrics"); return; }
    if (e.key === "i" || e.key === "I") { setTool("background"); return; }
    if (mode === "font" && e.key === "[") { selectGlyph((editor.glyphIndex - 1 + font.numGlyphs) % font.numGlyphs); return; }
    if (mode === "font" && e.key === "]") { selectGlyph((editor.glyphIndex + 1) % font.numGlyphs); return; }
    if (e.key === "r" || e.key === "R") { editor.reverseContours(); return; }

    editor.onKeyDown(e);
});

window.addEventListener("resize", resize);

setModeUI("none");
resize();
updateHint();
updateCursor();
renderer.clear();
