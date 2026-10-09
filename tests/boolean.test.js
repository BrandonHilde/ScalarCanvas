function square(x0, y0, x1, y1) {
    return rectContour({ x0, y0, x1, y1 });
}

function totalArea(contours) {
    // Clockwise (outer) contours have negative signed area in Y-up space.
    return contours.reduce((sum, c) => sum - c.signedArea(), 0);
}

// Non-zero fill test against a set of contours.
function filledAt(contours, x, y) {
    let w = 0;
    for (const c of contours) {
        const poly = c.flatten(64);
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if ((a.y <= y) !== (b.y <= y)) {
                const xi = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
                if (xi > x) w += b.y > a.y ? 1 : -1;
            }
        }
    }
    return w !== 0;
}

// Compare the filled region of two contour sets on a grid of sample points,
// skipping points too close to either outline to call.
function assertSameFill(expected, actual, box, step, message) {
    const near = (contours, x, y) => contours.some((c) => c.flatten(64).some((p) => Math.hypot(p.x - x, p.y - y) < step * 0.75));
    let checked = 0;
    for (let y = box.y0 + step / 2; y < box.y1; y += step) {
        for (let x = box.x0 + step / 2; x < box.x1; x += step) {
            if (near(expected, x, y) || near(actual, x, y)) continue;
            checked++;
            if (filledAt(expected, x, y) !== filledAt(actual, x, y)) {
                throw new Error(`${message}: fill differs at (${x}, ${y})`);
            }
        }
    }
    assert(checked > 20, `${message}: enough sample points`);
}

function onCurveCount(c) {
    return c.points.filter((p) => p.isOnCurve).length;
}

test("boolean union of overlapping squares", () => {
    const { contours } = booleanContours([square(0, 0, 100, 100)], [square(50, 50, 150, 150)], "union");
    assertEqual(contours.length, 1, "one outline");
    assertEqual(contours[0].points.length, 8, "eight corners");
    assertClose(totalArea(contours), 17500, 0.5, "area");
    assert(contours[0].isClockwise(), "outer contour clockwise");
});

test("boolean intersect, subtract and exclude of squares", () => {
    const a = [square(0, 0, 100, 100)];
    const b = [square(50, 50, 150, 150)];

    const inter = booleanContours(a, b, "intersect").contours;
    assertEqual(inter.length, 1, "intersect: one");
    assertClose(totalArea(inter), 2500, 0.5, "intersect area");

    const sub = booleanContours(a, b, "subtract").contours;
    assertEqual(sub.length, 1, "subtract: one");
    assertEqual(sub[0].points.length, 6, "subtract: L shape");
    assertClose(totalArea(sub), 7500, 0.5, "subtract area");

    const xor = booleanContours(a, b, "exclude").contours;
    assertEqual(xor.length, 2, "exclude: two L shapes touching at corners");
    assertClose(totalArea(xor), 15000, 0.5, "exclude area");
});

test("boolean union merges shared edges without leftover points", () => {
    const { contours } = booleanContours([square(0, 0, 100, 100)], [square(100, 0, 200, 100)], "union");
    assertEqual(contours.length, 1, "one outline");
    assertEqual(contours[0].points.length, 4, "a plain rectangle");
    assertClose(totalArea(contours), 20000, 0.5, "area");
});

test("boolean subtract cuts a hole", () => {
    const { contours } = booleanContours([square(0, 0, 300, 300)], [square(100, 100, 200, 200)], "subtract");
    assertEqual(contours.length, 2, "outer + hole");
    const outer = contours.find((c) => c.isClockwise());
    const hole = contours.find((c) => !c.isClockwise());
    assert(outer && hole, "hole wound counter-clockwise");
    assertClose(totalArea(contours), 80000, 0.5, "area");
});

