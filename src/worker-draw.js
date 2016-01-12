var numCanvases = 0;

function DrawObject(width, height, visible){
  // (new Date()).getTime() had uniqueness problems (weird) so use a manual counter for now
  this.canvasId = (new Date()).getTime() + "_" + numCanvases;

  numCanvases += 1;

  postMessage({type: 'draw',
               command: 'init',
               width: width,
               height: height,
               visible: visible,
               canvasId: this.canvasId})

  this.width = width;
  this.height = height;
}

DrawObject.prototype.circle = function(x, y, radius, stroke, fill){
  postMessage({type: 'draw',
               command: 'circle',
               canvasId: this.canvasId,
               x: x,
               y: y,
               radius: radius,
               stroke: stroke,
               fill: fill
              })
};

DrawObject.prototype.polygon = function(x, y, n, radius, stroke, fill){
  postMessage({type: 'draw',
               command: 'polygon',
               canvasId: this.canvasId,
               x: x,
               y: y,
               n: n,
               radius: radius,
               stroke: stroke,
               fill: fill
              })
};

DrawObject.prototype.line = function(x1, y1, x2, y2, strokeWidth, opacity, color){
  postMessage({type: 'draw',
               command: 'line',
               canvasId: this.canvasId,
               x1: x1,
               y1: y1,
               x2: x2,
               y2: y2,
               strokeWidth: strokeWidth,
               opacity: opacity,
               color: color
              })
};

DrawObject.prototype.destroy = function(){
  postMessage({type: 'draw',
               command: 'destroy',
               canvasId: this.canvasId
              })
};

// NB: had to rewrite this as non-prototype method. otherwise, it was impossible to
// get the return value from the main thread
var distance = function(s, k, a, thisDrawObject, thatDrawObject){
  // TODO: a better event handler registration system than this
  self._onmessage = self.onmessage;
  self.onmessage = function(e) {
    // restore message handler
    self.onmessage = self._onmessage;
    var result = e.data.distance;

    var trampoline = k(s, result);

    while (trampoline) {
      trampoline = trampoline();
    }

  }
  postMessage({type: 'draw',
               command: 'distance',
               canvasId: thisDrawObject.canvasId,
               compareCanvasId: thatDrawObject.canvasId
              })
};

function Draw(s, k, a, width, height, visible){
  return k(s, new DrawObject(width, height, visible));
}

function loadImage(s, k, a, drawObject, url){
  self._onmessage = self.onmessage;
  self.onmessage = function(e) {
    // restore message handler
    self.onmessage = self._onmessage;

    var trampoline = k(s);

    while (trampoline) {
      trampoline = trampoline();
    }

  }

  postMessage({type: 'draw',
               command: 'loadImage',
               canvasId: drawObject.canvasId,
               url: url})

}
