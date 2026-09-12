class ByteReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer);
        this.pos = 0;
    }

    seek(pos) {
        this.pos = pos;
    }

    skip(n) {
        this.pos += n;
    }

    u8() {
        return this.view.getUint8(this.pos++);
    }

    i8() {
        return this.view.getInt8(this.pos++);
    }

    u16() {
        const v = this.view.getUint16(this.pos, false);
        this.pos += 2;
        return v;
    }

    i16() {
        const v = this.view.getInt16(this.pos, false);
        this.pos += 2;
        return v;
    }

    u32() {
        const v = this.view.getUint32(this.pos, false);
        this.pos += 4;
        return v;
    }

    i32() {
        const v = this.view.getInt32(this.pos, false);
        this.pos += 4;
        return v;
    }

    fixed() {
        return this.i32() / 65536;
    }

    f2dot14() {
        return this.i16() / 16384;
    }

    tag() {
        let s = "";
        for (let i = 0; i < 4; i++) s += String.fromCharCode(this.u8());
        return s;
    }

    bytes(n) {
        const out = new Uint8Array(this.buffer, this.pos, n);
        this.pos += n;
        return out;
    }

    get remaining() {
        return this.buffer.byteLength - this.pos;
    }
}

function decodeWindowsString(bytes) {
    let s = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) {
        s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return s;
}

function decodeMacString(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i]);
    }
    return s;
}

