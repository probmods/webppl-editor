**Note: work in progress**

A browser-based code editor for WebPPL (requires version 0.6.1 or higher)

Usage:

```html
<html>
<head>
<meta charset="UTF-8"> <!-- tell the browser that editor.js contains unicode -->
<script src="webppl.js"></script> <!-- compiled webppl library; get this from https://github.com/probmods/webppl -->
<script src="editor.js"></script>
<link rel="stylesheet" href="editor.css">
</head>
<body>
...
</body>
<script>
// find all <pre> elements and set up the editor on them
var preEls = Array.prototype.slice.call(document.querySelectorAll("pre"));
preEls.map(function(el) { wpEditor.setup(el, {language: 'webppl'}); });
</script>
</html>
```

The library installs a single object, `wpEditor`, into the global namespace. `wpEditor` contains these methods:

- `setup`: a function for turning a DOM element into an editor
- `makeResultContainer`: a function used to insert custom objects into the results part of the editor

Compiling:

```sh
make all
```

Watchified compiling (incrementally rebuilds after source files have updated, only works for js, not css):

```sh
make watch
```
