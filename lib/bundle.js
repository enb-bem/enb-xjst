var vowCode = require('./vow-code'),
    vow = require('vow'),
    promisify = require('vow-node').promisify,
    EOL = require('os').EOL;

/**
 * Wraps code of BEMHTML or BEMTREE to a bundle.
 *
 * The compiled bundle supports CommonJS and YModules. If there is no any modular system in the runtime,
 * the module will be provided as a global variable with name specified in `exportName` option.
 *
 * @param {String}   code                           Code compiled with the `bem-xjst` (BEMHTML or BEMTREE).
 * @param {Object}   options                        Options.
 * @param {String}   opts.dirname                   Path to a directory with compiled file.
 * @param {String}   [options.exportName=BEMHTML]   Name for exports.
 * @param {Boolean}  [options.includeVow=false]     Includes code of `vow` module, it is necessary to BEMTREE.
 * @param {Object}   [options.requires={}]          Names for dependencies.
 * @returns {String}
 */
exports.compile = function (code, options) {
    options || (options = {});

    var exportName = options.exportName || 'BEMHTML',
        requires = options.requires || {},
        libs = {
            commonJS: Object.keys(requires).reduce(function (prev, name) {
                var item = requires[name];
                if (item.commonJS) {
                    prev.push(name + ': require("' + item.commonJS + '")');
                } else if (item.globals) {
                    prev.push(name + ': global' + compileGlobalAccessor(item.globals));
                }
                return prev;
            }, []),
            yModules: Object.keys(requires).reduce(function (prev, name) {
                var item = requires[name];
                if (item.ym) {
                    prev.push(name + ': ' + name);
                } else if (item.commonJS) {
                    prev.push(name + ': require("' + item.commonJS + '")');
                } else if (item.globals) {
                    prev.push(name + ': global' + compileGlobalAccessor(item.globals));
                }
                return prev;
            }, []),
            globals: Object.keys(requires).reduce(function (prev, name) {
                var item = requires[name];
                if (item.globals) {
                    prev.push(name + ': global' + compileGlobalAccessor(item.globals));
                } else if (item.commonJS) {
                    prev.push(name + ': require("' + item.commonJS + '")');
                }
                return prev;
            }, [])
        };

    libs = Object.keys(libs).reduce(function (prev, item) {
        prev[item] = '{' + libs[item].join(',' + EOL) + '}';
        return prev;
    }, {});

    return compileCommonJSRequire(requires, options.dirname).then(function (commonJSRequire) {
        return [
            'var ' + exportName + ';',
            '(function(global) {',
            'var buildXjst = function(exports, __xjst_libs__){',
            options.includeVow ? vowCode : '',
            code,
            '    return exports["' + exportName + '"];',
            '};',
            commonJSRequire,
            // Export template start
            'var defineAsGlobal = true;',
            // Provide with CommonJS
            'if(typeof module === "object" && typeof module.exports === "object") {',
            '    exports["' + exportName + '"] = buildXjst({}, ' + libs.commonJS + ');',
            '    defineAsGlobal = false;',
            '}',
            // Provide to YModules
            'if(typeof modules === "object") {',
            compileYModule(exportName, requires, libs),
            '    defineAsGlobal = false;',
            '}',
            // Provide to global scope
            'if(defineAsGlobal) {',
            '    ' + exportName + ' = buildXjst({}, ' + libs.globals + ');',
            '    global["' + exportName + '"] = ' + exportName + ';',
            '}',
            // IIFE finish
            '})(this);'
        ].join(EOL);
    });
};

/**
 * Compiles code with YModule definition.
 *
 * @ignore
 * @param {String} name Module name.
 * @param {Object} [requires] Names for requires dependencies.
 * @param {String} [libs] Required dependencies string representation for YModule system.
 * @returns {String}
 */
function compileYModule(name, requires, libs) {
    var modules = [],
        deps = [];

    Object.keys(requires).forEach(function (name) {
        var item = requires[name];

        if (item.ym) {
            modules.push(item.ym);
            deps.push(name);
        }
    });

    return [
        '    modules.define("' + name + '"' + (modules ? ', ' + JSON.stringify(modules) : '') +
        ', function(provide' + (deps && deps.length ? ', ' + deps.join(', ') : '') + ') {',
        '        provide(buildXjst({}, ' + libs.yModules + '));',
        '    });'
    ].join(EOL);
}

/**
 * Compiles require with modules from CommonJS.
 *
 * @ignore
 * @param {Object}   [requires] Names for requires to `bh.lib.name`.
 * @param {String}   [dirname]  Path to a directory with compiled file.
 * @returns {String}
 */
function compileCommonJSRequire(requires, dirname) {
    var browserify = require('browserify'),
        browserifyOptions = {
            basedir: dirname
        },
        renderer = browserify(browserifyOptions),
        bundle = promisify(renderer.bundle.bind(renderer)),
        hasRequire = false;

    Object.keys(requires).forEach(function (name) {
        var item = requires[name];

        if (item.commonJS) {
            renderer.require(item.commonJS);
            hasRequire = true;
        }
    });

    if (!hasRequire) {
        return vow.resolve('');
    }

    return bundle()
        .then(function (buf) {
            return 'var ' + buf.toString('utf-8');
        });
}

/**
 * Compiles accessor path of the `global` object.
 *
 * @ignore
 * @param {String} value  Dot delimited accessor path
 * @returns {String}
 */
function compileGlobalAccessor(value) {
    return '["' + value.split('.').join('"]["') + '"]';
}
