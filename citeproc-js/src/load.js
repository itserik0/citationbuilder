/*global CSL: true */

/**
 * A Javascript implementation of the CSL citation formatting language.
 *
 * <p>A configured instance of the process is built in two stages,
 * using {@link CSL.Core.Build} and {@link CSL.Core.Configure}.
 * The former sets up hash-accessible locale data and imports the CSL format file
 * to be applied to the citations,
 * transforming it into a one-dimensional token list, and
 * registering functions and parameters on each token as appropriate.
 * The latter sets jump-point information
 * on tokens that constitute potential branch
 * points, in a single back-to-front scan of the token list.
 * This
 * yields a token list that can be executed front-to-back by
 * body methods available on the
 * {@link CSL.Engine} class.</p>
 *
 * <p>This top-level {@link CSL} object itself carries
 * constants that are needed during processing.</p>
 * @namespace A CSL citation formatter.
 */

// IE6 does not implement Array.indexOf().
// IE7 neither, according to rumour.


// Potential skip words:
// under; along; out; between; among; outside; inside; amid; amidst; against; toward; towards.
// See https://forums.zotero.org/discussion/30484/?Focus=159613#Comment_159613


if (!Array.indexOf) {
    Array.prototype.indexOf = function (obj) {
        var i, len;
        for (i = 0, len = this.length; i < len; i += 1) {
            if (this[i] === obj) {
                return i;
            }
        }
        return -1;
    };
}

