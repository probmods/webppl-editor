compiled/editor.js : src/index.js
	@browserify -t [ babelify --presets [ react ] ] "$<" > "$@"

watch :
	watchify -v -t [ babelify --presets [ react ] ] src/index.js -o compiled/editor.js

mirror :
	rsync --exclude=".git" --exclude="node_modules/" -rLvz . corn20:~/WWW/wp-editor
