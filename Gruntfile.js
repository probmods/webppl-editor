'use strict';

var _ = require('underscore');
var open = require('open');
var child_process = require('child_process');

var jslintSettings = {
  options: {
    flags: ['--flagfile .gjslintrc'],
    reporter: {
      name: 'console'
    },
    force: false
  },
  lib: {
    src: [
      'Gruntfile.js',
      'src/*.js',
    ]
  }
};
module.exports = function(grunt) {
  grunt.initConfig({
    subgrunt: {
      // TODO: after browserifying webppl, move to demo folder
      webppl: {
        'node_modules/webppl': 'browserify'
      }
    },
    nodeunit: {
      all: ['tests/test-*.js']
    },
    jshint: {
      files: [
        'Gruntfile.js',
        'src/*.js'
      ],
      options: {
        maxerr: 500,
        camelcase: true,
        nonew: true,
        curly: true,
        noarg: true,
        trailing: true,
        forin: true,
        noempty: true,
        node: true,
        eqeqeq: true,
        strict: false,
        evil: true,
        undef: true,
        bitwise: true,
        browser: true,
        gcl: true,
        newcap: false
      }
    },
    gjslint: jslintSettings,
    fixjsstyle: jslintSettings,
    clean: ['bundle/*.js'],
    watch: {
      ad: {
        files: ['src/*.js'],
        tasks: ['build']
      }
    }
  });

  function browserifyArgs(args) {
    // var pkgArg = '';
    // var requires = _.chain(_.toArray(args))
    //     .map(function(name) { return ['--require', name]; })
    //     .flatten().value();
    // pkgArg = ' -t [' + ['./src/bundle.js'].concat(requires).join(' ') + ']';
    return ' -t [babelify --presets [react] ] src/index.js -o bundle/webppl-editor.js';
  }

  grunt.loadNpmTasks('grunt-subgrunt');
  grunt.loadNpmTasks('grunt-gjslint');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['gjslint', 'nodeunit']);
  grunt.registerTask('test', ['nodeunit']);
  grunt.registerTask('lint', ['gjslint']);
  grunt.registerTask('hint', ['jshint']);
  grunt.registerTask('fixstyle', ['fixjsstyle']);

  grunt.registerTask('bundle', 'Create browser bundle (= browserify + uglify)', function() {
    var taskArgs = (arguments.length > 0) ? ':' + _.toArray(arguments).join(':') : '';
    grunt.task.run('browserify' + taskArgs, 'uglify');
  });

  grunt.registerTask('browserify', 'Generate "bundle/webppl-editor.js".', function() {
    child_process.execSync('mkdir -p bundle');
    child_process.execSync('browserify' + browserifyArgs(arguments));
  });

  grunt.registerTask('browserify-watch', 'Run the browserify task on fs changes.', function() {
    var done = this.async();
    child_process.execSync('mkdir -p bundle');
    var args = '-v' + browserifyArgs(arguments);
    var p = child_process.spawn('watchify', args.split(' '));
    p.stdout.on('data', grunt.log.writeln);
    p.stderr.on('data', grunt.log.writeln);
    p.on('close', done);
  });

  grunt.registerTask('uglify', 'Generate "bundle/webppl-editor.min.js".', function() {
    child_process.execSync('mkdir -p bundle');
    child_process.execSync('uglifyjs bundle/webppl-editor.js -b ascii_only=true,beautify=false > bundle/webppl-editor.min.js');
  });

};
