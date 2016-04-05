#!/usr/bin/env node
var mathStart = {"\\[":"\\]","\\(":"\\)","$":"$","$$":"$$","\\begin{equation}":"\\end{equation}","\\begin{equation*}":"\\end{equation*}","\\begin{align}":"\\end{align}","\\begin{align*}":"\\end{align*}","\\begin{multline}":"\\end{multline}","\\begin{multline*}":"\\end{multline*}"};
var mathEnd = ["\\hbox{", "\\mbox{", "\\text{"];

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

}

function getLine(res, char) {
    return (res.substring(0, char).match(/\n/g)||[]).length + 1;

}

function findFirst(res, delim, start) {
    i = res.indexOf(delim, start);
    if (delim == "$" || delim == "\\[" || delim == "\\(") {
        if (i == -1) {
            return -1;
        }
        else if (i != 0 && res.charAt(i - 1) == "\\") {
            return findFirst(res, delim, i + delim.length);
        }
    }
    return i;
}

function firstDelim(res, enter) {
    if (enter) {
        var min = "\\[";
        var list = mathStart;
    }
    else {
        var min = "\\hbox{";
        var list = mathEnd;
    }
    for (var key in list) {
        var i = findFirst(res, key, 0);
        if (i != -1 && (i <= findFirst(res, min, 0) || res.indexOf(min) == -1)) {
            min = key;
        }
    }
    return min;
}

function startsWith(string, substring) {
    return string.lastIndexOf(substring, 0) === 0;

}

function doesExit(string) {
    for (var i = 0; i < mathEnd.length; i++) {
        if (startsWith(string, mathEnd[i])) {
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
    return "";
}

function parseMath(res, start, ranges) {
    var delim = firstDelim(res, true);
    var i = delim.length;
    var begin = start + i;
    while (i < res.length) {
        if (startsWith(res.substring(i), "\\$")) {
            i++;
        }
        else if (startsWith(res.substring(i), "\\\\]")) {
            i += 2;
        }
        else if (startsWith(res.substring(i), "\\\\)")) {
            i += 2;
        }
        else {
            if (doesExit(res.substring(i))) {
                if (begin != start + i) {
                    ranges.push([begin, start + i]);
                }
                i += parseNonMath(res.substring(i), start + i, ranges);
                begin = start + i;
            }
            if (startsWith(res.substring(i), mathStart[delim])) {
                if (begin != start + i) {
                    ranges.push([begin, start + i]);
                }
                return i + mathStart[delim].length - 1;
            }
        }
        i++;
    }
    return i;
}

function parseNonMath(res, start, ranges) {
    var delim = firstDelim(res, false);
    if (!startsWith(res, delim)) {
        delim = "";
    }
    var level = 0;
    var i = delim.length;
    while (i < res.length) {
        if (startsWith(res.substring(i), "\\$")) {
            i++;
        }
        else if (startsWith(res.substring(i), "\\\\[")) {
            i += 2;
        }
        else if (startsWith(res.substring(i), "\\\\(")) {
            i += 2;
        }
        else if (doesEnter(res.substring(i))) {
            i += parseMath(res.substring(i), start + i, ranges);
        }
        else if (res.charAt(i) == "{") {
            level++;
        }
        else if (res.charAt(i) == "}") {
            if (level == 0 && delim != "") {
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

function find_ranges(res) {
    var ranges = [];
    parseNonMath(res, 0, ranges);
    var mathModes = [];
    for (var index = 0; index < ranges.length; index++) {
        mathModes.push(res.substring(ranges[index][0], ranges[index][1]));
    }
    return mathModes;
}

//var res = "This is a test $a$ and $b$";
//console.log(find_ranges(res));