// Standard Macintosh glyph ordering used by the 'post' table, version 2.0.
const STANDARD_GLYPH_NAMES = [
    ".notdef", ".null", "nonmarkingreturn", "space", "exclam", "quotedbl",
    "numbersign", "dollar", "percent", "ampersand", "quotesingle", "parenleft",
    "parenright", "asterisk", "plus", "comma", "hyphen", "period", "slash",
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "colon", "semicolon", "less", "equal", "greater", "question", "at",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "bracketleft",
    "backslash", "bracketright", "asciicircum", "underscore", "grave", "a", "b",
    "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q",
    "r", "s", "t", "u", "v", "w", "x", "y", "z", "braceleft", "bar",
    "braceright", "asciitilde", "Adieresis", "Aring", "Ccedilla", "Eacute",
    "Ntilde", "Odieresis", "Udieresis", "aacute", "agrave", "acircumflex",
    "adieresis", "atilde", "aring", "ccedilla", "eacute", "egrave",
    "ecircumflex", "edieresis", "iacute", "igrave", "icircumflex", "idieresis",
    "ntilde", "oacute", "ograve", "ocircumflex", "odieresis", "otilde", "uacute",
    "ugrave", "ucircumflex", "udieresis", "dagger", "degree", "cent", "sterling",
    "section", "bullet", "paragraph", "germandbls", "registered", "copyright",
    "trademark", "acute", "dieresis", "notequal", "AE", "Oslash", "infinity",
    "plusminus", "lessequal", "greaterequal", "yen", "mu", "partialdiff",
    "summation", "product", "pi", "integral", "ordfeminine", "ordmasculine",
    "Omega", "ae", "oslash", "questiondown", "exclamdown", "logicalnot",
    "radical", "florin", "approxequal", "Delta", "guillemotleft",
    "guillemotright", "ellipsis", "nonbreakingspace", "Agrave", "Atilde",
    "Otilde", "OE", "oe", "endash", "emdash", "quotedblleft", "quotedblright",
    "quoteleft", "quoteright", "divide", "lozenge", "ydieresis", "Ydieresis",
    "fraction", "currency", "guilsinglleft", "guilsinglright", "fi", "fl",
    "daggerdbl", "periodcentered", "quotesinglbase", "quotedblbase",
    "perthousand", "Acircumflex", "Ecircumflex", "Aacute", "Edieresis",
    "Egrave", "Iacute", "Icircumflex", "Idieresis", "Igrave", "Oacute",
    "Ocircumflex", "apple", "Ograve", "Uacute", "Ucircumflex", "Ugrave",
    "dotlessi", "circumflex", "tilde", "macron", "breve", "dotaccent", "ring",
    "cedilla", "hungarumlaut", "ogonek", "caron", "Lslash", "lslash", "Scaron",
    "scaron", "Zcaron", "zcaron", "brokenbar", "Eth", "eth", "Yacute", "yacute",
    "Thorn", "thorn", "minus", "multiply", "onesuperior", "twosuperior",
    "threesuperior", "onehalf", "onequarter", "threequarters", "franc",
    "Gbreve", "gbreve", "Idotaccent", "Scedilla", "scedilla", "Cacute",
    "cacute", "Ccaron", "ccaron", "dcroat",
];

const MAC_TO_UNICODE = {
    Adieresis: 0x00c4, Aring: 0x00c5, Ccedilla: 0x00c7, Eacute: 0x00c9,
    Ntilde: 0x00d1, Odieresis: 0x00d6, Udieresis: 0x00dc, aacute: 0x00e1,
    agrave: 0x00e0, acircumflex: 0x00e2, adieresis: 0x00e4, atilde: 0x00e3,
    aring: 0x00e5, ccedilla: 0x00e7, eacute: 0x00e9, egrave: 0x00e8,
    ecircumflex: 0x00ea, edieresis: 0x00eb, iacute: 0x00ed, igrave: 0x00ec,
    icircumflex: 0x00ee, idieresis: 0x00ef, ntilde: 0x00f1, oacute: 0x00f3,
    ograve: 0x00f2, ocircumflex: 0x00f4, odieresis: 0x00f6, otilde: 0x00f5,
    uacute: 0x00fa, ugrave: 0x00f9, ucircumflex: 0x00fb, udieresis: 0x00fc,
    germandbls: 0x00df, ae: 0x00e6, oslash: 0x00f8, OE: 0x0152, oe: 0x0153,
    Lslash: 0x0141, lslash: 0x0142, Scaron: 0x0160, scaron: 0x0161,
    Zcaron: 0x017d, zcaron: 0x017e, Yacute: 0x00dd, yacute: 0x00fd,
    Thorn: 0x00de, thorn: 0x00fe, Eth: 0x00d0, eth: 0x00f0,
    Gbreve: 0x011e, gbreve: 0x011f, Idotaccent: 0x0130, Scedilla: 0x015e,
    scedilla: 0x015f, Cacute: 0x0106, cacute: 0x0107, Ccaron: 0x010c,
    ccaron: 0x010d,
};

