function makeEditor(doc, scale = 1) {
    const renderer = { view: new ViewTransform(scale, 0, 0), sx: (x) => x, sy: (y) => y, ctx: null };
    const history = new History();
    return { editor: new Editor(doc, renderer, history), history };
}

function sampleArc(n = 60, radius = 300) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (Math.PI * i) / n;
        pts.push({ x: 500 + radius * Math.cos(a), y: 200 + radius * Math.sin(a) });
    }
    return pts;
}

function distanceToContour(contour, p) {
    let best = Infinity;
    for (const q of contour.flatten(1000)) best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y));
    return best;
}

test("fitFreehandStroke fits a smooth arc with few segments", () => {
    const pts = sampleArc();
    const contour = fitFreehandStroke(pts, { tolerance: 2, smoothPasses: 0 });
    assert(contour, "contour produced");
    assert(!contour.closed, "open");
    const onCurve = contour.points.filter((p) => p.isOnCurve).length;
    assert(onCurve <= 6, `few on-curve points (got ${onCurve})`);
    for (const p of pts) assert(distanceToContour(contour, p) < 3, "curve stays near samples");
    assertClose(contour.points[0].x, pts[0].x, 0.01, "starts at first sample");
    const last = contour.points[contour.points.length - 1];
    assertClose(last.x, pts[pts.length - 1].x, 0.01, "ends at last sample");
});

test("fitFreehandStroke closes a loop when asked", () => {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
        const a = (2 * Math.PI * i) / 80;
        pts.push({ x: 200 * Math.cos(a), y: 200 * Math.sin(a) });
    }
    assert(strokeLooksClosed(pts, 20), "detected as closed");
    const contour = fitFreehandStroke(pts, { tolerance: 2, closed: true });
    assert(contour.closed, "closed");
    assert(contour.points[contour.points.length - 1].isOffCurve, "seam segment returns to start implicitly");
});

test("fitBrushStroke builds a clockwise outline around the stroke", () => {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push({ x: i * 10, y: 0, w: 60 });
    const contour = fitBrushStroke(pts, { tolerance: 1 });
    assert(contour && contour.closed, "closed outline");
    assert(contour.isClockwise(), "clockwise (TrueType outer)");
    // Measure the drawn outline (getBoundingBox also counts control points).
    const box = boxFromPoints(contour.flatten(200));
    assertClose(box.yMax, 30, 2, "half width above");
    assertClose(box.yMin, -30, 2, "half width below");
    assertClose(box.xMin, -30, 2, "round start cap");
    assertClose(box.xMax, 430, 2, "round end cap");
    assert(contour.containsPoint(200, 0), "centre line is inside");
});

test("fitBrushStroke turns a tap into a dot", () => {
    const contour = fitBrushStroke([{ x: 100, y: 100, w: 40 }], { tolerance: 1 });
    assert(contour && contour.closed, "dot outline");
    const box = boxFromPoints(contour.flatten(200));
    assertClose(box.width, 40, 2, "dot diameter");
});

test("brush freehand in the editor adds a closed contour (undoable)", () => {
    const doc = buildTestDocument();
    const { editor, history } = makeEditor(doc);
    editor.setGlyphIndex(1);
    editor.freehandMode = "brush";
    editor.brushSize = 50;
    const before = doc.glyphs[1].contours.length;

    editor.freehandDown({ x: 0, y: 0 });
    for (let i = 1; i <= 30; i++) editor.freehandMove({ x: i * 10, y: Math.sin(i / 5) * 40 });
    editor.finishFreehand();

    assertEqual(doc.glyphs[1].contours.length, before + 1, "contour added");
    assert(doc.glyphs[1].contours[before].closed, "brush outline is closed");
    history.undo();
    assertEqual(doc.glyphs[1].contours.length, before, "undone");
});

test("pen pressure scales brush width only for pens", () => {
    const { editor } = makeEditor(buildTestDocument());
    assertEqual(editor.pressureOf({ pointerType: "mouse", pressure: 0.5 }), 1, "mouse ignores pressure");
    assert(editor.pressureOf({ pointerType: "pen", pressure: 0.2 }) < 0.5, "light pen is thin");
    editor.usePressure = false;
    assertEqual(editor.pressureOf({ pointerType: "pen", pressure: 0.2 }), 1, "pressure can be disabled");
});

