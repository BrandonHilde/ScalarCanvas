// Boolean operations on closed contours: union, subtract, intersect, exclude
// and remove overlap. Plain JS, no dependencies.
//
// Method:
//   1. Flatten every curve segment to short edges on an integer grid
//      (1/BOOL_SCALE font unit), tagging each edge with its source segment
//      and parameter range.
//   2. Split all edges at their mutual intersections (including T-junctions
//      and collinear overlaps), then merge coincident edges.
//   3. For every edge, compute the non-zero winding number of each operand
//      on both of its sides and keep the edge only where the result's
//      inside/outside changes. Kept edges are directed with the filled
//      region on their right, so outer contours come out clockwise and holes
//      counter-clockwise (the TrueType convention).
//   4. Link kept edges into loops.
//   5. Rebuild curves: consecutive edges that came from the same source
//      segment are replaced by the exact sub-curve of that segment, so
//      untouched outlines keep their original points and only the new
//      junctions are approximated (to well under a font unit).

const BOOL_SCALE = 256;

const BOOL_OPS = {
    union: (a, b) => a || b,
    intersect: (a, b) => a && b,
    subtract: (a, b) => a && !b,
    exclude: (a, b) => a !== b,
};

/* ── Bézier helpers (any degree) ─────────────────────── */

function boolBezierPoint(pts, t) {
    let p = pts.map((q) => ({ x: q.x, y: q.y }));
    while (p.length > 1) {
        const next = [];
        for (let i = 0; i < p.length - 1; i++) {
            next.push({ x: p[i].x + (p[i + 1].x - p[i].x) * t, y: p[i].y + (p[i + 1].y - p[i].y) * t });
        }
        p = next;
    }
    return p[0];
}

function boolSplitBezier(pts, t) {
    const left = [];
    const right = [];
    let p = pts.map((q) => ({ x: q.x, y: q.y }));
    while (p.length) {
        left.push(p[0]);
        right.unshift(p[p.length - 1]);
        const next = [];
        for (let i = 0; i < p.length - 1; i++) {
            next.push({ x: p[i].x + (p[i + 1].x - p[i].x) * t, y: p[i].y + (p[i + 1].y - p[i].y) * t });
        }
        p = next;
    }
    return [left, right];
}

// Control points of the part of a Bézier between t0 and t1 (reversed when t0 > t1).
function boolBezierSlice(pts, t0, t1) {
    if (t0 > t1) return boolBezierSlice(pts, t1, t0).reverse();
    const right = t0 > 0 ? boolSplitBezier(pts, t0)[1] : pts.map((q) => ({ x: q.x, y: q.y }));
    const t = t0 < 1 ? (t1 - t0) / (1 - t0) : 1;
    return t < 1 ? boolSplitBezier(right, t)[0] : right;
}

/* ── 1. flatten ──────────────────────────────────────── */

function boolFlatten(contours, operand, sources, edges) {
    for (const contour of contours) {
        const contourId = {};
        if (!contour.closed || contour.points.length < 2) continue;
        for (const seg of contour.segments()) {
            const pts = seg.type === "line"
                ? [seg.p0, seg.p1]
                : seg.type === "quad"
                    ? [seg.p0, seg.control, seg.p1]
                    : [seg.p0, seg.control1, seg.control2, seg.p1];
            const src = sources.push({ type: seg.type, contour: contourId, pts: pts.map((p) => ({ x: p.x, y: p.y })) }) - 1;

            let steps = 1;
            if (seg.type !== "line") {
                let len = 0;
                for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                steps = Math.max(6, Math.min(96, Math.ceil(Math.sqrt(len) * 1.6)));
            }

            let prev = null;
            let last = null;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const p = i === 0 ? pts[0] : i === steps ? pts[pts.length - 1] : boolBezierPoint(pts, t);
                const q = { x: Math.round(p.x * BOOL_SCALE), y: Math.round(p.y * BOOL_SCALE), t };
                if (!prev) {
                    prev = q;
                    continue;
                }
                if (q.x === prev.x && q.y === prev.y) {
                    if (i === steps && last) last.t1 = 1;
                    continue;
                }
                last = { ax: prev.x, ay: prev.y, bx: q.x, by: q.y, op: operand, src, t0: prev.t, t1: t };
                edges.push(last);
                prev = q;
            }
        }
    }
}

