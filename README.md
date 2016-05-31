A browser-based code editor for WebPPL (requires version 0.6.2 or higher)

Demo: https://probmods.github.io/webppl-editor

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
- `put([key,] object)`: used for working across multiple code boxes. Stores an object (using an optional key) for use in other code boxes. If no key is specified, you'll get an automatically generated one.
- `get([key])`: retrieves the object with key `key`. When called with no key, returns the entire store.
- `MCMCProgress()`: displays a progress bar during MCMC inference (work in progress).

The library also provides a function `resumeTrampoline` for external library functions that need to do asynchronous work.

Development:

```sh
grunt browserify        # makes webppl-editor.js
grunt css               # makes webppl-editor.css
grunt uglify            # makes webppl-editor.min.js
grunt bundle            # = uglify + css
grunt webppl            # makes bundle/webppl.js (for testing)
grunt browserify-watch  # reruns browserify when it detects file changes
```