var CSL = {

    PROCESSOR_VERSION: "1.0.543",

    CONDITION_LEVEL_TOP: 1,

    CONDITION_LEVEL_BOTTOM: 2,

    PLAIN_HYPHEN_REGEX: /(?:[^\\]-|\u2013)/,

    LOCATOR_LABELS_REGEXP: new RegExp("^((art|ch|Ch|subch|col|fig|l|n|no|op|p|pp|para|subpara|pt|r|sec|subsec|Sec|sv|sch|tit|vrs|vol)\\.)\\s+(.*)"),

    STATUTE_SUBDIV_GROUPED_REGEX: /((?:^| )(?:art|ch|Ch|subch|p|pp|para|subpara|pt|r|sec|subsec|Sec|sch|tit)\.)/g,
    STATUTE_SUBDIV_PLAIN_REGEX: /(?:(?:^| )(?:art|ch|Ch|subch|p|pp|para|subpara|pt|r|sec|subsec|Sec|sch|tit)\.)/,
    STATUTE_SUBDIV_STRINGS: {
        "art.": "article",
        "bk.": "book",
        "ch.": "chapter",
        "Ch.": "Chapter",
        "subch.": "subchapter",
        "p.": "page",
        "pp.": "page",
        "para.": "paragraph",
        "subpara.": "subparagraph",
        "pt.": "part",
        "r.": "rule",
        "sec.": "section",
        "subsec.": "subsection",
        "Sec.": "Section",
        "sch.": "schedule",
        "tit.": "title",
        "col.": "column",
        "fig.": "figure",
        "fol.": "folio",
        "l.": "line",
        "n.": "note",
        "no.": "issue",
        "op.": "opus",
        "sv.": "sub-verbo",
        "vrs.": "verse",
        "vol.": "volume"
    },
    STATUTE_SUBDIV_STRINGS_REVERSE: {
        "article": "art.",
        "book": "bk.",
        "chapter": "ch.",
        "Chapter": "Ch.",
        "subchapter": "subch.",
        "page": "p.",
        "paragraph": "para.",
        "subparagraph": "subpara.",
        "part": "pt.",
        "rule": "r.",
        "section": "sec.",
        "subsection": "subsec.",
        "Section": "Sec.",
        "schedule": "sch.",
        "title": "tit.",
        "column": "col.",
        "figure": "fig.",
        "folio": "fol.",
        "line": "l.",
        "note": "n.",
        "issue": "no.",
        "opus": "op.",
        "sub-verbo": "sv.",
        "sub verbo": "sv.",
        "verse": "vrs.",
        "volume": "vol."
    },

    LOCATOR_LABELS_MAP: {
        "art": "article",
        "bk": "book",
        "ch": "chapter",
        "Ch": "Chapter",
        "subch": "subchapter",
        "col": "column",
        "fig": "figure",
        "fol": "folio",
        "l": "line",
        "n": "note",
        "no": "issue",
        "op": "opus",
        "p": "page",
        "pp": "page",
        "para": "paragraph",
        "subpara": "subparagraph",
        "pt": "part",
        "r": "rule",
		"sec": "section",
		"subsec": "subsection",
        "Sec": "Section",
		"sv": "sub-verbo",
        "sch": "schedule",
        "tit": "title",
        "vrs": "verse",
        "vol": "volume"
    },

    NestedBraces: [
        ["(", "["],
        [")", "]"]
    ],
    checkNestedBraceOpen: new RegExp(".*\\("),
    checkNestedBraceClose: new RegExp(".*\\)"),

    LangPrefsMap: {
        "title":"titles",
        "title-short":"titles",
        "container-title":"journals",
        "collection-title":"journals",
        "publisher":"publishers",
        "authority":"publishers",
        "publisher-place": "places",
        "event-place": "places",
        "number": "number",
        "edition":"number",
        "issue":"number",
        "volume":"number"
    },

    

    AbbreviationSegments: function () {
        this["container-title"] = {};
        this["collection-title"] = {};
        this["institution-entire"] = {};
        this["institution-part"] = {};
        this.nickname = {};
        this.number = {};
        this.title = {};
        this.place = {};
        this.hereinafter = {};
        this.classic = {};
        this["container-phrase"] = {};
        this["title-phrase"] = {};
    },

    GENDERS: ["masculine", "feminine"],
    
    ERROR_NO_RENDERED_FORM: 1,

    PREVIEW: "Just for laughs.",
    ASSUME_ALL_ITEMS_REGISTERED: 2,

    START: 0,
    END: 1,
    SINGLETON: 2,

    SEEN: 6,
    SUCCESSOR: 3,
    SUCCESSOR_OF_SUCCESSOR: 4,
    SUPPRESS: 5,

    SINGULAR: 0,
    PLURAL: 1,

    LITERAL: true,

    BEFORE: 1,
    AFTER: 2,

    DESCENDING: 1,
    ASCENDING: 2,

    ONLY_FIRST: 1,
    ALWAYS: 2,
    ONLY_LAST: 3,

    FINISH: 1,

    POSITION_FIRST: 0,
    POSITION_SUBSEQUENT: 1,
    POSITION_IBID: 2,
    POSITION_IBID_WITH_LOCATOR: 3,

    MARK_TRAILING_NAMES: true,

    POSITION_TEST_VARS: ["position", "first-reference-note-number", "near-note"],

    AREAS: ["citation", "citation_sort", "bibliography", "bibliography_sort"],

    MULTI_FIELDS: ["event", "publisher", "publisher-place", "event-place", "title", "container-title", "collection-title", "authority","edition","genre","title-short","medium","jurisdiction","archive","archive-place"],

    CITE_FIELDS: ["first-reference-note-number", "locator", "locator-revision"],

    MINIMAL_NAME_FIELDS: ["literal", "family"],

    SWAPPING_PUNCTUATION: [".", "!", "?", ":", ","],
    TERMINAL_PUNCTUATION: [":", ".", ";", "!", "?", " "],

    // update modes
    NONE: 0,
    NUMERIC: 1,
    POSITION: 2,

    COLLAPSE_VALUES: ["citation-number", "year", "year-suffix"],

    DATE_PARTS: ["year", "month", "day"],
    DATE_PARTS_ALL: ["year", "month", "day", "season"],
    DATE_PARTS_INTERNAL: ["year", "month", "day", "year_end", "month_end", "day_end"],

    NAME_PARTS: ["family", "given", "dropping-particle", "non-dropping-particle", "suffix", "literal"],
    DECORABLE_NAME_PARTS: ["given", "family", "suffix"],

    DISAMBIGUATE_OPTIONS: [
        "disambiguate-add-names",
        "disambiguate-add-givenname",
        "disambiguate-add-year-suffix"
    ],

    GIVENNAME_DISAMBIGUATION_RULES: [
        "all-names",
        "all-names-with-initials",
        "primary-name",
        "primary-name-with-initials",
        "by-cite"
    ],

    NAME_ATTRIBUTES: [
        "and",
        "delimiter-precedes-last",
        "delimiter-precedes-et-al",
        "initialize-with",
        "initialize",
        "name-as-sort-order",
        "sort-separator",
        "et-al-min",
        "et-al-use-first",
        "et-al-subsequent-min",
        "et-al-subsequent-use-first",
        "form",
        "prefix",
        "suffix",
        "delimiter"
    ],

    PARALLEL_MATCH_VARS: ["container-title"],
    PARALLEL_TYPES: ["bill","gazette","regulation","legislation","legal_case","treaty","article-magazine","article-journal"],
    PARALLEL_COLLAPSING_MID_VARSET: ["volume", "issue", "container-title", "section", "collection-number"],

    LOOSE: 0,
    STRICT: 1,
    TOLERANT: 2,

    PREFIX_PUNCTUATION: /[.;:]\s*$/,
    SUFFIX_PUNCTUATION: /^\s*[.;:,\(\)]/,

    NUMBER_REGEXP: /(?:^\d+|\d+$)/,
    //
    // \u0400-\u042f are cyrillic and extended cyrillic capitals
    // this is not fully smart yet.  can't do what this was trying to do
    // with regexps, actually; we want to identify strings with a leading
    // capital letter, and any subsequent capital letters.  Have to compare
    // locale caps version with existing version, character by character.
    // hard stuff, but if it breaks, that's what to do.
    // \u0600-\u06ff is Arabic/Persian
    // \u200c-\u200e and \u202a-\u202e are special spaces and left-right 
    // control characters



    NAME_INITIAL_REGEXP: /^([A-Z\u0590-\u05ff\u0080-\u017f\u0400-\u042f\u0600-\u06ff\u0370\u0372\u0376\u0386\u0388-\u03ab\u03e2\u03e4\u03e6\u03e8\u03ea\u03ec\u03ee\u03f4\u03f7\u03fd-\u03ff])([a-zA-Z\u0080-\u017f\u0400-\u052f\u0600-\u06ff\u0370-\u03ff\u1f00-\u1fff]*|)/,
    ROMANESQUE_REGEXP: /[-0-9a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ROMANESQUE_NOT_REGEXP: /[^a-zA-Z\u0590-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/g,
    STARTSWITH_ROMANESQUE_REGEXP: /^[&a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ENDSWITH_ROMANESQUE_REGEXP: /[.;:&a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]$/,
    ALL_ROMANESQUE_REGEXP: /^[a-zA-Z\u0590-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]+$/,

    VIETNAMESE_SPECIALS: /[\u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/,

    VIETNAMESE_NAMES: /^(?:(?:[.AaBbCcDdEeGgHhIiKkLlMmNnOoPpQqRrSsTtUuVvXxYy \u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]{2,6})(\s+|$))+$/,

    NOTE_FIELDS_REGEXP: /\{:(?:[\-_a-z]+|[A-Z]+):[^\}]+\}/g,
    NOTE_FIELD_REGEXP: /\{:([\-_a-z]+|[A-Z]+):\s*([^\}]+)\}/,

    DISPLAY_CLASSES: ["block", "left-margin", "right-inline", "indent"],

    NAME_VARIABLES: [
        "author",
        "editor",
        "translator",
        "contributor",
        "collection-editor",
        "composer",
        "container-author",
        "director",
        "editorial-director",
        "interviewer",
        "original-author",
        "recipient"
    ],
    NUMERIC_VARIABLES: [
        "call-number",
        "chapter-number",
        "collection-number",
        "edition",
        "page",
        "issue",
        "locator",
        "number",
        "number-of-pages",
        "number-of-volumes",
        "volume",
        "citation-number"
    ],
    //var x = new Array();
    //x = x.concat(["title","container-title","issued","page"]);
    //x = x.concat(["locator","collection-number","original-date"]);
    //x = x.concat(["reporting-date","decision-date","filing-date"]);
    //x = x.concat(["revision-date"]);
    //NUMERIC_VARIABLES = x.slice();
    DATE_VARIABLES: [
        "locator-date", 
        "issued", 
        "event-date", 
        "accessed", 
        "container", 
        "original-date",
        "publication-date",
        "original-date",
        "available-date",
        "submitted"
    ],

    // TAG_ESCAPE: /(<span class=\"no(?:case|decor)\">.*?<\/span>)/,
    TAG_ESCAPE: function (str) {
        var mx, lst, len, pos, m, buf1, buf2, idx, ret, myret;
        // Workaround for Internet Exporer

        // For squiggly-brace nocase markup ...
        //mx = str.match(/((?:\\[{}]+|\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">|[\{]+).*?(?:[\}]+|<\/span>|<\/?(?:i|sc|b)>)))/g);
        //lst = str.split(/(?:(?:\\[{}]+|\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">|[\{]+).*?(?:[\}]+|<\/span>|<\/?(?:i|sc|b)>)))/g);

        mx = str.match(/((?:\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">).*?(?:<\/span>|<\/?(?:i|sc|b)>)))/g);
        lst = str.split(/(?:(?:\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">).*?(?:<\/span>|<\/?(?:i|sc|b)>)))/g);
        myret = [lst[0]];
        for (pos = 1, len = lst.length; pos < len; pos += 1) {
            myret.push(mx[pos - 1]);
            myret.push(lst[pos]);
        }
        lst = myret.slice();
        return lst;
    },

    // TAG_USEALL: /(<[^>]+>)/,
    TAG_USEALL: function (str) {
        var ret, open, close, end;
        ret = [""];
        open = str.indexOf("<");
        close = str.indexOf(">");
        while (open > -1 && close > -1) {
            if (open > close) {
                end = open + 1;
            } else {
                end = close + 1;
            }
            if (open < close && str.slice(open + 1, close).indexOf("<") === -1) {
                ret[ret.length - 1] += str.slice(0, open);
                ret.push(str.slice(open, close + 1));
                ret.push("");
                str = str.slice(end);
            } else {
                ret[ret.length - 1] += str.slice(0, close + 1);
                str = str.slice(end);
            }
            open = str.indexOf("<");
            close = str.indexOf(">");
        }
        ret[ret.length - 1] += str;
        return ret;
    },

    SKIP_WORDS: ["about","above","across","afore","after","against","along","alongside","amid","amidst","among","amongst","anenst","apropos","apud","around","as","aside","astride","at","athwart","atop","barring","before","behind","below","beneath","beside","besides","between","beyond","but","by","circa","despite","down","during","except","for","forenenst","from","given","in","inside","into","lest","like","modulo","near","next","notwithstanding","of","off","on","onto","out","over","per","plus","pro","qua","sans","since","than","through"," thru","throughout","thruout","till","to","toward","towards","under","underneath","until","unto","up","upon","versus","vs.","v.","vs","v","via","vis-??-vis","with","within","without","according to","ahead of","apart from","as for","as of","as per","as regards","aside from","back to","because of","close to","due to","except for","far from","inside of","instead of","near to","next to","on to","out from","out of","outside of","prior to","pursuant to","rather than","regardless of","such as","that of","up to","where as","or", "yet", "so", "for", "and", "nor", "a", "an", "the", "de", "d'", "von", "van", "c", "et", "ca"],

    FORMAT_KEY_SEQUENCE: [
        "@strip-periods",
        "@font-style",
        "@font-variant",
        "@font-weight",
        "@text-decoration",
        "@vertical-align",
        "@quotes"
    ],

    INSTITUTION_KEYS: [
        "font-style",
        "font-variant",
        "font-weight",
        "text-decoration",
        "text-case"
    ],

    SUFFIX_CHARS: "a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z",
    ROMAN_NUMERALS: [
        [ "", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix" ],
        [ "", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc" ],
        [ "", "c", "cc", "ccc", "cd", "d", "dc", "dcc", "dccc", "cm" ],
        [ "", "m", "mm", "mmm", "mmmm", "mmmmm"]
    ],
    CREATORS: [
        "author",
        "editor",
        "contributor",
        "translator",
        "recipient",
        "interviewer",
        "composer",
        "original-author",
        "container-author",
        "collection-editor"
    ],

    LANGS: {
        "af-ZA":"Afrikaans",
        "ar-AR":"Arabic",
        "bg-BG":"Bulgarian",
        "ca-AD":"Catalan",
        "cs-CZ":"Czech",
        "da-DK":"Danish",
        "de-AT":"Austrian",
        "de-CH":"German (CH)",
        "de-DE":"German (DE)",
        "el-GR":"Greek",
        "en-GB":"English (GB)",
        "en-US":"English (US)",
        "es-ES":"Spanish",
        "et-EE":"Estonian",
        "eu":"European",
        "fa-IR":"Persian",
        "fi-FI":"Finnish",
        "fr-CA":"French (CA)",
        "fr-FR":"French (FR)",
        "he-IL":"Hebrew",
        "hr-HR":"Croatian",
        "hu-HU":"Hungarian",
        "is-IS":"Icelandic",
        "it-IT":"Italian",
        "ja-JP":"Japanese",
        "km-KH":"Khmer",
        "ko-KR":"Korean",
        "lt-LT":"Lithuanian",
        "lv-LV":"Latvian",
        "mn-MN":"Mongolian",
        "nb-NO":"Norwegian (Bokm??l)",
        "nl-NL":"Dutch",
        "nn-NO":"Norwegian (Nynorsk)",
        "pl-PL":"Polish",
        "pt-BR":"Portuguese (BR)",
        "pt-PT":"Portuguese (PT)",
        "ro-RO":"Romanian",
        "ru-RU":"Russian",
        "sk-SK":"Slovak",
        "sl-SI":"Slovenian",
        "sr-RS":"Serbian",
        "sv-SE":"Swedish",
        "th-TH":"Thai",
        "tr-TR":"Turkish",
        "uk-UA":"Ukranian",
        "vi-VN":"Vietnamese",
        "zh-CN":"Chinese (CN)",
        "zh-TW":"Chinese (TW)"
    },

    LANG_BASES: {
        af: "af_ZA",
        ar: "ar_AR",
        bg: "bg_BG",
        ca: "ca_AD",
        cs: "cs_CZ",
        da: "da_DK",
        de: "de_DE",
        el: "el_GR",
        en: "en_US",
        es: "es_ES",
        et: "et_EE",
        eu: "eu",
        fa: "fa_IR",
        fi: "fi_FI",
        fr: "fr_FR",
        he: "he_IL",
        hu: "hu_HU",
        is: "is_IS",
        it: "it_IT",
        ja: "ja_JP",
        km: "km_KH",
        ko: "ko_KR",
        lt: "lt_LT",
        mn: "mn_MN",
        nb: "nb_NO",
        nl: "nl_NL",
        nn: "nn-NO",
        pl: "pl_PL",
        pt: "pt_PT",
        ro: "ro_RO",
        ru: "ru_RU",
        sk: "sk_SK",
        sl: "sl_SI",
        sr: "sr_RS",
        sv: "sv_SE",
        th: "th_TH",
        tr: "tr_TR",
        uk: "uk_UA",
        vi: "vi_VN",
        zh: "zh_CN"
    },

    SUPERSCRIPTS: {
        "\u00AA": "\u0061",
        "\u00B2": "\u0032",
        "\u00B3": "\u0033",
        "\u00B9": "\u0031",
        "\u00BA": "\u006F",
        "\u02B0": "\u0068",
        "\u02B1": "\u0266",
        "\u02B2": "\u006A",
        "\u02B3": "\u0072",
        "\u02B4": "\u0279",
        "\u02B5": "\u027B",
        "\u02B6": "\u0281",
        "\u02B7": "\u0077",
        "\u02B8": "\u0079",
        "\u02E0": "\u0263",
        "\u02E1": "\u006C",
        "\u02E2": "\u0073",
        "\u02E3": "\u0078",
        "\u02E4": "\u0295",
        "\u1D2C": "\u0041",
        "\u1D2D": "\u00C6",
        "\u1D2E": "\u0042",
        "\u1D30": "\u0044",
        "\u1D31": "\u0045",
        "\u1D32": "\u018E",
        "\u1D33": "\u0047",
        "\u1D34": "\u0048",
        "\u1D35": "\u0049",
        "\u1D36": "\u004A",
        "\u1D37": "\u004B",
        "\u1D38": "\u004C",
        "\u1D39": "\u004D",
        "\u1D3A": "\u004E",
        "\u1D3C": "\u004F",
        "\u1D3D": "\u0222",
        "\u1D3E": "\u0050",
        "\u1D3F": "\u0052",
        "\u1D40": "\u0054",
        "\u1D41": "\u0055",
        "\u1D42": "\u0057",
        "\u1D43": "\u0061",
        "\u1D44": "\u0250",
        "\u1D45": "\u0251",
        "\u1D46": "\u1D02",
        "\u1D47": "\u0062",
        "\u1D48": "\u0064",
        "\u1D49": "\u0065",
        "\u1D4A": "\u0259",
        "\u1D4B": "\u025B",
        "\u1D4C": "\u025C",
        "\u1D4D": "\u0067",
        "\u1D4F": "\u006B",
        "\u1D50": "\u006D",
        "\u1D51": "\u014B",
        "\u1D52": "\u006F",
        "\u1D53": "\u0254",
        "\u1D54": "\u1D16",
        "\u1D55": "\u1D17",
        "\u1D56": "\u0070",
        "\u1D57": "\u0074",
        "\u1D58": "\u0075",
        "\u1D59": "\u1D1D",
        "\u1D5A": "\u026F",
        "\u1D5B": "\u0076",
        "\u1D5C": "\u1D25",
        "\u1D5D": "\u03B2",
        "\u1D5E": "\u03B3",
        "\u1D5F": "\u03B4",
        "\u1D60": "\u03C6",
        "\u1D61": "\u03C7",
        "\u2070": "\u0030",
        "\u2071": "\u0069",
        "\u2074": "\u0034",
        "\u2075": "\u0035",
        "\u2076": "\u0036",
        "\u2077": "\u0037",
        "\u2078": "\u0038",
        "\u2079": "\u0039",
        "\u207A": "\u002B",
        "\u207B": "\u2212",
        "\u207C": "\u003D",
        "\u207D": "\u0028",
        "\u207E": "\u0029",
        "\u207F": "\u006E",
        "\u2120": "\u0053\u004D",
        "\u2122": "\u0054\u004D",
        "\u3192": "\u4E00",
        "\u3193": "\u4E8C",
        "\u3194": "\u4E09",
        "\u3195": "\u56DB",
        "\u3196": "\u4E0A",
        "\u3197": "\u4E2D",
        "\u3198": "\u4E0B",
        "\u3199": "\u7532",
        "\u319A": "\u4E59",
        "\u319B": "\u4E19",
        "\u319C": "\u4E01",
        "\u319D": "\u5929",
        "\u319E": "\u5730",
        "\u319F": "\u4EBA",
        "\u02C0": "\u0294",
        "\u02C1": "\u0295",
        "\u06E5": "\u0648",
        "\u06E6": "\u064A"
    },
    SUPERSCRIPTS_REGEXP: new RegExp("[\u00AA\u00B2\u00B3\u00B9\u00BA\u02B0\u02B1\u02B2\u02B3\u02B4\u02B5\u02B6\u02B7\u02B8\u02E0\u02E1\u02E2\u02E3\u02E4\u1D2C\u1D2D\u1D2E\u1D30\u1D31\u1D32\u1D33\u1D34\u1D35\u1D36\u1D37\u1D38\u1D39\u1D3A\u1D3C\u1D3D\u1D3E\u1D3F\u1D40\u1D41\u1D42\u1D43\u1D44\u1D45\u1D46\u1D47\u1D48\u1D49\u1D4A\u1D4B\u1D4C\u1D4D\u1D4F\u1D50\u1D51\u1D52\u1D53\u1D54\u1D55\u1D56\u1D57\u1D58\u1D59\u1D5A\u1D5B\u1D5C\u1D5D\u1D5E\u1D5F\u1D60\u1D61\u2070\u2071\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B\u207C\u207D\u207E\u207F\u2120\u2122\u3192\u3193\u3194\u3195\u3196\u3197\u3198\u3199\u319A\u319B\u319C\u319D\u319E\u319F\u02C0\u02C1\u06E5\u06E6]", "g"),

    locale: {},
    locale_opts: {},
    locale_dates: {}

};

// For citeproc-node
if (typeof require !== "undefined" && typeof module !== 'undefined' && "exports" in module) {
    var CSL_IS_NODEJS = true;
    var CSL_NODEJS = require("./csl_nodejs_jsdom").CSL_NODEJS_JSDOM;
    exports.CSL = CSL;
}

CSL.TERMINAL_PUNCTUATION_REGEXP = new RegExp("^([" + CSL.TERMINAL_PUNCTUATION.slice(0, -1).join("") + "])(.*)");
CSL.CLOSURES = new RegExp(".*[\\]\\)]");


//SNIP-START

// skip jslint check on this file, it doesn't get E4X
if (!CSL.debug) {
    load("./src/print.js");
}
if (!CSL.System) {
    load("./src/system.js");
}
if (!CSL.getSortCompare) {
    load("./src/sort.js");
}
//if (!CSL.System.Xml.E4X) {
//    load("./src/xmle4x.js");
//}
//if (!CSL.System.Xml.DOM) {
//    load("./src/xmldom.js");
//}
// jslint OK
if (!CSL.cloneAmbigConfig) {
    load("./src/util_disambig.js");
}
// jslint OK
if (!CSL.XmlToToken) {
    load("./src/util_nodes.js");
}
// jslint OK
if (!CSL.DateParser) {
    load("./src/util_dateparser.js");
}
// jslint OK
if (!CSL.Engine) {
    load("./src/build.js");
    load("./src/util_static_locator.js");
}
// jslint OK
if (!CSL.Mode) {
    load("./src/util_processor.js");
}
if (!CSL.Engine.prototype.getCitationLabel) {
    load("./src/util_citationlabel.js");
}
if (!CSL.Engine.prototype.setOutputFormat) {
    load("./src/api_control.js");
}

// jslint OK
if (!CSL.Output) {
    load("./src/queue.js");
}
// jslint OK
if (!CSL.Engine.Opt) {
    load("./src/state.js");
}
// jslint OK
if (!CSL.makeCitationCluster) {
    load("./src/api_cite.js");
}
// jslint OK
if (!CSL.makeBibliography) {
    load("./src/api_bibliography.js");
}
// jslint OK
if (!CSL.setCitationId) {
    load("./src/util_integration.js");
}
// jslint OK
if (!CSL.updateItems) {
    load("./src/api_update.js");
}
if (!CSL.localeResolve) {
    load("./src/util_locale.js");
}
if (!CSL.Node) {
    // jslint OK
    load("./src/node_bibliography.js");
    // jslint OK
    load("./src/node_choose.js");
    // jslint OK
    load("./src/node_citation.js");
    load("./src/node_comment.js");
    // jslint OK
    // jslint OK
    load("./src/node_date.js");
    // jslint OK
    load("./src/node_datepart.js");
    // jslint OK
    load("./src/node_elseif.js");
    // jslint OK
    load("./src/node_else.js");
    // jslint OK
    load("./src/node_etal.js");
    // jslint OK
    load("./src/node_group.js");
    // jslint OK
    load("./src/node_if.js");
    load("./src/node_conditions.js");
    load("./src/node_condition.js");
    load("./src/util_conditions.js");
    // jslint OK
    load("./src/node_info.js");
    // jslint OK
    load("./src/node_institution.js");
    // jslint OK
    load("./src/node_institutionpart.js");
    // jslint OK
    load("./src/node_key.js");
    // jslint OK
    load("./src/node_label.js");
    // jslint OK
    load("./src/node_layout.js");
    // jslint OK
    load("./src/node_macro.js");

    load("./src/util_names_output.js");
    load("./src/util_names_tests.js");
    load("./src/util_names_truncate.js");
    load("./src/util_names_divide.js");
    load("./src/util_names_join.js");
    load("./src/util_names_common.js");
    load("./src/util_names_constraints.js");
    load("./src/util_names_disambig.js");
    load("./src/util_names_etalconfig.js");
    load("./src/util_names_etal.js");
    load("./src/util_names_render.js");
    load("./src/util_publishers.js");

    load("./src/util_label.js");

    // jslint OK
    load("./src/node_name.js");
    // jslint OK
    load("./src/node_namepart.js");
    // jslint OK
    load("./src/node_names.js");
    // jslint OK
    load("./src/node_number.js");
    // jslint OK
    load("./src/node_sort.js");
    // jslint OK
    load("./src/node_substitute.js");
    // jslint OK
    load("./src/node_text.js");
}
// jslint OK
if (!CSL.Attributes) {
    load("./src/attributes.js");
}
// jslint OK
if (!CSL.Stack) {
    load("./src/stack.js");
}
// jslint OK
if (!CSL.Parallel) {
    load("./src/util_parallel.js");
}
// jslint OK
if (!CSL.Util) {
    load("./src/util.js");
}
// jslint OK
if (!CSL.Transform) {
    load("./src/util_transform.js");
}
// jslint OK
if (!CSL.Token) {
    load("./src/obj_token.js");
}
// jslint OK
if (!CSL.AmbigConfig) {
    load("./src/obj_ambigconfig.js");
}
// jslint OK
if (!CSL.Blob) {
    load("./src/obj_blob.js");
}
// jslint OK
if (!CSL.NumericBlob) {
    load("./src/obj_number.js");
}
// jslint OK
if (!CSL.Util.fixDateNode) {
    load("./src/util_datenode.js");
}

if (!CSL.dateAsSortKey) {
    load("./src/util_date.js");
}
// jslint OK
if (!CSL.Util.Names) {
    load("./src/util_names.js");
}
// jslint OK (jslint wants "long" and "short" properties set in dot
// notation, but these are reserved words in JS, and raise an error
// in rhino.  Setting them in brace notation avoids the processing error.)
if (!CSL.Util.Dates) {
    load("./src/util_dates.js");
}
// jslint OK
if (!CSL.Util.Sort) {
    load("./src/util_sort.js");
}
// jslint OK
if (!CSL.Util.substituteStart) {
    load("./src/util_substitute.js");
}
// jslint OK
if (!CSL.Util.Suffixator) {
    load("./src/util_number.js");
}
// jstlint OK
if (!CSL.Util.PageRangeMangler) {
    load("./src/util_page.js");
}
// jslint OK
if (!CSL.Util.FlipFlopper) {
    load("./src/util_flipflop.js");
}
// jslint OK
if (!CSL.Output.Formatters) {
    load("./src/formatters.js");
}
// jslint OK
if (!CSL.Output.Formats) {
    load("./src/formats.js");
}
// jslint OK
if (!CSL.Registry) {
    load("./src/registry.js");
}
// jslint OK
if (!CSL.Registry.NameReg) {
    load("./src/disambig_names.js");
}
// jslint OK
if (!CSL.Registry.CitationReg) {
    load("./src/disambig_citations.js");
}
// jslint OK
if (!CSL.Registry.prototype.disambiguateCites) {
    load("./src/disambig_cites.js");
}

//SNIP-END