class TTFReader {
    constructor(buffer) {
        if (buffer instanceof ArrayBuffer) {
            this.buffer = buffer;
        } else {
            this.buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
        this.view = new DataView(this.buffer);
        this.tables = {};
    }

    readTableDirectory() {
        const r = new ByteReader(this.buffer);
        const sfnt = r.u32();
        this.sfntVersion = sfnt;

        if (sfnt === 0x4f54544f) {
            throw new Error("OpenType/CFF (.otf) fonts are not supported yet. Use a TrueType (.ttf) font.");
        }
        if (sfnt !== 0x00010000 && sfnt !== 0x74727565) {
            throw new Error(`Unrecognized font signature 0x${sfnt.toString(16)}`);
        }

        const numTables = r.u16();
        r.skip(6);

        for (let i = 0; i < numTables; i++) {
            const tag = r.tag();
            const checksum = r.u32();
            const offset = r.u32();
            const length = r.u32();
            this.tables[tag] = { offset, length, checksum };
        }
    }

    requireTable(tag) {
        if (!this.tables[tag]) throw new Error(`Missing required table '${tag}'`);
        return this.tables[tag];
    }

    parse() {
        this.readTableDirectory();

        const doc = new FontDocument();
        this.parseHead(doc);
        this.parseMaxp(doc);
        this.parseHhea(doc);
        this.parseOS2(doc);
        this.parsePost(doc);
        this.parseName(doc);
        this.parseGlyphs(doc);
        this.parseHmtx(doc);
        this.parseCmap(doc);
        this.parseKern(doc);
        return doc;
    }

    parseHead(doc) {
        const t = this.requireTable("head");
        const r = new ByteReader(this.buffer);
        r.seek(t.offset);
        const version = r.fixed();
        doc.head.version = version;
        doc.head.fontRevision = r.fixed();
        r.u32(); // checkSumAdjustment
        r.u32(); // magicNumber
        doc.head.flags = r.u16();
        doc.unitsPerEm = r.u16() || 1000;
        doc.head.created = r.u32();
        r.u32(); // low 32 bits of created
        doc.head.modified = r.u32();
        r.u32();
        r.i16(); // xMin
        r.i16(); // yMin
        r.i16(); // xMax
        r.i16(); // yMax
        doc.head.macStyle = r.u16();
        doc.head.lowestRecPPEM = r.u16();
        doc.head.fontDirectionHint = r.i16();
        doc.indexToLocFormat = r.i16();
        r.i16(); // glyphDataFormat
    }

    parseMaxp(doc) {
        const t = this.requireTable("maxp");
        const r = new ByteReader(this.buffer);
        r.seek(t.offset);
        this.maxpVersion = r.fixed();
        this.numGlyphs = r.u16();
    }

    parseHhea(doc) {
        const t = this.requireTable("hhea");
        const r = new ByteReader(this.buffer);
        r.seek(t.offset);
        r.fixed();
        doc.metrics.ascender = r.i16();
        doc.metrics.descender = r.i16();
        doc.metrics.lineGap = r.i16();
        this.advanceWidthMax = r.u16();
        this.minLeftSideBearing = r.i16();
        this.minRightSideBearing = r.i16();
        this.xMaxExtent = r.i16();
        doc.hhea.caretSlopeRise = r.i16();
        doc.hhea.caretSlopeRun = r.i16();
        doc.hhea.caretOffset = r.i16();
        r.skip(8);
        r.i16(); // metricDataFormat
        this.numberOfHMetrics = r.u16();
    }

    parseOS2(doc) {
        const table = this.tables["OS/2"];
        if (!table) return;
        const r = new ByteReader(this.buffer);
        r.seek(table.offset);
        const o = doc.os2;
        o.version = r.u16();
        o.xAvgCharWidth = r.i16();
        o.weightClass = r.u16();
        o.widthClass = r.u16();
        o.fsType = r.u16();
        o.ySubscriptXSize = r.i16();
        o.ySubscriptYSize = r.i16();
        o.ySubscriptXOffset = r.i16();
        o.ySubscriptYOffset = r.i16();
        o.ySuperscriptXSize = r.i16();
        o.ySuperscriptYSize = r.i16();
        o.ySuperscriptXOffset = r.i16();
        o.ySuperscriptYOffset = r.i16();
        o.yStrikeoutSize = r.i16();
        o.yStrikeoutPosition = r.i16();
        o.familyClass = r.i16();
        o.panose = Array.from(r.bytes(10));
        o.unicodeRanges = [r.u32(), r.u32(), r.u32(), r.u32()];
        o.vendorId = String.fromCharCode(...r.bytes(4));
        o.fsSelection = r.u16();
        o.firstCharIndex = r.u16();
        o.lastCharIndex = r.u16();
        o.typoAscender = r.i16();
        o.typoDescender = r.i16();
        o.typoLineGap = r.i16();
        o.winAscent = r.u16();
        o.winDescent = r.u16();

        if (o.version >= 1 && r.remaining >= 8) {
            o.codePageRange = [r.u32(), r.u32()];
        }
        if (o.version >= 2 && r.remaining >= 10) {
            o.sxHeight = r.i16();
            o.sCapHeight = r.i16();
            o.defaultChar = r.u16();
            o.breakChar = r.u16();
            o.maxContext = r.u16();
        }

        doc.metrics.xHeight = o.sxHeight || doc.metrics.xHeight;
        doc.metrics.capHeight = o.sCapHeight || doc.metrics.capHeight;
    }

    parsePost(doc) {
        const table = this.tables["post"];
        if (!table) return;
        const r = new ByteReader(this.buffer);
        r.seek(table.offset);
        const version = r.fixed();
        this.postVersion = version;
        doc.post.italicAngle = r.fixed();
        doc.post.underlinePosition = r.i16();
        doc.post.underlineThickness = r.i16();
        doc.post.isFixedPitch = r.u32();
        doc.post.minMemType42 = r.u32();
        doc.post.maxMemType42 = r.u32();
        doc.post.minMemType1 = r.u32();
        doc.post.maxMemType1 = r.u32();

        doc.metrics.italicAngle = doc.post.italicAngle;
        doc.metrics.underlinePosition = doc.post.underlinePosition;
        doc.metrics.underlineThickness = doc.post.underlineThickness;
        doc.metrics.isFixedPitch = doc.post.isFixedPitch;

        this.postNames = null;
        if (Math.abs(version - 2.0) < 0.001) {
            const count = r.u16();
            const indices = [];
            for (let i = 0; i < count; i++) indices.push(r.u16());

            const custom = [];
            const namesStart = r.pos;
            while (r.pos < table.offset + table.length) {
                const len = r.u8();
                if (r.pos + len > table.offset + table.length) break;
                let s = "";
                for (let i = 0; i < len; i++) s += String.fromCharCode(r.u8());
                custom.push(s);
            }
            this.postNames = indices.map((idx) =>
                idx < STANDARD_GLYPH_NAMES.length ? STANDARD_GLYPH_NAMES[idx] : (custom[idx - 258] || null)
            );
            void namesStart;
        }
    }

    parseName(doc) {
        const table = this.tables["name"];
        if (!table) return;
        const r = new ByteReader(this.buffer);
        r.seek(table.offset);
        const format = r.u16();
        const count = r.u16();
        const stringOffset = r.u16();
        void format;

        const records = [];
        for (let i = 0; i < count; i++) {
            records.push({
                platformID: r.u16(),
                encodingID: r.u16(),
                languageID: r.u16(),
                nameID: r.u16(),
                length: r.u16(),
                offset: r.u16(),
            });
        }

        const best = new Map();
        const score = (rec) => {
            if (rec.platformID === 3 && rec.encodingID === 1 && rec.languageID === 0x0409) return 100;
            if (rec.platformID === 3 && rec.encodingID === 1) return 80;
            if (rec.platformID === 0) return 60;
            if (rec.platformID === 1 && rec.languageID === 0) return 40;
            return 10;
        };

        for (const rec of records) {
            const start = table.offset + stringOffset + rec.offset;
            if (start + rec.length > this.buffer.byteLength) continue;
            const raw = new Uint8Array(this.buffer, start, rec.length);
            const text = rec.platformID === 3 || rec.platformID === 0
                ? decodeWindowsString(raw)
                : decodeMacString(raw);
            const existing = best.get(rec.nameID);
            if (!existing || score(rec) > existing.score) {
                best.set(rec.nameID, { text, score: score(rec) });
            }
        }

        for (const [nameID, entry] of best) {
            if (entry.text) doc.setName(nameID, entry.text);
        }
    }

    parseLoca() {
        const head = this.requireTable("head");
        const loca = this.requireTable("loca");
        const r = new ByteReader(this.buffer);
        r.seek(head.offset + 50);
        const indexToLocFormat = r.i16();

        const offsets = [];
        r.seek(loca.offset);
        if (indexToLocFormat === 0) {
            for (let i = 0; i <= this.numGlyphs; i++) offsets.push(r.u16() * 2);
        } else {
            for (let i = 0; i <= this.numGlyphs; i++) offsets.push(r.u32());
        }
        return offsets;
    }

    parseGlyphs(doc) {
        const glyf = this.requireTable("glyf");
        const loca = this.parseLoca();

        doc.glyphs = [];
        for (let i = 0; i < this.numGlyphs; i++) {
            const start = loca[i];
            const end = loca[i + 1];
            const glyph = new Glyph();
            glyph.name = (this.postNames && this.postNames[i]) || "";

            if (start === end) {
                doc.addGlyph(glyph);
                continue;
            }

            this.parseGlyphData(glyf.offset + start, glyf.offset + end, glyph);
            doc.addGlyph(glyph);
        }
    }

    parseGlyphData(start, end, glyph) {
        const r = new ByteReader(this.buffer);
        r.seek(start);
        const numberOfContours = r.i16();
        glyph.xMin = r.i16();
        glyph.yMin = r.i16();
        glyph.xMax = r.i16();
        glyph.yMax = r.i16();

        if (numberOfContours >= 0) {
            this.parseSimpleGlyph(r, numberOfContours, glyph, end);
        } else {
            this.parseCompositeGlyph(r, glyph, end);
        }
    }

    parseSimpleGlyph(r, numberOfContours, glyph, end) {
        const endPts = [];
        for (let i = 0; i < numberOfContours; i++) endPts.push(r.u16());

        const instructionLength = r.u16();
        glyph.instructions = new Uint8Array(r.bytes(instructionLength));

        const numPoints = numberOfContours > 0 ? endPts[numberOfContours - 1] + 1 : 0;

        const flags = [];
        while (flags.length < numPoints) {
            const flag = r.u8();
            flags.push(flag);
            if (flag & 0x08) {
                const repeat = r.u8();
                for (let k = 0; k < repeat && flags.length < numPoints; k++) flags.push(flag);
            }
        }

        const xs = [];
        let x = 0;
        for (let i = 0; i < numPoints; i++) {
            const flag = flags[i];
            if (flag & 0x02) {
                const dx = r.u8();
                x += flag & 0x10 ? dx : -dx;
            } else if (!(flag & 0x10)) {
                x += r.i16();
            }
            xs.push(x);
        }

        const ys = [];
        let y = 0;
        for (let i = 0; i < numPoints; i++) {
            const flag = flags[i];
            if (flag & 0x04) {
                const dy = r.u8();
                y += flag & 0x20 ? dy : -dy;
            } else if (!(flag & 0x20)) {
                y += r.i16();
            }
            ys.push(y);
        }
        void end;

        let pointIndex = 0;
        for (let c = 0; c < numberOfContours; c++) {
            const contour = new Contour([], true);
            const last = endPts[c];
            for (; pointIndex <= last; pointIndex++) {
                const onCurve = (flags[pointIndex] & 0x01) !== 0;
                const point = onCurve
                    ? Point.onCurve(xs[pointIndex], ys[pointIndex])
                    : Point.offCurve(xs[pointIndex], ys[pointIndex], CurveType.Quadratic);
                contour.points.push(point);
            }
            glyph.contours.push(contour);
        }
    }

    parseCompositeGlyph(r, glyph, end) {
        const ARG_1_AND_2_ARE_WORDS = 0x0001;
        const ARGS_ARE_XY_VALUES = 0x0002;
        const WE_HAVE_A_SCALE = 0x0008;
        const MORE_COMPONENTS = 0x0020;
        const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
        const WE_HAVE_A_TWO_BY_TWO = 0x0080;
        const WE_HAVE_INSTRUCTIONS = 0x0100;

        let flags = MORE_COMPONENTS;
        while (flags & MORE_COMPONENTS) {
            flags = r.u16();
            const glyphIndex = r.u16();

            let arg1;
            let arg2;
            if (flags & ARG_1_AND_2_ARE_WORDS) {
                arg1 = r.i16();
                arg2 = r.i16();
            } else {
                arg1 = r.i8();
                arg2 = r.i8();
            }

            let a = 1, b = 0, c = 0, d = 1;
            if (flags & WE_HAVE_A_SCALE) {
                a = d = r.f2dot14();
            } else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) {
                a = r.f2dot14();
                d = r.f2dot14();
            } else if (flags & WE_HAVE_A_TWO_BY_TWO) {
                a = r.f2dot14();
                b = r.f2dot14();
                c = r.f2dot14();
                d = r.f2dot14();
            }

            const e = flags & ARGS_ARE_XY_VALUES ? arg1 : 0;
            const f = flags & ARGS_ARE_XY_VALUES ? arg2 : 0;

            glyph.components.push(new GlyphComponent(
                glyphIndex,
                new AffineTransform(a, b, c, d, e, f),
                flags,
                arg1,
                arg2
            ));
        }

        if (flags & WE_HAVE_INSTRUCTIONS) {
            const instructionLength = r.u16();
            glyph.instructions = new Uint8Array(r.bytes(instructionLength));
        }
        void end;
    }

