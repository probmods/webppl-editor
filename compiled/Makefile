editor.js : ../src/index.js
	@browserify -t [ babelify --presets [ react ] ] "$<" > "$@"

watch :
	watchify -v -t [ babelify --presets [ react ] ] ../src/index.js -o editor.js

mirror :
	rsync -rLvz . corn:~/WWW/wp-editor