/* ── 2. split at intersections ───────────────────────── */

function boolAddSplit(list, e, x, y) {
    if ((x === e.ax && y === e.ay) || (x === e.bx && y === e.by)) return;
    const rx = e.bx - e.ax;
    const ry = e.by - e.ay;
    const s = ((x - e.ax) * rx + (y - e.ay) * ry) / (rx * rx + ry * ry);
    if (s <= 0 || s >= 1) return;
    list.push({ s, x, y });
}

function boolIntersect(e, f, splitsE, splitsF) {
    const rx = e.bx - e.ax, ry = e.by - e.ay;
    const qx = f.bx - f.ax, qy = f.by - f.ay;
    const wx = f.ax - e.ax, wy = f.ay - e.ay;
    const d = rx * qy - ry * qx;

    if (d === 0) {
        // Parallel; only collinear overlaps matter (exact integer test).
        if (wx * ry - wy * rx !== 0) return;
        boolAddSplit(splitsE, e, f.ax, f.ay);
        boolAddSplit(splitsE, e, f.bx, f.by);
        boolAddSplit(splitsF, f, e.ax, e.ay);
        boolAddSplit(splitsF, f, e.bx, e.by);
        return;
    }

    const s = (wx * qy - wy * qx) / d;
    const u = (wx * ry - wy * rx) / d;
    const es = 0.75 / Math.hypot(rx, ry);
    const eu = 0.75 / Math.hypot(qx, qy);
    if (s < -es || s > 1 + es || u < -eu || u > 1 + eu) return;

    // Prefer an existing endpoint over a rounded crossing so T-junctions
    // join exactly instead of leaving a one-unit gap.
    let x, y;
    if (u <= eu) { x = f.ax; y = f.ay; }
    else if (u >= 1 - eu) { x = f.bx; y = f.by; }
    else if (s <= es) { x = e.ax; y = e.ay; }
    else if (s >= 1 - es) { x = e.bx; y = e.by; }
    else {
        x = Math.round(e.ax + s * rx);
        y = Math.round(e.ay + s * ry);
    }
    boolAddSplit(splitsE, e, x, y);
    boolAddSplit(splitsF, f, x, y);
}

function boolSplitEdges(edges) {
    const splits = edges.map(() => []);
    const order = edges.map((_, i) => i);
    const minX = edges.map((e) => Math.min(e.ax, e.bx));
    const maxX = edges.map((e) => Math.max(e.ax, e.bx));
    order.sort((a, b) => minX[a] - minX[b]);

    for (let oi = 0; oi < order.length; oi++) {
        const i = order[oi];
        const e = edges[i];
        const eMinY = Math.min(e.ay, e.by), eMaxY = Math.max(e.ay, e.by);
        for (let oj = oi + 1; oj < order.length; oj++) {
            const j = order[oj];
            if (minX[j] > maxX[i] + 1) break;
            const f = edges[j];
            if (Math.max(f.ay, f.by) < eMinY - 1 || Math.min(f.ay, f.by) > eMaxY + 1) continue;
            boolIntersect(e, f, splits[i], splits[j]);
        }
    }

    const pieces = [];
    let didSplit = false;
    edges.forEach((e, i) => {
        const list = splits[i];
        if (!list.length) {
            pieces.push(e);
            return;
        }
        didSplit = true;
        list.sort((a, b) => a.s - b.s);
        let ax = e.ax, ay = e.ay, t0 = e.t0;
        for (const sp of list) {
            if (sp.x === ax && sp.y === ay) continue;
            const t = e.t0 + sp.s * (e.t1 - e.t0);
            pieces.push({ ax, ay, bx: sp.x, by: sp.y, op: e.op, src: e.src, t0, t1: t });
            ax = sp.x; ay = sp.y; t0 = t;
        }
        if (ax !== e.bx || ay !== e.by) pieces.push({ ax, ay, bx: e.bx, by: e.by, op: e.op, src: e.src, t0, t1: e.t1 });
    });
    return { pieces, didSplit };
}

