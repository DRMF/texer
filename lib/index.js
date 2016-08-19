"use strict";

var json = require('../package.json');
var fs = require("fs");

module.exports = {
    name: json.name, // package name
    version: json.version // version # for this package
};

module.exports.initialize = function() {
    module.exports.tu = require("./texutil");
    var Parser = module.exports.Parser = require('./parser');
    module.exports.render = require('./render');

    module.exports.ast = require('./ast');
    module.exports.astutil = require('./astutil');
    module.exports.parse = Parser.parse.bind(Parser);
    module.exports.SyntaxError = Parser.SyntaxError;
};

module.exports.rebuild = function(styFile, commandDefinitions) {
    require("./build-parser")(styFile, commandDefinitions);
}

module.exports.reset = function() {
    ["ast.js", "astutil.js", "parser.js", "parser.pegjs", "render.js"].forEach(
        function(file) {
            try {
                fs.unlinkSync("./" + file);
                delete require.cache[require.resolve("./" + file.substring(0, file.indexOf(".js")))];
            }
            catch (e) {}
        }
    );
};

// for only math mode input
module.exports.makeReplacements = function(input, options) {
    // allow user to pass a parsed AST as input, as well as a string
    if (typeof(input) === 'string') {
        input = module.exports.parse(input, {usemathrm:options.usemathrm, semanticlatex:options.semanticlatex});
    }
    var result = module.exports.render(input);
    ['ams', 'cancel', 'color', 'euro', 'teubner', 'mhchem'].forEach(function(pkg) {
        pkg = pkg + '_required';
        result[pkg] = module.exports.astutil.contains_func(input, module.exports.tu[pkg]);
    });
    return result;
};

// will be for all latex; separated from makeReplacements for testing purposes
module.exports.texer = function(input, options) {
    try {
        if (typeof options === "undefined") {
            options = {};
            options.usemathrm = false;
            options.usemhchem = false;
            options.semanticlatex = false;
        }
        var result = {
            status: "+", output: module.exports.makeReplacements(input, options)
        };
        if (!options.usemhchem){
            if (result.mhchem_required){
                return {
                    status: 'C', details: "mhchem package is required"
                };
            }
        }
        return result;
    }
    catch (e) {
//        console.log(e);
        if (options && options.debug) {
            throw e;
        }
        if (e instanceof module.exports.SyntaxError) {
            if (e.message === 'Illegal TeX function') {
                return {
                    status: 'F', details: e.found,
                    offset: e.offset, line: e.line, column: e.column
                };
            }
            return {
                status: 'S', details: e.toString(),
                offset: e.offset, line: e.line, column: e.column
            };
        }
        return { status: '-', details: e.toString() };
    }
}