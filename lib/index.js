"use strict";

var json = require('../package.json');

module.exports = {
    name: json.name, // package name
    version: json.version // version # for this package
};

module.exports.texer = function (input, options) {
    try {
        return input;
    } catch (e) {
        return 'error something went wrong';
    }
};
