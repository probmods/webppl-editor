A browser-based code editor for WebPPL (requires version 0.7.0-f24238e or higher)

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

`webppl-editor` installs these functions in the global namespace:

- `wpEditor.setup()`: converts a DOM element into an editor
- `wpEditor.makeResultContainer()`: used to insert custom output into the results section of the editor
- `wpEditor.put([key,] object)`: supports working across multiple code boxes. Stores an object (using an optional key) for use in other code boxes. If no key is specified, you'll get an automatically generated one.
- `wpEditor.get([key])`: retrieves the object with key `key`. When called with no key, returns the entire store.
- `wpEditor.MCMCProgress()`: displays a progress bar during MCMC inference (work in progress).
- `print` prints an object the results section (works both in WebPPL and vanilla Javascript).
- `resumeTrampoline`: resumes trampolining WebPPL code; used for external library functions that need to do asynchronous work.

We also ship the editor as `wpEditor.ReactComponent`.

Development:

```sh
grunt browserify        # makes webppl-editor.js
grunt css               # makes webppl-editor.css
grunt uglify            # makes webppl-editor.min.js
grunt bundle            # = uglify + css
grunt webppl            # makes bundle/webppl.js (for testing)
grunt browserify-watch  # reruns browserify when it detects file changes
```
