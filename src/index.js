'use strict';

var $ = require('jquery');
var _ = require('underscore');

var React = require('react');
var ReactDOM = require('react-dom');

var CodeMirror = require('codemirror');
var CodeMirrorComponent = require('react-codemirror');
var Folding = require('./folding')(CodeMirror);
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/edit/closebrackets');
require('codemirror/mode/javascript/javascript');
require('codemirror/addon/comment/comment'); // installs toggleComment

var renderReturnValue = function(x) {
  if (x === undefined) {
    return ''
  }

  if (x && (x.score != undefined) && (x.sample != undefined))
    // TODO: show as table?
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
  render: function() {
    var stack = this.state.showStack ? '\n' + this.props.stack : '';
    return (
        <pre key={this.props._key} className='error' onClick={this.handleClick}><span className='error-message'>{this.props.message}</span>{stack}</pre>
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
        <pre key={this.props._key} className='text'>{this.props.message + ''}</pre>
    );
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
    return (<div className='custom'></div>)
  }
})

var RunButton = React.createClass({
  getLabel: function() {
    var labels = {
      idle: 'run',
      queued: 'queued...'
    };
    return _.has(labels, this.props.status) ? labels[this.props.status] : this.props.status;
  },
  render: function() {
    return (
        <button className='run' type='button' onClick={this.props.clickHandler} disabled={!(this.props.status == 'idle')}>{this.getLabel()}</button>
    )
  }
});

var jobsQueue = [];
var compileCache = {};

var ResultList = React.createClass({
  getInitialState: function() {
    return {
      minHeight: 0
    }
  },
  render: function() {
    var renderResult = function(d,k) {
      if (d.type == 'text') {
        return <ResultText key={k} _key={k} {...d} />
      } else if (d.type == 'error') {
        return <ResultError key={k} _key={k} {...d} />
      } else if (d.type == 'DOM') {
        return <ResultDOM key={k} {...d} />
      } else {
        console.log('unrouted command: ', d)
        return null;
      }
    };

    // in general, numeric index keys aren't recommended
    // but i think they work for our use case (append-only, essentially)
    var list = this.props.list.map(function(r,i) { return renderResult(r,i) });

    var style = {
      minHeight: this.state.minHeight
    }

    return (<div style={style} className={this.props.newborn ? 'result hide' : 'result'}>
            {list}
            </div>);

  }
})


var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      results: [],
      newborn: true,
      execution: 'idle'
    }
  },
  // side effects
  // these methods draw to the results div of a particular CodeEditor instance
  // the actively running codebox will inject them into global once it starts running
  // TODO: remove hist and barChart once webppl-viz stabilizes
  // ------------------------------------------------------------
  print: function(s,k,a,x) {
    // make print work as a regular js function
    if (arguments.length == 1) {
      this.addResult({type: 'text',
                      message: typeof x == 'object' ? JSON.stringify(arguments[0]) : arguments[0]})
      return;
    }

    // if x has a custom printer, use it
    if (x.__print__) {
      return k(s, x.__print__(x));
    } else {
      this.addResult({type: 'text',
        message: typeof x == 'object' ? JSON.stringify(x) : x})
      return k(s)
    }
  },
  makeResultContainer: function() {
    // TODO: take property arguments so that we can, e.g., make the div inline or have a border or something
    this.addResult(_.extend({type: 'DOM'}));

    // return the most recent custom component
    // TODO: don't depend on jquery for this
    var element = _.last($(ReactDOM.findDOMNode(this)).find('.custom'));
    return element;
  },
  // ------------------------------------------------------------
  cancelRun: function() {
    this.runner.__cancel__ = true;
    this.addResult({type: 'text', message: '[Execution canceled]'});
    this.endJob();
  },
  runCode: function() {

    var resultList = this.refs.resultList;
    var $resultsDiv = $(ReactDOM.findDOMNode(resultList));

    // set the minimum height property for the result list
    // to be its current height so that we don't have the janky reflow
    // of it shrinking because it's empty and growing again as
    // results populate
    resultList.setState(function(state,props) {
      //return _.extend({}, state, {minHeight: $resultsDiv.height()})

      return _.extend({}, state, {minHeight:
            util.sum($resultsDiv.contents().map(function(i,x) {
              return $(x).height()
            }))
      })
    })

    // enable only in dev mode
    // global.localStorage.setItem('code',this.state.code);

    this.setState({newborn: false, results: []});

    var comp = this;
    var code = comp.refs.editor.getCodeMirror().getValue();
    var language = comp.props.language; // TODO: detect this from CodeMirror text

    var endJob = function(store, returnValue) {
      var renderedReturnValue = renderReturnValue(returnValue);
      comp.addResult({type: 'text', message: renderedReturnValue });
      cleanup();
    }

    this.endJob = endJob;

    var cleanup = function() {
      global['print'] = null;
      global['resumeTrampoline'] = null;
      global['onerror'] = null;
      wpEditor['makeResultContainer'] = null;
      comp.setState({execution: 'idle'});

      // remove completed job
      jobsQueue.shift();
      // if there are remaining jobs, start on the next one
      if (jobsQueue.length > 0) {
        jobsQueue[0]()
      }
    }

    var handleError = function(e) {
      if (typeof e == 'string') {
        e = {message: e, stack: []};
      }
      comp.addResult({type: 'error', message: e.message, stack: e.stack});
      cleanup();
    }

    var job = function() {

      // inject this component's side effect methods into global
      var sideEffectMethods = ['print'];
      _.each(sideEffectMethods,
             function(name) { global[name] = comp[name]; });
      // note: React automatically binds methods to their class so we don't need to use .bind here

      wpEditor['makeResultContainer'] = comp['makeResultContainer'];
      // for catching errors in library code like wpEditor.get()
      global.onerror = function(message, source, lineno, colno, e) {
        // TODO: if e is not available, also use source, lineno, and colno
        handleError(e || message)
      }

      // run vanilla js
      // TODO: detect language from codemirror value, not React prop
      if (language == 'javascript') {
        // TODO: grey out the run button but don't show a cancel button
        try {
          var res = eval(code);
          endJob({}, res);
          cleanup()
        } catch(e) {
          handleError(e);
        } finally {
          return;
        }
      }

      // if webppl hasn't loaded yet, wait 250ms before trying again
      if (typeof webppl == 'undefined') {
        comp.setState({execution: 'loading webppl'})
        return wait(250, job);
      }

      comp.setState({execution: compileCache[code] ? 'running' : 'compiling'});

      // use wait() so that runButton dom changes actually appear
      wait(20, function() {
        // compile code if we need to
        if (!compileCache[code]) {
          try {
            compileCache[code] = webppl.compile(code)
          } catch (e) {
            handleError(e);
          }
        }

        comp.setState({execution: 'running'});

        var runner = util.trampolineRunners.web(handleError);
        global['resumeTrampoline'] = runner;
        comp.runner = runner;

        wait(20, function() {
          var _code = eval.call({}, compileCache[code])(runner);
          _code({}, endJob, '');
        });

      });

    };

    jobsQueue.push(job);
    this.setState({execution: 'queued'});

    if (jobsQueue.length == 1) {
      job()
    }
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
    var comp = this;
    // TODO: allow configuring this
    var options = {
      mode: 'javascript',
      lineNumbers: false,
      autoCloseBrackets: true,
      matchBrackets: true,
      viewportMargin: Infinity,
      extraKeys: {
        'Tab': 'indentAuto',
        'Cmd-/': 'toggleComment',
        'Ctrl-/': 'toggleComment',
        'Cmd-.': function(cm) { cm.foldCode(cm.getCursor(), Folding.myRangeFinder); },
        'Ctrl-.': function(cm) { cm.foldCode(cm.getCursor(), Folding.myRangeFinder); },
        'Ctrl-Enter': function(cm) { comp.runCode(); },
        'Cmd-Enter': function(cm) { comp.runCode(); }
      }
    };

    var code = this.refs.editor ? this.refs.editor.getCodeMirror().getValue() : this.props.code;

    // TODO: get rid of CodeMirrorComponent ref by running refresh in it's own componentDidMount?
    // see http://stackoverflow.com/a/25723635/351392 for another approach mimicking inheritance in react
    return (
        <div ref='cont' className='wpedit'>
        <CodeMirrorComponent ref='editor' value={code} options={options} codeMirrorInstance={CodeMirror} />
        <RunButton status={this.state.execution} clickHandler={this.runCode} />
        <button className = {_.contains(['running'], this.state.execution) ? 'cancel' : 'cancel hide'} onClick={this.cancelRun}>cancel</button>
        <ResultList newborn={this.state.newborn} ref='resultList' executionState={this.state.execution} list={this.state.results} />
        </div>
    );
  }
});

