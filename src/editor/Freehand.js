// Freehand stroke processing.
//
// Two outputs are supported:
//   * fitFreehandStroke  - an open (or closed) centre-line contour, for line art.
//   * fitBrushStroke     - a closed, filled outline of a variable-width brush,
//                          which is what a font glyph actually needs.
//
// Both use Philip J. Schneider's least-squares cubic fitting ("An Algorithm
// for Automatically Fitting Digitized Curves", Graphics Gems 1990): the
// sampled stroke is fitted with as few cubic segments as possible while
// staying within `tolerance` font units of every sample.

/* ── small vector helpers ─────────────────────────────── */

function fhAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function fhSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function fhScale(a, s) { return { x: a.x * s, y: a.y * s }; }
function fhDot(a, b) { return a.x * b.x + a.y * b.y; }
function fhDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function fhNormalize(v) {
    const len = Math.hypot(v.x, v.y);
    return len > 1e-12 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
}

function fhBezier(b, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, c1 = 3 * mt * mt * t, c2 = 3 * mt * t * t, d = t * t * t;
    return {
        x: a * b[0].x + c1 * b[1].x + c2 * b[2].x + d * b[3].x,
        y: a * b[0].y + c1 * b[1].y + c2 * b[2].y + d * b[3].y,
    };
}

function fhBezierPrime(b, t) {
    const mt = 1 - t;
    return {
        x: 3 * mt * mt * (b[1].x - b[0].x) + 6 * mt * t * (b[2].x - b[1].x) + 3 * t * t * (b[3].x - b[2].x),
        y: 3 * mt * mt * (b[1].y - b[0].y) + 6 * mt * t * (b[2].y - b[1].y) + 3 * t * t * (b[3].y - b[2].y),
    };
}

function fhBezierPrime2(b, t) {
    const mt = 1 - t;
    return {
        x: 6 * mt * (b[2].x - 2 * b[1].x + b[0].x) + 6 * t * (b[3].x - 2 * b[2].x + b[1].x),
        y: 6 * mt * (b[2].y - 2 * b[1].y + b[0].y) + 6 * t * (b[3].y - 2 * b[2].y + b[1].y),
    };
}

/* ── stroke clean-up ──────────────────────────────────── */

// Drop samples closer than `minDist` to their predecessor (always keeps the
// last sample so the stroke ends where the pointer was released).
function dedupeSamples(points, minDist) {
    const out = [];
    for (const p of points) {
        const last = out[out.length - 1];
        if (!last || fhDist(p, last) > minDist) out.push({ ...p });
    }
    const raw = points[points.length - 1];
    const end = out[out.length - 1];
    if (raw && end && end !== raw && fhDist(raw, end) > 1e-9) {
        if (out.length > 1 && fhDist(raw, end) <= minDist) out[out.length - 1] = { ...raw };
        else out.push({ ...raw });
    }
    return out;
}

// [1 2 1] smoothing that removes hand jitter without moving the endpoints.
function smoothSamples(points, passes = 2) {
    let pts = points;
    for (let pass = 0; pass < passes; pass++) {
        if (pts.length < 3) return pts;
        const next = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const a = pts[i - 1], b = pts[i], c = pts[i + 1];
            const s = { ...b, x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 };
            if (b.w !== undefined) s.w = (a.w + 2 * b.w + c.w) / 4;
            next.push(s);
        }
        next.push(pts[pts.length - 1]);
        pts = next;
    }
    return pts;
}

/* ── Schneider curve fitting ──────────────────────────── */

function chordLengthParameterize(points) {
    const u = [0];
    for (let i = 1; i < points.length; i++) u.push(u[i - 1] + fhDist(points[i], points[i - 1]));
    const total = u[u.length - 1] || 1;
    return u.map((v) => v / total);
}

function generateBezier(points, u, tan1, tan2) {
    const first = points[0];
    const last = points[points.length - 1];
    let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;

    for (let i = 0; i < points.length; i++) {
        const t = u[i];
        const mt = 1 - t;
        const b0 = mt * mt * mt, b1 = 3 * t * mt * mt, b2 = 3 * t * t * mt, b3 = t * t * t;
        const a0 = fhScale(tan1, b1);
        const a1 = fhScale(tan2, b2);
        c00 += fhDot(a0, a0);
        c01 += fhDot(a0, a1);
        c11 += fhDot(a1, a1);
        const tmp = fhSub(points[i], fhAdd(fhScale(first, b0 + b1), fhScale(last, b2 + b3)));
        x0 += fhDot(a0, tmp);
        x1 += fhDot(a1, tmp);
    }

    const det = c00 * c11 - c01 * c01;
    let alpha1 = Math.abs(det) > 1e-12 ? (x0 * c11 - x1 * c01) / det : 0;
    let alpha2 = Math.abs(det) > 1e-12 ? (c00 * x1 - c01 * x0) / det : 0;

    // Degenerate or wildly overshooting handles: fall back to the
    // Wu/Barsky heuristic of one third of the chord.
    const segLength = fhDist(first, last);
    const eps = 1e-6 * segLength;
    if (alpha1 < eps || alpha2 < eps || alpha1 > segLength * 2 || alpha2 > segLength * 2) {
        alpha1 = alpha2 = segLength / 3;
    }

    return [first, fhAdd(first, fhScale(tan1, alpha1)), fhAdd(last, fhScale(tan2, alpha2)), last];
}

