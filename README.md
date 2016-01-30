**Note: work in progress**

A Javascript library that provides an in-browser editor for WebPPL

Usage:

```html
<html>
<head>
<meta charset="UTF-8"> <!-- editor.js contains unicode, and we need to tell the browser this -->
<script src="webppl.js"></script> <!-- compiled webppl library; build from https://github.com/probmods/webppl -->
<script src="editor.js"></script>
<link rel="stylesheet" href="editor.css">
</head>
<body>
...
</body>
<script>
// find all <pre> elements and set up the editor on them
var preEls = Array.prototype.slice.call(document.querySelectorAll("pre"));
preEls.map(function(el) { wpCodeEditor(el, {language: 'webppl'}); });
</script>
</html>
```

Compiling:

```sh
make all
```

Watchified compiling (incrementally rebuilds after source files have updated, only works for js, not css):

```sh
make watch
```
