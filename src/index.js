'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var CodeMirrorComponent = require('react-codemirror');

var renderReturnValue = function(x) {
  if (x === undefined) {
    return ""
  }

  if (x && (x.score != undefined) && (x.sample != undefined))
    return '<erp>';

  if (typeof x == 'function')
    return '<function ' + x.name + '>';

  if (typeof x == 'string') {
    return x;
  }

  return JSON.stringify(x);
};

// get access to the private CM function inside react-codemirror
// this works because node require calls are cached
var CM = require('react-codemirror/node_modules/codemirror');

// global.CodeMirror = require('codemirror');

var $ = require('jquery');

global.d3 = require('d3'); // debugging
//var vl = require('vega-lite');
var vg = require('vega');


var _ = require('underscore');
global._ = _; // debugging

var jobsQueue = [];

require('react-codemirror/node_modules/codemirror/addon/edit/matchbrackets')
require('react-codemirror/node_modules/codemirror/mode/javascript/javascript');
require('react-codemirror/node_modules/codemirror/addon/comment/comment'); // installs toggleComment

var ResultError = React.createClass({
  getInitialState: function() {
    return {showStack: false}
  },
  handleClick: function(e) {
    this.setState({showStack: !this.state.showStack})
  },
  // shouldComponentUpdate: function() {
  //   return false
  // },
  render: function() {
    var stack = this.state.showStack ? "\n" + this.props.stack : "";
    return (
        <pre key={this.props.key} className='error' onClick={this.handleClick}><span className='error-message'>{this.props.message}</span>{stack}</pre>
    );
  }
});

// React's render is called any time new results are entered or the codebox is edited
// To avoid this, we can do a lightweight version of PureRenderMixin:
// see http://stackoverflow.com/a/24719289/351329
var pureSCU = function(nextProps, nextState) {
  return !(_.isEqual(nextProps, this.props) && _.isEqual(nextState, nextState))
}

var ResultText = React.createClass({
  shouldComponentUpdate: pureSCU,
  render: function() {
    return (
        <pre key={this.props.key} className='text'>{this.props.message + ""}</pre>
    );
  }
});

var ResultBarChart = React.createClass({
  shouldComponentUpdate: pureSCU,
  componentDidMount: function() {
    var ivs = this.props.ivs;
    var dvs = this.props.dvs;

    var frequencyDf = _.zip(ivs,dvs).map(function(a) {
      return {iv: a[0], dv: a[1]}
    });

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

    var div = this.refs.div;

    vg.parse.spec(vgspec, function(error,chart) {
      var view = chart({renderer: 'svg'}).update();
      var img = document.createElement('img');
      img.src = 'data:image/svg+xml;utf8,' + view.svg();
      ReactDOM.findDOMNode(div).innerHTML = "<img src='data:image/svg+xml;utf8," + view.svg() + "'></img>";
    });

  },
  render: function() {
    return (<div ref="div" />);
  }
});

var wait = function(ms,f) {
  return setTimeout(f,ms);
}

var ResultDOM = React.createClass({
  componentDidMount: function() {
    this.div = ReactDOM.findDOMNode(this);
  },
  render: function() {
    return (<div className="custom"></div>)
  }
})

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