    parseHmtx(doc) {
        const hmtx = this.requireTable("hmtx");
        const r = new ByteReader(this.buffer);
        r.seek(hmtx.offset);

        const numHMetrics = this.numberOfHMetrics || this.numGlyphs;
        let lastAdvance = 0;

        for (let i = 0; i < this.numGlyphs; i++) {
            const glyph = doc.glyphs[i];
            if (!glyph) continue;
            if (i < numHMetrics) {
                lastAdvance = r.u16();
                glyph.leftSideBearing = r.i16();
            } else {
                glyph.leftSideBearing = r.i16();
            }
            glyph.advanceWidth = lastAdvance;
        }
    }

    parseCmap(doc) {
        const table = this.requireTable("cmap");
        const r = new ByteReader(this.buffer);
        r.seek(table.offset);
        const version = r.u16();
        const numTables = r.u16();
        void version;

        const subtables = [];
        for (let i = 0; i < numTables; i++) {
            subtables.push({
                platformID: r.u16(),
                encodingID: r.u16(),
                offset: r.u32(),
            });
        }

        const score = (s) => {
            const format12 = (s.platformID === 3 && s.encodingID === 10) || (s.platformID === 0 && (s.encodingID === 4 || s.encodingID === 6));
            const format4 = (s.platformID === 3 && s.encodingID === 1) || (s.platformID === 0 && s.encodingID === 3);
            if (format12) return 300;
            if (format4) return 200;
            if (s.platformID === 0) return 100;
            return 10;
        };

        subtables.sort((a, b) => score(b) - score(a));

        let map = null;
        for (const s of subtables) {
            const sub = table.offset + s.offset;
            const format = this.view.getUint16(sub, false);
            if (format === 12 || format === 13) {
                map = this.parseCmapFormat12(sub, format === 13);
            } else if (format === 4) {
                map = this.parseCmapFormat4(sub);
            } else if (format === 6) {
                map = this.parseCmapFormat6(sub);
            } else if (format === 0) {
                map = this.parseCmapFormat0(sub);
            }
            if (map && map.size > 0) break;
        }

        if (!map) return;

        for (const [codepoint, glyphIndex] of map) {
            const glyph = doc.glyphs[glyphIndex];
            if (glyph && !glyph.unicodes.includes(codepoint)) {
                glyph.unicodes.push(codepoint);
            }
        }

        for (const glyph of doc.glyphs) {
            if (!glyph.name && glyph.unicodes.length) {
                glyph.name = unicodeToGlyphName(glyph.unicodes[0]);
            }
            if (!glyph.name && this.postNames) {
                // keep post name
            }
            if (!glyph.name) {
                glyph.name = "glyph" + doc.glyphs.indexOf(glyph);
            }
            // Derive codepoints from glyph names when cmap is missing them.
            if (glyph.unicodes.length === 0) {
                const cp = glyphNameToUnicode(glyph.name);
                if (cp !== null) glyph.unicodes.push(cp);
            }
        }
    }