test("copy / paste moves contours between glyphs", () => {
    const doc = buildTestDocument();
    const { editor, history } = makeEditor(doc);
    editor.setGlyphIndex(2); // "O": two contours
    assertEqual(editor.copySelection(), 2, "copies all contours when nothing is selected");

    editor.setGlyphIndex(1);
    const before = doc.glyphs[1].contours.length;
    assertEqual(editor.paste(), 2, "pasted");
    assertEqual(doc.glyphs[1].contours.length, before + 2, "contours added");
    assert(editor.selection.size > 0, "pasted points selected");
    history.undo();
    assertEqual(doc.glyphs[1].contours.length, before, "paste undone");
});

test("cut removes only the selected contours", () => {
    const doc = buildTestDocument();
    const { editor } = makeEditor(doc);
    editor.setGlyphIndex(2);
    editor.selection = new Set(["1:0"]);
    assertEqual(editor.cutSelection(), 1, "cut one contour");
    assertEqual(doc.glyphs[2].contours.length, 1, "one left");
    assertEqual(editor.clipboard.length, 1, "clipboard holds it");
});

test("canvas strokes carry their own paint and restyle undoably", () => {
    const doc = new CanvasDocument(500, 500);
    const { editor, history } = makeEditor(doc);
    editor.paint = { stroke: "#ff0000", fill: "#00ff00", width: 4 };
    editor.freehandMode = "line";
    editor.freehandDown({ x: 10, y: 10 });
    for (let i = 1; i <= 20; i++) editor.freehandMove({ x: 10 + i * 10, y: 10 + i * 3 });
    editor.finishFreehand();

    const contour = doc.artboard.contours[0];
    assertEqual(contour.style.stroke, "#ff0000", "stroke stamped");
    assertEqual(contour.style.fill, null, "line strokes are unfilled");

    editor.selectAll();
    editor.applyStyleToSelection({ stroke: "#0000ff" });
    assertEqual(doc.artboard.contours[0].style.stroke, "#0000ff", "restyled");
    history.undo();
    assertEqual(doc.artboard.contours[0].style.stroke, "#ff0000", "restyle undone");
});

test("SVG export never fills open paths and keeps per-contour colours", () => {
    const glyph = new Glyph("artboard");
    const open = new Contour([Point.onCurve(0, 0), Point.onCurve(100, 100)], false);
    open.style = { stroke: "#123456", fill: null, width: 3 };
    const closed = new Contour([Point.onCurve(0, 0), Point.onCurve(50, 0), Point.onCurve(50, 50)], true);
    closed.style = { stroke: null, fill: "#abcdef", width: 0 };
    glyph.contours.push(open, closed);

    const svg = glyphToSVG(glyph, { width: 200, height: 200 });
    const paths = svg.match(/<path [^>]+>/g);
    assertEqual(paths.length, 2, "one path per contour");
    assert(paths[0].includes('fill="none"') && paths[0].includes('stroke="#123456"'), "open path stroked, unfilled");
    assert(paths[1].includes('fill="#abcdef"') && paths[1].includes('stroke="none"'), "brush path filled, unstroked");
});

test("font projects round-trip through JSON", () => {
    const doc = buildTestDocument();
    doc.metrics.xHeight = 512;
    const copy = FontDocument.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
    assertEqual(copy.numGlyphs, doc.numGlyphs, "glyph count");
    assertEqual(copy.familyName, doc.familyName, "family");
    assertEqual(copy.metrics.xHeight, 512, "metrics");
    const o = copy.glyphs[2];
    assertEqual(o.contours.length, 2, "contours");
    assertEqual(o.unicodes[0], 0x4f, "unicode");
    const composite = copy.glyphs.find((g) => g.isComposite);
    if (composite) assert(composite.components[0].transform instanceof AffineTransform, "component transform");
});

test("canvas projects round-trip with stroke styles", () => {
    const doc = new CanvasDocument(640, 480);
    const c = new Contour([Point.onCurve(0, 0), Point.onCurve(10, 10)], false);
    c.style = { stroke: "#ff00ff", fill: null, width: 2 };
    doc.artboard.contours.push(c);
    const copy = CanvasDocument.fromJSON(JSON.parse(JSON.stringify(doc.toJSON())));
    assertEqual(copy.width, 640, "width");
    assertEqual(copy.height, 480, "height");
    assertEqual(copy.artboard.contours[0].style.stroke, "#ff00ff", "style kept");
    assert(!copy.artboard.contours[0].closed, "open kept");
});