var compileCache = {};

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code,
      results: [],
      newborn: true,
      execution: "idle",
      resultDivMinHeight: 0
    }
  },
  runCode: function() {

    global.localStorage.setItem('code',this.state.code);

    var $resultsDiv = $(ReactDOM.findDOMNode(this)).find(".result");

    this.setState({newborn: false, results: []});
    var comp = this;
    var code = this.state.code;
    var language = this.props.language;

    var drawObjects = {};

    var cleanup = function() {
      comp.setState({execution: 'idle'}, function() {
        // set resultDivMinHeight with callback because we need to make sure the idle style is applied first
        // i.e., the css min-height attribute is set to 0 so we can actually measure the height of the div
        comp.setState({resultDivMinHeight: $resultsDiv.height()})
      });

      // remove completed job
      jobsQueue.shift();

      // if there are remaining jobs, start on the next one
      if (jobsQueue.length > 0) {
        jobsQueue[0]()
      }
    }

    var job = function() {

      // direct side effects to results area of current CodeEditor
      global.print = function(s,k,a,x) {
        comp.addResult({type: 'text', message: x})
        return k(s)
      };

      global.hist = function(s,k,a,samples) {
        var frequencyDict = _(samples).countBy(function(x) { return typeof x === 'string' ? x : JSON.stringify(x) });
        var labels = _(frequencyDict).keys();
        var counts = _(frequencyDict).values();
        comp.addResult({type: 'barChart', ivs: labels, dvs: counts})
        return k(s)
      };

      global.barChart = function(s,k,a,ivs, dvs) {
        comp.addResult({type: 'barChart', ivs: ivs, dvs: dvs});
        return k(s)
      };

      // TODO: take property arguments so that we can, e.g., make the div inline or have a border or something
      global.makeResultContainer = function() {
        comp.addResult(_.extend({type: 'DOM'}));
        // return the most recent custom component
        // TODO: don't depend on jquery for this
        return _.last( $(ReactDOM.findDOMNode(comp)).find(".custom") );
      }

      var endJob = function(store, returnValue) {
        var renderedReturnValue = renderReturnValue(returnValue);
        comp.addResult({type: 'text', message: renderedReturnValue });
        cleanup();
      }

      comp.setState({execution: compileCache[code] ? 'running' : 'compiling'});

      // use wait() so that runButton dom changes actually appear
      wait(20, function() {
        if (!compileCache[code]) {

          // catch compilation errors
          // TODO: better message for returnify
          try {
            compileCache[code] = webppl.compile(code, 'verbose');
          } catch (e) {
            comp.addResult({type: 'error', message: e.message, stack: e.stack});
            cleanup();
          }
        }

        comp.setState({execution: 'running'});

        wait(20, function() {

          try {
            eval.call({}, compileCache[code])({}, endJob, '');
          } catch(e) {
            comp.addResult({type: 'error', message: e.message, stack: e.stack});
            cleanup();
          }

        });

      });

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
    // discovered alternate form of setState on my own
    // but later stumbled on a good explanation of why we need it at
    // https://kevinmccarthy.org/2015/07/05/multiple-async-callbacks-updating-state-in-react/
    this.setState(function(state, props) {
      return {results: state.results.concat(result)}
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

    var renderResult = function(d,k) {
      if (d.type == 'text') {
        return <ResultText key={k} {...d} />
      } else if (d.type == 'error') {
        return <ResultError key={k} {...d} />
      } else if (d.type == 'barChart') {
        return <ResultBarChart key={k} {...d} />
      } else if (d.type == 'DOM') {
        return <ResultDOM key={k} {...d} />
      } else {
        console.log('unrouted command: ', d)
      }

    };

    // TODO: in general, numeric index based keys aren't recommended
    // but they might work for our use case (essentially append-only)
    var results = this.state.results.map(function(r,i) { return renderResult(r,i) });

    var resultDivStyle = {
      minHeight: this.state.execution == 'idle' ? 0 : this.state.resultDivMinHeight
    }

    // TODO: get rid of CodeMirrorComponent ref by running refresh in it's own componentDidMount?
    // see http://stackoverflow.com/a/25723635/351392 for another approach mimicking inheritance in react
    return (
      <div ref="cont">
        <CodeMirrorComponent ref="editor" value={this.state.code} onChange={this.updateCode} options={options} />
        <RunButton status={this.state.execution} clickHandler={this.runCode} />
        <div style={resultDivStyle} className={this.state.newborn ? "result hide" : "result"}>
          {results}
        </div>
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

// var makeAbsolutePath = function(relativePath) {
//   var prefix = _.initial(window.location.href.split('/')).join('/');
//   return [prefix,'/',relativePath].join('');
// }

// var isPathRelative = function(path) {
//   return !(/^(?:\/|[a-z]+:\/\/)/.test(path))
// }

global.wpCodeEditor = setupCode;
global.wpLiterateEditor = setupLiterate;
