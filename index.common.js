'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var rollup = require('rollup');
var watch = _interopDefault(require('rollup-watch'));
var switchy = _interopDefault(require('switchy'));
var chalk = _interopDefault(require('chalk'));
var fancyLog = _interopDefault(require('fancy-log'));
var merge = _interopDefault(require('lodash.merge'));
var buble = _interopDefault(require('rollup-plugin-buble'));
var resolve = _interopDefault(require('rollup-plugin-node-resolve'));
var commonjs = _interopDefault(require('rollup-plugin-commonjs'));
var replace = _interopDefault(require('rollup-plugin-replace'));
var strip = _interopDefault(require('rollup-plugin-strip'));
var rollupJson = _interopDefault(require('rollup-plugin-json'));
var uglify = _interopDefault(require('rollup-plugin-uglify'));
var postcss = _interopDefault(require('rollup-plugin-postcss'));
var postcssModules = _interopDefault(require('postcss-modules'));
var scssParser = _interopDefault(require('postcss-scss'));
var precss = _interopDefault(require('precss'));
var cssnano = _interopDefault(require('cssnano'));
var perfectionist = _interopDefault(require('perfectionist'));
var config = _interopDefault(require('./package.json'));

function log(type, msg, color) {
  if (!color) {
    fancyLog((type + " " + msg));
    return;
  }
  fancyLog(((color(type)) + " " + msg));
}

var cssExportMap = {};

var postcssPlugins = [
  precss,
  postcssModules({
    //generateScopedName: '[name]__[local]___[hash:base64:5]',
    getJSON: function getJSON(id, exportTokens) {
      cssExportMap[id] = exportTokens;
    }
  })
];

function build(options) {
  if ( options === void 0 ) options = {};

  if (process.env.NODE_ENV === 'production') {
    postcssPlugins.push(cssnano({
      sourceMap: true
    }));
  } else {
    postcssPlugins.push(perfectionist);
  }

  options = merge({
    entry: './src/index.js',
    exports: options.exports,
    dest: options.dest,
    moduleName: options.moduleName,
    useStrict: options.strict,
    format: options.format || 'iife',
    sourceMap: options.sourceMap,
    sourceMapFile: options.sourceMap,
    plugins: [
      postcss({
        parser: scssParser,
        plugins: postcssPlugins,
        combineStyleTags: false,
        extract: true,
        sourceMap: true,
        extensions: ['.css', '.sss', '.less', '.scss'],
        getExport: function getExport(id) {
          return cssExportMap[id];
        }
      }),
      rollupJson(),
      (process.env.NODE_ENV === 'production' && strip({
        debugger: true,
        functions: ['console.*', 'assert.*', 'debug', 'alert'],
        sourceMap: false
      })),
      resolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs({
        exclude: 'node_modules/process-es6/**',
        include: []
      }),
      buble({
        objectAssign: 'Object.assign',
        transforms: {
          arrow: true,
          modules: true,
          classes: true,
          dangerousForOf: true
        }
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }),
      (process.env.NODE_ENV === 'production' && uglify())
    ]
  }, config.rollup, options);

  return function () {
    if (options.watch) {
      delete options.watch;
      var init;
      return new Promise(function (resolve$$1) {
        var watcher = watch(rollup, options);
        watcher.on('event', function (event) {
          switchy({
            STARTING: function STARTING() {
              log(options.format, 'starting', chalk.white.bgBlue);
              if (!init) {
                init = true;
                return resolve$$1();
              }
            },
            BUILD_START: function BUILD_START() { },
            BUILD_END: function BUILD_END() {
              log(options.format, 'bundled successfully', chalk.black.bgGreen);
            },
            ERROR: function ERROR() {
              var error = event.error;
              log(options.format, '', chalk.white.bgRed);
              if (error.snippet) {
                console.error(chalk.red(("---\n" + (error.snippet) + "\n---")));
              }
              console.error(error.stack);
            },
            default: function default$1$$1() {
              console.error('unknown event', event);
            }
          })(event.code);
        });
      });
    }
    delete options.watch;
    return rollup.rollup(options).then(function (bundle) {
      return bundle.write(options);
    });
  };
}

build()();
