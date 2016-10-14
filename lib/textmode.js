"use strict";

var texer = module.exports.texer = require("./");
texer.reset();
var path = require('path');
var fs = require('fs');

var rebuilt = false;
var total;
var replaced;

var mathStart = {'\\[' : '\\]',
                 '\\(' : '\\)',
                 '$' : '$',
                 '$$' : '$$',
                 '\\begin{equation}' : '\\end{equation}',
                 '\\begin{equation*}' : '\\end{equation*}',
                 '\\begin{align}' : '\\end{align}',
                 '\\begin{align*}' : '\\end{align*}',
                 '\\begin{multline}' : '\\end{multline}',
                 '\\begin{multline*}' : '\\end{multline*}'};

var textStart = ['\\hbox{',
                 '\\mbox{',
                 '\\text{',
                 '\\label{'];

var escapes = ['\\$',
               '\\\\[',
               '\\\\]',
               '\\\\(',
               '\\\\)',
               '\\%'];

var insertion = "{--insertion--}";
var newline = "{--newline--}"

function makeInsertions(string, sections, replacements, undef) {
    var offset = 0;
    for (var index in sections) {
        var section = sections[index];
        var start = section.startIndex + offset, end = section.endIndex + offset + 1;
        replacements.push(section.makeReplacements(string.substring(start, end), undef));
        string = string.substring(0, start) + insertion + string.substring(end);
        offset += insertion.length - end + start;
    }
    return string;
}

function TextMode(startIndex, lineNumber) {
    this.startIndex = startIndex;
    this.lineNumber = lineNumber;
    this.mathSections = [];
}

TextMode.prototype.addMathSection = function(mathSection) {
    this.mathSections.push(mathSection);

}

TextMode.prototype.makeReplacements = function(string, undef) {
    var replacements = [];
    string = makeInsertions(string, this.mathSections, replacements, undef);
    for (var index in replacements) {
        var replacement = replacements[index];
        string = string.replace(insertion, replacement.replace(/\$/g, '$$$'));
    }
    return string;
}

function MathMode(startIndex, lineNumber) {
    this.startIndex = startIndex;
    this.lineNumber = lineNumber;
    this.textSections = [];
}

MathMode.prototype.addTextSection = function(textSection) {
    this.textSections.push(textSection);

}

MathMode.prototype.makeReplacements = function(string, undef) {
    total += 1;
    var replacements = [];
    var original = string;
    string = makeInsertions(string, this.textSections, replacements, undef);
    var delimStart = this.delim;
    var delimEnd = mathStart[delimStart];
    var manualReplacements = {"\\wt": "\\widetilde",
                              "\\sLP": "\\\\[\\sa]"};
    for (var key in manualReplacements) {
        if (string.indexOf(key) !== -1) {
            var num = string.split(key).length - 1;
            string = string.replace(new RegExp(key.replace(/\\/g, "\\\\"), "g"), manualReplacements[key]);
            undef.push([this.lineNumber, num + " occurrence(s) of " + key + " replaced.", null]);
        }
    }
    if (["\\begin{multline}", "\\begin{multline*}", "\\begin{align}", "\\begin{align*}"].indexOf(delimStart) === -1) {
        string = string.substring(delimStart.length, string.length - delimEnd.length);
        if (string.indexOf("\\\\") !== -1) {
            var num = string.split("\\\\").length - 1;
            string = string.replace(/\\\\/g, "");
            undef.push([this.lineNumber, num + " occurrence(s) of \\\\ replaced.", null]);
        }
        var output = texer.texer(string).output + "";
        if (output === "undefined") {
            undef.push([this.lineNumber, original]);
            string = original;
        }
        else {
            string = delimStart + output + delimEnd;
        }
    }
    else {
        var string = texer.texer(string).output + "";
        if (string === "undefined") {
            undef.push([this.lineNumber, original]);
            string = original;
        }
    }
    for (var index in replacements) {
        var replacement = replacements[index];
        string = string.replace(insertion, replacement.replace(/\$/g, '$$$'));
    }
    return string;
}

function firstDelim(res, enter) {
    var min, list;
    if (enter) {
        min = '\\[';
        list = Object.keys(mathStart);
    }
    else {
        min = '\\hbox{';
        list = textStart;
    }
    for (var key in list) {
        var i = res.indexOf(list[key]);
        if (i !== -1 && (i <= res.indexOf(min) || res.indexOf(min) === -1)) {
            min = list[key];
        }
    }
    return min;
}

function startsWith(string, substring) {
    return string.lastIndexOf(substring, 0) === 0;

}

function doesExit(string) {
    for (var i in textStart) {
        if (startsWith(string, textStart[i])) {
            return true;
        }
    }
    return false;
}

function doesEnter(string) {
    for (var key in mathStart) {
        if (startsWith(string, key)) {
            return key;
        }
    }
    return false;
}

function skipEscaped(res) {
    for (var index in escapes) {
        var escape = escapes[index];
        if (startsWith(res, escape)) {
            return escape.length;
        }
    }
    return 0;
}

