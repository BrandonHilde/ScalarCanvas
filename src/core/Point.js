const PointType = Object.freeze({
    OnCurve: "on",
    OffCurve: "off",
});

const CurveType = Object.freeze({
    Quadratic: "quad",
    Cubic: "cubic",
});

class Point {
    constructor(x = 0, y = 0, type = PointType.OnCurve, curve = null, smooth = false) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.curve = type === PointType.OffCurve
            ? (curve || CurveType.Quadratic)
            : null;
        this.smooth = smooth;
    }

    get isOnCurve() {
        return this.type === PointType.OnCurve;
    }

    get isOffCurve() {
        return this.type === PointType.OffCurve;
    }

    clone() {
        return new Point(this.x, this.y, this.type, this.curve, this.smooth);
    }

    moveTo(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    static onCurve(x, y, smooth = false) {
        return new Point(x, y, PointType.OnCurve, null, smooth);
    }

    static offCurve(x, y, curve = CurveType.Quadratic) {
        return new Point(x, y, PointType.OffCurve, curve);
    }

    static line(p0, p1) {
        return { type: "line", p0, p1 };
    }

    static quadratic(p0, control, p1) {
        return { type: "quad", p0, control, p1 };
    }

    static cubic(p0, control1, control2, p1) {
        return { type: "cubic", p0, control1, control2, p1 };
    }
}
