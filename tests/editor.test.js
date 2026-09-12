test("splitSegment splits a cubic at t", () => {
    const c = new Contour([
        Point.onCurve(0, 0),
        Point.offCurve(100, 200, CurveType.Cubic),
        Point.offCurve(200, 200, CurveType.Cubic),
        Point.onCurve(300, 0),
    ], true);

    const mid = splitSegment(c, c.points[0], 0.5);
    assertEqual(c.points.length, 7, "point count");
    assert(mid && mid.isOnCurve, "inserted on-curve");
    assertClose(mid.x, 150, 0.001, "mid x");
    assertClose(mid.y, 150, 0.001, "mid y");
    assertEqual(c.points[2].curve, CurveType.Cubic, "control type");
});

test("splitSegment splits a quadratic at t", () => {
    const c = new Contour([
        Point.onCurve(0, 0),
        Point.offCurve(100, 200, CurveType.Quadratic),
        Point.onCurve(200, 0),
    ], true);

    const mid = splitSegment(c, c.points[0], 0.5);
    assertEqual(c.points.length, 5, "point count");
    assertClose(mid.x, 100, 0.001, "mid x");
    assertClose(mid.y, 100, 0.001, "mid y");
});

test("splitSegment splits a line at t", () => {
    const c = new Contour([
        Point.onCurve(0, 0),
        Point.onCurve(100, 0),
    ], true);

    const mid = splitSegment(c, c.points[0], 0.5);
    assertEqual(c.points.length, 3, "point count");
    assertClose(mid.x, 50, 0.001, "mid x");
});

test("nodesToContour builds cubic segments", () => {
    const nodes = [
        { x: 0, y: 0, in: null, out: { x: 50, y: 100 } },
        { x: 100, y: 0, in: { x: 50, y: 100 }, out: null },
    ];
    const c = nodesToContour(nodes, false);
    assertEqual(c.points.length, 4, "point count");
    assert(c.points[1].isOffCurve && c.points[2].isOffCurve, "two controls");
});

test("snapToGrid rounds to the nearest cell", () => {
    const p = snapToGrid(23, 47, 10);
    assertEqual(p.x, 20, "x");
    assertEqual(p.y, 50, "y");
});

test("hitTestPoint finds the nearest point within tolerance", () => {
    const c = new Contour([Point.onCurve(10, 10), Point.onCurve(100, 100)], true);
    const hit = hitTestPoint([c], 12, 12, 5);
    assert(hit && hit.ci === 0 && hit.pi === 0, "hit first point");
    assertEqual(hitTestPoint([c], 50, 50, 2), null, "no hit out of tolerance");
});

test("pen finishes a closed contour", () => {
    const doc = buildTestDocument();
    const renderer = { view: new ViewTransform(1, 0, 0), sx: (x) => x, sy: (y) => y, ctx: null };
    const editor = new Editor(doc, renderer, new History());
    editor.setGlyphIndex(1);

    editor.setTool("pen");
    editor.penDown({ x: 0, y: 0 }, false);
    editor.penDown({ x: 100, y: 0 }, false);
    editor.penDown({ x: 100, y: 100 }, false);
    editor.finishPen(true);

    const glyph = doc.glyphs[1];
    assertEqual(glyph.contours.length, 2, "new contour added");
    assertEqual(glyph.contours[1].points.length, 3, "triangle points");
    assert(glyph.contours[1].closed, "closed");
});

test("editor nudge is undoable", () => {
    const doc = buildTestDocument();
    const renderer = { view: new ViewTransform(1, 0, 0), sx: (x) => x, sy: (y) => y, ctx: null };
    const history = new History();
    const editor = new Editor(doc, renderer, history);
    editor.setGlyphIndex(1);

    const point = doc.glyphs[1].contours[0].points[0];
    const originalX = point.x;
    editor.selection = new Set(["0:0"]);
    editor.nudgeSelection(10, 0);

    assertEqual(doc.glyphs[1].contours[0].points[0].x, originalX + 10, "nudged");
    history.undo();
    assertEqual(doc.glyphs[1].contours[0].points[0].x, originalX, "undone");
});

test("editor deletes selected points", () => {
    const doc = buildTestDocument();
    const renderer = { view: new ViewTransform(1, 0, 0), sx: (x) => x, sy: (y) => y, ctx: null };
    const editor = new Editor(doc, renderer, new History());
    editor.setGlyphIndex(1);

    editor.selection = new Set(["0:0"]);
    editor.deleteSelection();
    assertEqual(doc.glyphs[1].contours[0].points.length, 3, "point removed");
});

test("editor advance width is editable and undoable", () => {
    const doc = buildTestDocument();
    const renderer = { view: new ViewTransform(1, 0, 0), sx: (x) => x, sy: (y) => y, ctx: null };
    const history = new History();
    const editor = new Editor(doc, renderer, history);
    editor.setGlyphIndex(1);

    editor.setAdvanceWidth(900);
    assertEqual(doc.glyphs[1].advanceWidth, 900, "advance set");
    history.undo();
    assertEqual(doc.glyphs[1].advanceWidth, 600, "advance restored");
});
