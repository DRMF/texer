// Information about TeX functions.
// In its own module so that the sets aren't recreated from scratch
// every time that parse() is called.
"use strict";

// track all known function names, so we can give good errors for unknown
// functions.
var all_functions = module.exports.all_functions = Object.create(null);
all_functions['\\begin'] = all_functions['\\end'] = true;

var arr2set = function(a) {
    // note that the fact that all keys in the set are prefixed with '\\'
    // helps avoid accidental name conflicts.  But use Object.create(null)
    // to be extra safe.
    var set = Object.create(null);
    a.forEach(function(v) {
        console.assert(!set[v], v);
        set[v] = all_functions[v] = true;
    });
    return set;
};
var obj2map = function(o) {
    // this just recreates the argument, but with `null` as prototype.
    var map = Object.create(null);
    Object.keys(o).forEach(function(f) {
        console.assert(!map[f]);
        map[f] = o[f]; all_functions[f] = true;
    });
    return map;
};

// Sets of function names
module.exports.box_functions = arr2set([
    "\\text", "\\mbox", "\\hbox", "\\vbox"
]);

module.exports.latex_function_names = arr2set([
    "\\arccos", "\\arcsin", "\\arctan", "\\arg", "\\cosh", "\\cos",
    "\\cot", "\\coth", "\\csc", "\\deg", "\\det", "\\dim", "\\exp",
    "\\gcd", "\\hom", "\\inf", "\\ker", "\\lg", "\\lim", "\\liminf",
    "\\limsup", "\\ln", "\\log", "\\max", "\\min", "\\Pr", "\\sec",
    "\\sin", "\\sinh", "\\sup", "\\tan", "\\tanh"
]);

function findFirst(string, subs, start) {
    var min = -1;
    var index;
    var first = subs[0];
    for (var i = 0; i < subs.length; i++) {
        index = string.indexOf(subs[i], start);
        if ((index !== -1) && (index < min || min === -1)) {
            min = index;
            first = subs[i];
        }
    }
    return [min, first];
}

function findBracketSections(string) {
    var sections = [[""]];
    var char;
    var level = 0;
    string = string.substring(findFirst(string, ["[", "{"])[0]);
    for (var i = 0; i < string.length; i++) {
        char = string.charAt(i);
        if (char == "}" || char == "]") {
            level--;
            if (level == 0) {
                sections.push([""]);
            }
            else {
                sections[sections.length - 1][0] += char;
            }
        }
        else if (char == "{" || char == "[") {
            if (level != 0) {
                sections[sections.length - 1][0] += char;
            }
            else {
                sections[sections.length - 1].push(char);
            }
            level++;
        }
        else {
            sections[sections.length - 1][0] += char;
        }
    }
    sections = sections.slice(0, sections.length - 1);
    return sections;
}

