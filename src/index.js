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
//require('codemirror/mode/javascript/javascript');
require('./wppl-mode.js')
require('codemirror/addon/comment/comment'); // installs toggleComment

var wait = function(ms, f) {
  return setTimeout(f, ms);
}

var renderReturnValue = function(x) {
  if (x === undefined) {
    return ''
  }

  if (x && (x.score != undefined) && (x.sample != undefined))
    if (typeof viz == 'undefined') {
      return util.serialize(x);
    } else {
      if (typeof viz.auto == 'function') {
        viz.auto(x);
        return;
      }
    }

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
    var subtype = this.props.subtype || "log";
    var icon = {
      log: "",
      warn: "⚠",
      error: "x",
      info: "i"
    }[subtype];

    var spanClass='icon ' + subtype;

    var count = this.props.count == 1 || this.props.count === undefined ? "" : "(" + this.props.count + ") ";
    var message = this.props.message;

    if (this.props.count == 1 && this.subtype == 'log') {
      return (<pre key={this.props._key} className='text'>{message}</pre>)
    } else {
      return  (<div>
               <span className={spanClass}>{icon}</span>
               <span className='count'>{count}</span>
               <pre key={this.props._key} className='text'>{message}</pre>
               </div>);
    }
  }
});

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

var ResultMetaDrawer = React.createClass({
  render: function() {
    var items = _.values(_.mapObject(_.omit(this.props, 'visible'),
                                     function(v,k) {
                                       return <div key={k}><b>{k}</b>: {v}</div>
                                     }));

    return (<div className={'meta ' + (this.props.visible ? '' : 'hide')}>
            {items}
            </div>)
  }
})

var ResultList = React.createClass({
  getInitialState: function() {
    return {
      metaVisible: false,
      minHeight: 0,
      hide: false
    }
  },
  hide: function() {
    this.setState({hide: true})
  },
  // auto scroll to bottom (if user is already at the bottom)
  // HT http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html
  // this is a modification that works with MutationObserver
  _autoscroller: function() {
    var node = ReactDOM.findDOMNode(this);
    // auto scroll either if the user didn't scroll to a non-bottom position
    var nodeHeight = $(node).height();
    this.lastScrollTop = node.scrollTop;
    if (node.scrollHeight > node.scrollTop + nodeHeight + 4) {
      node.scrollTop = node.scrollHeight
    }
  },
  componentWillMount: function() {
    this.autoscroller = _.throttle(this._autoscroller, 50);
    this.ResultsMutationObserver = new MutationObserver(this.autoscroller);
  },
  componentWillUnmount: function() {
    this.ResultsMutationObserver.disconnect();
    $(ReactDOM.findDOMNode(this)).unbind('scroll');
  },
  componentDidMount: function() {
    var comp = this,
        mo = this.ResultsMutationObserver,
        node = ReactDOM.findDOMNode(this),
        scrollHandler = function(e) {
          if (node.scrollTop < comp.lastScrollTop) {
            // if user scrolled up, disconnect
            mo.disconnect();
          } else if (node.scrollTop + node.offsetHeight/* NB */ + 30 > node.scrollHeight) {
            // if user scrolled to very bottom, reconnect
            // but first, prevent flick-scrolling to get to the bottom from "overflowing"
            // and also scrolling the parent webpage
            e.stopImmediatePropagation();
            mo.observe(node, {childList: true, attributes: true, subtree: true});
          }
        }

    $(node).scroll(scrollHandler);
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

    var webpplVersion = this.props.webpplVersion;
    var seed = this.props.seed;

    var className = 'result ' + (list.length == 0 ? ' hide' : '');

    return (
        <div style={style} className={className}>
        <button onClick={this.props.clear} className={'clearButton ' +  this.props.executionState}>X</button>
        {list}
      </div>
        );

  }
})

var jobsQueue = [], compileCache = {};

