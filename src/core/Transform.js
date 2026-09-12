class AffineTransform {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
    }

    static identity() {
        return new AffineTransform();
    }

    static translate(tx, ty) {
        return new AffineTransform(1, 0, 0, 1, tx, ty);
    }

    static scale(sx, sy = sx) {
        return new AffineTransform(sx, 0, 0, sy, 0, 0);
    }

    get isIdentity() {
        return (
            this.a === 1 && this.b === 0 && this.c === 0 &&
            this.d === 1 && this.e === 0 && this.f === 0
        );
    }

    applyPoint(x, y) {
        return {
            x: this.a * x + this.c * y + this.e,
            y: this.b * x + this.d * y + this.f,
        };
    }

    // Returns this * other (apply `other` first, then `this`).
    multiply(other) {
        return new AffineTransform(
            this.a * other.a + this.c * other.b,
            this.b * other.a + this.d * other.b,
            this.a * other.c + this.c * other.d,
            this.b * other.c + this.d * other.d,
            this.a * other.e + this.c * other.f + this.e,
            this.b * other.e + this.d * other.f + this.f
        );
    }

    clone() {
        return new AffineTransform(this.a, this.b, this.c, this.d, this.e, this.f);
    }
}

// Maps font units (Y-up, origin at baseline) to canvas/screen pixels (Y-down).
class ViewTransform {
    constructor(scale = 1, panX = 0, panY = 0) {
        this.scale = scale;
        this.panX = panX;
        this.panY = panY;
    }

    toScreenX(x) {
        return this.panX + x * this.scale;
    }

    toScreenY(y) {
        return this.panY - y * this.scale;
    }

    toFontX(sx) {
        return (sx - this.panX) / this.scale;
    }

    toFontY(sy) {
        return (this.panY - sy) / this.scale;
    }

    applyToContext(ctx) {
        ctx.setTransform(this.scale, 0, 0, -this.scale, this.panX, this.panY);
    }
}
