var EOL = require('os').EOL,
    fs = require('fs'),
    mock = require('mock-fs'),
    dropRequireCache = require('enb/lib/fs/drop-require-cache'),
    MockNode = require('mock-enb/lib/mock-node'),
    Tech = require('../../../techs/bemhtml'),
    FileList = require('enb/lib/file-list'),
    files = {
        'i-bem.bemhtml': {
            path: require.resolve('bem-bl-xjst/i-bem__html.bemhtml'),
        }
    };

Object.keys(files).forEach(function (name) {
    var file = files[name];
    file.contents = fs.readFileSync(file.path, 'utf-8');
});

describe('bemhtml --node', function () {
    afterEach(function () {
        mock.restore();
    });

    it('must compile BEMHTML file', function () {
        var templates = ['block bla, tag: "a"'],
            bemjson = { block: 'bla' },
            html = '<a class="bla"></a>';

        return build(templates)
            .then(function (res) {
                res.BEMHTML.apply(bemjson).must.be(html);
            });
    });

    it('must build block with custom exportName', function () {
        var templates = ['block bla, tag: "a"'],
            bemjson = { block: 'bla' },
            html = '<a class="bla"></a>',
            options = { exportName: 'BH' };

        return build(templates, options)
            .then(function (res) {
                res.BH.apply(bemjson).must.be(html);
            });
    });

    describe('requires', function () {
        it('must get dependency from global scope', function () {
            var templates = [
                    [
                        'block block, content: {',
                        '    return this.require("text").text;',
                        '}'
                    ].join(EOL)
                ],
                bemjson = { block: 'block' },
                html = '<div class="block">Hello world!</div>',
                options = {
                    requires: {
                        text: {
                            globals: 'text'
                        }
                    }
                },
                lib = 'this.text = { text: "Hello world!" };';

            return build(templates, options, lib)
                .then(function (res) {
                    res.BEMHTML.apply(bemjson).must.equal(html);
                });
        });

        it('must get dependency from global scope using dot-delimited key', function () {
            var templates = [
                    [
                        'block block, content: {',
                        '    return this.require("text");',
                        '}'
                    ].join(EOL)
                ],
                bemjson = { block: 'block' },
                html = '<div class="block">Hello world!</div>',
                options = {
                    requires: {
                        text: {
                            globals: 'text.text'
                        }
                    }
                },
                lib = 'this.text = { text: "Hello world!" };';

            return build(templates, options, lib)
                .then(function (res) {
                    res.BEMHTML.apply(bemjson).must.equal(html);
                });
        });

        it('must require module from CommonJS', function () {
            var templates = [
                    [
                        'block block, content: {',
                        '    var fake = this.require("fake");',
                        '    return fake.getText();',
                        '}'
                    ].join(EOL)
                ],
                bemjson = { block: 'block' },
                html = '<div class="block">^_^</div>',
                options = {
                    requires: {
                        fake: {
                            commonJS: 'fake'
                        }
                    }
                };

            return build(templates, options)
                .then(function (res) {
                    res.BEMHTML.apply(bemjson).must.equal(html);
                });
        });
    });
});

function build(templates, options, lib) {
    options || (options = {});
    lib || (lib = '');

    var scheme = {
            blocks: {
                'base.bemhtml': files['i-bem.bemhtml'].contents
            },
            bundle: {},
            // jscs:disable
            node_modules: {
                browserify: {
                    'index.js': ''
                },
                fake: {
                    'index.js': 'module.exports = { getText: function () { return "^_^"; } };'
                },
                depend: {
                    'index.js': 'module.exports = "CommonJS";'
                }
            }
            // jscs:enable
        },
        bundle, fileList;

    templates && templates.forEach(function (item, i) {
        scheme.blocks['block-' + i + '.bemhtml'] = item;
    });

    mock(scheme);

    bundle = new MockNode('bundle');
    fileList = new FileList();
    fileList.loadFromDirSync('blocks');
    bundle.provideTechData('?.files', fileList);

    return bundle.runTech(Tech, options)
        .spread(function () {
            var filename = bundle.resolvePath(bundle.unmaskTargetName(options.target || '?.bemhtml.js')),
                contents = [
                    lib,
                    fs.readFileSync(filename, 'utf-8')
                ].join(EOL);

            fs.writeFileSync(filename, contents);
            dropRequireCache(require, filename);
            return require(filename);
        });
}