    parseCmapFormat0(offset) {
        const map = new Map();
        for (let i = 0; i < 256; i++) {
            const gid = this.view.getUint8(offset + 6 + i);
            if (gid) map.set(i, gid);
        }
        return map;
    }

    parseCmapFormat4(offset) {
        const map = new Map();
        const segCountX2 = this.view.getUint16(offset + 6, false);
        const segCount = segCountX2 / 2;

        const endCodes = [];
        const startCodes = [];
        const idDeltas = [];
        const idRangeOffsets = [];

        let ptr = offset + 14;
        for (let i = 0; i < segCount; i++) { endCodes.push(this.view.getUint16(ptr, false)); ptr += 2; }
        ptr += 2;
        for (let i = 0; i < segCount; i++) { startCodes.push(this.view.getUint16(ptr, false)); ptr += 2; }
        for (let i = 0; i < segCount; i++) { idDeltas.push(this.view.getInt16(ptr, false)); ptr += 2; }
        const rangeOffsetBase = ptr;
        for (let i = 0; i < segCount; i++) { idRangeOffsets.push(this.view.getUint16(ptr, false)); ptr += 2; }

        for (let i = 0; i < segCount; i++) {
            for (let c = startCodes[i]; c <= endCodes[i]; c++) {
                if (c === 0xffff) continue;
                let gid;
                if (idRangeOffsets[i] === 0) {
                    gid = (c + idDeltas[i]) & 0xffff;
                } else {
                    const glyphIndexOffset = rangeOffsetBase + i * 2 + idRangeOffsets[i] + (c - startCodes[i]) * 2;
                    if (glyphIndexOffset + 1 >= this.buffer.byteLength) continue;
                    gid = this.view.getUint16(glyphIndexOffset, false);
                    if (gid !== 0) gid = (gid + idDeltas[i]) & 0xffff;
                }
                if (gid) map.set(c, gid);
            }
        }
        return map;
    }

