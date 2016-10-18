'use strict';

var _ = require('underscore');
var open = require('open');
var child_process = require('child_process');
var fs = require('fs');

module.exports = function(grunt) {
  grunt.initConfig({
    subgrunt: {
      webppl: {
        'node_modules/webppl': 'browserify'
      }
    },
    clean: ['docs/webppl-editor.js', 'docs/webppl-editor.css'],
    watch: {
      ad: {
        files: ['src/*.js'],
        tasks: ['build']
      }
    }
  });

  function browserifyArgs(args) {
    return ' -t [babelify --presets [react] ] src/index.js -o docs/webppl-editor.js';
  }

  grunt.loadNpmTasks('grunt-subgrunt');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['browserify']);


  grunt.registerTask('bundle', 'Create browser bundle (= css + browserify + uglify)', function() {
    var taskArgs = (arguments.length > 0) ? ':' + _.toArray(arguments).join(':') : '';
    grunt.task.run('browserify' + taskArgs, 'uglify','css');
  });

  grunt.registerTask('css', 'Concatenate css files', function() {
    var cssSource =
        fs.readFileSync('src/component.css','utf8') +
        fs.readFileSync('node_modules/codemirror/lib/codemirror.css','utf8');

    fs.writeFileSync('docs/webppl-editor.css', cssSource)
  })

  grunt.registerTask('copy-webppl','Copy webppl bundle into bundle/', function() {
    child_process.execSync('cp node_modules/webppl/bundle/webppl.js bundle/');
  })

  grunt.registerTask('webppl', 'Make webppl bundle', function() {
    grunt.task.run('subgrunt:webppl')
    grunt.task.run('copy-webppl')
  });

  grunt.registerTask('browserify', 'Generate "docs/webppl-editor.js".', function() {
    child_process.execSync('browserify' + browserifyArgs(arguments));
  });

  grunt.registerTask('browserify-watch', 'Run the browserify task on fs changes.', function() {
    var done = this.async();
    var args = '-v' + browserifyArgs(arguments);
    var p = child_process.spawn('watchify', args.split(' '));
    p.stdout.on('data', grunt.log.writeln);
    p.stderr.on('data', grunt.log.writeln);
    p.on('close', done);
  });

  grunt.registerTask('uglify', 'Generate "bundle/webppl-editor.min.js".', function() {
    child_process.execSync('mkdir -p bundle');
    child_process.execSync('uglifyjs docs/webppl-editor.js -b ascii_only=true,beautify=false > docs/webppl-editor.min.js');
  });

};