/* ── 3. classify ─────────────────────────────────────── */

const boolKey = (x, y) => x + "," + y;

function boolMergeEdges(pieces) {
    const map = new Map();
    let merged = false;
    for (const p of pieces) {
        const forward = p.ax < p.bx || (p.ax === p.bx && p.ay < p.by);
        const ax = forward ? p.ax : p.bx, ay = forward ? p.ay : p.by;
        const bx = forward ? p.bx : p.ax, by = forward ? p.by : p.ay;
        const k = ax + "," + ay + "," + bx + "," + by;
        let rec = map.get(k);
        if (!rec) {
            rec = {
                ax, ay, bx, by, dA: 0, dB: 0, count: 0,
                tag: forward ? { src: p.src, t0: p.t0, t1: p.t1 } : { src: p.src, t0: p.t1, t1: p.t0 },
            };
            map.set(k, rec);
        } else {
            merged = true;
        }
        const sign = forward ? 1 : -1;
        if (p.op === 0) rec.dA += sign;
        else rec.dB += sign;
        rec.count++;
    }
    return { recs: [...map.values()], merged };
}

// Buckets edges by their extent along one axis so ray casts only test edges
// that can cross the ray.
function boolBandIndex(recs, lo, hi) {
    let min = Infinity, max = -Infinity;
    for (const r of recs) {
        min = Math.min(min, lo(r));
        max = Math.max(max, hi(r));
    }
    const count = Math.max(1, Math.min(512, recs.length >> 2));
    const size = Math.max(1, (max - min) / count);
    const bands = Array.from({ length: count }, () => []);
    const band = (v) => Math.max(0, Math.min(count - 1, Math.floor((v - min) / size)));
    for (const r of recs) {
        for (let b = band(lo(r)); b <= band(hi(r)); b++) bands[b].push(r);
    }
    return (v) => bands[band(v)];
}

function boolClassify(recs, predicate) {
    const byY = boolBandIndex(recs, (r) => Math.min(r.ay, r.by), (r) => Math.max(r.ay, r.by));
    const byX = boolBandIndex(recs, (r) => Math.min(r.ax, r.bx), (r) => Math.max(r.ax, r.bx));
    const out = [];
    let changed = false;

    for (const e of recs) {
        const mx = (e.ax + e.bx) / 2;
        const my = (e.ay + e.by) / 2;
        let wA = 0, wB = 0, cE, negIsLeft;

        if (e.ay !== e.by) {
            // Ray towards +x; upward crossings count +1 (counter-clockwise positive).
            for (const g of byY(my)) {
                if (g === e || (g.ay <= my) === (g.by <= my)) continue;
                const xi = g.ax + ((my - g.ay) * (g.bx - g.ax)) / (g.by - g.ay);
                if (xi <= mx) continue;
                const s = g.by > g.ay ? 1 : -1;
                wA += s * g.dA;
                wB += s * g.dB;
            }
            cE = e.by > e.ay ? 1 : -1;
            negIsLeft = e.by > e.ay;
        } else {
            // Horizontal edge: ray towards +y; leftward crossings count +1.
            for (const g of byX(mx)) {
                if (g === e || (g.ax <= mx) === (g.bx <= mx)) continue;
                const yi = g.ay + ((mx - g.ax) * (g.by - g.ay)) / (g.bx - g.ax);
                if (yi <= my) continue;
                const s = g.bx < g.ax ? 1 : -1;
                wA += s * g.dA;
                wB += s * g.dB;
            }
            cE = e.bx < e.ax ? 1 : -1;
            negIsLeft = e.bx < e.ax;
        }

        // Winding just past the edge on its negative (-x / -y) and positive sides.
        const inNeg = predicate(wA + cE * e.dA !== 0, wB + cE * e.dB !== 0);
        const inPos = predicate(wA !== 0, wB !== 0);
        if (inNeg === inPos) {
            changed = true;
            continue;
        }

        const interiorLeft = inNeg ? negIsLeft : !negIsLeft;
        const originalForward = e.dA + e.dB > 0;
        if (e.count !== 1 || interiorLeft === originalForward) changed = true;

        out.push(interiorLeft
            ? { ax: e.bx, ay: e.by, bx: e.ax, by: e.ay, tag: { src: e.tag.src, t0: e.tag.t1, t1: e.tag.t0 } }
            : { ax: e.ax, ay: e.ay, bx: e.bx, by: e.by, tag: e.tag });
    }
    return { out, changed };
}

