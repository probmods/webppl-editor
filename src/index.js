'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

// global.CodeMirror = require('codemirror');
var Codemirror = require('react-codemirror');

var $ = require('jquery');

global.d3 = require('d3');
var vl = require('vega-lite');
var vg = require('vega');

var _ = require('underscore');

var work = require('webworkify');

var jobsQueue = [];

require('react-codemirror/node_modules/codemirror/mode/javascript/javascript');
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

var Result = React.createClass({
  render: function() {
    var piecesKeyed = this.props.pieces.map(function(x,i) { return (<div key={i}>{x}</div>) });
    return (
      <div className="result">
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

worker.postMessage({type: 'init',
                    // TODO: take this as wpCodeEditor argument
                    path: 'http://127.0.0.1:4000/assets/js/webppl.min.js'})

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code,
      pieces: []
    }
  },
  runCode: function() {
    var $runButton = $(ReactDOM.findDOMNode(this)).find("button");
    $runButton.prop('disabled',true);

    global.localStorage.setItem('code',this.state.code);

    var comp = this;

    var code = this.state.code;

    var job = function() {

      worker.onerror = function(err) {
        comp.addResult(<ResultError message={err.message} />)
        $runButton.html('run').prop('disabled',false);
      }

      worker.onmessage = function(m) {
        var d = m.data;

        if (d.type == 'status')
          $runButton.html(d.status)

        if (d.type == 'text')
          comp.addResult(<ResultText message={JSON.stringify(d.obj)} />)

        if (d.type == 'barChart')
          comp.addResult(<ResultBarChart ivs={d.ivs} dvs={d.dvs} />)

        if (d.type == 'error')
          comp.addResult(<ResultError message={d.error.message} />)

        if (d.done) {
          $runButton.html('run').prop('disabled',false);
          comp.setState({fresh: true});
          jobsQueue.shift();

          if (jobsQueue.length > 0) {
            (jobsQueue.shift())()
          }
        }
      }

      comp.setState({pieces: []});
      worker.postMessage(code);
    };

    jobsQueue.push(job);

    if (jobsQueue.length == 1) {
      job()
    } else {
      $runButton.text('waiting...');
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
    var options = {
      mode: 'javascript',
      lineNumbers: false,
      matchBrackets: true,
      viewportMargin: Infinity
    };

    return (
      <div ref="cont">
          <Codemirror ref="editor" value={this.state.code} onChange={this.updateCode} options={options} />
          <button className='run' type="button" onClick={this.runCode}>run</button>
          <Result ref="result" pieces={this.state.pieces} />
      </div>
    );


  }
});

var setupLiterate = function(el) {

};

var setupCode = function(preEl) {
  // converts <pre><code>...</code></pre>
  // to a CodeMirror instance

  var editorDiv = document.createElement('div');

  var r = React.createElement(CodeEditor,
                              {code: preEl.children[0].innerHTML })

    ReactDOM.render(r, editorDiv, function() {
      var cm = this.refs.editor.codeMirror;
      requestAnimationFrame(function() {
        $(preEl).replaceWith(editorDiv);
        cm.refresh();
        // $(cm.display.wrapper).after(
        //   $('<button>').attr('type', 'button').addClass('run').text('run')
        // )

      })
    })
};


global.wpCodeEditor = setupCode;
global.wpLiterateEditor = setupLiterate;
