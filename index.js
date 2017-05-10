import * as rollup from 'rollup';
import watch from 'rollup-watch';
import switchy from 'switchy';
import chalk from 'chalk';
import fancyLog from 'fancy-log';
import merge from 'lodash.merge';

import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import strip from 'rollup-plugin-strip';
import rollupJson from 'rollup-plugin-json';
import uglify from 'rollup-plugin-uglify';

import postcss from 'rollup-plugin-postcss';
import postcssModules from 'postcss-modules';
import scssParser from 'postcss-scss';
import precss from 'precss';
import cssnano from 'cssnano';
import perfectionist from 'perfectionist';

import config from './package.json';

function log(type, msg, color) {
  if (!color) {
    fancyLog(`${type} ${msg}`);
    return;
  }
  fancyLog(`${color(type)} ${msg}`);
}

const cssExportMap = {};

const postcssPlugins = [
  precss,
  postcssModules({
    //generateScopedName: '[name]__[local]___[hash:base64:5]',
    getJSON(id, exportTokens) {
      cssExportMap[id] = exportTokens;
    }
  })
];

function build(options = {}) {
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
        getExport(id) {
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

  return () => {
    if (options.watch) {
      delete options.watch;
      let init;
      return new Promise(resolve => {
        const watcher = watch(rollup, options);
        watcher.on('event', event => {
          switchy({
            STARTING() {
              log(options.format, 'starting', chalk.white.bgBlue);
              if (!init) {
                init = true;
                return resolve();
              }
            },
            BUILD_START() { },
            BUILD_END() {
              log(options.format, 'bundled successfully', chalk.black.bgGreen);
            },
            ERROR() {
              const error = event.error;
              log(options.format, '', chalk.white.bgRed);
              if (error.snippet) {
                console.error(chalk.red(`---\n${error.snippet}\n---`));
              }
              console.error(error.stack);
            },
            default() {
              console.error('unknown event', event);
            }
          })(event.code);
        });
      });
    }
    delete options.watch;
    return rollup.rollup(options).then(bundle => {
      return bundle.write(options);
    });
  };
}

build()();
