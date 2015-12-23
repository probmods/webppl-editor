'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var Paper = require('paper');

var CodeMirrorComponent = require('react-codemirror');

// get access to the private CM function inside react-codemirror
// this works because node require calls are cached
var CM = require('react-codemirror/node_modules/codemirror');

// global.CodeMirror = require('codemirror');

var $ = require('jquery');

global.d3 = require('d3'); // debugging
//var vl = require('vega-lite');
var vg = require('vega');

// NB: redundant with worker.js
var serializeReturnValue = function(x) {
  if (x && (x.score != undefined) && (x.sample != undefined))
    return '<erp>';

  if (typeof x == 'function')
    return '<function ' + x.name + '>';

  if (typeof x == 'string') {
    return x;
  }

  return x;
};


var _ = require('underscore');
global._ = _; // debugging

var work = require('webworkify');

var jobsQueue = [];

require('react-codemirror/node_modules/codemirror/addon/edit/matchbrackets')
require('react-codemirror/node_modules/codemirror/mode/javascript/javascript');
// installs toggleComment
require('react-codemirror/node_modules/codemirror/addon/comment/comment');


// NB: require('codemirror/mode/javascript/javascript') doesn't work
// might be able to avoid reaching into react-codemirror's copy of codemirror
// by doing some browserify tricks with -x or -r or factor-bundle (TODO: investigate)

var ResultError = React.createClass({
  render: function() {
    return (
        <pre key={this.props.key} className='error'>{this.props.message}</pre>
    );
  }
});

var ResultText = React.createClass({
  render: function() {
    return (
        <pre key={this.props.key} className='text'>{this.props.message}</pre>
    );
  }
});

var ResultBarChart = React.createClass({
  render: function() {
    // var samples = this.props.samples;
    // var frequencyDict = _(samples).countBy(function(x) { return typeof x === 'string' ? x : JSON.stringify(x) });
    // var labels = _(frequencyDict).keys();
    // var counts = _(frequencyDict).values();

    var ivs = this.props.ivs;
    var dvs = this.props.dvs;

    var frequencyDf = _.zip(ivs,dvs).map(function(a) {
      return {iv: a[0], dv: a[1]}
    });

    // var vlspec = {
    //   data: {values: frequencyDf},
    //   marktype: "bar",
    //   encoding: {
    //     x: {type: "O", name: "label"},
    //     y: {type: "Q", name: "count"}
    //   }
    // };

    // var vgspec = vl.compile(vlspec);

    // TODO: why did the hovering stuff stop working all of a sudden?
    // i can't even get it working on test-vega.html
    var vgspec = {
      "width": 400,
      "height": ivs.length * 30,
      // "padding": {"top": 10, "left": 30, "bottom": 20, "right": 30},

      "data": [
        {
          "name": "table",
          "values": frequencyDf
        }
      ],

      "signals": [
        {
          "name": "tooltip",
          "init": {},
          "streams": [
            {"type": "rect:mouseover", "expr": "datum"},
            {"type": "rect:mouseout", "expr": "{}"}
          ]
        }
      ],

      "predicates": [
        {
          "name": "tooltip", "type": "==",
          "operands": [{"signal": "tooltip._id"}, {"arg": "id"}]
        }
      ],

      "scales": [
        { "name": "yscale", "type": "ordinal", "range": "height",
          "domain": {"data": "table", "field": "iv"} },
        { "name": "xscale", "range": "width", "nice": true,
          "domain": {"data": "table", "field": "dv"} }
      ],

      "axes": [
        { "type": "x", "scale": "xscale" },
        { "type": "y", "scale": "yscale" }
      ],

      marks: [
        {
          "type": "rect",
          "from": {"data":"table"},
          "properties": {
            "enter": {
              "x": {"scale": "xscale", value: 0},
              x2: {scale: 'xscale', field: 'dv'},
              "y": {"scale": "yscale", "field": "iv"},
              "height": {"scale": "yscale", "band": true, "offset": -1}
            },
            "update": { "fill": {"value": "steelblue"} },
            "hover": { "fill": {"value": "red"} }
          }
        },

        {
          "type": "text",
          "properties": {
            "enter": {
              "align": {"value": "center"},
              "fill": {"value": "#333"}
            },
            "update": {
              "x": {"scale": "xscale", "signal": "tooltip.dv", "offset": 10},
              "y": {"scale": "yscale", "signal": "tooltip.iv", "offset": 3},
              "dy": {"scale": "yscale", "band": true, "mult": 0.5},
              "text": {"signal": "tooltip.count"},
              "fillOpacity": {
                "rule": [
                  {
                    "predicate": {"name": "tooltip", "id": {"value": null}},
                    "value": 0
                  },
                  {"value": 1}
                ]
              }
            }
          }
        }

      ]
    };

    var visEl = (
        <div>
        </div>
    );

    var me = this;

    vg.parse.spec(vgspec, function(error,chart) {
      var view = chart({renderer: 'svg'}).update();
      var $img = $("<img>").attr({src:'data:image/svg+xml;utf8,' +
                                  view.svg()})
      $(ReactDOM.findDOMNode(me)).append($img);
    });

    return visEl;

  }
});

