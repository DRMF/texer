"use strict";
var assert = require('assert');
var mathFinder = require('../lib/mathmode.js');
var testCases = [
    {input: '', options: {}, out: []},
    {
        input: 'This is a test',
        options: {},
        out: []
    },
    {
        input: '$a$ and $b$',
        options: {},
        out: ['a', 'b']
    },
    {
        input: '$c\\hbox{and $d$}$',
        options: {},
        out: ['c', 'd']
    },
    {
        input: '\\$Not this\\$ \\\\[or this\\\\] \\\\(or even this\\\\) $This$',
        options: {},
        out: ['This']
    },
    {
        input: '$math mode\\hbox{not math {still not math}}$',
        options: {},
        out: ['math mode']
    }
];

describe('Index', function () {
    testCases.forEach(function (tc) {
        var input = tc.input;
        var options = tc.options;
        var output = tc.out;
        it('should correctly replace ' + JSON.stringify(input), function () {
            assert.deepEqual(mathFinder.findMathSections(input), output);
        });
    });
});