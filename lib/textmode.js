"use strict";

var texer = module.exports.texer = require("./");
texer.reset();

var rebuilt = false;

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

function makeInsertions(string, sections, replacements) {
    var offset = 0;
    for (var index in sections) {
        var section = sections[index];
        var start = section.startIndex + offset, end = section.endIndex + offset + 1;
        replacements.push(section.makeReplacements(string.substring(start, end)));
        string = string.substring(0, start) + insertion + string.substring(end);
        offset += insertion.length - end + start;
    }
    return string;
}

function TextMode(startIndex) {
    this.startIndex = startIndex;
    this.mathSections = [];
}

TextMode.prototype.addMathSection = function(mathSection) {
    this.mathSections.push(mathSection);

}

TextMode.prototype.makeReplacements = function(string) {
    var replacements = [];
    string = makeInsertions(string, this.mathSections, replacements);
    for (var index in replacements) {
        var replacement = replacements[index];
        string = string.replace(insertion, replacement.replace(/\$/g, '$$$'));
    }
    return string;
}

function MathMode(startIndex) {
    this.startIndex = startIndex;
    this.textSections = [];
}

MathMode.prototype.addTextSection = function(textSection) {
    this.textSections.push(textSection);

}

MathMode.prototype.makeReplacements = function(string) {
    var replacements = [];
    string = makeInsertions(string, this.textSections, replacements);
    var delimStart = this.delim, delimEnd = mathStart[this.delim];
    string = string.substring(delimStart.length, string.length - delimEnd.length);
    var output = texer.texer(string).output;
    string = delimStart + output + delimEnd;
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

function parseMath(res, startIndex) {
    var mathSection = new MathMode(startIndex);
    mathSection.delim = firstDelim(res, true);
    var i = mathSection.delim.length;
    var end = mathStart[mathSection.delim];
    while (i < res.length) {
        i += skipEscaped(res.substring(i));
        var sub = res.substring(i);
        if (sub.charAt(0) == "%") {
            var textSection = parseText(sub.substring(0, sub.indexOf("\n")), i);
            mathSection.addTextSection(textSection);
            i += textSection.endIndex - textSection.startIndex;
        }
        if (doesExit(sub)) {
            var textSection = parseText(sub, i);
            mathSection.addTextSection(textSection);
            i += textSection.endIndex - textSection.startIndex;
        }
        if (startsWith(sub, end)) {
            mathSection.endIndex = mathSection.startIndex + i + end.length - 1;
            return mathSection;
        }
        i++;
    }
}

function parseText(res, startIndex) {
    if (startIndex == undefined) {
        startIndex = 0;
    }
    var textSection = new TextMode(startIndex);
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
                var mathSection = parseMath(sub, i);
                textSection.addMathSection(mathSection);
                i += mathSection.endIndex - mathSection.startIndex;
            }
            else if (sub.charAt(0) === '{') {
                level++;
            }
            else if (sub.charAt(0) === '}') {
                if (level === 0 && delim !== '') {
                    textSection.endIndex = startIndex + i;
                    return textSection;
                }
                level--;
            }
        }
        else if (res.charAt(i) == "\n") {
            commented = false;
        }
        i++;
    }
    textSection.endIndex = startIndex + i - 1;
    return textSection;
}

module.exports.replaceText = function(res, preserveBuild) {
    if (!rebuilt && !preserveBuild) {
        rebuilt = true;
        texer.rebuild();
        texer.initialize();
    }
    return parseText(res).makeReplacements(res);
}

module.exports.replaceFile = function(inFile, outFile) {
    var path = require('path');
    var fs = require('fs');
    inFile = path.join(__dirname, inFile);
    outFile = path.join(__dirname, outFile);
    var res = fs.readFileSync(inFile, 'utf8');
    var lines = res.split("\n").map(function(line) {return line.trim();});
    var sty = lines.slice(0, lines.indexOf("\\begin{document}")).join("\n");
    texer.rebuild(sty);
    texer.initialize();
    rebuilt = true;
    fs.writeFileSync(outFile, module.exports.replaceText(res), 'utf8');
    rebuilt = false;
}