var PaperComponent = React.createClass({
  newPoint: function(x,y) {
    return new this.paper.Point(x, y);
  },
  newPath: function(strokeWidth, opacity, color){
    var path = new this.paper.Path();
    path.strokeColor = color || 'black';
    path.strokeWidth = strokeWidth || 8;
    path.opacity = opacity || 0.6;
    return path;
  },
  line: function(x1, y1, x2, y2, strokeWidth, opacity, color) {
    var path = this.newPath(strokeWidth, opacity, color);
    path.moveTo(x1, y1);
    path.lineTo(this.newPoint(x2, y2));
    this.paper.view.draw();
  },
  componentDidMount: function() {
    var paper = new Paper.PaperScope();
    paper.setup(ReactDOM.findDOMNode(this));
    paper.view.viewSize = new paper.Size(this.props.width,this.props.height);
    paper.view.draw();
    this.paper = paper;
  },
  render: function() {
    return (<canvas ref={this.props.canvasId} className="paper" width={this.props.width} height={this.props.height} />)
  }
});

var Result = React.createClass({
  render: function() {
    var piecesKeyed = this.props.pieces.map(function(x,i) { return (<div key={i}>{x}</div>) });
    return (
      <div className={this.props.newborn ? 'result hide' : 'result'}>
        {piecesKeyed}
      </div>);
  }
});

var wait = function(ms,f) {
  return setTimeout(f,ms);
}

// use just a single worker for now since running a lot of
// workers would be a huge resource hog
var worker = work(require('./worker.js'));

var RunButton = React.createClass({
  getLabel: function() {
    var labels = {
      idle: "run",
      queued: 'queued...'
    };
    return _.has(labels, this.props.status) ? labels[this.props.status] : this.props.status;
  },
  render: function() {
    return (
        <button className='run' type="button" onClick={this.props.clickHandler} disabled={!(this.props.status == 'idle')}>{this.getLabel()}</button>
    )
  }
});

