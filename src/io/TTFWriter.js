class ByteWriter {
    constructor() {
        this.a = [];
    }

    get length() {
        return this.a.length;
    }

    u8(v) {
        this.a.push(v & 0xff);
    }

    i8(v) {
        this.a.push(v & 0xff);
    }

    u16(v) {
        this.a.push((v >>> 8) & 0xff, v & 0xff);
    }

    i16(v) {
        this.a.push((v >> 8) & 0xff, v & 0xff);
    }

    u32(v) {
        this.a.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }

    i32(v) {
        this.u32(v >>> 0);
    }

    fixed(v) {
        this.i32(Math.round(v * 65536));
    }

    f2dot14(v) {
        this.i16(Math.round(v * 16384));
    }

    tag(s) {
        for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i));
    }

    bytes(arr) {
        for (let i = 0; i < arr.length; i++) this.a.push(arr[i] & 0xff);
    }

    pad(value, count) {
        for (let i = 0; i < count; i++) this.u8(value);
    }

    patch(index, value) {
        this.a[index] = value & 0xff;
    }

    toUint8Array() {
        return Uint8Array.from(this.a);
    }
}

function utf16be(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        out.push((code >> 8) & 0xff, code & 0xff);
    }
    return out;
}

function pad4(bytes) {
    const remainder = bytes.length % 4;
    if (remainder === 0) return bytes;
    const padded = new Uint8Array(bytes.length + (4 - remainder));
    padded.set(bytes);
    return padded;
}

function checksum(bytes) {
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 4) {
        const b0 = bytes[i] || 0;
        const b1 = bytes[i + 1] || 0;
        const b2 = bytes[i + 2] || 0;
        const b3 = bytes[i + 3] || 0;
        sum = (sum + (((b0 << 24) >>> 0) + (b1 << 16) + (b2 << 8) + b3)) >>> 0;
    }
    return sum >>> 0;
}

class TTFWriter {
    constructor(document, options = {}) {
        this.doc = document;
        this.tolerance = options.tolerance ?? 0.6;
        this.correctDirection = options.correctDirection !== false;
    }

    contourToPoints(contour) {
        const hasCubic = contour.points.some(
            (p) => p.isOffCurve && p.curve === CurveType.Cubic
        );

        if (!hasCubic) {
            return contour.points.map((p) => ({ x: p.x, y: p.y, on: p.isOnCurve }));
        }

        const points = [];
        let first = true;
        for (const seg of contour.segments()) {
            if (first) {
                points.push({ x: seg.p0.x, y: seg.p0.y, on: true });
                first = false;
            }
            if (seg.type === "line") {
                points.push({ x: seg.p1.x, y: seg.p1.y, on: true });
            } else if (seg.type === "quad") {
                points.push({ x: seg.control.x, y: seg.control.y, on: false });
                points.push({ x: seg.p1.x, y: seg.p1.y, on: true });
            } else {
                const quads = cubicToQuadratics(
                    seg.p0, seg.control1, seg.control2, seg.p1, this.tolerance
                );
                for (const q of quads) {
                    points.push({ x: q.control.x, y: q.control.y, on: false });
                    points.push({ x: q.end.x, y: q.end.y, on: true });
                }
            }
        }
        return points;
    }

    prepareGlyph(glyph) {
        if (glyph.isComposite) {
            return { type: "composite", glyph };
        }

        const contours = [];
        for (const contour of glyph.contours) {
            const pts = this.contourToPoints(contour);
            if (pts.length > 0) contours.push(pts);
        }

        if (contours.length === 0) return { type: "empty", glyph };
        return { type: "simple", glyph, contours };
    }

    clampInt16(value, glyph) {
        const n = Math.round(value);
        if (n < -32768 || n > 32767) {
            throw new Error(`glyph '${glyph.name || "?"}' coordinate ${n} is outside the int16 range`);
        }
        return n;
    }