function reparameterize(bez, points, u) {
    return u.map((t, i) => {
        const d = fhSub(fhBezier(bez, t), points[i]);
        const q1 = fhBezierPrime(bez, t);
        const q2 = fhBezierPrime2(bez, t);
        const den = fhDot(q1, q1) + fhDot(d, q2);
        if (Math.abs(den) < 1e-12) return t;
        return Math.min(1, Math.max(0, t - fhDot(d, q1) / den));
    });
}

function distToSegmentSq(p, a, b) {
    const ab = fhSub(b, a);
    const len = fhDot(ab, ab);
    const t = len > 1e-12 ? Math.min(1, Math.max(0, fhDot(fhSub(p, a), ab) / len)) : 0;
    const d = fhSub(p, fhAdd(a, fhScale(ab, t)));
    return d.x * d.x + d.y * d.y;
}

// Squared error of `bez` against the samples. Besides the samples themselves,
// the curve between consecutive parameters is checked against the polyline,
// which catches loops and bulges Newton reparameterisation can hide.
function computeMaxError(points, bez, u) {
    let maxDist = 0;
    let split = Math.floor(points.length / 2);
    const n = points.length;
    for (let i = 1; i < n - 1; i++) {
        const d = fhSub(fhBezier(bez, u[i]), points[i]);
        const dist = d.x * d.x + d.y * d.y;
        if (dist >= maxDist) {
            maxDist = dist;
            split = i;
        }
    }
    for (let i = 0; i < n - 1; i++) {
        if (u[i + 1] < u[i]) return { maxDist: Infinity, split: Math.max(1, Math.min(n - 2, i)) };
        const mid = fhBezier(bez, (u[i] + u[i + 1]) / 2);
        const dist = distToSegmentSq(mid, points[i], points[i + 1]);
        if (dist > maxDist) {
            maxDist = dist;
            split = Math.max(1, Math.min(n - 2, i === 0 ? 1 : i));
        }
    }
    return { maxDist, split };
}

function fitCubicRange(points, tan1, tan2, errSq, depth, out) {
    if (points.length === 2) {
        const d = fhDist(points[0], points[1]) / 3;
        out.push([points[0], fhAdd(points[0], fhScale(tan1, d)), fhAdd(points[1], fhScale(tan2, d)), points[1]]);
        return;
    }

    let u = chordLengthParameterize(points);
    let bez = generateBezier(points, u, tan1, tan2);
    let { maxDist, split } = computeMaxError(points, bez, u);
    if (maxDist < errSq || depth > 24) {
        out.push(bez);
        return;
    }

    if (maxDist < errSq * 16) {
        for (let iter = 0; iter < 12; iter++) {
            const uPrime = reparameterize(bez, points, u);
            bez = generateBezier(points, uPrime, tan1, tan2);
            ({ maxDist, split } = computeMaxError(points, bez, uPrime));
            if (maxDist < errSq) {
                out.push(bez);
                return;
            }
            u = uPrime;
        }
    }

    split = Math.max(1, Math.min(points.length - 2, split));
    let center = fhNormalize(fhSub(points[split - 1], points[split + 1]));
    if (center.x === 0 && center.y === 0) center = fhNormalize(fhSub(points[split - 1], points[split]));
    fitCubicRange(points.slice(0, split + 1), tan1, center, errSq, depth + 1, out);
    fitCubicRange(points.slice(split), fhScale(center, -1), tan2, errSq, depth + 1, out);
}

// Fit an ordered list of points with cubic Béziers. Returns [[p0, c1, c2, p3], ...].
function fitCubicBeziers(points, tolerance) {
    if (!points || points.length < 2) return [];
    const n = points.length;
    let tan1 = fhNormalize(fhSub(points[1], points[0]));
    let tan2 = fhNormalize(fhSub(points[n - 2], points[n - 1]));
    const out = [];
    fitCubicRange(points, tan1, tan2, tolerance * tolerance, 0, out);
    return out;
}

// Same as fitCubicBeziers but for a closed loop: the start/end tangent is
// shared so the seam is smooth.
function fitClosedBeziers(points, tolerance) {
    const n = points.length;
    if (n < 3) return [];
    const loop = points.concat([points[0]]);
    const seam = fhNormalize(fhSub(points[1], points[n - 1]));
    const out = [];
    fitCubicRange(loop, seam, fhScale(seam, -1), tolerance * tolerance, 0, out);
    return out;
}

function beziersToContour(beziers, closed) {
    if (!beziers.length) return null;
    const contour = new Contour([], closed);
    const round = (v) => Math.round(v * 100) / 100;
    contour.add(Point.onCurve(round(beziers[0][0].x), round(beziers[0][0].y)));
    beziers.forEach((b, i) => {
        contour.add(Point.offCurve(round(b[1].x), round(b[1].y), CurveType.Cubic));
        contour.add(Point.offCurve(round(b[2].x), round(b[2].y), CurveType.Cubic));
        // A closed contour's final segment returns to point 0 implicitly.
        if (!(closed && i === beziers.length - 1)) contour.add(Point.onCurve(round(b[3].x), round(b[3].y)));
    });
    return contour;
}

