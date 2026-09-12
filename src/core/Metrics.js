class Metrics {
    constructor() {
        this.ascender = 800;
        this.descender = -200;
        this.lineGap = 0;
        this.xHeight = 500;
        this.capHeight = 700;
        this.italicAngle = 0;
        this.underlinePosition = -100;
        this.underlineThickness = 50;
        this.isFixedPitch = 0;
    }

    clone() {
        const m = new Metrics();
        Object.assign(m, this);
        return m;
    }
}

function defaultHead() {
    return {
        version: 1.0,
        fontRevision: 1.0,
        flags: 3,
        macStyle: 0,
        lowestRecPPEM: 8,
        fontDirectionHint: 2,
        created: 0,
        modified: 0,
    };
}

function defaultHhea() {
    return {
        caretSlopeRise: 1,
        caretSlopeRun: 0,
        caretOffset: 0,
    };
}

function defaultPost() {
    return {
        italicAngle: 0,
        underlinePosition: -100,
        underlineThickness: 50,
        isFixedPitch: 0,
        minMemType42: 0,
        maxMemType42: 0,
        minMemType1: 0,
        maxMemType1: 0,
    };
}

function defaultOS2() {
    return {
        version: 4,
        xAvgCharWidth: 0,
        weightClass: 400,
        widthClass: 5,
        fsType: 0,
        ySubscriptXSize: 650,
        ySubscriptYSize: 600,
        ySubscriptXOffset: 0,
        ySubscriptYOffset: 75,
        ySuperscriptXSize: 650,
        ySuperscriptYSize: 600,
        ySuperscriptXOffset: 0,
        ySuperscriptYOffset: 350,
        yStrikeoutSize: 50,
        yStrikeoutPosition: 250,
        familyClass: 0,
        panose: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        unicodeRanges: [0, 0, 0, 0],
        vendorId: "NONE",
        fsSelection: 0x0040,
        firstCharIndex: 0,
        lastCharIndex: 0,
        typoAscender: 800,
        typoDescender: -200,
        typoLineGap: 0,
        winAscent: 800,
        winDescent: 200,
        codePageRange: [0, 0],
        sxHeight: 500,
        sCapHeight: 700,
        defaultChar: 0,
        breakChar: 32,
        maxContext: 0,
    };
}
