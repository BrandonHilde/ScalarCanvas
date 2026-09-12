// Pure editing geometry helpers. No DOM, no renderer state.

function lerp(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function segPoint(seg, t) {
    if (seg.type === "line") return lerp(seg.p0, seg.p1, t);
    if (seg.type === "quad") {
        const a = lerp(seg.p0, seg.control, t);
        const b = lerp(seg.control, seg.p1, t);
        return lerp(a, b, t);
    }
    const a = lerp(seg.p0, seg.control1, t);
    const b = lerp(seg.control1, seg.control2, t);
    const c = lerp(seg.control2, seg.p1, t);
    const d = lerp(a, b, t);
    const e = lerp(b, c, t);
    return lerp(d, e, t);
}

function hitTestPoint(contours, fx, fy, tolerance) {
    let best = null;
    for (let ci = 0; ci < contours.length; ci++) {
        const points = contours[ci].points;
        for (let pi = 0; pi < points.length; pi++) {
            const p = points[pi];
            const dist = Math.hypot(p.x - fx, p.y - fy);
            if (dist <= tolerance && (!best || dist < best.dist)) {
                best = { ci, pi, point: p, dist };
            }
        }
    }
    return best;
}

function hitTestSegment(contours, fx, fy, tolerance) {
    let best = null;
    for (let ci = 0; ci < contours.length; ci++) {
        let segIndex = 0;
        for (const seg of contours[ci].segments()) {
            const steps = seg.type === "line" ? 1 : seg.type === "quad" ? 24 : 32;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const p = segPoint(seg, t);
                const dist = Math.hypot(p.x - fx, p.y - fy);
                if (dist <= tolerance && (!best || dist < best.dist)) {
                    best = { ci, seg, segIndex, t, dist };
                }
            }
            segIndex++;
        }
    }
    return best;
}

function nearestPoint(contours, fx, fy, tolerance, excludeKeys = null) {
    let best = null;
    for (let ci = 0; ci < contours.length; ci++) {
        const points = contours[ci].points;
        for (let pi = 0; pi < points.length; pi++) {
            if (excludeKeys && excludeKeys.has(`${ci}:${pi}`)) continue;
            const p = points[pi];
            const dist = Math.hypot(p.x - fx, p.y - fy);
            if (dist <= tolerance && (!best || dist < best.dist)) {
                best = { x: p.x, y: p.y, ci, pi, dist };
            }
        }
    }
    return best;
}

// Split the segment of `contour` that starts at `startPoint` at parameter t,
// inserting the appropriate on/off curve points. Returns the new point or null.
function splitSegment(contour, startPoint, t) {
    const points = contour.points;
    const n = points.length;
    let i0 = points.indexOf(startPoint);
    if (i0 === -1) return null;

    if (contour.closed) {
        contour.points = points.slice(i0).concat(points.slice(0, i0));
        i0 = 0;
    }

    const pts = contour.points;
    const count = pts.length;
    const A = pts[i0];

    const controls = [];
    let j = i0 + 1;
    while (j < count && pts[j].isOffCurve) {
        controls.push(pts[j]);
        j++;
    }
    if (j >= count && !contour.closed) return null;
    const B = pts[j % count];

    if (controls.length === 0) {
        const mid = lerp(A, B, t);
        const inserted = Point.onCurve(mid.x, mid.y);
        pts.splice(i0 + 1, 0, inserted);
        return inserted;
    }

    if (controls.length === 1) {
        const C = controls[0];
        const c1 = lerp(A, C, t);
        const c2 = lerp(C, B, t);
        const m = lerp(c1, c2, t);
        C.x = c1.x;
        C.y = c1.y;
        const mid = Point.onCurve(m.x, m.y);
        const c2p = Point.offCurve(c2.x, c2.y, CurveType.Quadratic);
        pts.splice(i0 + 2, 0, mid, c2p);
        return mid;
    }

    const C1 = controls[0];
    const C2 = controls[1];
    const p01 = lerp(A, C1, t);
    const p12 = lerp(C1, C2, t);
    const p23 = lerp(C2, B, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);

    C1.x = p01.x;
    C1.y = p01.y;
    C2.x = p23.x;
    C2.y = p23.y;

    const mid = Point.onCurve(m.x, m.y);
    const offA = Point.offCurve(p012.x, p012.y, CurveType.Cubic);
    const offB = Point.offCurve(p123.x, p123.y, CurveType.Cubic);
    pts.splice(i0 + 2, 0, offA, mid, offB);
    return mid;
}

function deletePoints(contour, indices) {
    const sorted = indices.slice().sort((a, b) => b - a);
    for (const index of sorted) {
        if (index >= 0 && index < contour.points.length) contour.points.splice(index, 1);
    }
    return contour.points.length;
}

function snapToGrid(x, y, size) {
    if (!size) return { x, y };
    return { x: Math.round(x / size) * size, y: Math.round(y / size) * size };
}

// Build a contour from pen nodes {x, y, in, out}.
function nodesToContour(nodes, closed) {
    const contour = new Contour([], closed);
    const n = nodes.length;
    const segments = closed ? n : n - 1;

    for (let k = 0; k < n; k++) {
        const A = nodes[k];
        contour.points.push(Point.onCurve(A.x, A.y));

        if (k >= segments) continue;
        const B = nodes[(k + 1) % n];
        if (A.out || B.in) {
            const c1 = A.out || { x: A.x, y: A.y };
            const c2 = B.in || { x: B.x, y: B.y };
            contour.points.push(Point.offCurve(c1.x, c1.y, CurveType.Cubic));
            contour.points.push(Point.offCurve(c2.x, c2.y, CurveType.Cubic));
        }
    }
    return contour;
}
