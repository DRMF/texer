"use strict";

var mathMode = {'\\[' : '\\]',
                '\\(' : '\\)',
                '$' : '$',
                '$$' : '$$',
                '\\begin{equation}' : '\\end{equation}',
                '\\begin{equation*}' : '\\end{equation*}',
                '\\begin{align}' : '\\end{align}',
                '\\begin{align*}' : '\\end{align*}',
                '\\begin{multline}' : '\\end{multline}',
                '\\begin{multline*}' : '\\end{multline*}'};

var textMode = ['\\hbox{',
                '\\mbox{',
                '\\text{'];

function firstDelim(res, enter) {
    var min, list;
    if (enter) {
        min = '\\[';
        list = mathMode;
    }
    else {
        min = '\\hbox{';
        list = textMode;
    }
    for (var key in list) {
        var i = res.indexOf(key);
        if (i !== -1 && (i <= res.indexOf(min) || res.indexOf(min) === -1)) {
            min = key;
        }
    }
    return min;
}

function startsWith(string, substring) {
    return string.lastIndexOf(substring, 0) === 0;

}

function doesExit(string) {
    for (var i = 0; i < textMode.length; i++) {
        if (startsWith(string, textMode[i])) {
            return true;
        }
    }
    return false;
}

function doesEnter(string) {
    for (var key in mathMode) {
        if (startsWith(string, key)) {
            return key;
        }
    }
    return '';
}

function skipEscaped(res) {
    if (startsWith(res, '\\$')) {
        return 2;
    }
    else if (startsWith(res, '\\\\[')) {
        return 3;
    }
    else if (startsWith(res, '\\\\(')) {
        return 3;
    }
    return 0;
}

function parseMath(res, start, ranges) {
    var delim = firstDelim(res, true);
    var i = delim.length;
    var begin = start + i;
    while (i < res.length) {
        i += skipEscaped(res.substring(i));
        if (doesExit(res.substring(i))) {
            if (begin !== start + i) {
                ranges.push([begin, start + i]);
            }
            i += parseNonMath(res.substring(i), start + i, ranges);
            begin = start + i;
        }
        if (startsWith(res.substring(i), mathMode[delim])) {
            if (begin !== start + i) {
                ranges.push([begin, start + i]);
            }
            return i + mathMode[delim].length - 1;
        }
        i++;
    }
}

function parseNonMath(res, start, ranges) {
    var delim = firstDelim(res, false);
    if (!startsWith(res, delim)) {
        delim = '';
    }
    var level = 0;
    var i = delim.length;
    while (i < res.length) {
        i += skipEscaped(res.substring(i));
        if (doesEnter(res.substring(i))) {
            i += parseMath(res.substring(i), start + i, ranges);
        }
        else if (res.charAt(i) === '{') {
            level++;
        }
        else if (res.charAt(i) === '}') {
            if (level === 0 && delim !== '') {
                i++;
                return i;
            }
            else {
                level--;
            }
        }
        i++;
    }
    return i;
}

module.exports.findMathSections = function (res) {
    var ranges = [];
    parseNonMath(res, 0, ranges);
    var mathSections = [];
    for (var index = 0; index < ranges.length; index++) {
        mathSections.push(res.substring(ranges[index][0], ranges[index][1]));
    }
    return mathSections;
};