// untape AD values
var unAd = function() {
  var ad = global.ad;
  if (typeof ad == 'undefined') {
    unAd = function(x) { return x }
  } else {
    unAd = function(x) {
      if (global.ad.isLifted(x)) {
        return x.x;
      } else if (_.isArray(x)) {
        return _.map(x, unAd);
      } else if (x instanceof ad.tensor.__Tensor) {
        // Optimization: tensors don't contain tapes, so return now rather
        // than descend into the tensor object.
        return x;
      } else if (_.isObject(x) && !_.isFunction(x)) {
        // Ensure prototype chain is preserved
        var proto = Object.getPrototypeOf(x);
        var y = _.mapObject(x, unAd);
        return _.extendOwn(Object.create(proto), y);
        return y;
      } else {
        return x;
      }
    }

  }
}

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      results: [],
      newborn: true,
      execution: 'idle',
      showMeta: false
    }
  },
  // side effects
  // these methods draw to the results div of a particular CodeEditor instance
  // the actively running codebox will inject them into global once it starts running
  // ------------------------------------------------------------
  print: function(s,k,a,x) {
    // make print work as a vanilla js function
    var isVanillaCall = (arguments.length == 1);
    if (isVanillaCall) {
      x = arguments[0];
    }

    // if x has a custom printer, use it
    if (x.__print__) {
      return k(s, x.__print__(x));
    } else {
      var _x = unAd(x);
      var type = typeof _x;
      this.addResult({type: 'text',
                      message: _.contains(['object', 'boolean', 'number'], type) ? JSON.stringify(_x) : _x})
      if (isVanillaCall) {
        return;
      } else {
        return k(s)
      }
    }
  },
  makeResultContainer: function(_options) {
    var options = _.defaults(_options || {},
                             {});
    this.addResult(_.extend({type: 'DOM'}));

    // return the most recent custom component
    // TODO: don't depend on jquery for this
    var element = _.last($(ReactDOM.findDOMNode(this)).find('.custom'));
    if (options.css) {
      $(element).css(options.css)
    }
    return element;
  },
  // ------------------------------------------------------------
  cancelRun: function() {
    if (this.runner) { this.runner.__cancel__ = true; }
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
      return _.extend({}, state, {minHeight: $resultsDiv.height()})
    })

    // enable only in dev mode
    // global.localStorage.setItem('code',this.state.code);

    this.setState({newborn: false, results: []});

    resultList.ResultsMutationObserver.observe($resultsDiv[0],
                                               {childList: true, attributes: true, subtree: true});

    var comp = this;
    var code = comp.refs.editor.getCodeMirror().getValue();
    var language = comp.props.language; // TODO: detect this from CodeMirror text

    var runT0, runClockId;

    var endJob = function(store, returnValue) {
      var renderedReturnValue = renderReturnValue(returnValue);
      comp.addResult({type: 'text', message: renderedReturnValue });
      cleanup();
    }

    this.endJob = endJob;

    // TODO: incorporate this into the other side effect stuff
    var nativeConsole = console;
    if (!global['nativeConsole']) {
      global['nativeConsole'] = nativeConsole;
    }

    var cleanup = function() {
      // remove completed job
      jobsQueue.shift();

      // stop the runtime clock
      clearInterval(runClockId);
      comp.setState({runTime: (_.now() - runT0)/1000 + 's',
                     execution: 'idle'});

      // undo global variable changes
      global['console'] = nativeConsole;
      global['print'] = null;
      global['onerror'] = null;
      wpEditor['makeResultContainer'] = null;

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
      // TODO: incorporate this into the other side effect stuff
      // NB: doing, e.g., nativeConsole.log.apply doesn't work
      // HT http://stackoverflow.com/a/9521992/351392

      var lastMessages = {};
      var makeConsoleMethod = function(subtype) {
        return function() {
          if (!comp.state.consoleMuted) {

            var args = _.toArray(arguments);
            var message = args.join(' ');
            var lastMessage = lastMessages[subtype];

            // if this message is a repeat of the previous one,
            // increment a counter on the previous counter rather than
            // redundantly printing this new message
            if (lastMessage == message) {
              comp.setState(function(state, props) {
                // TODO: is mutating state okay?
                var idx = _.findLastIndex(state.results,
                                          function(res) { return res.subtype == subtype});
                state.results[idx].count += 1;
                return state;
              })
            } else {
              comp.addResult({type: 'text', subtype: subtype, message: message, count: 1});
              lastMessages[subtype] = message;
            }

          }

          nativeConsole[subtype](message);
        }
      }

      global['console'] = {
        log: makeConsoleMethod('log'),
        info: makeConsoleMethod('info'),
        warn: makeConsoleMethod('warn'),
        error: makeConsoleMethod('error'),
        mute: function() {
          comp.setState({consoleMuted: true})
        },
        unmute: function() {
          comp.setState({consoleMuted: false})
        }
      };

      // pass through un-intercepted console methods
      _.each(_.difference(_.methods(nativeConsole),
                          _.methods(global['console'])),
             function(key) {
               global['console'][key] = nativeConsole[key]
             }
            )

      // inject this component's side effect methods into global
      var sideEffectMethods = ['print'];
      _.each(sideEffectMethods,
             function(name) { global[name] = comp[name]; });
      // note: React automatically binds methods to their class so we don't need to use .bind here

      wpEditor['makeResultContainer'] = comp['makeResultContainer'];

      // run vanilla js
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

      var handleRunError = function(error) {
        // For Chrome only...

        // If debug=true is passed to run (as below), then wpplError is
        // expected to be present when an instance of Error is thrown
        // running the program

        // This object holds information about the top-most position on the
        // stack that originated from the user specific program.

        if (error instanceof Error && error.wpplError) {

          // We can use the following information for highlighting a
          // suitable point in the user program.
          var wpplError = error.wpplError,
              lineNumber = wpplError.lineNumber - 1,
              columnNumber = wpplError.columnNumber,
              endColumn = wpplError.name ? columnNumber + wpplError.name.length : Infinity;
          var cm = comp.refs.editor.getCodeMirror();
          cm.markText({line: lineNumber, ch: columnNumber},
                      {line: lineNumber, ch: endColumn},
                      {className: "CodeMirrorError", clearOnEnter: true});

        }

        handleError(error);

      };

      var handleCompileError = function(e) {
        var message = e.message;

        var cm = comp.refs.editor.getCodeMirror();

        var re_line = /Line ([0-9]+): /;
        if (re_line.test(message)) {
          var line = parseInt(re_line.exec(message)[1]) - 1;
          cm.markText({line: line, ch: 0},
                      {line: line, ch: Infinity},
                      {className: "CodeMirrorError", clearOnEnter: true});
        }
        e.message = "Syntax error: " + e.message.replace(re_line, "");
        handleError(e)
      };


      // catch errors in library code (like editor.get())
      global.onerror = function(message, source, lineno, colno, e) {
        console.log('global.onerror triggered')
        // TODO: if e is not available, also use source, lineno, and colno
        handleRunError(e || message)
      }

      comp.setState({execution: 'compiling'});

      wait(
        20,
        function() {
          // (memoized) compile code

          var compileT0 = _.now();

          if (compileCache[code]) {
            comp.setState({compileTime: 'cached'})
          } else {
            try {
              compileCache[code] = webppl.compile(code, {debug: true});
              var compileT1 = _.now();
              comp.setState({compileTime: (compileT1 - compileT0)/1000 + 's'});
            } catch(e) {
              handleCompileError(e)
              return;
            }
          }

          var baseRunner = util.trampolineRunners.web();
          var compiled = compileCache[code];
          var prepared = webppl.prepare(compiled,
                                        endJob,
                                        {errorHandlers: [handleRunError], debug: true, baseRunner: baseRunner});
          comp.runner = baseRunner;

          comp.setState({execution: 'running'});

          var seed = _.now();
          comp.setState({seed: seed});
          util.seedRNG(seed);
          wait(20, function() {
            runT0 = _.now();

            runClockId = setInterval(function() {
              comp.setState({runTime: (_.now() - runT0)/1000 + 's' })
            }, 1000)


            prepared.run()
          })

        });


    };

    jobsQueue.push(job);
    this.setState({execution: 'queued'});

    if (jobsQueue.length == 1) {
      job()
    }
  },
  getCode: function() {
    return this.refs.editor ? this.refs.editor.getCodeMirror().getValue() : this.props.code;
  },
  addResult: function(result) {
    // discovered alternate form of setState on my own
    // but later stumbled on a good explanation of why we need it at
    // https://kevinmccarthy.org/2015/07/05/multiple-async-callbacks-updating-state-in-react/
    this.setState(function(state, props) {
      return {results: state.results.concat(result)}
    });
  },
  clearResults: function() {
    this.setState({results: []})
  },
  toggleMetaDrawer: function() {
    this.setState({showMeta: !this.state.showMeta})
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

    var webpplVersion = global.webppl ? global.webppl.version : '';

    var webpplPackages = global.webppl ? global.webppl.packages.map(function(pkg) {
      return pkg.name + ' ' + pkg.version
    }).join(', ') : 'n/a';

    var code = this.refs.editor ? this.refs.editor.getCodeMirror().getValue() : this.props.code;

    var drawerButtonLabel = this.state.showMeta ? "▲" : "▼";

    // TODO: get rid of CodeMirrorComponent ref by running refresh in it's own componentDidMount?
    // see http://stackoverflow.com/a/25723635/351392 for another approach mimicking inheritance in react
    return (<div ref='cont' className='wpedit'>
            <CodeMirrorComponent ref='editor'
                                 value={code}
                                 options={options}
                                 onChange={comp.props.onChange}
                                 codeMirrorInstance={CodeMirror} />
            <RunButton status={this.state.execution} clickHandler={this.runCode} />
        <button className = {_.contains(['running'], this.state.execution) ? 'cancel' : 'cancel hide'} onClick={this.cancelRun}>cancel</button>
        <button className="drawerButton" onClick={this.toggleMetaDrawer}>{drawerButtonLabel}</button>
            <ResultMetaDrawer visible={this.state.showMeta}
            webppl={webpplVersion}
            packages={webpplPackages}
            seed={this.state.seed}
            compile={this.state.compileTime}
            run={this.state.runTime}

            />
        <ResultList ref='resultList'
            newborn={this.state.newborn}
            clear={this.clearResults}
            executionState={this.state.execution}
            list={this.state.results}
        />
        </div>
    );
  }
});

var setupCode = function(preEl, options) {
  // converts <pre><code>...</code></pre>
  // to a CodeMirror instance

  options = _.defaults(options || {}, {trim: true,
                                       language: 'webppl'
                                      });

  var parentDiv = preEl.parentNode;
  var editorDiv = document.createElement('div');

  var code = $(preEl).text();
  if (options.trim) {
    code = code.trim()
  }

  var r = React.createElement(CodeEditor,
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

var topStore = {};
var numTopStoreKeys = 0;

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

if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = wpEditor;
  }
}

if (typeof window !== 'undefined') {
  window.wpEditor = wpEditor;
  window.editor = wpEditor;
}
