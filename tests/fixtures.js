function buildTestDocument() {
    const doc = new FontDocument();
    doc.unitsPerEm = 1000;
    doc.setName(1, "ScalarTest");
    doc.setName(2, "Regular");
    doc.setName(4, "ScalarTest Regular");
    doc.setName(6, "ScalarTest-Regular");

    doc.addGlyph(new Glyph(".notdef"));

    const a = new Glyph("A");
    a.advanceWidth = 600;
    a.leftSideBearing = 50;
    a.unicodes = [0x41];
    a.addContour([
        Point.onCurve(50, 0),
        Point.onCurve(550, 0),
        Point.onCurve(550, 700),
        Point.onCurve(50, 700),
    ]);
    doc.addGlyph(a);

    const o = new Glyph("O");
    o.advanceWidth = 700;
    o.unicodes = [0x4f];
    o.addContour([
        Point.onCurve(50, 0),
        Point.onCurve(650, 0),
        Point.onCurve(650, 700),
        Point.onCurve(50, 700),
    ]);
    o.addContour([
        Point.onCurve(200, 150),
        Point.onCurve(500, 150),
        Point.onCurve(500, 550),
        Point.onCurve(200, 550),
    ]);
    doc.addGlyph(o);

    const acc = new Glyph("Aacute");
    acc.advanceWidth = 600;
    acc.unicodes = [0xc1];
    acc.components.push(new GlyphComponent(1, new AffineTransform(1, 0, 0, 1, 0, 0)));
    acc.components.push(new GlyphComponent(1, new AffineTransform(0.5, 0, 0, 0.5, 100, 700)));
    doc.addGlyph(acc);

    const curve = new Glyph("c");
    curve.advanceWidth = 500;
    curve.unicodes = [0x63];
    curve.addContour([
        Point.onCurve(50, 0),
        Point.offCurve(250, 100, CurveType.Cubic),
        Point.offCurve(350, 600, CurveType.Cubic),
        Point.onCurve(450, 700),
    ]);
    doc.addGlyph(curve);

    const quad = new Glyph("q");
    quad.advanceWidth = 520;
    quad.unicodes = [0x71];
    quad.addContour([
        Point.onCurve(50, 0),
        Point.offCurve(300, 50, CurveType.Quadratic),
        Point.onCurve(550, 0),
        Point.onCurve(300, 700),
    ]);
    doc.addGlyph(quad);

    return doc;
}

function fontChecksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 4) {
        const b0 = bytes[i] || 0;
        const b1 = bytes[i + 1] || 0;
        const b2 = bytes[i + 2] || 0;
        const b3 = bytes[i + 3] || 0;
        sum = (sum + (((b0 << 24) >>> 0) + (b1 << 16) + (b2 << 8) + b3)) >>> 0;
    }
    return sum >>> 0;
}

function tableTags(buffer) {
    const view = new DataView(buffer);
    const numTables = view.getUint16(4, false);
    const tags = [];
    for (let i = 0; i < numTables; i++) {
        let tag = "";
        for (let j = 0; j < 4; j++) tag += String.fromCharCode(view.getUint8(12 + i * 16 + j));
        tags.push(tag);
    }
    return tags;
}
