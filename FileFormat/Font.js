class TTFParser {
  constructor(buffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.tables = {};
    this.cmap = {};
  }

  readUInt8(o)  { return this.view.getUint8(o); }
  readUInt16(o) { return this.view.getUint16(o, false); }
  readInt16(o)  { return this.view.getInt16(o, false); }
  readUInt32(o) { return this.view.getUint32(o, false); }

  parse() {
    let o = 0;
    const sfntVersion = this.readUInt32(o); o += 4;
    const numTables = this.readUInt16(o); o += 2;
    o += 6; // searchRange, entrySelector, rangeShift

    for (let i = 0; i < numTables; i++) {
      const tag = String.fromCharCode(
        this.readUInt8(o), this.readUInt8(o+1),
        this.readUInt8(o+2), this.readUInt8(o+3)
      );
      o += 4;
      o += 4; // checksum
      const offset = this.readUInt32(o); o += 4;
      const length = this.readUInt32(o); o += 4;
      this.tables[tag] = { offset, length };
    }

    if (!this.tables['glyf']) {
      throw new Error('No glyf table found. Only TrueType (.ttf) fonts are supported.');
    }

    this.parseHead();
    this.parseMaxp();
    this.parseCmap();
    this.parseLoca();
  }

  parseHead() {
    const o = this.tables['head'].offset;
    this.unitsPerEm = this.readUInt16(o + 18);
    this.xMin = this.readInt16(o + 36);
    this.yMin = this.readInt16(o + 38);
    this.xMax = this.readInt16(o + 40);
    this.yMax = this.readInt16(o + 42);
    this.indexToLocFormat = this.readInt16(o + 50);
  }

  parseMaxp() {
    const o = this.tables['maxp'].offset;
    this.numGlyphs = this.readUInt16(o + 4);
  }

  parseCmap() {
    const o = this.tables['cmap'].offset;
    const numTables = this.readUInt16(o + 2);
    let subtableOffset = null;

    for (let i = 0; i < numTables; i++) {
      const platformID = this.readUInt16(o + 4 + i * 8);
      const encodingID = this.readUInt16(o + 4 + i * 8 + 2);
      const offset = this.readUInt32(o + 4 + i * 8 + 4);
      if (platformID === 3 && encodingID === 1) {
        subtableOffset = o + offset;
        break;
      }
      if (platformID === 0 && subtableOffset === null) {
        subtableOffset = o + offset;
      }
    }
    if (!subtableOffset && numTables > 0) {
      subtableOffset = o + this.readUInt32(o + 4 + 4);
    }
    if (!subtableOffset) return;

    const format = this.readUInt16(subtableOffset);
    if (format === 4) this.parseCmapFormat4(subtableOffset);
    else if (format === 12) this.parseCmapFormat12(subtableOffset);
  }

  parseCmapFormat4(offset) {
    const segCountX2 = this.readUInt16(offset + 6);
    const segCount = segCountX2 / 2;
    const endCode = [];
    const startCode = [];
    const idDelta = [];
    const idRangeOffset = [];

    let ptr = offset + 14;
    for (let i = 0; i < segCount; i++) { endCode.push(this.readUInt16(ptr)); ptr += 2; }
    ptr += 2; // reservedPad
    for (let i = 0; i < segCount; i++) { startCode.push(this.readUInt16(ptr)); ptr += 2; }
    for (let i = 0; i < segCount; i++) { idDelta.push(this.readInt16(ptr)); ptr += 2; }
    const idRangeOffsetBase = ptr;
    for (let i = 0; i < segCount; i++) { idRangeOffset.push(this.readUInt16(ptr)); ptr += 2; }

    for (let i = 0; i < segCount; i++) {
      for (let c = startCode[i]; c <= endCode[i]; c++) {
        if (idRangeOffset[i] === 0) {
          this.cmap[c] = (c + idDelta[i]) & 0xFFFF;
        } else {
          const glyphIndexOffset = idRangeOffset[i] + 2 * (c - startCode[i]) + (idRangeOffsetBase + i * 2);
          let glyphIndex = this.readUInt16(glyphIndexOffset);
          if (glyphIndex !== 0) glyphIndex = (glyphIndex + idDelta[i]) & 0xFFFF;
          this.cmap[c] = glyphIndex;
        }
      }
    }
  }

  parseCmapFormat12(offset) {
    const nGroups = this.readUInt32(offset + 12);
    let ptr = offset + 16;
    for (let i = 0; i < nGroups; i++) {
      const startCharCode = this.readUInt32(ptr); ptr += 4;
      const endCharCode = this.readUInt32(ptr); ptr += 4;
      const startGlyphCode = this.readUInt32(ptr); ptr += 4;
      for (let c = startCharCode; c <= endCharCode; c++) {
        this.cmap[c] = (startGlyphCode + (c - startCharCode)) & 0xFFFF;
      }
    }
  }

  parseLoca() {
    const o = this.tables['loca'].offset;
    this.loca = [];
    if (this.indexToLocFormat === 0) {
      for (let i = 0; i <= this.numGlyphs; i++) {
        this.loca.push(this.readUInt16(o + i * 2) * 2);
      }
    } else {
      for (let i = 0; i <= this.numGlyphs; i++) {
        this.loca.push(this.readUInt32(o + i * 4));
      }
    }
  }

  getGlyph(glyphIndex) {
    if (glyphIndex >= this.numGlyphs) return null;
    const offset = this.tables['glyf'].offset + this.loca[glyphIndex];
    const endOffset = this.loca[glyphIndex + 1];
    if (offset === endOffset) return null;

    const numberOfContours = this.readInt16(offset);
    const xMin = this.readInt16(offset + 2);
    const yMin = this.readInt16(offset + 4);
    const xMax = this.readInt16(offset + 6);
    const yMax = this.readInt16(offset + 8);

    if (numberOfContours < 0) return null; // composite not supported
    if (numberOfContours === 0) return null;

    const path = this.parseSimpleGlyph(offset, numberOfContours);
    if (!path) return null;
    return { path, xMin, yMin, xMax, yMax };
  }

  parseSimpleGlyph(offset, numberOfContours) {
    let ptr = offset + 10;
    const endPtsOfContours = [];
    for (let i = 0; i < numberOfContours; i++) {
      endPtsOfContours.push(this.readUInt16(ptr)); ptr += 2;
    }
    const instructionLength = this.readUInt16(ptr); ptr += 2;
    ptr += instructionLength;

    const numPoints = endPtsOfContours[numberOfContours - 1] + 1;
    const flags = [];
    for (let i = 0; i < numPoints; i++) {
      const flag = this.readUInt8(ptr); ptr++;
      flags.push(flag);
      if (flag & 0x08) {
        const repeat = this.readUInt8(ptr); ptr++;
        for (let r = 0; r < repeat; r++) flags.push(flag);
        i += repeat;
      }
    }

    const xCoords = [];
    let prevX = 0;
    for (let i = 0; i < numPoints; i++) {
      const flag = flags[i];
      let x = 0;
      if (flag & 0x02) {
        x = this.readUInt8(ptr); ptr++;
        if (!(flag & 0x10)) x = -x;
      } else if (flag & 0x10) {
        x = 0;
      } else {
        x = this.readInt16(ptr); ptr += 2;
      }
      prevX += x;
      xCoords.push(prevX);
    }

    const yCoords = [];
    let prevY = 0;
    for (let i = 0; i < numPoints; i++) {
      const flag = flags[i];
      let y = 0;
      if (flag & 0x04) {
        y = this.readUInt8(ptr); ptr++;
        if (!(flag & 0x20)) y = -y;
      } else if (flag & 0x20) {
        y = 0;
      } else {
        y = this.readInt16(ptr); ptr += 2;
      }
      prevY += y;
      yCoords.push(prevY);
    }

    const points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({ x: xCoords[i], y: yCoords[i], onCurve: (flags[i] & 0x01) !== 0 });
    }

    let path = '';
    let start = 0;
    for (let c = 0; c < numberOfContours; c++) {
      const end = endPtsOfContours[c];
      path += this.contourToPath(points.slice(start, end + 1));
      start = end + 1;
    }
    return path;
  }

  contourToPath(pts) {
    if (pts.length === 0) return '';
    if (!pts[0].onCurve) {
      if (pts[pts.length - 1].onCurve) {
        pts.unshift(pts.pop());
      } else {
        const mid = {
          x: (pts[0].x + pts[pts.length - 1].x) / 2,
          y: (pts[0].y + pts[pts.length - 1].y) / 2,
          onCurve: true
        };
        pts.unshift(mid);
      }
    }

    let d = `M ${pts[0].x} ${pts[0].y}`;
    let i = 1;
    while (i < pts.length) {
      if (pts[i].onCurve) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
        i++;
      } else {
        const c = pts[i];
        const next = pts[(i + 1) % pts.length];
        if (next.onCurve) {
          d += ` Q ${c.x} ${c.y} ${next.x} ${next.y}`;
          i += 2;
        } else {
          const mid = { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 };
          d += ` Q ${c.x} ${c.y} ${mid.x} ${mid.y}`;
          i++;
        }
      }
    }
    d += ' Z';
    return d;
  }

  charToGlyphIndex(char) {
    const code = char.charCodeAt(0);
    return this.cmap[code];
  }
}