// Map a standard glyph name to a Unicode code point when one is known.
function glyphNameToUnicode(name) {
    if (!name) return null;
    if (name.length === 1) return name.charCodeAt(0);

    if (name.startsWith("uni") && /^uni[0-9A-Fa-f]{4}$/.test(name)) {
        return parseInt(name.slice(3), 16);
    }
    if (name.startsWith("u") && /^u[0-9A-Fa-f]{4,6}$/.test(name)) {
        return parseInt(name.slice(1), 16);
    }
    if (name in MAC_TO_UNICODE) return MAC_TO_UNICODE[name];

    const simple = {
        space: 0x20, exclam: 0x21, quotedbl: 0x22, numbersign: 0x23,
        dollar: 0x24, percent: 0x25, ampersand: 0x26, quotesingle: 0x27,
        parenleft: 0x28, parenright: 0x29, asterisk: 0x2a, plus: 0x2b,
        comma: 0x2c, hyphen: 0x2d, period: 0x2e, slash: 0x2f,
        zero: 0x30, one: 0x31, two: 0x32, three: 0x33, four: 0x34,
        five: 0x35, six: 0x36, seven: 0x37, eight: 0x38, nine: 0x39,
        colon: 0x3a, semicolon: 0x3b, less: 0x3c, equal: 0x3d,
        greater: 0x3e, question: 0x3f, at: 0x40, bracketleft: 0x5b,
        backslash: 0x5c, bracketright: 0x5d, asciicircum: 0x5e,
        underscore: 0x5f, grave: 0x60, braceleft: 0x7b, bar: 0x7c,
        braceright: 0x7d, asciitilde: 0x7e, endash: 0x2013,
        emdash: 0x2014, quoteleft: 0x2018, quoteright: 0x2019,
        quotedblleft: 0x201c, quotedblright: 0x201d, bullet: 0x2022,
        ellipsis: 0x2026, perthousand: 0x2030, guilsinglleft: 0x2039,
        guilsinglright: 0x203a, fi: 0xfb01, fl: 0xfb02, dagger: 0x2020,
        daggerdbl: 0x2021, periodcentered: 0x00b7, quotesinglbase: 0x201a,
        quotedblbase: 0x201e, trademark: 0x2122, degree: 0x00b0, cent: 0x00a2,
        sterling: 0x00a3, section: 0x00a7, paragraph: 0x00b6, registered: 0x00ae,
        copyright: 0x00a9, acute: 0x00b4, dieresis: 0x00a8, AE: 0x00c6,
        Oslash: 0x00d8, infinity: 0x221e, plusminus: 0x00b1,
        lessequal: 0x2264, greaterequal: 0x2265, yen: 0x00a5, mu: 0x00b5,
        partialdiff: 0x2202, summation: 0x2211, product: 0x220f, pi: 0x03c0,
        integral: 0x222b, ordfeminine: 0x00aa, ordmasculine: 0x00ba,
        Omega: 0x03a9, questiondown: 0x00bf, exclamdown: 0x00a1,
        logicalnot: 0x00ac, radical: 0x221a, florin: 0x0192,
        approxequal: 0x2248, Delta: 0x0394, guillemotleft: 0x00ab,
        guillemotright: 0x00bb, divide: 0x00f7, lozenge: 0x25ca,
        fraction: 0x2044, currency: 0x00a4, dotlessi: 0x0131,
        circumflex: 0x02c6, tilde: 0x02dc, macron: 0x00af, breve: 0x02d8,
        dotaccent: 0x02d9, ring: 0x02da, cedilla: 0x00b8,
        hungarumlaut: 0x02dd, ogonek: 0x02db, caron: 0x02c7,
        brokenbar: 0x00a6, minus: 0x2212, multiply: 0x00d7,
        onesuperior: 0x00b9, twosuperior: 0x00b2, threesuperior: 0x00b3,
        onehalf: 0x00bd, onequarter: 0x00bc, threequarters: 0x00be,
        franc: 0x20a3, dotaccent: 0x02d9, nonbreakingspace: 0x00a0,
    };
    if (name in simple) return simple[name];
    return null;
}

function unicodeToGlyphName(codepoint) {
    if (codepoint === 0x20) return "space";
    if (codepoint >= 0x21 && codepoint <= 0x7e) {
        const ch = String.fromCharCode(codepoint);
        if (/[A-Za-z0-9]/.test(ch)) return ch;
    }
    for (const [name, cp] of Object.entries(MAC_TO_UNICODE)) {
        if (cp === codepoint) return name;
    }
    if (codepoint <= 0xffff) {
        return "uni" + codepoint.toString(16).toUpperCase().padStart(4, "0");
    }
    return "u" + codepoint.toString(16).toUpperCase();
}
