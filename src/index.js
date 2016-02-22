'use strict';

var $ = require('jquery');

var _ = require('underscore');
global._ = _;  // debugging

var React = require('react');
var ReactDOM = require('react-dom');
var CodeMirror = require('codemirror');
var CodeMirrorComponent = require('react-codemirror');
var Folding = require('./folding')(CodeMirror);

var d3 = require('d3');
if (typeof window !== "undefined") {
  window.d3 = d3;
}
if (typeof global !== "undefined") {
  global.d3 = d3;
}

var vg = require('vega');

require('codemirror/addon/edit/matchbrackets')
require('codemirror/mode/javascript/javascript');
require('codemirror/addon/comment/comment'); // installs toggleComment


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

var jobsQueue = [];
var compileCache = {};

var ResultList = React.createClass({
  getInitialState: function() {
    return {
      resultDivMinHeight: 0
    }
  },
  render: function() {
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
        return null;
      }
    };

    // TODO: in general, numeric index based keys aren't recommended
    // but they might work for our use case (essentially append-only)
    var list = this.props.list.map(function(r,i) { return renderResult(r,i) });

    var resultDivStyle = {
      minHeight: this.props.executionState == 'idle' ? 0 : this.state.resultDivMinHeight
    }

    return (<div style={resultDivStyle} className={this.props.newborn ? "result hide" : "result"}>
            {list}
            </div>);

  }
})