var paperComponents = {};

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code,
      pieces: [],
      newborn: true,
      execution: "idle"
    }
  },
  runCode: function() {

    global.localStorage.setItem('code',this.state.code);

    this.setState({newborn: false});
    var comp = this;
    var code = this.state.code;
    var language = this.props.language;

    var drawObjects = {};

    var job = function() {
      comp.setState({execution: 'init'});

      var endJob = function() {
        comp.setState({execution: 'idle'})

        // remove completed job
        jobsQueue.shift();

        // if there are remaining jobs, start on the next one
        if (jobsQueue.length > 0) {
          jobsQueue[0]()
        }
      }

      worker.onerror = function(err) {
        comp.addResult(<ResultError message={err.message} />)
        endJob();
      }

      worker.onmessage = function(m) {
        var d = m.data;

        if (d.type == 'status')
          comp.setState({execution: d.status})

        if (d.type == 'text')
          comp.addResult(<ResultText message={d.obj} />)

        if (d.type == 'barChart')
          comp.addResult(<ResultBarChart ivs={d.ivs} dvs={d.dvs} />)

        // TODO: enable custom handlers to be defined elsewhere?
        if (d.type == 'draw') {
          // PaperComponent attempt
          if (d.command == 'init') {
            var paperComponent = (<PaperComponent width={d.width} height={d.height} visible={d.visible} canvasId={d.canvasId} />)

            paperComponents[d.canvasId] = paperComponent;
            comp.addResult(paperComponent)
          }
          if (d.command == 'line') {
            // ------- TODO: this doesn't work
            // paperComponent is a ReactElement, not a component?
            var paperComponent = comp.refs[d.canvasId];
            debugger;
            paperComponent.line(d.x1,d.y1,d.x2,d.y2,d.strokeWidth,d.opacity,d.color);
          }


          // if (d.command == 'init') {

          //   var drawObject = new DrawObject(d.width, d.height, d.visible);

          //   if (d.visible) {
          //     $(ReactDOM.findDOMNode(comp)).find(".result").append(drawObject.canvas);
          //   }

          //   drawObjects[d.canvasId] = drawObject;
          // }

          // if (d.command == 'line') {
          //   var drawObject = drawObjects[d.canvasId];

          //   drawObject.line(d.x1, d.y1, d.x2, d.y2, d.strokeWidth, d.opacity, d.color);
          // }

        }

        if (d.done) {
          endJob();
        }
      }

      comp.setState({pieces: []});
      worker.postMessage({language: language,
                          code: code});
    };

    jobsQueue.push(job);
    this.setState({execution: 'queued'});

    if (jobsQueue.length == 1) {
      job()
    }

  },
  updateCode: function(newCode) {
    this.setState({
      code: newCode
    })
  },
  addResult: function(result) {
    this.setState(function(state, props) {
      return {pieces: state.pieces.concat(result)}
    });
  },
  render: function() {
    var myRangeFinder = require('./folding').myRangeFinder;

    var options = {
      mode: 'javascript',
      lineNumbers: false,
      matchBrackets: true,
      viewportMargin: Infinity,
      extraKeys: {
        "Cmd-/": "toggleComment",
        "Cmd-.": function(cm){cm.foldCode(cm.getCursor(), myRangeFinder); }

      }
    };

    // TODO: get rid of Result ref
    // TODO: get rid of CodeMirrorComponent ref by running refresh in it's own componentDidMount?
    return (
      <div ref="cont">
          <CodeMirrorComponent ref="editor" value={this.state.code} onChange={this.updateCode} options={options} />
          <RunButton status={this.state.execution} clickHandler={this.runCode} />
          <Result ref="result" newborn={this.state.newborn} pieces={this.state.pieces} />
      </div>
    );


  }
});

var setupLiterate = function(el) {

};

var setupCode = function(preEl, options) {
  // converts <pre><code>...</code></pre>
  // to a CodeMirror instance

  var parentDiv = preEl.parentNode;

  var editorDiv = document.createElement('div');

  var r = React.createElement(CodeEditor,
                              {code: preEl.children[0].innerHTML,
                               language: options.language
                              });

  ReactDOM.render(r, editorDiv, function() {
    var cm = this.refs.editor.codeMirror;
    requestAnimationFrame(function() {
      parentDiv.replaceChild(editorDiv, preEl);
      cm.refresh();
    })
  })
};

var makeAbsolutePath = function(relativePath) {
  var prefix = _.initial(window.location.href.split('/')).join('/');
  return [prefix,'/',relativePath].join('');
}

var isPathRelative = function(path) {
  return !(/^(?:\/|[a-z]+:\/\/)/.test(path))
}

global.initializeWorker = function(webpplPath) {
  if (isPathRelative(webpplPath)) {
    webpplPath = makeAbsolutePath(webpplPath);
  }

  worker.postMessage({type: 'init',
                      // TODO: take this as wpCodeEditor argument
                      path: webpplPath})

  worker.postMessage({type: 'init',
                      path: makeAbsolutePath('../src/draw.js')})

}

global.wpCodeEditor = setupCode;
global.wpLiterateEditor = setupLiterate;
