function contourToSVGPath(contour) {
    let d = "";
    let started = false;
    for (const seg of contour.segments()) {
        const a = `${seg.p0.x} ${seg.p0.y}`;
        if (!started) {
            d += `M ${a} `;
            started = true;
        }
        if (seg.type === "line") {
            d += `L ${seg.p1.x} ${seg.p1.y} `;
        } else if (seg.type === "quad") {
            d += `Q ${seg.control.x} ${seg.control.y} ${seg.p1.x} ${seg.p1.y} `;
        } else {
            d += `C ${seg.control1.x} ${seg.control1.y} ${seg.control2.x} ${seg.control2.y} ${seg.p1.x} ${seg.p1.y} `;
        }
    }
    if (contour.closed && started) d += "Z";
    return d.trim();
}

function svgAttr(value) {
    return String(value).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
}

// Build a standalone SVG string from a drawn glyph. The artboard uses a
// bottom-left origin, so contours are flipped into SVG's top-left space.
// Each contour is written as its own path so per-stroke colours survive;
// open contours are never filled (SVG would otherwise close them implicitly).
function glyphToSVG(glyph, options = {}) {
    const width = Math.max(1, Math.round(options.width || 1000));
    const height = Math.max(1, Math.round(options.height || 1000));
    const defaults = {
        stroke: options.stroke || "#64ffda",
        fill: options.fill || "#ccd6f6",
        width: options.lineWidth != null ? Number(options.lineWidth) : 1.5,
    };
    const filled = options.filled !== false;

    const paths = [];
    for (const contour of glyph.contours) {
        const d = contourToSVGPath(contour);
        if (!d) continue;
        const style = { ...defaults, ...(contour.style || {}) };
        const fill = contour.closed && filled && style.fill ? style.fill : "none";
        const strokeWidth = Number(style.width) || 0;
        const stroke = style.stroke && strokeWidth > 0 ? style.stroke : "none";
        let attrs = `fill="${svgAttr(fill)}"`;
        if (fill !== "none") attrs += ` fill-rule="nonzero"`;
        attrs += ` stroke="${svgAttr(stroke)}"`;
        if (stroke !== "none") attrs += ` stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`;
        paths.push(`<path d="${d}" ${attrs} />`);
    }

    const body = `<g transform="translate(0, ${height}) scale(1, -1)">\n${paths.join("\n")}\n</g>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${body}
</svg>
`;
}

function downloadSVG(svg, filename = "design.svg") {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}