function parseMath(res, startIndex, lineNumber) {
    var mathSection = new MathMode(startIndex, lineNumber);
    mathSection.delim = firstDelim(res, true);
    var i = mathSection.delim.length;
    var end = mathStart[mathSection.delim];
    while (i < res.length) {
        i += skipEscaped(res.substring(i));
        var sub = res.substring(i);
        if (sub.charAt(0) === "%") {
            var textSection = parseText(sub.substring(0, sub.indexOf(newline)), i, lineNumber);
            mathSection.addTextSection(textSection);
            i += textSection.endIndex - textSection.startIndex;
            lineNumber = textSection.endLine;
        }
        if (doesExit(sub)) {
            var textSection = parseText(sub, i, lineNumber);
            mathSection.addTextSection(textSection);
            i += textSection.endIndex - textSection.startIndex;
            lineNumber = textSection.endLine;
        }
        if (startsWith(sub, end)) {
            mathSection.endIndex = mathSection.startIndex + i + end.length - 1;
            mathSection.endLine = lineNumber;
            return mathSection;
        }
        if (startsWith(sub, newline)) {
            i += newline.length - 1;
            lineNumber += 1;
        }
        i++;
    }
}

function parseText(res, startIndex, lineNumber) {
    if (startIndex == undefined) {
        startIndex = 0;
        lineNumber = 1;
    }
    var textSection = new TextMode(startIndex, lineNumber);
    var delim = firstDelim(res, false);
    if (!startsWith(res, delim)) {
        delim = '';
    }
    var level = 0;
    var i = delim.length;
    var commented = false;
    while (i < res.length) {
        if (!commented) {
            i += skipEscaped(res.substring(i));
            if (i >= res.length) {
                break;
            }
            var sub = res.substring(i);
            if (sub.charAt(0) == "%") {
                commented = true;
                i++;
                continue;
            }
            if (doesEnter(sub)) {
                var mathSection = parseMath(sub, i, lineNumber);
                textSection.addMathSection(mathSection);
                i += mathSection.endIndex - mathSection.startIndex;
                lineNumber = mathSection.endLine;
            }
            else if (sub.charAt(0) === '{') {
                level++;
            }
            else if (sub.charAt(0) === '}') {
                if (level === 0 && delim !== '') {
                    textSection.endIndex = startIndex + i;
                    textSection.endLine = lineNumber;
                    return textSection;
                }
                level--;
            }
        }
        if (startsWith(res.substring(i), newline)) {
            commented = false;
            i += newline.length - 1;
            lineNumber += 1;
        }
        i++;
    }
    textSection.endIndex = startIndex + i - 1;
    textSection.endLine = lineNumber;
    return textSection;
}

module.exports.replaceText = function(res, preserveBuild, logFile, undef) {
    if (!rebuilt && !preserveBuild) {
        rebuilt = true;
        texer.reset();
        texer.rebuild("DRMFfcns.sty");
        texer.initialize();
    }
    if (!undef) {
        undef = [];
    }
    total = 0;
    replaced
    res = res.replace(/\r?\n/g, newline);
    var result = parseText(res).makeReplacements(res, undef).replace(new RegExp(newline, "g"), "\n");
    if (logFile) {
        var lines = [];
        undef = undef.filter(function(l) {
            if (lines.length == 3 && lines.indexOf(l[0] + l[1]) === -1) {
                lines.push(l[0] + l[1]);
                return true;
            }
            if (lines.indexOf(l[0]) === -1) {
                lines.push(l[0]);
                return true;
            }
            return false;
        }).sort(function (a, b) { return a[0] - b[0]; });
        var num = undef.filter(function(a) { return a.length == 2; }).length;
        undef = undef.map(function(l) { return "[[[" + l[0] + "]]]\n" + l[1]; });
        var percent = Math.round((num / total) * 10000) / 100;
        var log = total + " occurrences of math mode\n" + num + " encountered an error (" + percent + "%)\n";
        log += (total - num) + " parsed without error " + "(" + (100 - percent) + "%)\n\n";
        log += undef.join("\n\n").replace(new RegExp(newline, "g"), "\n");
        fs.writeFileSync(path.join(__dirname, logFile), log);
    }
    return result;
}

var replaceFile = module.exports.replaceFile = function(inFile, outFile, styFile, logFile, undef) {
    if (!logFile) {
        logFile = inFile + ".log";
    }
    if (!undef) {
        undef = [];
    }
    if (!styFile) {
        replaceFile(inFile, outFile, "DRMFfcns.sty", logFile, undef);
        replaceFile(outFile, outFile, "DLMFfcns.sty", logFile, undef);
//        replaceFile(outFile, outFile, "DLMFmath.sty", logFile);
        return;
    }
    inFile = path.join(__dirname, inFile);
    outFile = path.join(__dirname, outFile);
    var res = fs.readFileSync(inFile, 'utf8');
    var lines = res.split("\n").map(function(line) {return line.trim();});
    var sty = lines.slice(0, lines.indexOf("\\begin{document}")).join("\n");
    texer.reset();
    texer.rebuild(styFile, sty);
    texer.initialize();
    rebuilt = true;
    fs.writeFileSync(outFile, module.exports.replaceText(res, true, logFile, undef), 'utf8');
    rebuilt = false;
}