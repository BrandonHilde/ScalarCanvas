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

        if (this.showMetrics) this.drawMetrics();

        const contours = glyph.getOutlineContours((i) => this.doc.resolveGlyph(i));

        this.pathContours(contours);
        if (this.showFill) {
            this.ctx.fillStyle = COLORS.fill;
            this.ctx.fill("nonzero");
        }
        this.ctx.strokeStyle = COLORS.outline;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        this.drawAdvance(glyph);

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
        const box = glyph.getBoundingBox((i) => this.doc.resolveGlyph(i));
        if (!box || box.width === 0 || box.height === 0) {
            this.view = new ViewTransform(0.5, this.canvas.width / (2 * this.dpr), this.canvas.height / (2 * this.dpr));
            return;
        }
        const w = this.canvas.width / this.dpr;
        const h = this.canvas.height / this.dpr;
        const asc = this.doc ? this.doc.metrics.ascender : box.yMax;
        const desc = this.doc ? this.doc.metrics.descender : box.yMin;
        const contentH = Math.max(1, asc - desc);

        const scale = Math.min(
            (h - padding * 2) / contentH,
            (w - padding * 2) / Math.max(1, box.width)
        );

        this.view = new ViewTransform(scale, w / 2 - ((box.xMin + box.xMax) / 2) * scale, h / 2 + ((asc + desc) / 2) * scale);
    }
}

