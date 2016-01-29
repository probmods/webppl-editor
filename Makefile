all : compiled/editor.css compiled/editor.js

compiled/editor.css : src/component.css src/codemirror-5.10.0.css
	@cat src/component.css src/codemirror-5.10.0.css > compiled/editor.css

compiled/editor.js : src/index.js
	@browserify -t [ babelify --presets [ react ] ] "$<" > "$@"

watch :
	watchify -v -t [ babelify --presets [ react ] ] src/index.js -o compiled/editor.js

mirror :
	rsync --exclude=".git" --exclude="node_modules/" -rLvz . corn:~/WWW/wp-editor
