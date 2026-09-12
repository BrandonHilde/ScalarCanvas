const els = {
    canvas: document.getElementById("canvas"),
    stage: document.getElementById("stage"),
    fileInput: document.getElementById("fileInput"),
    exportBtn: document.getElementById("exportBtn"),
    togglePoints: document.getElementById("togglePoints"),
    toggleFill: document.getElementById("toggleFill"),
    toggleMetrics: document.getElementById("toggleMetrics"),
    fitBtn: document.getElementById("fitBtn"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    glyphList: document.getElementById("glyphlist"),
    glyphSearch: document.getElementById("glyphSearch"),
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
};

const TOOL_HINTS = {
    node: "Node: click to select, shift-click to add, drag to move. Double-click a segment to insert a point. Arrow keys nudge; Delete removes. [ ] change glyph.",
    pen: "Pen: click to add a point, drag to pull curve handles, click the first point to close. Alt breaks the handle. Enter finishes open; Esc cancels.",
    metrics: "Metrics: drag the purple advance guide or the sidebearing guide. Edit exact values in the panel.",
};

let font = null;
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
    try {
        font = new TTFReader(arrayBuffer).parse();
    } catch (err) {
        alert("Could not read font:\n" + err.message);
        return;
    }

    renderer.doc = font;
    els.empty.style.display = "none";
    els.exportBtn.disabled = false;
    els.fitBtn.disabled = false;
    els.glyphSearch.disabled = false;
    els.previewText.disabled = false;

    editor.setDocument(font);
    history.clear();
    buildGlyphList("");
    renderer.fitToGlyph(editor.glyph);
    redraw();
    updateStatus();
    updateInspector();
    drawPreview();
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
    else if (editor.tool === "metrics") els.canvas.style.cursor = "ew-resize";
    else els.canvas.style.cursor = "default";
}

/* ── preview ────────────────────────────────────────── */

function drawPreview() {
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

editor.onChange = () => redraw();
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

/* ── event wiring ───────────────────────────────────── */

els.fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFont(reader.result);
    reader.readAsArrayBuffer(file);
});

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadFont(reader.result);
    reader.readAsArrayBuffer(file);
});

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
        alert("Export failed:\n" + err.message);
        console.error(err);
    }
});

document.querySelectorAll("header .tool").forEach((btn) => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
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
    if (e.key === "n" || e.key === "N") { setTool("node"); return; }
    if (e.key === "p" || e.key === "P") { setTool("pen"); return; }
    if (e.key === "m" || e.key === "M") { setTool("metrics"); return; }
    if (e.key === "[") { selectGlyph((editor.glyphIndex - 1 + font.numGlyphs) % font.numGlyphs); return; }
    if (e.key === "]") { selectGlyph((editor.glyphIndex + 1) % font.numGlyphs); return; }
    if (e.key === "r" || e.key === "R") { editor.reverseContours(); return; }

    editor.onKeyDown(e);
});

window.addEventListener("resize", resize);

resize();
updateHint();
renderer.clear();
