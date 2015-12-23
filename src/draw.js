function DrawObject(width, height, visible){

  this.canvasId = (new Date()).getTime() + "";

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
};

DrawObject.prototype.polygon = function(x, y, n, radius, stroke, fill){
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

DrawObject.prototype.redraw = function(){
  // unnecessary?
};

DrawObject.prototype.toArray = function(){
};

DrawObject.prototype.distanceF = function(f, cmpDrawObject){
};

DrawObject.prototype.distance = function(cmpDrawObject){
};

DrawObject.prototype.destroy = function(){
}

function Draw(s, k, a, width, height, visible){
  return k(s, new DrawObject(width, height, visible));
}

function loadImage(s, k, a, drawObject, url){
  // Synchronous loading - only continue with computation once image is loaded
  var context = drawObject.canvas.getContext('2d');
  var imageObj = new Image();
  imageObj.onload = function() {
    var raster = new drawObject.paper.Raster(imageObj);
    raster.position = drawObject.paper.view.center;
    drawObject.redraw();
    var trampoline = k(s);
    while (trampoline){
      trampoline = trampoline();
    }
  };
  imageObj.src = url;
  return false;
}
