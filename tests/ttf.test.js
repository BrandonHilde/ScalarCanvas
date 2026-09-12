test("writer emits all required tables", () => {
    const doc = buildTestDocument();
    const buffer = new TTFWriter(doc).write();
    const tags = tableTags(buffer);
    for (const required of ["head", "maxp", "hhea", "hmtx", "cmap", "loca", "glyf", "name", "OS/2", "post"]) {
        assert(tags.includes(required), `missing table ${required}`);
    }
});

test("font checksum is valid (0xB1B0AFBA)", () => {
    const doc = buildTestDocument();
    const buffer = new TTFWriter(doc).write();
    assertEqual(fontChecksum(new Uint8Array(buffer)), 0xb1b0afba, "checksum");
});

test("round-trip preserves glyph count, advances and cmap", () => {
    const doc = buildTestDocument();
    const buffer = new TTFWriter(doc).write();
    const parsed = new TTFReader(buffer).parse();

    assertEqual(parsed.numGlyphs, doc.numGlyphs, "numGlyphs");
    assertEqual(parsed.unitsPerEm, 1000, "unitsPerEm");
    assertEqual(parsed.glyphs[1].advanceWidth, 600, "A advance");
    assertEqual(parsed.glyphs[2].advanceWidth, 700, "O advance");
    assert(parsed.getGlyphByCodepoint(0x41), "cmap has A");
    assert(parsed.getGlyphByCodepoint(0x4f), "cmap has O");
    assert(parsed.getGlyphByCodepoint(0xc1), "cmap has Aacute");
});

test("quadratic off-curve points are preserved", () => {
    const doc = buildTestDocument();
    const parsed = new TTFReader(new TTFWriter(doc).write()).parse();
    const q = parsed.glyphs[5];
    const offCurve = q.contours[0].points.filter((p) => p.isOffCurve);
    assert(offCurve.length >= 1, "has off-curve point");
    assertEqual(offCurve[0].curve, CurveType.Quadratic, "curve type");
});

test("cubic outlines survive as approximated quadratics", () => {
    const doc = buildTestDocument();
    const parsed = new TTFReader(new TTFWriter(doc).write()).parse();
    const c = parsed.glyphs[4];
    assert(c.contours[0].points.length > 4, "cubic expanded to multiple points");
    for (const p of c.contours[0].points) {
        if (p.isOffCurve) assertEqual(p.curve, CurveType.Quadratic, "approximated as quadratic");
    }
});

test("composite glyphs keep their components", () => {
    const doc = buildTestDocument();
    const parsed = new TTFReader(new TTFWriter(doc).write()).parse();
    const acc = parsed.glyphs[3];
    assert(acc.isComposite, "is composite");
    assertEqual(acc.components.length, 2, "component count");
    assertEqual(acc.components[0].glyphIndex, 1, "base glyph index");
    assertClose(acc.components[1].transform.a, 0.5, 0.001, "component scale");
    assertClose(acc.components[1].transform.e, 100, 0.5, "component offset x");
    assertClose(acc.components[1].transform.f, 700, 0.5, "component offset y");
});

test("contour direction is normalized for holes", () => {
    const doc = buildTestDocument();
    const parsed = new TTFReader(new TTFWriter(doc).write()).parse();
    const o = parsed.glyphs[2];
    assert(o.contours[0].signedArea() < 0, "outer contour clockwise");
    assert(o.contours[1].signedArea() > 0, "inner contour counter-clockwise");
});

test("repeated coordinate flags decode correctly", () => {
    const doc = new FontDocument();
    doc.unitsPerEm = 1000;
    doc.setName(1, "Repeat");
    doc.addGlyph(new Glyph(".notdef"));

    const glyph = new Glyph("repeat");
    glyph.advanceWidth = 2000;
    glyph.unicodes = [0x72];
    const points = [];
    for (let i = 0; i < 20; i++) points.push(Point.onCurve(i * 100, 0));
    for (let i = 0; i < 20; i++) points.push(Point.onCurve(1900 - i * 100, 500));
    glyph.addContour(points);
    doc.addGlyph(glyph);

    const parsed = new TTFReader(new TTFWriter(doc).write()).parse();
    const got = parsed.glyphs[1].contours[0].points.map((p) => [p.x, p.y]);
    const want = points.map((p) => [p.x, p.y]);
    assertEqual(JSON.stringify(got), JSON.stringify(want), "repeated-flag points");
});

test("renderer starts one subpath per contour", () => {
    const doc = buildTestDocument();
    const glyph = doc.glyphs[2]; // O: two contours

    const ops = [];
    const fakeCanvas = { width: 400, height: 400, style: {} };
    const ctx = new Proxy({}, {
        get(target, prop) {
            if (prop === "canvas") return fakeCanvas;
            return () => { ops.push(prop); };
        },
        set() { return true; },
    });
    fakeCanvas.getContext = () => ctx;

    const renderer = new CanvasRenderer(fakeCanvas, doc, new ViewTransform(0.5, 200, 200));
    const contours = glyph.getOutlineContours((i) => doc.resolveGlyph(i));
    renderer.pathContours(contours);

    const moveTos = ops.filter((op) => op === "moveTo").length;
    assertEqual(moveTos, contours.length, "moveTo calls");
});

test("renderer preserves holes (non-zero winding)", () => {
    const doc = buildTestDocument();
    const glyph = doc.glyphs[2]; // O with a hole
    glyph.correctDirection();

    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const renderer = new CanvasRenderer(canvas, doc, new ViewTransform(0.5, 200, 200));
    renderer.showPoints = false;
    renderer.showMetrics = false;
    renderer.render(glyph);

    const ctx = canvas.getContext("2d");
    const brightness = (fx, fy) => {
        const d = ctx.getImageData(Math.round(renderer.sx(fx)), Math.round(renderer.sy(fy)), 1, 1).data;
        return d[0] + d[1] + d[2];
    };

    const ring = brightness(100, 350);
    const hole = brightness(350, 350);
    assert(ring > hole + 100, `ring (${ring}) should be filled, hole (${hole}) empty`);
});

test("second-generation round-trip is stable", () => {
    const doc = buildTestDocument();
    const gen1 = new TTFReader(new TTFWriter(doc).write()).parse();
    const gen2 = new TTFReader(new TTFWriter(gen1).write()).parse();
    assertEqual(gen2.numGlyphs, gen1.numGlyphs, "numGlyphs");
    assertEqual(gen2.glyphs[3].components.length, 2, "composites stable");
    assertEqual(gen2.glyphs[5].contours[0].points.length, gen1.glyphs[5].contours[0].points.length, "points stable");
});

test("browser FontFace accepts the generated TTF", async () => {
    const doc = buildTestDocument();
    const buffer = new TTFWriter(doc).write();
    const face = new FontFace("ScalarCanvasTest", buffer);
    await face.load();
    assertEqual(face.status, "loaded", "FontFace status");
    document.fonts.add(face);

    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.font = "90px ScalarCanvasTest";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("AO", 10, 95);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    assert(painted > 200, `expected rendered pixels, got ${painted}`);
    document.fonts.delete(face);
});

test("real dropped font round-trips (if provided)", async () => {
    if (!window.__realFontBuffer) return;
    const original = new TTFReader(window.__realFontBuffer).parse();
    const reparsed = new TTFReader(new TTFWriter(original).write()).parse();
    assertEqual(reparsed.numGlyphs, original.numGlyphs, "numGlyphs");
});
