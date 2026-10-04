// A general-purpose SVG drawing document. It exposes the same shape as
// FontDocument so the existing editor, renderer and history can operate on it,
// but its single "glyph" is treated as an artboard of raw drawing contours.
class CanvasDocument {
    constructor(width = 1000, height = 1000) {
        this.canvas = true;
        this.unitsPerEm = 1000;
        this.width = width;
        this.height = height;

        this.artboard = new Glyph("artboard");
        this.artboard.advanceWidth = width;
        this.glyphs = [this.artboard];

        this.metrics = {
            ascender: height,
            descender: 0,
            lineGap: 0,
            xHeight: Math.round(height * 0.5),
            capHeight: height,
            italicAngle: 0,
            underlinePosition: -100,
            underlineThickness: 50,
            isFixedPitch: 0,
        };
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

    setSize(width, height) {
        this.width = Math.max(1, Math.round(width) || 1);
        this.height = Math.max(1, Math.round(height) || 1);
        this.artboard.advanceWidth = this.width;
        this.metrics.ascender = this.height;
        this.metrics.capHeight = this.height;
        this.metrics.xHeight = Math.round(this.height * 0.5);
    }
}