String.prototype.replaceAll = function(str1, str2, ignore) {
    return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

function generateCode(cmd, parameterCount, replacement, argumentCount, renderOption, optionNum, code, extra) {
    if (argumentCount != 0 && renderOption == null) {
        return;
    }
    for (var i = 0; i < argumentCount; i++) {
        if (renderOption.indexOf("#" + (i + 1)) == -1) {
            return;
        }
    }
    var command = cmd + (optionNum + 1);
    if (extra != null) {
        command += extra;
    }
    var pegjs = code[0];
    var ast = code[1];
    var astutil = code[2];
    var render = code[3];
    var pegjscode = "\"" + replacement;
    var astcode = command + ": { args: [ 'string', ";
    var astutilcode1 = command + ": function(target, ";
    var astutilcode2 = "\treturn ";
    var rendercode1 = command + ": function(";
    var rendercode2 = "\treturn ";
    var args = [];
    var temp;
    for (var par = 0; par < parameterCount; par++) {
        if (pegjscode.indexOf("#" + (par + 1)) != -1) {
            temp = "l" + (par + 1);
            args.push(temp);
            pegjscode = pegjscode.replaceAll("#" + (par + 1), "\" _ " + temp + ":lit _ \"");
        }
    }
    var index = args.length;
    if (renderOption != null) {
        pegjscode += renderOption;
        for (var arg = 0; arg < argumentCount; arg++) {
            temp = "k" + (arg + 1);
            args.push(temp);
            pegjscode = pegjscode.replaceAll("#" + (arg + 1), "\" _ " + temp + ":lit _ \"");
        }
    }
    pegjscode = (pegjscode + "\" ").replaceAll("_ \" ", "_ \"");
    pegjscode = [pegjscode.replaceAll(" \" _", "\" _")].concat("{ return ast.Tex." + command + ["(\"\\\\" + cmd + "\""].concat(args).join(", ") + "); }");
    astcode += Array.apply(null, Array(args.length)).map(function() {return "'self'"}).join(", ") + " ] },";
    astutilcode1 += ["f"].concat(args).join(", ") + ") {\n\t";
    astutilcode2 += ["match(target, f)"].concat(args.map(function(a) {return a + ".contains_func(target)"})).join(" || ");
    var astutilcode = astutilcode1 + astutilcode2 + ";\n\t},";
    rendercode1 += ["f"].concat(args).join(", ") + ") {\n\t";
    temp = ["\"\\\\" + cmd + "\""].concat(args.map(function(a) {return "curlies(" + a + ")"}))
    if (renderOption != null) {
        temp.splice(index + 1, 0, "\"" + Array(optionNum + 2).join("@") + "\"");
    }
    rendercode2 += temp.join(" + ");
    var rendercode = rendercode1 + rendercode2 + ";\n\t},";
    pegjs.push(pegjscode);
    ast.push(astcode);
    astutil.push(astutilcode);
    render.push(rendercode);
}

function parseSpecFun(text, code, extra) {
    var sections = findBracketSections(text);
    var command = sections[0][0];
    var offset = 0;
    var parameterCount = 0;
    if (sections[1][1] == "[") {
        parameterCount = parseInt(sections[1][0]);
        if (sections[2][1] == "[") {
            offset = 1;
        }
    }
    else {
        offset = -1;
    }
    var replacement = sections[2 + offset][0].replaceAll("\\", "\\\\").replaceAll("\\\\!", "\\!");
    var meaning = sections[3 + offset][0];
    var argumentCount = parseInt(sections[4 + offset][0]);
    if (sections.length == 5 + offset) {
        generateCode(command, parameterCount, replacement, argumentCount, null, 0, code, extra);
    }
    else {
        for (var i = 0; i < sections.length - 5 - offset; i++) {
            var renderOption = sections[i + 5 + offset][0].replaceAll("\\", "\\\\").replaceAll("\\\\!", "\\!");
            generateCode(command, parameterCount, replacement, argumentCount, renderOption, i, code, extra);
        }
    }
}

function parseIfx(string) {
    var start = string.indexOf("\\ifx");
    if (start == -1) {
        return [string];
    }
    else {
        var end = string.indexOf("\\fi") + 3;
        var ifx = string.substring(start, end);
        var false_text = ifx.substring(ifx.indexOf("\\else") + 5, ifx.length - 3);
        return [string.substring(0, start) + string.substring(end), string.substring(0, start) + false_text + string.substring(end)];
    }
}

function parseSty(sty, code) {
    var starts = ["\\newcommand", "\\renewcommand", "\\DeclareRobustCommand", "\\defSpecFun"];
    var fs = require('fs');
    var path = require('path');
    var filePathRead = path.join(__dirname, sty);
    var inp = fs.readFileSync(filePathRead, 'utf8');
    var cmds = {};
    var firstStart = findFirst(inp, starts, 0);
    var first = firstStart[0];
    var next;
    var nextStart;
    var text;
    var sections;
    var prev = firstStart[1];
    while (first !== -1) {
        firstStart = findFirst(inp, starts, first + prev.length);
        next = firstStart[0];
        if (next === -1) {
            text = inp.substring(first + prev.length, inp.indexOf("\n", first + prev.length));
        }
        else {
            text = inp.substring(first + prev.length, next);
        }
        if (text.indexOf("\n") !== -1) {
            text = text.substring(0, text.indexOf("\n"));
        }
        if (prev === "\\defSpecFun") {
            var ifx = parseIfx(text);
            for (var condition in ifx) {
                parseSpecFun(ifx[condition], code, String.fromCharCode(65 + parseInt(condition)));
            }
        }
        else {
            sections = findBracketSections(text.replace("\n", ""));
            if (sections[0][0] != undefined && sections[1][0] != undefined) {
                cmds[sections[0][0]] = sections[1][0];
            }
        }
        first = next;
        prev = firstStart[1];
    }
    return cmds;
}

function createFromTemplate(template, func) {
    var filePathRead = path.join(__dirname, "templates/" + template);
    var inp = fs.readFileSync(filePathRead, 'utf8');
    var result = func(inp);
    var filePathWrite = path.join(__dirname, template);
    return fs.writeFileSync(filePathWrite, result, 'utf8');
}

module.exports.createMacroCode = function() {
    try {
        var code = [[], [], [], []];
        module.exports.other_literals3 = parseSty("DRMFfcns.sty", code);
        module.exports.other_required = module.exports.other_literals3;
        var pegjs = code[0];
        var ast = code[1];
        var astutil = code[2];
        var render = code[3];
        var csv = require('csv-parse/lib/sync');
        var fs = require('fs');
        var path = require('path');
        createFromTemplate("parser.pegjs", function(data) {
            pegjs.sort(function(a, b) {return b[0].length - a[0].length});
            pegjs = pegjs.map(function(a) {return a.join("")}).join("\n  / ");
            for (var i in [0, 1]) {
              var start = ["lit\n  =", "litstuff ="][i];
              var index = data.indexOf(start) + start.length;
              var result = data.substring(0, index) + "\n    " + pegjs + data.substring(index).replace("    ", "\n  / ");
              data = result;
            }
            return data;
        });
        createFromTemplate("ast.js", function(data) {
            var start = "new Enum( 'Tex', {\n";
            var index = data.indexOf(start) + start.length;
            var result = data.substring(0, index) + "    " + ast.join("\n    ") + "\n" + data.substring(index);
            return result;
        });
        createFromTemplate("astutil.js", function(data) {
            var start = "ast.Tex.defineVisitor(\"contains_func\", {\n";
            var index = data.indexOf(start) + start.length;
            var result = data.substring(0, index) + "    " + astutil.join("\n    ") + "\n" + data.substring(index);
            return result;
        });
        createFromTemplate("render.js", function(data) {
            var start = "ast.Tex.defineVisitor(\"render_tex\", {\n";
            var index = data.indexOf(start) + start.length;
            var result = data.substring(0, index) + "    " + render.join("\n    ") + "\n" + data.substring(index);
            return result;
        });
    } catch (e) {}
}

module.exports.paren = arr2set(["\\sinh"]);
module.exports.other_literals3 = obj2map({});
try{ //try catch to make sure program still runs without csv file
    var csv = require('csv-parse/lib/sync');
    var fs = require('fs');
    var path = require('path');
    var filePathRead = path.join(__dirname, 'optionalFunctions.csv');
    var paren = [];
    var inp = fs.readFileSync(filePathRead, 'utf8');
    var cmds = csv(inp, {columns: true});
    var c = 0;
    while (c < cmds.length) {
        if (cmds[c].type === 'paren') {
            paren.push(cmds[c].command);
        }
        c++;
    }
    module.exports.paren = arr2set(paren);
} catch (e) {}

module.exports.mediawiki_function_names = arr2set([
    "\\arccot", "\\arcsec", "\\arccsc", "\\sgn", "\\sen"
]);

module.exports.other_literals1 = arr2set([
    "\\aleph",
    "\\alpha",
    "\\amalg",
    "\\And",
    "\\angle",
    "\\approx",
    "\\approxeq",
    "\\ast",
    "\\asymp",
    "\\backepsilon",
    "\\backprime",
    "\\backsim",
    "\\backsimeq",
    "\\barwedge",
    "\\Bbbk",
    "\\because",
    "\\beta",
    "\\beth",
    "\\between",
    "\\bigcap",
    "\\bigcirc",
    "\\bigcup",
    "\\bigodot",
    "\\bigoplus",
    "\\bigotimes",
    "\\bigsqcup",
    "\\bigstar",
    "\\bigtriangledown",
    "\\bigtriangleup",
    "\\biguplus",
    "\\bigvee",
    "\\bigwedge",
    "\\blacklozenge",
    "\\blacksquare",
    "\\blacktriangle",
    "\\blacktriangledown",
    "\\blacktriangleleft",
    "\\blacktriangleright",
    "\\bot",
    "\\bowtie",
    "\\Box",
    "\\boxdot",
    "\\boxminus",
    "\\boxplus",
    "\\boxtimes",
    "\\bullet",
    "\\bumpeq",
    "\\Bumpeq",
    "\\cap",
    "\\Cap",
    "\\CatalansConstant",
    "\\cdot",
    "\\cdots",
    "\\centerdot",
    "\\checkmark",
    "\\chi",
    "\\circ",
    "\\circeq",
    "\\circlearrowleft",
    "\\circlearrowright",
    "\\circledast",
    "\\circledcirc",
    "\\circleddash",
    "\\circledS",
    "\\clubsuit",
    "\\colon",
    "\\complement",
    "\\cong",
    "\\coprod",
    "\\cup",
    "\\Cup",
    "\\curlyeqprec",
    "\\curlyeqsucc",
    "\\curlyvee",
    "\\curlywedge",
    "\\curvearrowleft",
    "\\curvearrowright",
    "\\dagger",
    "\\daleth",
    "\\dashv",
    "\\ddagger",
    "\\ddots",
    "\\delta",
    "\\Delta",
    "\\diagdown",
    "\\diagup",
    "\\diamond",
    "\\Diamond",
    "\\diamondsuit",
    "\\digamma",
    "\\displaystyle",
    "\\div",
    "\\divideontimes",
    "\\doteq",
    "\\doteqdot",
    "\\dotplus",
    "\\dots",
    "\\dotsb",
    "\\dotsc",
    "\\dotsi",
    "\\dotsm",
    "\\dotso",
    "\\doublebarwedge",
    "\\downdownarrows",
    "\\downharpoonleft",
    "\\downharpoonright",
    "\\ell",
    "\\emptyset",
    "\\epsilon",
    "\\eqcirc",
    "\\eqsim",
    "\\eqslantgtr",
    "\\eqslantless",
    "\\equiv",
    "\\eta",
    "\\eth",
    "\\exists",
    "\\fallingdotseq",
    "\\Finv",
    "\\flat",
    "\\forall",
    "\\frown",
    "\\Game",
    "\\gamma",
    "\\Gamma",
    "\\geq",
    "\\geqq",
    "\\geqslant",
    "\\gets",
    "\\gg",
    "\\ggg",
    "\\gimel",
    "\\gnapprox",
    "\\gneq",
    "\\gneqq",
    "\\gnsim",
    "\\gtrapprox",
    "\\gtrdot",
    "\\gtreqless",
    "\\gtreqqless",
    "\\gtrless",
    "\\gtrsim",
    "\\gvertneqq",
    "\\hbar",
    "\\heartsuit",
    //"\\hline", // moved to hline_function
    "\\hookleftarrow",
    "\\hookrightarrow",
    "\\hslash",
    "\\iff",
    "\\iiiint",
    "\\iiint",
    "\\iint",
    "\\Im",
    "\\imath",
    "\\implies",
    "\\in",
    "\\infty",
    "\\injlim",
    "\\int",
    "\\intercal",
    "\\iota",
    "\\jmath",
    "\\kappa",
    "\\lambda",
    "\\Lambda",
    "\\land",
    "\\ldots",
    "\\leftarrow",
    "\\Leftarrow",
    "\\leftarrowtail",
    "\\leftharpoondown",
    "\\leftharpoonup",
    "\\leftleftarrows",
    "\\leftrightarrow",
    "\\Leftrightarrow",
    "\\leftrightarrows",
    "\\leftrightharpoons",
    "\\leftrightsquigarrow",
    "\\leftthreetimes",
    "\\leq",
    "\\leqq",
    "\\leqslant",
    "\\lessapprox",
    "\\lessdot",
    "\\lesseqgtr",
    "\\lesseqqgtr",
    "\\lessgtr",
    "\\lesssim",
    "\\limits", // XXX only valid in certain contexts
    "\\ll",
    "\\Lleftarrow",
    "\\lll",
    "\\lnapprox",
    "\\lneq",
    "\\lneqq",
    "\\lnot",
    "\\lnsim",
    "\\longleftarrow",
    "\\Longleftarrow",
    "\\longleftrightarrow",
    "\\Longleftrightarrow",
    "\\longmapsto",
    "\\longrightarrow",
    "\\Longrightarrow",
    "\\looparrowleft",
    "\\looparrowright",
    "\\lor",
    "\\lozenge",
    "\\Lsh",
    "\\ltimes",
    "\\lVert",
    "\\lvertneqq",
    "\\mapsto",
    "\\measuredangle",
    "\\mho",
    "\\mid",
    "\\mod",
    "\\models",
    "\\mp",
    "\\mu",
    "\\multimap",
    "\\nabla",
    "\\natural",
    "\\ncong",
    "\\nearrow",
    "\\neg",
    "\\neq",
    "\\nexists",
    "\\ngeq",
    "\\ngeqq",
    "\\ngeqslant",
    "\\ngtr",
    "\\ni",
    "\\nleftarrow",
    "\\nLeftarrow",
    "\\nleftrightarrow",
    "\\nLeftrightarrow",
    "\\nleq",
    "\\nleqq",
    "\\nleqslant",
    "\\nless",
    "\\nmid",
    "\\nolimits", // XXX see \limits
    "\\not",
    "\\notin",
    "\\nparallel",
    "\\nprec",
    "\\npreceq",
    "\\nrightarrow",
    "\\nRightarrow",
    "\\nshortmid",
    "\\nshortparallel",
    "\\nsim",
    "\\nsubseteq",
    "\\nsubseteqq",
    "\\nsucc",
    "\\nsucceq",
    "\\nsupseteq",
    "\\nsupseteqq",
    "\\ntriangleleft",
    "\\ntrianglelefteq",
    "\\ntriangleright",
    "\\ntrianglerighteq",
    "\\nu",
    "\\nvdash",
    "\\nVdash",
    "\\nvDash",
    "\\nVDash",
    "\\nwarrow",
    "\\odot",
    "\\oint",
    "\\omega",
    "\\Omega",
    "\\ominus",
    "\\oplus",
    "\\oslash",
    "\\otimes",
    //"\\overbrace", // moved to ar1nb (grabs trailing sub/superscript)
    "\\P",
    "\\parallel",
    "\\partial",
    "\\perp",
    "\\phi",
    "\\Phi",
    "\\pi",
    "\\Pi",
    "\\pitchfork",
    "\\pm",
    "\\prec",
    "\\precapprox",
    "\\preccurlyeq",
    "\\preceq",
    "\\precnapprox",
    "\\precneqq",
    "\\precnsim",
    "\\precsim",
    "\\prime",
    "\\prod",
    "\\projlim",
    "\\propto",
    "\\psi",
    "\\Psi",
    "\\qquad",
    "\\quad",
    "\\Re",
    "\\rho",
    "\\rightarrow",
    "\\Rightarrow",
    "\\rightarrowtail",
    "\\rightharpoondown",
    "\\rightharpoonup",
    "\\rightleftarrows",
    "\\rightrightarrows",
    "\\rightsquigarrow",
    "\\rightthreetimes",
    "\\risingdotseq",
    "\\Rrightarrow",
    "\\Rsh",
    "\\rtimes",
    "\\rVert",
    "\\S",
    "\\scriptscriptstyle",
    "\\scriptstyle",
    "\\searrow",
    "\\setminus",
    "\\sharp",
    "\\shortmid",
    "\\shortparallel",
    "\\sigma",
    "\\Sigma",
    "\\sim",
    "\\simeq",
    "\\smallfrown",
    "\\smallsetminus",
    "\\smallsmile",
    "\\smile",
    "\\spadesuit",
    "\\sphericalangle",
    "\\sqcap",
    "\\sqcup",
    "\\sqsubset",
    "\\sqsubseteq",
    "\\sqsupset",
    "\\sqsupseteq",
    "\\square",
    "\\star",
    "\\subset",
    "\\Subset",
    "\\subseteq",
    "\\subseteqq",
    "\\subsetneq",
    "\\subsetneqq",
    "\\succ",
    "\\succapprox",
    "\\succcurlyeq",
    "\\succeq",
    "\\succnapprox",
    "\\succneqq",
    "\\succnsim",
    "\\succsim",
    "\\sum",
    "\\supset",
    "\\Supset",
    "\\supseteq",
    "\\supseteqq",
    "\\supsetneq",
    "\\supsetneqq",
    "\\surd",
    "\\swarrow",
    "\\tau",
    "\\textstyle",
    "\\therefore",
    "\\theta",
    "\\Theta",
    "\\thickapprox",
    "\\thicksim",
    "\\times",
    "\\to",
    "\\top",
    "\\triangle",
    "\\triangledown",
    "\\triangleleft",
    "\\trianglelefteq",
    "\\triangleq",
    "\\triangleright",
    "\\trianglerighteq",
    //"\\underbrace", // moved to ar1nb (grabs trailing sub/superscript)
    "\\upharpoonleft",
    "\\upharpoonright",
    "\\uplus",
    "\\upsilon",
    "\\Upsilon",
    "\\upuparrows",
    "\\varepsilon",
    "\\varinjlim",
    "\\varkappa",
    "\\varliminf",
    "\\varlimsup",
    "\\varnothing",
    "\\varphi",
    "\\varpi",
    "\\varprojlim",
    "\\varpropto",
    "\\varrho",
    "\\varsigma",
    "\\varsubsetneq",
    "\\varsubsetneqq",
    "\\varsupsetneq",
    "\\varsupsetneqq",
    "\\vartheta",
    "\\vartriangle",
    "\\vartriangleleft",
    "\\vartriangleright",
    "\\vdash",
    "\\Vdash",
    "\\vDash",
    "\\vdots",
    "\\vee",
    "\\veebar",
    "\\vline",
    "\\Vvdash",
    "\\wedge",
    "\\wp",
    "\\wr",
    "\\xi",
    "\\Xi",
    "\\zeta"
]);

// text-mode literals; enclose in \mbox
module.exports.other_literals2 = arr2set([
    "\\AA",
    "\\Coppa",
    "\\coppa",
    "\\Digamma",
    "\\euro",
    "\\geneuro",
    "\\geneuronarrow",
    "\\geneurowide",
    "\\Koppa",
    "\\koppa",
    "\\officialeuro",
    "\\Sampi",
    "\\sampi",
    "\\Stigma",
    "\\stigma",
    "\\textvisiblespace",
    "\\varstigma"
]);

module.exports.other_literals3 = obj2map({
    "\\C": "\\mathbb{C}",
    "\\H": "\\mathbb{H}",
    "\\N": "\\mathbb{N}",
    "\\Q": "\\mathbb{Q}",
    "\\R": "\\mathbb{R}",
    "\\Z": "\\mathbb{Z}",
    "\\alef": "\\aleph",
    "\\alefsym": "\\aleph",
    "\\Alpha": "\\mathrm{A}",
    "\\and": "\\land",
    "\\ang": "\\angle",
    "\\Beta": "\\mathrm{B}",
    "\\bull": "\\bullet",
    "\\Chi": "\\mathrm{X}",
    "\\clubs": "\\clubsuit",
    "\\cnums": "\\mathbb{C}",
    "\\Complex": "\\mathbb{C}",
    "\\Dagger": "\\ddagger",
    "\\diamonds": "\\diamondsuit",
    "\\Doteq": "\\doteqdot",
    "\\doublecap": "\\Cap",
    "\\doublecup": "\\Cup",
    "\\empty": "\\emptyset",
    "\\Epsilon": "\\mathrm{E}",
    "\\Eta": "\\mathrm{H}",
    "\\exist": "\\exists",
    "\\ge": "\\geq",
    "\\gggtr": "\\ggg",
    "\\hAar": "\\Leftrightarrow",
    "\\harr": "\\leftrightarrow",
    "\\Harr": "\\Leftrightarrow",
    "\\hearts": "\\heartsuit",
    "\\image": "\\Im",
    "\\infin": "\\infty",
    "\\Iota": "\\mathrm{I}",
    "\\isin": "\\in",
    "\\Kappa": "\\mathrm{K}",
    "\\larr": "\\leftarrow",
    "\\Larr": "\\Leftarrow",
    "\\lArr": "\\Leftarrow",
    "\\le": "\\leq",
    "\\lrarr": "\\leftrightarrow",
    "\\Lrarr": "\\Leftrightarrow",
    "\\lrArr": "\\Leftrightarrow",
    "\\Mu": "\\mathrm{M}",
    "\\natnums": "\\mathbb{N}",
    "\\ne": "\\neq",
    "\\Nu": "\\mathrm{N}",
    "\\O": "\\emptyset",
    "\\omicron": "\\mathrm{o}",
    "\\Omicron": "\\mathrm{O}",
    "\\or": "\\lor",
    "\\part": "\\partial",
    "\\plusmn": "\\pm",
    "\\rarr": "\\rightarrow",
    "\\Rarr": "\\Rightarrow",
    "\\rArr": "\\Rightarrow",
    "\\real": "\\Re",
    "\\reals": "\\mathbb{R}",
    "\\Reals": "\\mathbb{R}",
    "\\restriction": "\\upharpoonright",
    "\\Rho": "\\mathrm{P}",
    "\\sdot": "\\cdot",
    "\\sect": "\\S",
    "\\spades": "\\spadesuit",
    "\\sub": "\\subset",
    "\\sube": "\\subseteq",
    "\\supe": "\\supseteq",
    "\\Tau": "\\mathrm{T}",
    "\\thetasym": "\\vartheta",
    "\\varcoppa": "\\mbox{\\coppa}",
    "\\weierp": "\\wp",
    "\\Zeta": "\\mathrm{Z}"
});

module.exports.big_literals = arr2set([
    "\\big",
    "\\Big",
    "\\bigg",
    "\\Bigg",
    "\\biggl",
    "\\Biggl",
    "\\biggr",
    "\\Biggr",
    "\\bigl",
    "\\Bigl",
    "\\bigr",
    "\\Bigr"
]);

module.exports.other_delimiters1 = arr2set([
    "\\backslash",
    "\\downarrow",
    "\\Downarrow",
    "\\langle",
    "\\lbrace",
    "\\lceil",
    "\\lfloor",
    "\\llcorner",
    "\\lrcorner",
    "\\rangle",
    "\\rbrace",
    "\\rceil",
    "\\rfloor",
    "\\rightleftharpoons",
    "\\twoheadleftarrow",
    "\\twoheadrightarrow",
    "\\ulcorner",
    "\\uparrow",
    "\\Uparrow",
    "\\updownarrow",
    "\\Updownarrow",
    "\\urcorner",
    "\\Vert",
    "\\vert",
    "\\lbrack",
    "\\rbrack"
]);

module.exports.other_delimiters2 = obj2map({
    "\\darr": "\\downarrow",
    "\\dArr": "\\Downarrow",
    "\\Darr": "\\Downarrow",
    "\\lang": "\\langle",
    "\\rang": "\\rangle",
    "\\uarr": "\\uparrow",
    "\\uArr": "\\Uparrow",
    "\\Uarr": "\\Uparrow"
});

module.exports.fun_ar1 = arr2set([
    "\\acute",
    "\\bar",
    "\\bcancel",
    "\\bmod",
    "\\boldsymbol",
    "\\breve",
    "\\cancel",
    "\\ce",
    "\\check",
    "\\ddot",
    "\\dot",
    "\\emph",
    "\\grave",
    "\\hat",
    //"\\mathbb", // moved to fun_ar1nb
    //"\\mathbf", // moved to fun_ar1nb
    "\\mathbin",
    "\\mathcal",
    "\\mathclose",
    "\\mathfrak",
    "\\mathit",
    "\\mathop",
    "\\mathopen",
    "\\mathord",
    "\\mathpunct",
    "\\mathrel",
    //"\\mathrm", // moved to fun_ar1nb
    "\\mathsf",
    "\\mathtt",
    //"\\operatorname", // already exists in fun_ar1nb
    "\\overleftarrow",
    "\\overleftrightarrow",
    "\\overline",
    "\\overrightarrow",
    "\\pmod",
    "\\sqrt",
    "\\textbf",
    "\\textit",
    "\\textrm",
    "\\textsf",
    "\\texttt",
    "\\tilde",
    "\\underline",
    "\\vec",
    "\\widehat",
    "\\widetilde",
    "\\xcancel",
    "\\xleftarrow",
    "\\xrightarrow"
]);

module.exports.other_fun_ar1 = obj2map({
    "\\Bbb": "\\mathbb",
    "\\bold": "\\mathbf"
});

module.exports.fun_ar1nb = arr2set([
    "\\operatorname",
    "\\overbrace",
    "\\mathbb",
    "\\mathbf",
    "\\mathrm",
    "\\underbrace"
]);

module.exports.fun_ar1opt = arr2set([
    "\\sqrt", "\\xleftarrow", "\\xrightarrow"
]);

module.exports.fun_ar2 = arr2set([
    "\\binom",
    "\\cancelto",
    "\\cfrac",
    "\\dbinom",
    "\\dfrac",
    "\\frac",
    "\\overset",
    "\\pochhammer",
    "\\stackrel",
    "\\tbinom",
    "\\tfrac",
    "\\underset"
]);

module.exports.fun_ar3 = arr2set([
    "\\qPochhammer"
]);

module.exports.jacobi = arr2set([
    "\\Jacobi"
]);

module.exports.laguerre = arr2set([
    "\\Laguerre"
]);

module.exports.elliptical_jacobi = arr2set([
    "\\Jacobi"
]);

module.exports.fun_ar2nb = arr2set([
    "\\sideset"
]);

module.exports.fun_infix = arr2set([
    "\\atop",
    "\\choose",
    "\\over"
]);

module.exports.declh_function = arr2set([
    "\\rm",
    "\\it",
    "\\cal",
    "\\bf"
]);

module.exports.left_function = arr2set([ "\\left" ]);
module.exports.right_function = arr2set([ "\\right" ]);
module.exports.hline_function = arr2set([ "\\hline" ]);
module.exports.definecolor_function = arr2set([ "\\definecolor" ]);
module.exports.color_function = arr2set([ "\\color", "\\pagecolor" ]);

// ------------------------------------------------------
// Package dependencies for various allowed commands.

module.exports.ams_required = arr2set([
    "\\text",
    "\\begin{matrix}",
    "\\begin{pmatrix}",
    "\\begin{bmatrix}",
    "\\begin{Bmatrix}",
    "\\begin{vmatrix}",
    "\\begin{Vmatrix}",
    "\\begin{aligned}",
    "\\begin{alignedat}",
    "\\begin{smallmatrix}",
    "\\begin{cases}",

    "\\ulcorner",
    "\\urcorner",
    "\\llcorner",
    "\\lrcorner",
    "\\twoheadleftarrow",
    "\\twoheadrightarrow",
    "\\xleftarrow",
    "\\xrightarrow",
    //"\\angle", // in texvc, but ams not actually required
    "\\sqsupset",
    "\\sqsubset",
    //"\\sqsupseteq", // in texvc, but ams not actually required
    //"\\sqsubseteq", // in texvc, but ams not actually required
    "\\smallsetminus",
    "\\And",
    //"\\sqcap", // in texvc, but ams not actually required
    //"\\sqcup", // in texvc, but ams not actually required
    "\\implies",
    "\\mod",
    "\\Diamond",
    "\\dotsb",
    "\\dotsc",
    "\\dotsi",
    "\\dotsm",
    "\\dotso",
    "\\lVert",
    "\\rVert",
    "\\nmid",
    "\\lesssim",
    "\\ngeq",
    "\\smallsmile",
    "\\smallfrown",
    "\\nleftarrow",
    "\\nrightarrow",
    "\\trianglelefteq",
    "\\trianglerighteq",
    "\\square",
    "\\checkmark",
    "\\supsetneq",
    "\\subsetneq",
    "\\Box",
    "\\nleq",
    "\\upharpoonright",
    "\\upharpoonleft",
    "\\downharpoonright",
    "\\downharpoonleft",
    //"\\rightharpoonup", // in texvc, but ams not actually required
    //"\\rightharpoondown", // in texvc, but ams not actually required
    //"\\leftharpoonup", // in texvc, but ams not actually required
    //"\\leftharpoondown", // in texvc, but ams not actually required
    "\\nless",
    "\\Vdash",
    "\\vDash",
    "\\varkappa",
    "\\digamma",
    "\\beth",
    "\\daleth",
    "\\gimel",
    "\\complement",
    "\\eth",
    "\\hslash",
    "\\mho",
    "\\Finv",
    "\\Game",
    "\\varlimsup",
    "\\varliminf",
    "\\varinjlim",
    "\\varprojlim",
    "\\injlim",
    "\\projlim",
    "\\iint",
    "\\iiint",
    "\\iiiint",
    "\\varnothing",
    "\\overleftrightarrow",
    "\\binom",
    "\\dbinom",
    "\\tbinom",
    "\\sideset",
    "\\underset",
    "\\overset",
    "\\dfrac",
    "\\tfrac",
    "\\cfrac",
    //"\\bigl", // in texvc, but ams not actually required
    //"\\bigr", // in texvc, but ams not actually required
    //"\\Bigl", // in texvc, but ams not actually required
    //"\\Bigr", // in texvc, but ams not actually required
    //"\\biggl", // in texvc, but ams not actually required
    //"\\biggr", // in texvc, but ams not actually required
    //"\\Biggl", // in texvc, but ams not actually required
    //"\\Biggr", // in texvc, but ams not actually required
    "\\vartriangle",
    "\\triangledown",
    "\\lozenge",
    "\\circledS",
    "\\measuredangle",
    "\\nexists",
    "\\Bbbk",
    "\\backprime",
    "\\blacktriangle",
    "\\blacktriangledown",
    "\\blacksquare",
    "\\blacklozenge",
    "\\bigstar",
    "\\sphericalangle",
    "\\diagup",
    "\\diagdown",
    "\\dotplus",
    "\\Cap",
    "\\Cup",
    "\\barwedge",
    "\\veebar",
    "\\doublebarwedge",
    "\\boxminus",
    "\\boxtimes",
    "\\boxdot",
    "\\boxplus",
    "\\divideontimes",
    "\\ltimes",
    "\\rtimes",
    "\\leftthreetimes",
    "\\rightthreetimes",
    "\\curlywedge",
    "\\curlyvee",
    "\\circleddash",
    "\\circledast",
    "\\circledcirc",
    "\\centerdot",
    "\\intercal",
    "\\leqq",
    "\\leqslant",
    "\\eqslantless",
    "\\lessapprox",
    "\\approxeq",
    "\\lessdot",
    "\\lll",
    "\\lessgtr",
    "\\lesseqgtr",
    "\\lesseqqgtr",
    "\\doteqdot",
    "\\risingdotseq",
    "\\fallingdotseq",
    "\\backsim",
    "\\backsimeq",
    "\\subseteqq",
    "\\Subset",
    "\\preccurlyeq",
    "\\curlyeqprec",
    "\\precsim",
    "\\precapprox",
    "\\vartriangleleft",
    "\\Vvdash",
    "\\bumpeq",
    "\\Bumpeq",
    "\\geqq",
    "\\geqslant",
    "\\eqslantgtr",
    "\\gtrsim",
    "\\gtrapprox",
    "\\eqsim",
    "\\gtrdot",
    "\\ggg",
    "\\gtrless",
    "\\gtreqless",
    "\\gtreqqless",
    "\\eqcirc",
    "\\circeq",
    "\\triangleq",
    "\\thicksim",
    "\\thickapprox",
    "\\supseteqq",
    "\\Supset",
    "\\succcurlyeq",
    "\\curlyeqsucc",
    "\\succsim",
    "\\succapprox",
    "\\vartriangleright",
    "\\shortmid",
    "\\shortparallel",
    "\\between",
    "\\pitchfork",
    "\\varpropto",
    "\\blacktriangleleft",
    "\\therefore",
    "\\backepsilon",
    "\\blacktriangleright",
    "\\because",
    "\\nleqslant",
    "\\nleqq",
    "\\lneq",
    "\\lneqq",
    "\\lvertneqq",
    "\\lnsim",
    "\\lnapprox",
    "\\nprec",
    "\\npreceq",
    "\\precneqq",
    "\\precnsim",
    "\\precnapprox",
    "\\nsim",
    "\\nshortmid",
    "\\nvdash",
    "\\nVdash",
    "\\ntriangleleft",
    "\\ntrianglelefteq",
    "\\nsubseteq",
    "\\nsubseteqq",
    "\\varsubsetneq",
    "\\subsetneqq",
    "\\varsubsetneqq",
    "\\ngtr",
    "\\ngeqslant",
    "\\ngeqq",
    "\\gneq",
    "\\gneqq",
    "\\gvertneqq",
    "\\gnsim",
    "\\gnapprox",
    "\\nsucc",
    "\\nsucceq",
    "\\succneqq",
    "\\succnsim",
    "\\succnapprox",
    "\\ncong",
    "\\nshortparallel",
    "\\nparallel",
    "\\nvDash",
    "\\nVDash",
    "\\ntriangleright",
    "\\ntrianglerighteq",
    "\\nsupseteq",
    "\\nsupseteqq",
    "\\varsupsetneq",
    "\\supsetneqq",
    "\\varsupsetneqq",
    "\\leftleftarrows",
    "\\leftrightarrows",
    "\\Lleftarrow",
    "\\leftarrowtail",
    "\\looparrowleft",
    "\\leftrightharpoons",
    "\\curvearrowleft",
    "\\circlearrowleft",
    "\\Lsh",
    "\\upuparrows",
    "\\rightrightarrows",
    "\\rightleftarrows",
    "\\Rrightarrow",
    "\\rightarrowtail",
    "\\looparrowright",
    "\\curvearrowright",
    "\\circlearrowright",
    "\\Rsh",
    "\\downdownarrows",
    "\\multimap",
    "\\leftrightsquigarrow",
    "\\rightsquigarrow",
    "\\nLeftarrow",
    "\\nleftrightarrow",
    "\\nRightarrow",
    "\\nLeftrightarrow",

    //"\\mathit", // in texvc, but ams not actually required
    //"\\mathrm", // in texvc, but ams not actually required
    //"\\mathord", // in texvc, but ams not actually required
    //"\\mathop", // in texvc, but ams not actually required
    //"\\mathbin", // in texvc, but ams not actually required
    //"\\mathrel", // in texvc, but ams not actually required
    //"\\mathopen", // in texvc, but ams not actually required
    //"\\mathclose", // in texvc, but ams not actually required
    //"\\mathpunct", // in texvc, but ams not actually required
    "\\boldsymbol",
    "\\mathbb",
    //"\\mathbf", // in texvc, but ams not actually required
    //"\\mathsf", // in texvc, but ams not actually required
    //"\\mathcal", // in texvc, but ams not actually required
    //"\\mathtt", // in texvc, but ams not actually required
    "\\mathfrak",
    "\\operatorname",
    "\\mathbb{R}"
]);

module.exports.cancel_required = arr2set([
    "\\bcancel",
    "\\cancel",
    "\\xcancel",
    "\\cancelto"
]);

module.exports.color_required = arr2set([
    "\\color",
    "\\pagecolor",
    "\\definecolor"
]);

module.exports.euro_required = arr2set([
    "\\euro",
    "\\geneuro",
    "\\geneuronarrow",
    "\\geneurowide",
    "\\officialeuro"
]);

module.exports.teubner_required = arr2set([
    "\\Coppa",
    "\\coppa",
    "\\Digamma",
    "\\Koppa",
    "\\koppa",
    "\\Sampi",
    "\\sampi",
    "\\Stigma",
    "\\stigma",
    "\\varstigma"
]);

module.exports.mhchem_required = arr2set([
    "\\ce"
]);
