"use strict";
var assert = require('assert');
var mathFinder = require('../lib/mathmode.js');
var testcases = [
    {input: '', options: '', out: []},
    {
        input: 'This is a test',
        options: {},
        out: []
    },
    {
        input : '$a$ and $b$',
        options: {},
        out: ['a', 'b']
    }
];

describe('Index', function () {
    testcases.forEach(function (tc) {
        var input = tc.input;
        var options = tc.options;
        var output = tc.out;
        it('should correctly replace ' + JSON.stringify(input), function () {
            assert.deepEqual(mathFinder.findRanges(input), output);
        });
    });
});