    writeSimpleGlyph(glyph, contours) {
        const w = new ByteWriter();
        const box = glyph.getBoundingBox();
        const flat = contours.flat();
        const clamp = (v) => this.clampInt16(v, glyph);

        w.i16(contours.length);
        w.i16(clamp(box.xMin));
        w.i16(clamp(box.yMin));
        w.i16(clamp(box.xMax));
        w.i16(clamp(box.yMax));

        let last = -1;
        for (const contour of contours) {
            last += contour.length;
            w.u16(last);
        }

        w.u16(glyph.instructions.length);
        w.bytes(glyph.instructions);

        const flags = [];
        const xBytes = [];
        const yBytes = [];

        let prevX = 0;
        let prevY = 0;
        for (const p of flat) {
            const x = clamp(p.x);
            const y = clamp(p.y);
            const dx = x - prevX;
            const dy = y - prevY;
            prevX = x;
            prevY = y;

            let flag = p.on ? 0x01 : 0x00;

            if (dx === 0) {
                flag |= 0x10;
            } else if (dx >= -255 && dx <= 255) {
                flag |= 0x02;
                if (dx > 0) flag |= 0x10;
                xBytes.push(Math.abs(dx));
            } else {
                xBytes.push((dx >> 8) & 0xff, dx & 0xff);
            }

            if (dy === 0) {
                flag |= 0x20;
            } else if (dy >= -255 && dy <= 255) {
                flag |= 0x04;
                if (dy > 0) flag |= 0x20;
                yBytes.push(Math.abs(dy));
            } else {
                yBytes.push((dy >> 8) & 0xff, dy & 0xff);
            }

            flags.push(flag);
        }

        let i = 0;
        while (i < flags.length) {
            const flag = flags[i];
            let run = 1;
            while (i + run < flags.length && flags[i + run] === flag && run < 255) run++;
            if (run > 1) {
                w.u8(flag | 0x08);
                w.u8(run - 1);
            } else {
                w.u8(flag);
            }
            i += run;
        }

        w.bytes(xBytes);
        w.bytes(yBytes);
        return w.toUint8Array();
    }

    writeCompositeGlyph(glyph) {
        const w = new ByteWriter();
        const box = glyph.getBoundingBox((i) => this.doc.resolveGlyph(i));

        w.i16(-1);
        w.i16(this.clampInt16(box.xMin, glyph));
        w.i16(this.clampInt16(box.yMin, glyph));
        w.i16(this.clampInt16(box.xMax, glyph));
        w.i16(this.clampInt16(box.yMax, glyph));

        const components = glyph.components;
        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            const t = comp.transform;
            const isLast = i === components.length - 1;

            let flags = 0;
            const hasXY = t.b !== 0 || t.c !== 0;
            const hasXYScale = !hasXY && t.a !== t.d;
            const hasScale = !hasXY && !hasXYScale && (t.a !== 1 || t.d !== 1);

            if (hasXY) flags |= 0x0080;
            else if (hasXYScale) flags |= 0x0040;
            else if (hasScale) flags |= 0x0008;

            const useXY = (comp.flags & 0x0002) !== 0 || comp.flags === 0;
            let arg1 = comp.arg1;
            let arg2 = comp.arg2;
            if (useXY) {
                flags |= 0x0002;
                arg1 = Math.round(t.e);
                arg2 = Math.round(t.f);
            }

            flags |= comp.flags & (0x0004 | 0x0200 | 0x0400 | 0x0800 | 0x1000);
            if (!isLast) flags |= 0x0020;
            if (isLast && glyph.instructions.length > 0) flags |= 0x0100;

            if (arg1 < -128 || arg1 > 127 || arg2 < -128 || arg2 > 127) {
                flags |= 0x0001;
            }

            w.u16(flags);
            w.u16(comp.glyphIndex);

            if (flags & 0x0001) {
                w.i16(arg1);
                w.i16(arg2);
            } else {
                w.i8(arg1);
                w.i8(arg2);
            }

            if (flags & 0x0008) {
                w.f2dot14(t.a);
            } else if (flags & 0x0040) {
                w.f2dot14(t.a);
                w.f2dot14(t.d);
            } else if (flags & 0x0080) {
                w.f2dot14(t.a);
                w.f2dot14(t.b);
                w.f2dot14(t.c);
                w.f2dot14(t.d);
            }
        }