    parseCmapFormat6(offset) {
        const map = new Map();
        const firstCode = this.view.getUint16(offset + 6, false);
        const entryCount = this.view.getUint16(offset + 8, false);
        for (let i = 0; i < entryCount; i++) {
            const gid = this.view.getUint16(offset + 10 + i * 2, false);
            if (gid) map.set(firstCode + i, gid);
        }
        return map;
    }

    parseCmapFormat12(offset, manyToOne = false) {
        const map = new Map();
        const nGroups = this.view.getUint32(offset + 12, false);
        let ptr = offset + 16;
        for (let i = 0; i < nGroups; i++) {
            const startChar = this.view.getUint32(ptr, false); ptr += 4;
            const endChar = this.view.getUint32(ptr, false); ptr += 4;
            const startGlyph = this.view.getUint32(ptr, false); ptr += 4;
            if (manyToOne) {
                for (let c = startChar; c <= endChar; c++) {
                    if (startGlyph) map.set(c, startGlyph);
                }
            } else {
                for (let c = startChar; c <= endChar; c++) {
                    const gid = startGlyph + (c - startChar);
                    if (gid) map.set(c, gid);
                }
            }
        }
        return map;
    }

    parseKern(doc) {
        const table = this.tables["kern"];
        if (!table) return;
        const r = new ByteReader(this.buffer);
        r.seek(table.offset);
        const version = r.u16();
        if (version !== 0) return;
        const nTables = r.u16();

        for (let i = 0; i < nTables; i++) {
            const subtableStart = r.pos;
            r.u16(); // subtable version
            const length = r.u16();
            const coverage = r.u16();
            const format = coverage >> 8;

            if (format === 0) {
                const nPairs = r.u16();
                r.skip(6);
                for (let p = 0; p < nPairs; p++) {
                    const left = r.u16();
                    const right = r.u16();
                    const value = r.i16();
                    if (value !== 0) doc.setKerning(left, right, value);
                }
            }
            r.seek(subtableStart + length);
        }
    }
}