var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code,
      results: [],
      newborn: true,
      execution: "idle"
    }
  },
  // side effects
  // these methods draw to the results div of a particular CodeEditor instance
  // the actively running codebox will inject them into global once it starts running
  // TODO: remove hist and barChart once webppl-viz stabilizes
  // ------------------------------------------------------------
  print: function(s,k,a,x) {
    this.addResult({type: 'text', message: x})
    return k(s)
  },
  hist: function(s,k,a,samples) {
    var frequencyDict = _(samples).countBy(function(x) { return typeof x === 'string' ? x : JSON.stringify(x) });
    var labels = _(frequencyDict).keys();
    var counts = _(frequencyDict).values();
    this.addResult({type: 'barChart', ivs: labels, dvs: counts})
    return k(s)
  },
  barChart: function(s,k,a,ivs, dvs) {
    this.addResult({type: 'barChart', ivs: ivs, dvs: dvs});
    return k(s)
  },
  makeResultContainer: function() {
    // TODO: take property arguments so that we can, e.g., make the div inline or have a border or something
    this.addResult(_.extend({type: 'DOM'}));

    // return the most recent custom component
    // TODO: don't depend on jquery for this
    var element = _.last( $(ReactDOM.findDOMNode(this)).find(".custom") );
    return element;
  },
  // ------------------------------------------------------------
  cancelRun: function() {
    util.trampolineRunners.web.__cancel__ = true;
    this.addResult({type: 'text', message: '[Execution canceled]'});
    this.endJob();
  },
  runCode: function() {
    global.localStorage.setItem('code',this.state.code); // TODO: enable only in dev mode
    var $resultsDiv = $(ReactDOM.findDOMNode(this)).find(".result");

    this.setState({newborn: false, results: []});
    var comp = this;
    var code = this.state.code;
    var language = this.props.language; // TODO: detect this from CodeMirror text

    var endJob = function(store, returnValue) {
      var renderedReturnValue = renderReturnValue(returnValue);
      comp.addResult({type: 'text', message: renderedReturnValue });
      cleanup();
    }

    this.endJob = endJob;

    var cleanup = function() {
      window.onerror = null;
      comp.setState({execution: 'idle'}, function() {
        // set resultDivMinHeight with callback because we need to make sure the idle style is applied first
        // i.e., the css min-height attribute is set to 0 so we can actually measure the height of the div
        comp.refs['resultList'].setState({resultDivMinHeight: $resultsDiv.height()})
      });

      // remove completed job
      jobsQueue.shift();
      // if there are remaining jobs, start on the next one
      if (jobsQueue.length > 0) {
        jobsQueue[0]()
      }
    }

    var job = function() {

      // if webppl hasn't loaded yet, wait 250ms before trying again
      if (typeof webppl == 'undefined') {
        comp.setState({execution: 'loading webppl'})
        return wait(250, job);
      }

      // inject this component's side effect methods into global
      var sideEffectMethods = ["print","hist","barChart"];
      _.each(sideEffectMethods,
             function(name) { global[name] = comp[name]; });
      // note: React automatically binds methods to their class so we don't need to use .bind here

      globalExport['makeResultContainer'] = comp['makeResultContainer'];

      comp.setState({execution: compileCache[code] ? 'running' : 'compiling'});

      // use wait() so that runButton dom changes actually appear
      wait(20, function() {
        // compile code if we need to
        if (!compileCache[code]) {
          try {
            compileCache[code] = webppl.compile(code)
          } catch (e) {
            // TODO: better message for returnify
            comp.addResult({type: 'error', message: e.message, stack: e.stack});
            cleanup();
          }
        }

        comp.setState({execution: 'running'});

        wait(20, function() {
          // catch errors that try-catch can't because of trampoline pauses
          // there is some redundancy here but leave it for now
          window.onerror = function(message,url,lineNumber,colNumber,e) {
            if (e) {
              comp.addResult({type: 'error', message: e.message, stack: e.stack});
            } else {
              comp.addResult({type: 'error', message: message})
            }
            cleanup();
          }

          try {
            // TODO: supply our own runner that is parameterized by error handler?
            var _code = eval.call({}, compileCache[code])(util.trampolineRunners.web);
            _code({}, endJob, '');
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
    var myRangeFinder = Folding.myRangeFinder;

    var options = {
      mode: 'javascript',
      lineNumbers: false,
      matchBrackets: true,
      viewportMargin: Infinity,
      extraKeys: {
        "Tab": "indentAuto",
        "Cmd-/": "toggleComment",
        "Cmd-.": function(cm){cm.foldCode(cm.getCursor(), myRangeFinder); }
      }
    };

    // TODO: get rid of CodeMirrorComponent ref by running refresh in it's own componentDidMount?
    // see http://stackoverflow.com/a/25723635/351392 for another approach mimicking inheritance in react
    return (
      <div ref="cont" className="wpedit">
        <CodeMirrorComponent ref="editor" value={this.state.code} onChange={this.updateCode} options={options} codeMirrorInstance={CodeMirror} />
        <RunButton status={this.state.execution} clickHandler={this.runCode} />
        <button className = {_.contains(['running','queued'], this.state.execution) ? 'cancel' : 'cancel hide'} onClick={this.cancelRun}>cancel</button>
        <ResultList newborn={this.state.newborn} ref="resultList" executionState={this.state.execution} list={this.state.results} />
      </div>
    );
  }
});

var setupCode = function(preEl, options) {
  // converts <pre><code>...</code></pre>
  // to a CodeMirror instance

  var parentDiv = preEl.parentNode;

  var editorDiv = document.createElement('div');

  var r = React.createElement(CodeEditor,
                              {code: $(preEl.children[0]).text(),
                               language: options.language
                              });

  ReactDOM.render(r, editorDiv, function() {
    var cm = this.refs.editor.codeMirror;
    requestAnimationFrame(function() {
      parentDiv.replaceChild(editorDiv, preEl);
      cm.refresh();

      // fold lines marked by "///fold"
      var lastLine = cm.lastLine();
      for(var i=0;i<=lastLine;i++) {
        var txt = cm.getLine(i),
            pos = txt.indexOf("///fold:");
        if (pos==0) {cm.foldCode(CodeMirror.Pos(i,pos), Folding.tripleCommentRangeFinder);}
      }
    })
  })
};

var globalExport = {
  setup: setupCode,
  makeResultContainer: function() {}, // this gets set by a CodeEditor instance
  MCMCProgress: function() {
    var container = globalExport['makeResultContainer'](),
        $container = $(container).addClass('progress'),
        $fill = $('<div>').addClass('fill'),
        $text = $('<div>').addClass('text');
    $container.append($fill, $text);

    var completed = 0, total;

    var renderProgressBar = _.throttle(function() {
      var pct = (100 * completed / total);
      $text.text(completed + ' / ' + total + ' samples');
      $fill.css('width',pct + '%')
    }, 100);

    return {
      setup: function(n) {
        total = n;
      },
      iteration: function(trace) {
        completed += 1;
        renderProgressBar();
      }
    }
  }
}

global.wpEditor = globalExport;
