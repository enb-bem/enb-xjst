var fs = require('fs'),
    path = require('path'),
    vow = require('vow'),
    mock = require('mock-fs'),
    TestNode = require('enb/lib/test/mocks/test-node'),
    Tech = require('../../../techs/bemhtml'),
    FileList = require('enb/lib/file-list'),
    bemhtmlCoreFilename = require.resolve('bem-bl-xjst/i-bem__html.bemhtml');

describe('bemhtml', function () {
    afterEach(function () {
        mock.restore();
    });

    it('must compile BEMHTML file', function () {
        var templates = ['block bla, tag: "a"'],
            bemjson = { block: 'bla' },
            html = '<a class="bla"></a>';

        return assert(bemjson, html, templates);
    });

    describe('syntax error', function () {
        it('must throw if syntax error at end line', function () {
            var templates = ['block throw tag: "a"'];

            return build(templates)
                .fail(function (err) {
                    err.must.a(SyntaxError);
                    err.message.must.equal([
                        'space rule failed at ./blocks' + path.sep + 'block-0.bemhtml',
                        '    1| block throw tag: "a"',
                        '    ---------------^'
                    ].join('\n'));
                });
        });

        it('must throw if syntax error at midst line', function () {
            var templates = [
                [
                    'block bla, content: "bla!bla!"',
                    'block throw tag: "a"',
                    'block bla, tag: "p"'
                ].join('\n')
            ];

            return build(templates)
                .fail(function (err) {
                    err.must.a(SyntaxError);
                    err.message.must.equal([
                        'space rule failed at ./blocks' + path.sep + 'block-0.bemhtml',
                        '    1| block bla, content: "bla!bla!"',
                        '    2| block throw tag: "a"',
                        '    ---------------^',
                        '    3| block bla, tag: "p"'
                    ].join('\n'));
                });
        });

        it('must throw if syntax error in some template', function () {
            var templates = [
                'block bla, content: "bla!bla!"',
                'block throw tag: "a"'
            ];

            return build(templates)
                .fail(function (err) {
                    err.must.a(SyntaxError);
                    err.message.must.equal([
                        'space rule failed at ./blocks' + path.sep + 'block-1.bemhtml',
                        '    1| block throw tag: "a"',
                        '    ---------------^'
                    ].join('\n'));
                });
        });
    });

    describe('mode', function () {
        it('must build block in development mode', function () {
            var templates = ['block bla, tag: "a"'],
                bemjson = { block: 'bla' },
                html = '<a class="bla"></a>',
                options = { devMode: true };

            return assert(bemjson, html, templates, options);
        });

        it('must build block in production mode', function () {
            var templates = ['block bla, tag: "a"'],
                bemjson = { block: 'bla' },
                html = '<a class="bla"></a>',
                options = { devMode: false };

            return assert(bemjson, html, templates, options);
        });

        it('must build different code by mode', function () {
            var scheme = {
                    blocks: {
                        'base.bemhtml': fs.readFileSync(bemhtmlCoreFilename, 'utf-8'),
                        'bla.bemhtml': 'block bla, tag: "a"'
                    },
                    bundle: {}
                },
                bundle, fileList;

            mock(scheme);

            bundle = new TestNode('bundle');
            fileList = new FileList();
            fileList.loadFromDirSync('blocks');
            bundle.provideTechData('?.files', fileList);

            return vow.all([
                bundle.runTechAndGetContent(
                    Tech, { target: 'dev.bemhtml.js', devMode: true }
                ),
                bundle.runTechAndGetContent(
                    Tech, { target: 'prod.bemhtml.js', devMode: false }
                )
            ]).spread(function (dev, prod) {
                var devSource = dev.toString(),
                    prodSource = prod.toString();

                devSource.must.not.be.equal(prodSource);
            });
        });
    });

    it('must build block with custom exportName', function () {
        var scheme = {
                blocks: {
                    'base.bemhtml': fs.readFileSync(bemhtmlCoreFilename, 'utf-8'),
                    'bla.bemhtml': 'block bla, tag: "a"'
                },
                bundle: {}
            },
            bundle, fileList;

        mock(scheme);

        bundle = new TestNode('bundle');
        fileList = new FileList();
        fileList.loadFromDirSync('blocks');
        bundle.provideTechData('?.files', fileList);

        return bundle.runTechAndRequire(Tech, { exportName: 'BH' })
            .spread(function (bemhtml) {
                bemhtml.BH.apply({ block: 'bla' }).must.be('<a class="bla"></a>');
            });
    });
});

function build(templates, options) {
    var scheme = {
            blocks: {
                'base.bemhtml': fs.readFileSync(bemhtmlCoreFilename, 'utf-8')
            },
            bundle: {}
        },
        bundle, fileList;

    templates && templates.forEach(function (item, i) {
        scheme.blocks['block-' + i + '.bemhtml'] = item;
    });

    mock(scheme);

    bundle = new TestNode('bundle');
    fileList = new FileList();
    fileList.loadFromDirSync('blocks');
    bundle.provideTechData('?.files', fileList);

    return bundle.runTechAndRequire(Tech, options)
        .spread(function (bemhtml) {
            return bemhtml.BEMHTML;
        });
}

function assert(bemjson, html, templates, options) {
    return build(templates, options)
        .then(function (BEMHTML) {
            BEMHTML.apply(bemjson).must.be(html);
        });
}
