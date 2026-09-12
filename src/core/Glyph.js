class GlyphComponent {
    constructor(glyphIndex, transform = new AffineTransform(), flags = 0, arg1 = 0, arg2 = 0) {
        this.glyphIndex = glyphIndex;
        this.transform = transform;
        this.flags = flags;
        this.arg1 = arg1;
        this.arg2 = arg2;
    }

    clone() {
        return new GlyphComponent(
            this.glyphIndex,
            this.transform.clone(),
            this.flags,
            this.arg1,
            this.arg2
        );
    }

    apply(x, y) {
        return this.transform.applyPoint(x, y);
    }
}

class Glyph {
    constructor(name = "") {
        this.name = name;
        this.contours = [];
        this.advanceWidth = 0;
        this.leftSideBearing = 0;
        this.unicodes = [];
        this.components = [];
        this.instructions = new Uint8Array(0);
        this.smooth = true;
    }

    get isComposite() {
        return this.components.length > 0;
    }

    get codepoint() {
        return this.unicodes.length ? this.unicodes[0] : null;
    }

    clone() {
        const g = new Glyph(this.name);
        g.contours = this.contours.map((c) => c.clone());
        g.advanceWidth = this.advanceWidth;
        g.leftSideBearing = this.leftSideBearing;
        g.unicodes = this.unicodes.slice();
        g.components = this.components.map((c) => c.clone());
        g.instructions = new Uint8Array(this.instructions);
        g.smooth = this.smooth;
        return g;
    }

    addContour(points = [], closed = true) {
        const contour = points instanceof Contour ? points : new Contour(points, closed);
        this.contours.push(contour);
        return contour;
    }

    // Bounding box in font units. `resolveGlyph(index)` is required for composites.
    getBoundingBox(resolveGlyph = null) {
        let box = null;
        for (const contour of this.contours) {
            box = mergeBox(box, contour.getBoundingBox());
        }

        if (this.isComposite && resolveGlyph) {
            for (const comp of this.components) {
                const base = resolveGlyph(comp.glyphIndex);
                if (!base) continue;
                const baseBox = base.getBoundingBox(resolveGlyph);
                if (!baseBox) continue;
                const corners = [
                    comp.apply(baseBox.xMin, baseBox.yMin),
                    comp.apply(baseBox.xMax, baseBox.yMin),
                    comp.apply(baseBox.xMin, baseBox.yMax),
                    comp.apply(baseBox.xMax, baseBox.yMax),
                ];
                box = mergeBox(box, boxFromPoints(corners));
            }
        }

        return box;
    }

    // Flattened contours in font units. Composites are resolved recursively.
    getOutlineContours(resolveGlyph = null, transform = new AffineTransform(), depth = 0) {
        if (depth > 16) return [];

        const out = [];

        if (this.isComposite && resolveGlyph) {
            for (const comp of this.components) {
                const base = resolveGlyph(comp.glyphIndex);
                if (!base) continue;
                const combined = transform.multiply(comp.transform);
                out.push(...base.getOutlineContours(resolveGlyph, combined, depth + 1));
            }
            return out;
        }

        for (const contour of this.contours) {
            if (transform.isIdentity) {
                out.push(contour);
            } else {
                const c = contour.clone();
                for (const p of c.points) {
                    const q = transform.applyPoint(p.x, p.y);
                    p.x = q.x;
                    p.y = q.y;
                }
                out.push(c);
            }
        }
        return out;
    }

    findInteriorPoint(contour) {
        const box = contour.getBoundingBox();
        if (!box) return { x: 0, y: 0 };
        const steps = 16;
        for (let iy = 1; iy < steps; iy++) {
            for (let ix = 1; ix < steps; ix++) {
                const x = box.xMin + (box.width * ix) / steps;
                const y = box.yMin + (box.height * iy) / steps;
                if (contour.containsPoint(x, y)) return { x, y };
            }
        }
        return { x: box.xMin + box.width / 2, y: box.yMin + box.height / 2 };
    }

    // TrueType convention: outer contours clockwise, inner (holes) counter-clockwise.
    correctDirection() {
        if (this.contours.length < 2) {
            for (const contour of this.contours) {
                if (!contour.isClockwise()) contour.reverse();
            }
            return this;
        }

        for (const contour of this.contours) {
            const probe = this.findInteriorPoint(contour);
            let depth = 0;
            for (const other of this.contours) {
                if (other === contour) continue;
                if (other.containsPoint(probe.x, probe.y)) depth++;
            }
            const shouldBeClockwise = depth % 2 === 0;
            if (contour.isClockwise() !== shouldBeClockwise) contour.reverse();
        }
        return this;
    }

    toJSON() {
        return {
            name: this.name,
            advanceWidth: this.advanceWidth,
            leftSideBearing: this.leftSideBearing,
            unicodes: this.unicodes.slice(),
            contours: this.contours.map((c) => ({
                closed: c.closed,
                points: c.toArray(),
            })),
            components: this.components.map((comp) => ({
                glyphIndex: comp.glyphIndex,
                transform: [comp.transform.a, comp.transform.b, comp.transform.c, comp.transform.d, comp.transform.e, comp.transform.f],
                flags: comp.flags,
                arg1: comp.arg1,
                arg2: comp.arg2,
            })),
        };
    }
}