/* ── 4. link into loops ──────────────────────────────── */

function boolLink(edges) {
    const outgoing = new Map();
    for (const e of edges) {
        const k = boolKey(e.ax, e.ay);
        if (!outgoing.has(k)) outgoing.set(k, []);
        outgoing.get(k).push(e);
    }

    const loops = [];
    for (const first of edges) {
        if (first.used) continue;
        const loop = [];
        const startKey = boolKey(first.ax, first.ay);
        let cur = first;
        for (;;) {
            cur.used = true;
            loop.push(cur);
            const k = boolKey(cur.bx, cur.by);
            if (k === startKey) break;
            const cands = (outgoing.get(k) || []).filter((e) => !e.used);
            if (!cands.length) break;
            // At pinch points take the tightest turn (smallest counter-
            // clockwise angle from the reversed incoming direction) so
            // regions that only touch stay separate contours.
            const back = Math.atan2(cur.ay - cur.by, cur.ax - cur.bx);
            let best = cands[0];
            let bestDelta = Infinity;
            for (const c of cands) {
                let delta = Math.atan2(c.by - c.ay, c.bx - c.ax) - back;
                while (delta <= 1e-12) delta += Math.PI * 2;
                while (delta > Math.PI * 2) delta -= Math.PI * 2;
                if (delta < bestDelta) {
                    bestDelta = delta;
                    best = c;
                }
            }
            cur = best;
        }
        loops.push(loop);
    }
    return loops;
}

/* ── 5. rebuild curves ───────────────────────────────── */

const boolIsEnd = (t) => t === 0 || t === 1;

