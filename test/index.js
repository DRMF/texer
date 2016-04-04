"use strict";
var assert = require('assert');
var texer = require('../');
var testcases = [
    {input: '', options: '', out: ''},
    {
        input: 'This is a test',
        options: {},
        out: 'This is a test'
    }
];

describe('Index', function () {
    testcases.forEach(function (tc) {
        var input = tc.input;
        var options = tc.options;
        var output = tc.out;
        it('should correctly replace ' + JSON.stringify(input), function () {
            assert.deepEqual(texer.texer(input, options), output);
        });
    });
});