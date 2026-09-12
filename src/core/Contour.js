const BBOX_FLATTEN_STEPS = 24;

function boxFromPoints(points) {
    if (!points || points.length === 0) return null;
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (const p of points) {
        if (p.x < xMin) xMin = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.x > xMax) xMax = p.x;
        if (p.y > yMax) yMax = p.y;
    }
    return { xMin, yMin, xMax, yMax, width: xMax - xMin, height: yMax - yMin };
}

function mergeBox(a, b) {
    if (!a) return b;
    if (!b) return a;
    return {
        xMin: Math.min(a.xMin, b.xMin),
        yMin: Math.min(a.yMin, b.yMin),
        xMax: Math.max(a.xMax, b.xMax),
        yMax: Math.max(a.yMax, b.yMax),
        width: Math.max(a.xMax, b.xMax) - Math.min(a.xMin, b.xMin),
        height: Math.max(a.yMax, b.yMax) - Math.min(a.yMin, b.yMin),
    };
}

function pointOnQuad(p0, c, p1, t) {
    const mt = 1 - t;
    const a = mt * mt;
    const b = 2 * mt * t;
    const d = t * t;
    return { x: a * p0.x + b * c.x + d * p1.x, y: a * p0.y + b * c.y + d * p1.y };
}

function pointOnCubic(p0, c1, c2, p1, t) {
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    return {
        x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
        y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
    };
}

function quadExtrema(p0, c, p1, axis, out) {
    const denom = p0[axis] - 2 * c[axis] + p1[axis];
    if (denom === 0) return;
    const t = (p0[axis] - c[axis]) / denom;
    if (t > 0 && t < 1) out.push(pointOnQuad(p0, c, p1, t));
}

function cubicExtrema(p0, c1, c2, p1, axis, out) {
    const a = -p0[axis] + 3 * c1[axis] - 3 * c2[axis] + p1[axis];
    const b = 2 * (p0[axis] - 2 * c1[axis] + c2[axis]);
    const c = -p0[axis] + c1[axis];

    if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) {
            const t = -c / b;
            if (t > 0 && t < 1) out.push(pointOnCubic(p0, c1, c2, p1, t));
        }
        return;
    }

    const disc = b * b - 4 * a * c;
    if (disc < 0) return;
    const sq = Math.sqrt(disc);
    const t1 = (-b + sq) / (2 * a);
    const t2 = (-b - sq) / (2 * a);
    if (t1 > 0 && t1 < 1) out.push(pointOnCubic(p0, c1, c2, p1, t1));
    if (t2 > 0 && t2 < 1) out.push(pointOnCubic(p0, c1, c2, p1, t2));
}

class Contour {
    constructor(points = [], closed = true) {
        this.points = points;
        this.closed = closed;
    }

    clone() {
        return new Contour(this.points.map((p) => p.clone()), this.closed);
    }

    get length() {
        return this.points.length;
    }

    add(point) {
        this.points.push(point);
        return point;
    }

    insert(index, point) {
        this.points.splice(index, 0, point);
        return point;
    }

    removeAt(index) {
        return this.points.splice(index, 1)[0];
    }

    reverse() {
        this.points.reverse();
        return this;
    }

    // Expand quadratic off-curve runs by inserting implied on-curve midpoints.
    // Cubic control pairs are left intact.
    expanded() {
        const pts = this.points;
        const n = pts.length;
        if (n < 2) return pts.map((p) => p.clone());

        const out = [];
        const last = this.closed ? n : n - 1;
        for (let i = 0; i < n; i++) {
            const cur = pts[i];
            out.push(cur);
            if (i === last) break;
            const next = pts[(i + 1) % n];
            if (
                cur.isOffCurve &&
                next.isOffCurve &&
                cur.curve === CurveType.Quadratic &&
                next.curve === CurveType.Quadratic
            ) {
                out.push(Point.onCurve((cur.x + next.x) / 2, (cur.y + next.y) / 2));
            }
        }
        return out;
    }

    *segments() {
        if (this.points.length < 2) return;

        let ex = this.expanded();
        const start = ex.findIndex((p) => p.isOnCurve);
        if (start === -1) return;

        if (this.closed) {
            ex = ex.slice(start).concat(ex.slice(0, start));
            ex.push(ex[0]);
        } else if (start > 0) {
            ex = ex.slice(start);
        }

        const end = ex.length - 1;
        let i = 0;
        while (i < end) {
            if (!ex[i].isOnCurve) {
                i++;
                continue;
            }

            let j = i + 1;
            const controls = [];
            while (j < end && ex[j].isOffCurve) {
                controls.push(ex[j]);
                j++;
            }
            if (j > end) break;

            yield this.buildSegment(ex[i], controls, ex[j]);
            i = j;
        }
    }

    buildSegment(a, controls, b) {
        if (controls.length === 0) {
            return { type: "line", p0: a, p1: b };
        }
        if (controls.length === 1) {
            return { type: "quad", p0: a, control: controls[0], p1: b };
        }
        // Two or more controls: treat as cubic using first/last.
        return { type: "cubic", p0: a, control1: controls[0], control2: controls[controls.length - 1], p1: b };
    }

    getBoundingBox() {
        if (this.points.length === 0) return null;

        const candidates = this.points.slice();
        for (const seg of this.segments()) {
            if (seg.type === "quad") {
                quadExtrema(seg.p0, seg.control, seg.p1, "x", candidates);
                quadExtrema(seg.p0, seg.control, seg.p1, "y", candidates);
            } else if (seg.type === "cubic") {
                cubicExtrema(seg.p0, seg.control1, seg.control2, seg.p1, "x", candidates);
                cubicExtrema(seg.p0, seg.control1, seg.control2, seg.p1, "y", candidates);
            }
        }
        return boxFromPoints(candidates);
    }

    flatten(steps = BBOX_FLATTEN_STEPS) {
        const out = [];
        for (const seg of this.segments()) {
            const { p0, p1 } = seg;
            if (out.length === 0) out.push({ x: p0.x, y: p0.y });
            if (seg.type === "line") {
                out.push({ x: p1.x, y: p1.y });
            } else if (seg.type === "quad") {
                for (let s = 1; s <= steps; s++) {
                    out.push(pointOnQuad(p0, seg.control, p1, s / steps));
                }
            } else {
                for (let s = 1; s <= steps; s++) {
                    out.push(pointOnCubic(p0, seg.control1, seg.control2, p1, s / steps));
                }
            }
        }
        return out;
    }

    signedArea() {
        const poly = this.flatten();
        let area = 0;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            area += a.x * b.y - b.x * a.y;
        }
        return area / 2;
    }

    isClockwise() {
        return this.signedArea() < 0;
    }

    containsPoint(x, y) {
        const poly = this.flatten();
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect =
                yi > y !== yj > y &&
                x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Keep only points that belong to the glyph data (drops points that are
    // unreachable, e.g. trailing off-curve points on a closed contour).
    toArray() {
        return this.points.map((p) => ({
            x: p.x,
            y: p.y,
            type: p.type,
            curve: p.curve,
            smooth: p.smooth,
        }));
    }
}

