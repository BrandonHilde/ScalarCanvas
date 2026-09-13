// Fits a smooth cubic-Bezier contour to a freehand stroke.
//
// Each segment's control points are derived from the sampled stroke using the
// same 1/4 and 3/4 heuristic as the original prototype's draw mode: take the
// points a quarter and three quarters along the sampled chunk, then reflect
// them across the 25%/75% points of the chord. This makes the curve pass near
// the hand-drawn path while keeping handles smooth and tangential.

function fitFreehandStroke(points, options = {}) {
    const segmentLength = options.segmentLength || 40;
    const closed = !!options.closed;

    if (!points || points.length < 2) return null;

    const pts = [];
    for (const p of points) {
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > segmentLength * 0.12) {
            pts.push({ x: p.x, y: p.y });
        }
    }
    const rawLast = points[points.length - 1];
    const end = pts[pts.length - 1];
    if (!end || Math.hypot(rawLast.x - end.x, rawLast.y - end.y) > 1e-6) {
        pts.push({ x: rawLast.x, y: rawLast.y });
    }
    if (pts.length < 2) return null;

    const contour = new Contour([], closed);
    contour.add(Point.onCurve(pts[0].x, pts[0].y));

    let startIndex = 0;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const isLast = i === pts.length - 1;
        if (acc < segmentLength && !isLast) continue;

        const chunk = pts.slice(startIndex, i + 1);
        const a = pts[startIndex];
        const b = pts[i];

        const q1 = chunk[Math.floor(chunk.length / 4)] || a;
        const q3 = chunk[Math.floor((chunk.length * 3) / 4)] || b;

        const p25 = lerp(a, b, 0.25);
        const p75 = lerp(a, b, 0.75);

        const c1 = { x: 2 * q1.x - p25.x, y: 2 * q1.y - p25.y };
        const c2 = { x: 2 * q3.x - p75.x, y: 2 * q3.y - p75.y };

        contour.points.push(Point.offCurve(c1.x, c1.y, CurveType.Cubic));
        contour.points.push(Point.offCurve(c2.x, c2.y, CurveType.Cubic));
        contour.points.push(Point.onCurve(b.x, b.y));

        startIndex = i;
        acc = 0;
    }

    if (closed && contour.points.length > 2) {
        const lastPoint = contour.points[contour.points.length - 1];
        const firstPoint = contour.points[0];
        if (Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y) <= segmentLength * 0.5) {
            contour.points.pop();
        }
    }

    return contour.points.length >= 2 ? contour : null;
}
