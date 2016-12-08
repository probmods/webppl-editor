'use strict';

var _ = require('underscore');
var open = require('open');
var child_process = require('child_process');
var fs = require('fs');

module.exports = function(grunt) {
  grunt.initConfig({
    clean: ['docs/webppl-editor.*'],
    watch: {
      scripts: {
        files: ['src/component.css'],
        tasks: ['css']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['bundle']);

  grunt.registerTask('bundle', 'Create browser bundle (= browserify + css)', function() {
    var taskArgs = (arguments.length > 0) ? ':' + _.toArray(arguments).join(':') : '';
    grunt.task.run('css', 'browserify' + taskArgs);
  });

  grunt.registerTask('css', 'Concatenate css files', function() {
    var cssSource =
        fs.readFileSync('src/component.css','utf8') +
        fs.readFileSync('node_modules/codemirror/lib/codemirror.css','utf8');

    fs.writeFileSync('docs/webppl-editor.css', cssSource)
  })

  function browserifyArgs(args) {
    return ' -t [babelify --presets [react] ] src/index.js -o docs/webppl-editor.js';
  }

  grunt.registerTask('browserify', 'Generate "docs/webppl-editor.js".', function() {
    child_process.execSync('browserify' + browserifyArgs(arguments));
  });

  // TODO: integrate watch-js and watch-css (maybe using grunt-parallel?)
  grunt.registerTask('watch-js', 'Run the browserify task on fs changes.', function() {
    var done = this.async();
    var args = '-v' + browserifyArgs(arguments);
    var p = child_process.spawn('watchify', args.split(' '));
    p.stdout.on('data', grunt.log.writeln);
    p.stderr.on('data', grunt.log.writeln);
    p.on('close', done);
  });

  grunt.registerTask('watch-css', 'Run the css task on fs changes.', function() {
    grunt.task.run('watch')
  });

  grunt.registerTask('uglify', 'Generate "docs/webppl-editor.min.js".', function() {
    child_process.execSync('uglifyjs docs/webppl-editor.js -b ascii_only=true,beautify=false > docs/webppl-editor.min.js');
  });

};
