const COLORS = {
    background: "#14161f",
    fill: "#ccd6f6",
    outline: "#64ffda",
    onCurve: "#64ffda",
    offCurve: "#ffcb6b",
    handle: "#82aaff",
    baseline: "#ff5370",
    metric: "#3a4a6e",
    metricText: "#5a6080",
    advance: "#c792ea",
    sidebearing: "#546e7a",
};

class CanvasRenderer {
    constructor(canvas, document, view = new ViewTransform(0.5, 200, 500)) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.doc = document || null;
        this.view = view;
        this.showPoints = true;
        this.showMetrics = true;
        this.showFill = true;
        this.showAdvance = true;
        this.showGrid = false;
        this.gridSize = 50;
        this.strokeStyle = COLORS.outline;
        this.fillStyle = COLORS.fill;
        this.lineWidth = 1.5;
        this.background = null;
        this.dpr = window.devicePixelRatio || 1;
    }

    resize(width, height) {
        this.dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
    }

    clear() {
        const { ctx, canvas } = this;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    sx(x) {
        return this.view.toScreenX(x);
    }

    sy(y) {
        return this.view.toScreenY(y);
    }

    pathContours(contours) {
        const { ctx } = this;
        ctx.beginPath();
        for (const contour of contours) {
            let started = false;
            for (const seg of contour.segments()) {
                if (!started) {
                    ctx.moveTo(this.sx(seg.p0.x), this.sy(seg.p0.y));
                    started = true;
                }
                if (seg.type === "line") {
                    ctx.lineTo(this.sx(seg.p1.x), this.sy(seg.p1.y));
                } else if (seg.type === "quad") {
                    ctx.quadraticCurveTo(
                        this.sx(seg.control.x), this.sy(seg.control.y),
                        this.sx(seg.p1.x), this.sy(seg.p1.y)
                    );
                } else {
                    ctx.bezierCurveTo(
                        this.sx(seg.control1.x), this.sy(seg.control1.y),
                        this.sx(seg.control2.x), this.sy(seg.control2.y),
                        this.sx(seg.p1.x), this.sy(seg.p1.y)
                    );
                }
            }
            if (contour.closed) ctx.closePath();
        }
    }

    render(glyph) {
        this.clear();
        this.drawBackground();
        if (!glyph) {
            this.drawOrigin();
            return;
        }

        if (this.showGrid) this.drawGrid();
        this.drawArtboard();

        if (this.showMetrics) this.drawMetrics();

        const contours = glyph.getOutlineContours((i) => this.doc.resolveGlyph(i));

        if (this.showFill) {
            const closed = contours.filter((c) => c.closed);
            if (closed.length) {
                this.pathContours(closed);
                this.ctx.fillStyle = this.fillStyle;
                this.ctx.fill("nonzero");
            }
        }
        this.pathContours(contours);
        this.ctx.strokeStyle = this.strokeStyle;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.stroke();

        if (this.showAdvance) this.drawAdvance(glyph);

        if (this.showPoints && !glyph.isComposite) {
            for (const contour of glyph.contours) this.drawContourPoints(contour);
        }

        if (glyph.isComposite) this.drawComponents(glyph);
    }

    drawOrigin() {
        const { ctx } = this;
        ctx.strokeStyle = COLORS.advance;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.sx(0), 0);
        ctx.lineTo(this.sx(0), this.canvas.height);
        ctx.stroke();
    }

    // Image bounds in font units: x0,y0 is bottom-left, x1,y1 is top-right.
    backgroundBounds() {
        const bg = this.background;
        if (!bg || !bg.image) return null;
        const w = bg.image.width * bg.scale;
        const h = bg.image.height * bg.scale;
        return { x0: bg.x, y0: bg.y - h, x1: bg.x + w, y1: bg.y };
    }

    drawBackground() {
        const bg = this.background;
        if (!bg || !bg.image || !bg.visible) return;
        const { ctx } = this;
        const w = bg.image.width * bg.scale * this.view.scale;
        const h = bg.image.height * bg.scale * this.view.scale;
        const x = this.sx(bg.x);
        const y = this.sy(bg.y);
        ctx.save();
        ctx.globalAlpha = bg.opacity;
        ctx.imageSmoothingEnabled = bg.smoothing !== false;
        ctx.drawImage(bg.image, x, y, w, h);
        ctx.restore();
    }

    drawGrid() {
        const size = this.gridSize;
        if (!(size > 0)) return;
        const px = size * this.view.scale;
        if (px < 4) return;

        const { ctx } = this;
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const x0 = this.view.toFontX(0);
        const x1 = this.view.toFontX(w);
        const y0 = this.view.toFontY(h);
        const y1 = this.view.toFontY(0);

        ctx.save();
        ctx.strokeStyle = COLORS.metric;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = Math.floor(x0 / size) * size; x <= x1; x += size) {
            const sx = Math.round(this.sx(x)) + 0.5;
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
        }
        for (let y = Math.floor(y0 / size) * size; y <= y1; y += size) {
            const sy = Math.round(this.sy(y)) + 0.5;
            ctx.moveTo(0, sy);
            ctx.lineTo(w, sy);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawArtboard() {
        const doc = this.doc;
        if (!doc || !doc.canvas) return;
        const { ctx } = this;
        const x0 = this.sx(0);
        const y0 = this.sy(doc.height);
        const x1 = this.sx(doc.width);
        const y1 = this.sy(0);
        ctx.save();
        ctx.strokeStyle = COLORS.metricText;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        ctx.restore();
    }

    drawMetrics() {
        const { ctx } = this;
        const m = this.doc ? this.doc.metrics : null;
        const lines = [
            { y: 0, color: COLORS.baseline, label: "baseline" },
            { x: 0, y: m ? m.xHeight : 500, color: COLORS.metric, label: "x-height" },
            { x: 0, y: m ? m.capHeight : 700, color: COLORS.metric, label: "cap" },
            { x: 0, y: m ? m.ascender : 800, color: COLORS.metric, label: "asc" },
            { x: 0, y: m ? m.descender : -200, color: COLORS.metric, label: "desc" },
        ];

        ctx.save();
        ctx.font = "11px monospace";
        for (const line of lines) {
            const y = this.sy(line.y);
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.color === COLORS.baseline ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
            ctx.fillStyle = COLORS.metricText;
            ctx.fillText(line.label, 6, y - 3);
        }
        ctx.restore();
    }

    drawAdvance(glyph) {
        const { ctx } = this;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = COLORS.advance;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.sx(glyph.advanceWidth), 0);
        ctx.lineTo(this.sx(glyph.advanceWidth), this.canvas.height);
        ctx.stroke();

        ctx.strokeStyle = COLORS.sidebearing;
        ctx.beginPath();
        ctx.moveTo(this.sx(glyph.leftSideBearing), 0);
        ctx.lineTo(this.sx(glyph.leftSideBearing), this.canvas.height);
        ctx.stroke();
        ctx.restore();
    }

    drawContourPoints(contour) {
        const { ctx } = this;
        for (const point of contour.points) {
            const x = this.sx(point.x);
            const y = this.sy(point.y);

            if (point.isOnCurve) {
                ctx.fillStyle = COLORS.onCurve;
                ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.offCurve;
                ctx.fill();
            }
        }
    }

    drawComponents(glyph) {
        const { ctx } = this;
        ctx.save();
        ctx.font = "11px monospace";
        ctx.fillStyle = COLORS.metricText;
        for (const comp of glyph.components) {
            const base = this.doc.resolveGlyph(comp.glyphIndex);
            if (!base) continue;
            const box = base.getBoundingBox((i) => this.doc.resolveGlyph(i));
            const corners = [
                comp.apply(box.xMin, box.yMin),
                comp.apply(box.xMax, box.yMin),
                comp.apply(box.xMax, box.yMax),
                comp.apply(box.xMin, box.yMax),
            ];
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = COLORS.handle;
            ctx.lineWidth = 1;
            ctx.beginPath();
            corners.forEach((c, i) => {
                const x = this.sx(c.x);
                const y = this.sy(c.y);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
            const label = base.name || `#${comp.glyphIndex}`;
            ctx.fillText(label, this.sx(corners[0].x), this.sy(corners[0].y) - 4);
        }
        ctx.restore();
    }

    fitToGlyph(glyph, padding = 80) {
        if (!glyph) return;
        const isCanvas = this.doc && this.doc.canvas;
        const box = isCanvas
            ? { xMin: 0, yMin: 0, xMax: this.doc.width, yMax: this.doc.height, width: this.doc.width, height: this.doc.height }
            : glyph.getBoundingBox((i) => this.doc.resolveGlyph(i));
        if (!box || box.width === 0 || box.height === 0) {
            this.view = new ViewTransform(0.5, this.canvas.width / (2 * this.dpr), this.canvas.height / (2 * this.dpr));
            return;
        }
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const asc = isCanvas ? this.doc.height : (this.doc ? this.doc.metrics.ascender : box.yMax);
        const desc = isCanvas ? 0 : (this.doc ? this.doc.metrics.descender : box.yMin);
        const contentH = Math.max(1, asc - desc);

        const scale = Math.min(
            (h - padding * 2) / contentH,
            (w - padding * 2) / Math.max(1, box.width)
        );

        this.view = new ViewTransform(scale, w / 2 - ((box.xMin + box.xMax) / 2) * scale, h / 2 + ((asc + desc) / 2) * scale);
    }
}