        if (glyph.instructions.length > 0) {
            w.u16(glyph.instructions.length);
            w.bytes(glyph.instructions);
        }

        return w.toUint8Array();
    }

    buildGlyf(stats) {
        const glyf = new ByteWriter();
        const loca = [];

        for (const glyph of this.doc.glyphs) {
            loca.push(glyf.length);
            const prepared = this.prepareGlyph(glyph);

            if (prepared.type === "empty") continue;

            if (prepared.type === "composite") {
                const bytes = this.writeCompositeGlyph(glyph);
                glyf.bytes(bytes);
                const outline = glyph.getOutlineContours((i) => this.doc.resolveGlyph(i));
                let compositePoints = 0;
                for (const c of outline) compositePoints += c.points.length;
                stats.maxCompositeContours = Math.max(stats.maxCompositeContours, outline.length);
                stats.maxCompositePoints = Math.max(stats.maxCompositePoints, compositePoints);
                stats.maxComponentElements = Math.max(stats.maxComponentElements, glyph.components.length);
            } else {
                const bytes = this.writeSimpleGlyph(glyph, prepared.contours);
                glyf.bytes(bytes);
                let pointCount = 0;
                for (const c of prepared.contours) pointCount += c.length;
                stats.maxPoints = Math.max(stats.maxPoints, pointCount);
                stats.maxContours = Math.max(stats.maxContours, prepared.contours.length);
            }

            while (glyf.length % 4 !== 0) glyf.u8(0);
        }

        loca.push(glyf.length);
        return { glyf, loca };
    }

    componentDepth(index, visiting, cache) {
        if (cache.has(index)) return cache.get(index);
        if (visiting.has(index)) return 1;
        const glyph = this.doc.glyphs[index];
        if (!glyph || !glyph.isComposite) return 0;
        visiting.add(index);
        let depth = 0;
        for (const comp of glyph.components) {
            depth = Math.max(depth, 1 + this.componentDepth(comp.glyphIndex, visiting, cache));
        }
        visiting.delete(index);
        cache.set(index, depth);
        return depth;
    }

    buildGlyfWithStats() {
        const stats = {
            maxPoints: 0,
            maxContours: 0,
            maxCompositePoints: 0,
            maxCompositeContours: 0,
            maxComponentElements: 0,
            maxComponentDepth: 0,
            maxSizeOfInstructions: 0,
        };
        const { glyf, loca } = this.buildGlyf(stats);

        const cache = new Map();
        for (let i = 0; i < this.doc.glyphs.length; i++) {
            stats.maxComponentDepth = Math.max(stats.maxComponentDepth, this.componentDepth(i, new Set(), cache));
            stats.maxSizeOfInstructions = Math.max(stats.maxSizeOfInstructions, this.doc.glyphs[i].instructions.length);
        }

        const longLoca = loca.some((o) => o > 0x1fffe);
        return { glyf, loca, stats, longLoca };
    }

    buildHead(longLoca) {
        const box = this.doc.getBoundingBox();
        const w = new ByteWriter();
        const head = this.doc.head;

        w.fixed(head.version || 1.0);
        w.fixed(head.fontRevision || 1.0);
        w.u32(0);
        w.u32(0x5f0f3cf5);
        w.u16(head.flags ?? 3);
        w.u16(this.doc.unitsPerEm);
        const created = this.doc.created || Math.floor(Date.now() / 1000) + 2082844800;
        const modified = this.doc.modified || created;
        w.u32((created / 4294967296) >>> 0);
        w.u32(created >>> 0);
        w.u32((modified / 4294967296) >>> 0);
        w.u32(modified >>> 0);
        w.i16(Math.round(box.xMin));
        w.i16(Math.round(box.yMin));
        w.i16(Math.round(box.xMax));
        w.i16(Math.round(box.yMax));
        w.u16(head.macStyle ?? 0);
        w.u16(head.lowestRecPPEM ?? 8);
        w.i16(head.fontDirectionHint ?? 2);
        w.i16(longLoca ? 1 : 0);
        w.i16(0);
        return w.toUint8Array();
    }

    buildHhea() {
        const w = new ByteWriter();
        w.fixed(1.0);

        let advanceWidthMax = 0;
        let minLsB = 0x7fff;
        let minRsB = 0x7fff;
        let xMaxExtent = -0x8000;

        for (const glyph of this.doc.glyphs) {
            const box = glyph.getBoundingBox((i) => this.doc.resolveGlyph(i));
            const advance = glyph.advanceWidth;
            const lsb = glyph.leftSideBearing;
            advanceWidthMax = Math.max(advanceWidthMax, advance);
            minLsB = Math.min(minLsB, lsb);
            const extent = lsb + (box ? box.width : 0);
            xMaxExtent = Math.max(xMaxExtent, extent);
            minRsB = Math.min(minRsB, advance - extent);
        }
        if (this.doc.glyphs.length === 0) {
            minLsB = 0;
            minRsB = 0;
            xMaxExtent = 0;
        }

        w.i16(this.doc.metrics.ascender);
        w.i16(this.doc.metrics.descender);
        w.i16(this.doc.metrics.lineGap);
        w.u16(advanceWidthMax);
        w.i16(minLsB);
        w.i16(minRsB);
        w.i16(xMaxExtent);
        w.i16(this.doc.hhea.caretSlopeRise ?? 1);
        w.i16(this.doc.hhea.caretSlopeRun ?? 0);
        w.i16(this.doc.hhea.caretOffset ?? 0);
        w.i16(0);
        w.i16(0);
        w.i16(0);
        w.i16(0);
        w.i16(0);
        w.u16(this.doc.numGlyphs);
        return w.toUint8Array();
    }

    buildMaxp(stats) {
        const w = new ByteWriter();
        w.fixed(1.0);
        w.u16(this.doc.numGlyphs);
        w.u16(stats.maxPoints);
        w.u16(stats.maxContours);
        w.u16(stats.maxCompositePoints);
        w.u16(stats.maxCompositeContours);
        w.u16(2);
        w.u16(0);
        w.u16(0);
        w.u16(0);
        w.u16(0);
        w.u16(0);
        w.u16(stats.maxSizeOfInstructions);
        w.u16(stats.maxComponentElements);
        w.u16(stats.maxComponentDepth);
        return w.toUint8Array();
    }

    buildHmtx() {
        const w = new ByteWriter();
        for (const glyph of this.doc.glyphs) {
            w.u16(Math.max(0, Math.round(glyph.advanceWidth)));
            w.i16(Math.round(glyph.leftSideBearing));
        }
        return w.toUint8Array();
    }

    buildOS2() {
        const w = new ByteWriter();
        const o = this.doc.os2;
        const bmp = this.doc.glyphs
            .flatMap((g) => g.unicodes)
            .filter((c) => c <= 0xffff);

        const first = bmp.length ? Math.min(...bmp) : 0;
        const last = bmp.length ? Math.max(...bmp) : 0;

        w.u16(4);
        w.i16(o.xAvgCharWidth || this.averageAdvance());
        w.u16(o.weightClass ?? 400);
        w.u16(o.widthClass ?? 5);
        w.u16(o.fsType ?? 0);
        w.i16(o.ySubscriptXSize ?? 650);
        w.i16(o.ySubscriptYSize ?? 600);
        w.i16(o.ySubscriptXOffset ?? 0);
        w.i16(o.ySubscriptYOffset ?? 75);
        w.i16(o.ySuperscriptXSize ?? 650);
        w.i16(o.ySuperscriptYSize ?? 600);
        w.i16(o.ySuperscriptXOffset ?? 0);
        w.i16(o.ySuperscriptYOffset ?? 350);
        w.i16(o.yStrikeoutSize ?? 50);
        w.i16(o.yStrikeoutPosition ?? 250);
        w.i16(o.familyClass ?? 0);
        w.bytes(o.panose ?? new Array(10).fill(0));
        const ranges = o.unicodeRanges ?? [0, 0, 0, 0];
        w.u32(ranges[0] || 0);
        w.u32(ranges[1] || 0);
        w.u32(ranges[2] || 0);
        w.u32(ranges[3] || 0);
        const vendor = (o.vendorId || "NONE").padEnd(4, " ").slice(0, 4);
        w.bytes([...vendor].map((c) => c.charCodeAt(0)));
        w.u16(o.fsSelection ?? 0x0040);
        w.u16(first);
        w.u16(last);
        w.i16(o.typoAscender ?? this.doc.metrics.ascender);
        w.i16(o.typoDescender ?? this.doc.metrics.descender);
        w.i16(o.typoLineGap ?? this.doc.metrics.lineGap);
        w.u16(o.winAscent ?? Math.max(0, this.doc.metrics.ascender));
        w.u16(o.winDescent ?? Math.abs(Math.min(0, this.doc.metrics.descender)));
        const codePages = o.codePageRange ?? [0, 0];
        w.u32(codePages[0] || 0);
        w.u32(codePages[1] || 0);
        w.i16(o.sxHeight ?? this.doc.metrics.xHeight);
        w.i16(o.sCapHeight ?? this.doc.metrics.capHeight);
        w.u16(o.defaultChar ?? 0);
        w.u16(o.breakChar ?? 32);
        w.u16(o.maxContext ?? 0);
        return w.toUint8Array();
    }

    averageAdvance() {
        let sum = 0;
        let count = 0;
        for (const glyph of this.doc.glyphs) {
            if (glyph.advanceWidth > 0) {
                sum += glyph.advanceWidth;
                count++;
            }
        }
        return count ? Math.round(sum / count) : 0;
    }

    buildName() {
        const required = {
            0: this.doc.getName(0, "Generated by ScalarCanvas"),
            1: this.doc.familyName,
            2: this.doc.styleName,
            3: this.doc.getName(3, `${this.doc.familyName};${this.doc.styleName};1.0`),
            4: this.doc.fullName,
            5: this.doc.getName(5, "Version 1.0"),
            6: this.doc.postScriptName,
        };

        const strings = [];
        const records = [];
        let stringOffset = 0;

        for (const [nameID, text] of Object.entries(required)) {
            const encoded = utf16be(text);
            records.push({
                platformID: 3,
                encodingID: 1,
                languageID: 0x0409,
                nameID: Number(nameID),
                length: encoded.length,
                offset: stringOffset,
            });
            strings.push(...encoded);
            stringOffset += encoded.length;
        }

        const w = new ByteWriter();
        w.u16(0);
        w.u16(records.length);
        w.u16(6 + records.length * 12);
        for (const rec of records) {
            w.u16(rec.platformID);
            w.u16(rec.encodingID);
            w.u16(rec.languageID);
            w.u16(rec.nameID);
            w.u16(rec.length);
            w.u16(rec.offset);
        }
        w.bytes(strings);
        return w.toUint8Array();
    }

    buildPost() {
        const w = new ByteWriter();
        w.fixed(3.0);
        w.fixed(this.doc.post.italicAngle || 0);
        w.i16(this.doc.post.underlinePosition ?? -100);
        w.i16(this.doc.post.underlineThickness ?? 50);
        w.u32(this.doc.post.isFixedPitch ?? 0);
        w.u32(0);
        w.u32(0);
        w.u32(0);
        w.u32(0);
        return w.toUint8Array();
    }

    buildCmap() {
        const mapping = [];
        for (let i = 0; i < this.doc.glyphs.length; i++) {
            for (const cp of this.doc.glyphs[i].unicodes) {
                if (cp >= 0 && cp <= 0x10ffff && cp !== 0xffff) {
                    mapping.push([cp, i]);
                }
            }
        }
        mapping.sort((a, b) => a[0] - b[0]);

        const format4 = this.buildCmapFormat4(mapping.filter(([c]) => c <= 0xffff));
        const format12 = this.buildCmapFormat12(mapping);

        const records = [
            { platformID: 0, encodingID: 3, format: 4 },
            { platformID: 0, encodingID: 4, format: 12 },
            { platformID: 3, encodingID: 1, format: 4 },
            { platformID: 3, encodingID: 10, format: 12 },
        ];

        const headerLen = 4 + records.length * 8;
        let offset4 = headerLen;
        let offset12 = offset4 + format4.length;
        if (offset12 % 2 !== 0) {
            offset12 += 1;
        }

        const w = new ByteWriter();
        w.u16(0);
        w.u16(records.length);
        for (const rec of records) {
            w.u16(rec.platformID);
            w.u16(rec.encodingID);
            w.u32(rec.format === 4 ? offset4 : offset12);
        }
        w.bytes(format4);
        if (offset12 !== headerLen + format4.length) w.u8(0);
        w.bytes(format12);
        return w.toUint8Array();
    }

    buildCmapFormat4(entries) {
        const segments = [];
        let i = 0;
        while (i < entries.length) {
            const [startCode, startGid] = entries[i];
            let end = i;
            let endCode = startCode;
            while (
                end + 1 < entries.length &&
                entries[end + 1][0] === entries[end][0] + 1 &&
                entries[end + 1][1] === entries[end][1] + 1
            ) {
                end++;
                endCode = entries[end][0];
            }
            segments.push({
                startCode,
                endCode,
                idDelta: (startGid - startCode) & 0xffff,
            });
            i = end + 1;
        }

        segments.push({ startCode: 0xffff, endCode: 0xffff, idDelta: 1 });

        const segCount = segments.length;
        const segCountX2 = segCount * 2;
        let entrySelector = 0;
        while ((1 << (entrySelector + 1)) <= segCount) entrySelector++;
        const searchRange = 2 * (1 << entrySelector);
        const rangeShift = segCountX2 - searchRange;

        const w = new ByteWriter();
        w.u16(4);
        w.u16(16 + segCount * 8);
        w.u16(0);
        w.u16(segCountX2);
        w.u16(searchRange);
        w.u16(entrySelector);
        w.u16(rangeShift);
        for (const s of segments) w.u16(s.endCode);
        w.u16(0);
        for (const s of segments) w.u16(s.startCode);
        for (const s of segments) w.i16(s.idDelta);
        for (let s = 0; s < segCount; s++) w.u16(0);
        return w.toUint8Array();
    }

    buildCmapFormat12(entries) {
        const groups = [];
        let i = 0;
        while (i < entries.length) {
            const startChar = entries[i][0];
            const startGid = entries[i][1];
            let end = i;
            while (
                end + 1 < entries.length &&
                entries[end + 1][0] === entries[end][0] + 1 &&
                entries[end + 1][1] === entries[end][1] + 1
            ) {
                end++;
            }
            groups.push({
                startChar,
                endChar: entries[end][0],
                startGid,
            });
            i = end + 1;
        }

        const w = new ByteWriter();
        w.u16(12);
        w.u16(0);
        w.u32(16 + groups.length * 12);
        w.u32(0);
        w.u32(groups.length);
        for (const g of groups) {
            w.u32(g.startChar);
            w.u32(g.endChar);
            w.u32(g.startGid);
        }
        return w.toUint8Array();
    }

    buildKern() {
        const pairs = [];
        for (const [key, value] of this.doc.kerning) {
            const [left, right] = key.split(",").map(Number);
            if (Number.isFinite(left) && Number.isFinite(right)) {
                pairs.push([left, right, value]);
            }
        }
        if (pairs.length === 0) return null;
        pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

        const subtable = new ByteWriter();
        const nPairs = pairs.length;
        let searchRange = 6;
        let entrySelector = 0;
        while (searchRange * 2 <= nPairs * 6) {
            searchRange *= 2;
            entrySelector++;
        }
        const rangeShift = nPairs * 6 - searchRange;
        subtable.u16(0);
        subtable.u16(14 + nPairs * 6);
        subtable.u16(0);
        subtable.u16(nPairs);
        subtable.u16(searchRange);
        subtable.u16(entrySelector);
        subtable.u16(rangeShift);
        for (const [left, right, value] of pairs) {
            subtable.u16(left);
            subtable.u16(right);
            subtable.i16(value);
        }

        const w = new ByteWriter();
        w.u16(0);
        w.u16(1);
        w.bytes(subtable.toUint8Array());
        return w.toUint8Array();
    }

    write() {
        const doc = this.doc;
        if (this.correctDirection) {
            for (const glyph of doc.glyphs) {
                if (!glyph.isComposite) glyph.correctDirection();
            }
        }

        const { glyf, loca, stats, longLoca } = this.buildGlyfWithStats();

        const locaBytes = (() => {
            const w = new ByteWriter();
            if (longLoca) {
                for (const offset of loca) w.u32(offset);
            } else {
                for (const offset of loca) w.u16(offset / 2);
            }
            return w.toUint8Array();
        })();

        const tables = {
            "cmap": this.buildCmap(),
            "glyf": glyf.toUint8Array(),
            "head": this.buildHead(longLoca),
            "hhea": this.buildHhea(),
            "hmtx": this.buildHmtx(),
            "loca": locaBytes,
            "maxp": this.buildMaxp(stats),
            "name": this.buildName(),
            "OS/2": this.buildOS2(),
            "post": this.buildPost(),
        };

        const kern = this.buildKern();
        if (kern) tables["kern"] = kern;

        const tags = Object.keys(tables).sort();
        const numTables = tags.length;
        const headerSize = 12 + numTables * 16;

        const directory = [];
        let offset = headerSize;
        for (const tag of tags) {
            const bytes = pad4(tables[tag]);
            tables[tag] = bytes;
            directory.push({
                tag,
                checksum: checksum(bytes),
                offset,
                length: tables[tag].length,
            });
            offset += bytes.length;
        }

        const total = offset;
        const font = new Uint8Array(total);
        const view = new DataView(font.buffer);

        view.setUint32(0, 0x00010000, false);
        view.setUint16(4, numTables, false);
        let searchRange = 1;
        while (searchRange * 2 <= numTables) searchRange *= 2;
        const entrySelector = Math.log2(searchRange);
        searchRange *= 16;
        const rangeShift = numTables * 16 - searchRange;
        view.setUint16(6, searchRange, false);
        view.setUint16(8, entrySelector, false);
        view.setUint16(10, rangeShift, false);

        let dirPos = 12;
        for (const entry of directory) {
            for (let i = 0; i < 4; i++) font[dirPos + i] = entry.tag.charCodeAt(i);
            view.setUint32(dirPos + 4, entry.checksum, false);
            view.setUint32(dirPos + 8, entry.offset, false);
            view.setUint32(dirPos + 12, entry.length, false);
            font.set(tables[entry.tag], entry.offset);
            dirPos += 16;
        }

        // head.checkSumAdjustment = 0xB1B0AFBA - checksum(entire font)
        const adjustment = (0xb1b0afba - checksum(font)) >>> 0;
        const headOffset = directory.find((d) => d.tag === "head").offset;
        view.setUint32(headOffset + 8, adjustment, false);

        return font.buffer;
    }
}
