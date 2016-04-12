"use strict";
var assert = require('assert');
var mathFinder = require('../mathmode.js');
var testcases = [
    {input: '', options: '', out: ''},
    {
        input: 'This is a test',
        options: {},
        out: 'This is a test'
    }
    {
        input : '$a$ and $b$';
        options: {};
        out: ['a', 'b']
    }
];

describe('Index', function () {
    testcases.forEach(function (tc) {
        var input = tc.input;
        var options = tc.options;
        var output = tc.out;
        it('should correctly replace ' + JSON.stringify(input), function () {
            assert.deepEqual(mathmode.findRanges(input), output);
        });
    });
});