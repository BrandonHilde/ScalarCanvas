// Builds simple closed contours for the Add Shape menu.
//
// Every builder takes a font-unit box {x0, y0, x1, y1} (y-up, y0 < y1) and
// returns a closed Contour wound clockwise, matching the TrueType convention
// for outer contours.

function rectContour(box) {
    const { x0, y0, x1, y1 } = box;
    return new Contour([
        Point.onCurve(x0, y1),
        Point.onCurve(x1, y1),
        Point.onCurve(x1, y0),
        Point.onCurve(x0, y0),
    ], true);
}

// Four cubic arcs wound clockwise: right -> bottom -> left -> top.
function ellipseContour(box) {
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const rx = (box.x1 - box.x0) / 2;
    const ry = (box.y1 - box.y0) / 2;
    const k = 0.5522847498307936;
    const ox = rx * k;
    const oy = ry * k;
    return new Contour([
        Point.onCurve(cx + rx, cy),
        Point.offCurve(cx + rx, cy - oy, CurveType.Cubic),
        Point.offCurve(cx + ox, cy - ry, CurveType.Cubic),
        Point.onCurve(cx, cy - ry),
        Point.offCurve(cx - ox, cy - ry, CurveType.Cubic),
        Point.offCurve(cx - rx, cy - oy, CurveType.Cubic),
        Point.onCurve(cx - rx, cy),
        Point.offCurve(cx - rx, cy + oy, CurveType.Cubic),
        Point.offCurve(cx - ox, cy + ry, CurveType.Cubic),
        Point.onCurve(cx, cy + ry),
        Point.offCurve(cx + ox, cy + ry, CurveType.Cubic),
        Point.offCurve(cx + rx, cy + oy, CurveType.Cubic),
    ], true);
}

// Regular n-gon inscribed in the box. Vertices step clockwise from `startAngle`.
function polygonContour(box, sides, startAngle = Math.PI / 2) {
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const rx = (box.x1 - box.x0) / 2;
    const ry = (box.y1 - box.y0) / 2;
    const points = [];
    for (let i = 0; i < sides; i++) {
        const a = startAngle - (2 * Math.PI * i) / sides;
        points.push(Point.onCurve(cx + rx * Math.cos(a), cy + ry * Math.sin(a)));
    }
    return new Contour(points, true);
}

// Apex at top-center, base spanning the full width (fills the box).
function triangleContour(box) {
    const cx = (box.x0 + box.x1) / 2;
    return new Contour([
        Point.onCurve(cx, box.y1),
        Point.onCurve(box.x1, box.y0),
        Point.onCurve(box.x0, box.y0),
    ], true);
}

function starContour(box, points = 5, innerRatio = 0.4) {
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const rx = (box.x1 - box.x0) / 2;
    const ry = (box.y1 - box.y0) / 2;
    const verts = [];
    for (let i = 0; i < points * 2; i++) {
        const a = Math.PI / 2 - (Math.PI * i) / points;
        const r = i % 2 === 0 ? 1 : innerRatio;
        verts.push(Point.onCurve(cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)));
    }
    return new Contour(verts, true);
}

function squareBox(box) {
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const side = Math.min(box.x1 - box.x0, box.y1 - box.y0);
    const h = side / 2;
    return { x0: cx - h, y0: cy - h, x1: cx + h, y1: cy + h };
}

// Returns a Contour for `kind`, or null when the kind is unknown.
function createShapeContour(kind, box, sides = 6) {
    switch (kind) {
        case "rectangle":
            return rectContour(box);
        case "square":
            return rectContour(squareBox(box));
        case "ellipse":
            return ellipseContour(box);
        case "circle": {
            const square = squareBox(box);
            return ellipseContour(square);
        }
        case "triangle":
            return triangleContour(box);
        case "pentagon":
            return polygonContour(box, 5, Math.PI / 2);
        case "hexagon":
            return polygonContour(box, 6, Math.PI / 2);
        case "octagon":
            return polygonContour(box, 8, Math.PI / 8);
        case "star":
            return starContour(box, 5, 0.4);
        case "polygon": {
            const n = Math.max(3, Math.min(24, Math.round(sides) || 6));
            return polygonContour(box, n, Math.PI / 2);
        }
        default:
            return null;
    }
}
