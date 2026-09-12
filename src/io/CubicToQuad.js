// Approximate a cubic Bezier with one or more quadratic Beziers.
// Returns an array of { control, end } quads starting from p0.

function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function cubicAt(p0, c1, c2, p1, t) {
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

function quadAt(p0, c, p1, t) {
    const mt = 1 - t;
    const a = mt * mt;
    const b = 2 * mt * t;
    const d = t * t;
    return {
        x: a * p0.x + b * c.x + d * p1.x,
        y: a * p0.y + b * c.y + d * p1.y,
    };
}

function splitCubic(p0, c1, c2, p1, t) {
    const p01 = { x: p0.x + (c1.x - p0.x) * t, y: p0.y + (c1.y - p0.y) * t };
    const p12 = { x: c1.x + (c2.x - c1.x) * t, y: c1.y + (c2.y - c1.y) * t };
    const p23 = { x: c2.x + (p1.x - c2.x) * t, y: c2.y + (p1.y - c2.y) * t };
    const p012 = { x: p01.x + (p12.x - p01.x) * t, y: p01.y + (p12.y - p01.y) * t };
    const p123 = { x: p12.x + (p23.x - p12.x) * t, y: p12.y + (p23.y - p12.y) * t };
    const p0123 = { x: p012.x + (p123.x - p012.x) * t, y: p012.y + (p123.y - p012.y) * t };
    return {
        left: [p0, p01, p012, p0123],
        right: [p0123, p123, p23, p1],
    };
}

function tangentIntersection(p0, c1, c2, p1) {
    const d0x = c1.x - p0.x, d0y = c1.y - p0.y;
    const d1x = c2.x - p1.x, d1y = c2.y - p1.y;
    const denom = d0x * d1y - d0y * d1x;

    if (Math.abs(denom) < 1e-9) {
        return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
    }

    const rx = p1.x - p0.x, ry = p1.y - p0.y;
    const t = (rx * d1y - ry * d1x) / denom;
    return { x: p0.x + t * d0x, y: p0.y + t * d0y };
}

function quadError(p0, c, p1, c1, c2, c3, samples = 12) {
    let maxError = 0;
    for (let i = 1; i < samples; i++) {
        const t = i / samples;
        const a = cubicAt(p0, c1, c2, c3, t);
        const b = quadAt(p0, c, p1, t);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const err = dx * dx + dy * dy;
        if (err > maxError) maxError = err;
    }
    return Math.sqrt(maxError);
}

function cubicToQuadratics(p0, c1, c2, p1, tolerance = 0.6) {
    const out = [];

    const recurse = (a, b, c, d, depth) => {
        const control = tangentIntersection(a, b, c, d);
        const error = quadError(a, control, d, b, c, d);
        if (error <= tolerance || depth >= 8) {
            out.push({ control, end: { x: d.x, y: d.y } });
            return;
        }
        const { left, right } = splitCubic(a, b, c, d, 0.5);
        recurse(left[0], left[1], left[2], left[3], depth + 1);
        recurse(right[0], right[1], right[2], right[3], depth + 1);
    };

    // Degenerate: control points coincide with endpoints.
    const degenerate =
        (Math.abs(c1.x - p0.x) < 1e-9 && Math.abs(c1.y - p0.y) < 1e-9 &&
            Math.abs(c2.x - p1.x) < 1e-9 && Math.abs(c2.y - p1.y) < 1e-9);
    if (degenerate) {
        return [{ control: mid(c1, c2), end: { x: p1.x, y: p1.y } }];
    }

    recurse(p0, c1, c2, p1, 0);
    return out;
}