test("boolean keeps original curves exactly where untouched", () => {
    const a = ellipseContour({ x0: 0, y0: 0, x1: 200, y1: 200 });
    const b = ellipseContour({ x0: 150, y0: 0, x1: 350, y1: 200 });
    const { contours } = booleanContours([a], [b], "union");
    assertEqual(contours.length, 1, "one outline");
    const c = contours[0];
    assert(c.points.some((p) => p.isOffCurve && p.curve === CurveType.Cubic), "still cubic");
    assert(onCurveCount(c) <= 8, `few on-curve points (got ${onCurveCount(c)})`);
    // The leftmost extreme of circle A must survive untouched.
    assert(c.points.some((p) => p.isOnCurve && Math.abs(p.x) < 1e-6 && Math.abs(p.y - 100) < 1e-6), "original extreme kept");
    assertSameFill([a, b], contours, { x0: -10, y0: -10, x1: 360, y1: 210 }, 9, "union of circles");
});

test("boolean handles quadratic TrueType outlines", () => {
    const quad = new Contour([
        Point.onCurve(0, 0),
        Point.offCurve(100, 200, CurveType.Quadratic),
        Point.onCurve(200, 0),
    ], true);
    const { contours } = booleanContours([quad], [square(80, -50, 120, 300)], "subtract");
    assertEqual(contours.length, 2, "split in two");
    assert(contours.every((c) => c.points.some((p) => p.curve === CurveType.Quadratic)), "quadratic kept");
});

test("remove overlap leaves clean glyphs untouched", () => {
    const outer = square(0, 0, 300, 300);
    const inner = square(100, 100, 200, 200).reverse();
    const { contours, changed } = removeOverlap([outer, inner]);
    assert(!changed, "nothing to do");
    assertEqual(contours.length, 2, "same contours");
    assertEqual(contours[0].points[0].x, outer.points[0].x, "same points");
});

test("remove overlap merges overlapping brush strokes", () => {
    const strokes = [];
    const line = (x0, y0, x1, y1) => {
        const pts = [];
        for (let i = 0; i <= 30; i++) pts.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30, w: 70 });
        return fitBrushStroke(pts, { tolerance: 1 });
    };
    strokes.push(line(60, 0, 300, 700), line(300, 700, 540, 0), line(150, 250, 450, 250));
    const { contours, changed } = removeOverlap(strokes);
    assert(changed, "changed");
    assertEqual(contours.length, 2, "A outline + counter");
    assertSameFill(strokes, contours, { x0: 0, y0: -50, x1: 600, y1: 760 }, 12, "brush A");
});

test("remove overlap fixes a self-intersecting contour", () => {
    // Figure-eight: one contour crossing itself.
    const eight = new Contour([
        Point.onCurve(0, 0), Point.onCurve(200, 200), Point.onCurve(200, 0), Point.onCurve(0, 200),
    ], true);
    const { contours } = removeOverlap([eight]);
    assertEqual(contours.length, 2, "two triangles");
    assert(contours.every((c) => c.isClockwise()), "both clockwise");
    assertClose(totalArea(contours), 20000, 0.5, "area of both lobes");
});

test("boolean of disjoint shapes", () => {
    const a = [square(0, 0, 100, 100)];
    const b = [square(200, 0, 300, 100)];
    assertEqual(booleanContours(a, b, "union").contours.length, 2, "union keeps both");
    assertEqual(booleanContours(a, b, "intersect").contours.length, 0, "intersect is empty");
    assertEqual(booleanContours(a, b, "subtract").contours.length, 1, "subtract keeps A");
});

test("editor path operations use the last-drawn contour as cutter and undo", () => {
    const doc = new CanvasDocument(500, 500);
    const { editor, history } = makeEditor(doc);
    const base = square(0, 0, 200, 200);
    base.style = { stroke: "#111111", fill: "#ff0000", width: 2 };
    const cutter = square(100, 100, 300, 300);
    cutter.style = { stroke: "#222222", fill: "#00ff00", width: 2 };
    doc.artboard.contours.push(base, cutter);

    editor.selectAll();
    assert(editor.pathOperation("subtract"), "message returned");
    const out = doc.artboard.contours;
    assertEqual(out.length, 1, "one result");
    assertClose(totalArea(out), 30000, 0.5, "base minus cutter");
    assertEqual(out[0].style.fill, "#ff0000", "keeps the bottom operand's paint");
    assert(editor.selection.size > 0, "result selected");

    history.undo();
    assertEqual(doc.artboard.contours.length, 2, "undo restores both");
    assertEqual(editor.pathOperation("union"), "Select at least two closed contours", "needs a selection of two");
});
