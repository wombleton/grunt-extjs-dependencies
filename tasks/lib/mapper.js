
'use strict';

exports.init = function (grunt, opts, cb) {
    var options,
        
        array = require('array-extended'),
        path = require('path'),
        Promise = require('promise'),
        // minimatcher = require('./minimatcher'),
        tmp = require('tmp'),
        tmpdirp = Promise.denodeify(tmp.dir),

        parser,
        graph = require('./graph').init(grunt),

        fileCounter = 0,

        exports = {},

        initPromise;

    tmp.setGracefulCleanup();

    function readOptions(opts) {
        var options = opts || {},
            rootDir = options.rootDir || process.cwd();
            
        return {
            includeFilePattern: options.includeFilePattern || /\.js$/,
            excludeFiles: options.excludeFiles,

            skipParse: options.skipParse,

            rootDir: rootDir,
            
            excludeClasses: options.excludeClasses || ['Ext.*'],

            tempDir: (options.tempDir ? path.resolve(process.cwd(), options.tempDir) : null)
        };
    }
    
    function readDir(dirPath, parse) {
        grunt.file.recurse(dirPath, function (abspath) {
            if ( shouldProcessFile(abspath) ) {
                readFile(abspath, parse);
            }
        });
    }

    function readFile(filePath, parse) {
        var outputPath = getOutputPath(filePath),
            data, node;
        
        if (parse) {
            data = grunt.file.read(filePath, { encoding: 'utf-8' });
            if (data && (node = parser.parse(data, outputPath))) {
                graph.addNode(node);
                grunt.file.write(outputPath, node.src, { encoding: 'utf-8' });
            }
        } else {
            graph.addNode(parser.getClass(outputPath));
            grunt.file.copy(filePath, outputPath, { encoding: 'utf-8' });
        }
        fileCounter++;
    }

    function getOutputPath(filePath) {
        return path.join(options.tempDir, path.relative(options.rootDir, filePath));
    }

    function shouldProcessFile(filePath) {
        var p = true;
        if (options.includeFilePattern) {
            p = options.includeFilePattern.test(filePath);
        //     if (p && options.excludeFiles) {
        //         p = !minimatcher(filePath, options.excludeFiles);
        //     }
        // } else if (options.excludeFiles) {
        //     p = !minimatcher(filePath, options.excludeFiles);
        }
        return p;
    }

    exports.addDir = function (dirs, parse) {
        if (!Array.isArray(dirs)) {
            dirs = [{ path: dirs, parse: parse !== false }];
        }

        dirs.forEach(function (dir) {
            var dirPath, parse;
            
            if (typeof dir === 'string') {
                dirPath = dir.charAt(0) === '/' ? dir : path.join(options.rootDir, dir);
                parse = true;
            } else {
                dirPath = dir.path.charAt(0) === '/' ? dir.path : path.join(options.rootDir, dir.path);
                parse = dir.parse !== false;
            }
            
            grunt.verbose.writeln('Adding dir ' + dirPath);
            
            readDir(dirPath, parse);
        });

        return fileCounter;
    };

    exports.resolveDependencies = function () {
        var required = graph.getDependencies.apply(graph, arguments);
        return {
            required: required,
            diff: array.difference(graph.getAllNodePaths(), required)
        };
    };

    options = readOptions(opts);
    parser = require('./parser.js').init(grunt, options);

    grunt.verbose.write('Create temp folder... ');
    
    if (!options.tempDir) {
        initPromise = tmpdirp({
            mode: '0777',
            prefix: 'extjs_dependencies_',
            unsafeCleanup: true
        }).then(function (path) {
            grunt.verbose.ok('Done, ' + path);
            options.tempDir = path;
            return exports;
        }, function (reason) {
            grunt.fail.warn(reason);
        });
    } else {
        initPromise = new Promise(function (done, fail) {
            try {
                grunt.file.mkdir(options.tempDir);
                grunt.verbose.ok('Done, ' + options.tempDir);
                done(exports);
            } catch (e) {
                fail(e);
                grunt.fail.warn(e);
            }
        });
    }


    if (typeof cb === 'function') {
        initPromise.then(cb);
    }

    return initPromise;
};