/* ── public API ───────────────────────────────────────── */

// Centre-line stroke. Options:
//   tolerance  max distance (font units) between the curve and the samples
//   closed     produce a closed contour (the stroke's ends are joined)
function fitFreehandStroke(points, options = {}) {
    if (!points || points.length < 2) return null;
    const tolerance = options.tolerance || 4;
    const closed = !!options.closed;

    let pts = dedupeSamples(points, tolerance * 0.25);
    pts = smoothSamples(pts, options.smoothPasses != null ? options.smoothPasses : 2);
    if (closed && pts.length > 3 && fhDist(pts[0], pts[pts.length - 1]) < tolerance * 3) pts.pop();
    if (pts.length < 2) return null;

    const beziers = closed && pts.length >= 3 ? fitClosedBeziers(pts, tolerance) : fitCubicBeziers(pts, tolerance);
    return beziersToContour(beziers, closed && pts.length >= 3);
}

// True when a stroke ends close enough to where it started to be closed.
function strokeLooksClosed(points, threshold) {
    if (!points || points.length < 8) return false;
    const first = points[0];
    const last = points[points.length - 1];
    if (fhDist(first, last) > threshold) return false;
    let length = 0;
    for (let i = 1; i < points.length; i++) length += fhDist(points[i], points[i - 1]);
    return length > threshold * 4;
}

// Polygon (array of {x, y}) outlining a variable-width brush stroke with round
// caps. Each input sample carries a width `w` in font units. The polygon is
// returned clockwise (TrueType outer-contour direction).
function brushOutlinePolygon(points, tolerance = 2) {
    let pts = dedupeSamples(points, Math.max(0.5, tolerance * 0.5));
    pts = smoothSamples(pts, 2);
    if (pts.length === 0) return [];

    const maxW = Math.max(...pts.map((p) => p.w));
    // Enough cap vertices that the fitted curve cannot bulge between them.
    const capSteps = Math.max(6, Math.min(48, Math.ceil((Math.PI * maxW) / 2 / Math.max(0.5, tolerance * 1.5))));
    const ring = (c, r) => {
        const out = [];
        for (let i = 0; i < capSteps * 2; i++) {
            const a = -(Math.PI * 2 * i) / (capSteps * 2);
            out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
        }
        return out;
    };

    const n = pts.length;
    let length = 0;
    for (let i = 1; i < n; i++) length += fhDist(pts[i], pts[i - 1]);
    if (n < 2 || length < maxW * 0.25) return ring(pts[0], Math.max(0.5, maxW / 2));

    const left = [];
    const right = [];
    const tangents = [];
    for (let i = 0; i < n; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(n - 1, i + 1)];
        let t = fhNormalize(fhSub(next, prev));
        if (t.x === 0 && t.y === 0) t = tangents[i - 1] || { x: 1, y: 0 };
        tangents.push(t);
        const r = Math.max(0.5, pts[i].w / 2);
        const nrm = { x: -t.y, y: t.x };
        left.push(fhAdd(pts[i], fhScale(nrm, r)));
        right.push(fhSub(pts[i], fhScale(nrm, r)));
    }

    const cap = (center, tangent, r, from) => {
        const base = Math.atan2(tangent.y, tangent.x);
        const out = [];
        for (let s = 1; s < capSteps; s++) {
            const a = base + from - (Math.PI * s) / capSteps;
            out.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
        }
        return out;
    };

    const endR = Math.max(0.5, pts[n - 1].w / 2);
    const startR = Math.max(0.5, pts[0].w / 2);
    const poly = [
        ...left,
        ...cap(pts[n - 1], tangents[n - 1], endR, Math.PI / 2),
        ...right.reverse(),
        ...cap(pts[0], tangents[0], startR, -Math.PI / 2),
    ];

    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        area += a.x * b.y - b.x * a.y;
    }
    if (area > 0) poly.reverse();
    return densifyPolygon(poly, Math.max(0.5, tolerance * 1.5));
}

// Insert points so no polygon edge is longer than `maxGap`. The curve fitter
// only checks its error at the samples, so long edges would let it overshoot.
function densifyPolygon(poly, maxGap) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        out.push(a);
        const steps = Math.min(64, Math.floor(fhDist(a, b) / maxGap));
        for (let s = 1; s <= steps; s++) out.push(lerp(a, b, s / (steps + 1)));
    }
    return out;
}

// Closed, clockwise contour for a brush stroke. Samples: [{x, y, w}].
function fitBrushStroke(points, options = {}) {
    if (!points || points.length === 0) return null;
    const tolerance = options.tolerance || 2;
    const poly = brushOutlinePolygon(points, tolerance);
    if (poly.length < 3) return null;
    const contour = beziersToContour(fitClosedBeziers(poly, tolerance), true);
    if (contour && !contour.isClockwise()) contour.reverse();
    return contour;
}