function boolLoopToContour(loop, sources) {
    let area = 0;
    for (const e of loop) area += e.ax * e.by - e.bx * e.ay;
    if (Math.abs(area / 2) / (BOOL_SCALE * BOOL_SCALE) < 1) return null; // sliver

    const contiguous = (a, b) => a.tag.src === b.tag.src && a.tag.t1 === b.tag.t0;
    let start = loop.findIndex((e, i) => !contiguous(loop[(i - 1 + loop.length) % loop.length], e));
    if (start < 0) start = 0;
    const edges = loop.slice(start).concat(loop.slice(0, start));

    const groups = [];
    for (const e of edges) {
        const g = groups[groups.length - 1];
        if (g && contiguous(g.last, e)) {
            g.last = e;
        } else {
            groups.push({ first: e, last: e });
        }
    }

    const S = BOOL_SCALE;
    const round = (v) => Math.round(v * 100) / 100;
    const points = [];
    // Per on-curve point: false when it joins two segments of the same source
    // contour at their ends (an original point the designer placed), true
    // when the operation created it or it now joins different contours.
    const junction = [];
    const isJunction = (a, b) =>
        !(sources[a.last.tag.src].contour === sources[b.first.tag.src].contour &&
            boolIsEnd(a.last.tag.t1) && boolIsEnd(b.first.tag.t0));

    const firstGroup = groups[0];
    const lastGroup = groups[groups.length - 1];
    points.push(Point.onCurve(round(firstGroup.first.ax / S), round(firstGroup.first.ay / S)));
    junction.push(isJunction(lastGroup, firstGroup));

    groups.forEach((g, gi) => {
        const src = sources[g.first.tag.src];
        const sx = g.first.ax / S, sy = g.first.ay / S;
        const ex = g.last.bx / S, ey = g.last.by / S;
        const chord = Math.hypot(ex - sx, ey - sy);

        if (src.type !== "line" && chord > 2 / S) {
            const pts = boolBezierSlice(src.pts, g.first.tag.t0, g.last.tag.t1);
            // Snap the slice onto the shared junction points.
            const d0 = { x: sx - pts[0].x, y: sy - pts[0].y };
            const d1 = { x: ex - pts[pts.length - 1].x, y: ey - pts[pts.length - 1].y };
            if (pts.length === 4) {
                points.push(Point.offCurve(round(pts[1].x + d0.x), round(pts[1].y + d0.y), CurveType.Cubic));
                points.push(Point.offCurve(round(pts[2].x + d1.x), round(pts[2].y + d1.y), CurveType.Cubic));
            } else {
                points.push(Point.offCurve(
                    round(pts[1].x + (d0.x + d1.x) / 2),
                    round(pts[1].y + (d0.y + d1.y) / 2),
                    CurveType.Quadratic
                ));
            }
        }

        if (gi < groups.length - 1) {
            points.push(Point.onCurve(round(ex), round(ey)));
            junction[points.length - 1] = isJunction(g, groups[gi + 1]);
        }
    });

    // Drop junction points that ended up in the middle of a straight line
    // (e.g. where two rectangles sharing an edge were merged).
    for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < points.length && points.length > 3; i++) {
            const p = points[i];
            if (!p.isOnCurve || !junction[i]) continue;
            const a = points[(i - 1 + points.length) % points.length];
            const b = points[(i + 1) % points.length];
            if (!a.isOnCurve || !b.isOnCurve) continue;
            const ux = p.x - a.x, uy = p.y - a.y, vx = b.x - p.x, vy = b.y - p.y;
            const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
            if (lu === 0 || lv === 0 || (Math.abs(ux * vy - uy * vx) / (lu * lv) < 1e-4 && ux * vx + uy * vy > 0)) {
                points.splice(i, 1);
                junction.splice(i, 1);
                i--;
            }
        }
    }

    if (points.length < 2) return null;
    const contour = new Contour(points, true);
    return Math.abs(contour.signedArea()) < 1 ? null : contour;
}

/* ── public API ──────────────────────────────────────── */

// Combine two sets of contours. Each set is filled with the non-zero rule.
// Returns { contours, changed }; when nothing needed to change, `contours`
// are clones of the input so original points and directions are preserved.
function booleanContours(subject, clip, op) {
    const predicate = BOOL_OPS[op];
    if (!predicate) throw new Error(`Unknown boolean operation "${op}"`);

    const sources = [];
    const edges = [];
    boolFlatten(subject, 0, sources, edges);
    boolFlatten(clip, 1, sources, edges);
    if (!edges.length) return { contours: [], changed: subject.length + clip.length > 0 };

    const { pieces, didSplit } = boolSplitEdges(edges);
    const { recs, merged } = boolMergeEdges(pieces);
    const { out, changed: classChanged } = boolClassify(recs.filter((r) => r.dA || r.dB), predicate);
    const changed = didSplit || merged || classChanged || recs.some((r) => !r.dA && !r.dB);

    if (!changed) {
        return { contours: subject.concat(clip).filter((c) => c.closed).map((c) => c.clone()), changed: false };
    }

    const contours = [];
    for (const loop of boolLink(out)) {
        const contour = boolLoopToContour(loop, sources);
        if (contour) contours.push(contour);
    }
    return { contours, changed: true };
}

// Merge overlapping and self-intersecting contours into clean outlines.
function removeOverlap(contours) {
    return booleanContours(contours, [], "union");
}
