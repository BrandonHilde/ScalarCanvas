class FontDocument {
    constructor() {
        this.unitsPerEm = 1000;
        this.glyphs = [];
        this.names = new Map();
        this.metrics = new Metrics();
        this.head = defaultHead();
        this.hhea = defaultHhea();
        this.post = defaultPost();
        this.os2 = defaultOS2();
        this.kerning = new Map();
        this.glyphNames = true;
        this.created = Math.floor(Date.now() / 1000) + 2082844800;
        this.modified = this.created;
    }

    get numGlyphs() {
        return this.glyphs.length;
    }

    glyphAt(index) {
        return this.glyphs[index] || null;
    }

    resolveGlyph(index) {
        return this.glyphs[index] || null;
    }

    addGlyph(glyph = new Glyph()) {
        this.glyphs.push(glyph);
        return glyph;
    }

    getGlyphByCodepoint(codepoint) {
        return this.glyphs.find((g) => g.unicodes.includes(codepoint)) || null;
    }

    glyphIndexForCodepoint(codepoint) {
        return this.glyphs.findIndex((g) => g.unicodes.includes(codepoint));
    }

    setName(nameID, value) {
        this.names.set(nameID, value);
    }

    getName(nameID, fallback = "") {
        return this.names.has(nameID) ? this.names.get(nameID) : fallback;
    }

    get familyName() {
        return this.getName(16, this.getName(1, "Untitled"));
    }

    get styleName() {
        return this.getName(17, this.getName(2, "Regular"));
    }

    get fullName() {
        return this.getName(4, `${this.familyName} ${this.styleName}`.trim());
    }

    get postScriptName() {
        const raw = this.getName(6, `${this.familyName}-${this.styleName}`.replace(/\s+/g, "-"));
        return raw.replace(/[^A-Za-z0-9-]/g, "").slice(0, 63) || "Untitled-Regular";
    }

    setKerning(left, right, value) {
        const key = `${left},${right}`;
        if (value === 0) this.kerning.delete(key);
        else this.kerning.set(key, value);
    }

    getKerning(left, right) {
        return this.kerning.get(`${left},${right}`) || 0;
    }

    getBoundingBox() {
        let box = null;
        for (const glyph of this.glyphs) {
            const gb = glyph.getBoundingBox((i) => this.resolveGlyph(i));
            if (!gb) continue;
            if (!box) {
                box = { ...gb };
            } else {
                box.xMin = Math.min(box.xMin, gb.xMin);
                box.yMin = Math.min(box.yMin, gb.yMin);
                box.xMax = Math.max(box.xMax, gb.xMax);
                box.yMax = Math.max(box.yMax, gb.yMax);
            }
        }
        if (box) {
            box.width = box.xMax - box.xMin;
            box.height = box.yMax - box.yMin;
        }
        return box || { xMin: 0, yMin: 0, xMax: 0, yMax: 0, width: 0, height: 0 };
    }

    // Recompute derived fields after edits. Orientation normalization is an
    // explicit operation (Glyph.correctDirection) rather than implicit here.
    refresh() {
        return this;
    }

    toJSON() {
        return {
            format: "scalarcanvas-font",
            version: 1,
            unitsPerEm: this.unitsPerEm,
            glyphs: this.glyphs.map((g) => g.toJSON()),
            names: Array.from(this.names.entries()),
            metrics: { ...this.metrics },
            head: { ...this.head },
            hhea: { ...this.hhea },
            post: { ...this.post },
            os2: { ...this.os2 },
            kerning: Array.from(this.kerning.entries()),
        };
    }
}
