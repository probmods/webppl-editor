compiled/editor.js : src/index.js
	@browserify -t [ babelify --presets [ react ] ] "$<" > "$@"

watch :
	watchify -v -t [ babelify --presets [ react ] ] src/index.js -o compiled/editor.js

mirror :
	rsync -rLvz compiled corn:~/WWW/wp-editor