var setupCode = function(preEl, options) {
  // converts <pre><code>...</code></pre>
  // to a CodeMirror instance

  options = _.defaults(
    options || {},
    {
      trim: true,
      language: 'webppl'
    }
  );

  var parentDiv = preEl.parentNode;

  var editorDiv = document.createElement('div');

  var code = $(preEl).text();
  if (options.trim) {
    code = code.trim()
  }

  var r = React.createElement(
    CodeEditor,
    {code: code,
     language: options.language});

  // TODO: figure out if this is an anti-pattern
  var ret = {};

  ReactDOM.render(r, editorDiv, function() {
    ret = this;
    var comp = this;

    requestAnimationFrame(function() {

      var cm = comp.refs['editor'].getCodeMirror();

      parentDiv.replaceChild(editorDiv, preEl);
      cm.refresh();

      // fold lines marked by "///fold"
      var lastLine = cm.lastLine();
      for(var i=0;i<=lastLine;i++) {
        var txt = cm.getLine(i),
            pos = txt.indexOf('///fold:');
        if (pos==0) {cm.foldCode(CodeMirror.Pos(i,pos), Folding.tripleCommentRangeFinder);}
      }
    })
  })

  return ret;
};

var numTopStoreKeys = 0;

var topStore = {};
var wpEditor = {
  setup: setupCode,
  ReactComponent: CodeEditor,
  makeResultContainer: function() {}, // this gets set by a CodeEditor instance
  MCMCProgress: function() {
    var container = wpEditor['makeResultContainer'](),
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
  },
  put: function() {
    var item, key;
    if (arguments.length == 1) {
      item = arguments[0];
    } else {
      key = arguments[0];
      item = arguments[1];
    }
    if (!key) {
      numTopStoreKeys++;
      key = 'r' + numTopStoreKeys;
    }
    topStore[key] = item;
    var div = wpEditor.makeResultContainer();
    $(div).html('Stored item with key <span style="border: 1px solid gray; background-color: #dddddd; border-radius: 5px; padding: 0em 0.5em">' + key + '</b>').css({
      'font-size': '12px',
      'padding': '2px'
    });
  },
  get: function(k) {
    if (k) {
      if (_.has(topStore, k)) {
        return topStore[k]
      } else {
        throw new Error('There is no stored item with key ' + k)
      }
    } else {
      // when called with no argument, returns backing dictionary
      return topStore;
    }
  }
}

// behave both as a browser library and a node module
// (HT underscore library)
var root = this;
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = wpEditor;
  }
  exports.wpEditor = wpEditor;
} else {
  root.wpEditor = wpEditor;
}
