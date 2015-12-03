'use strict';

var webppl; // set by exports.install

var React = require('react');
var ReactDOM = require('react-dom');

// global.CodeMirror = require('codemirror');
var Codemirror = require('react-codemirror');

var $ = require('jquery');
global.$ = $;

global.d3 = require('d3');
var vl = require('vega-lite');
var vg = require('vega');


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


var ResultHist = React.createClass({
  render: function() {
    var samples = this.props.samples;
    var frequencyDict = _(samples).countBy(function(x) { return typeof x === 'string' ? x : JSON.stringify(x) });
    var labels = _(frequencyDict).keys();
    var counts = _(frequencyDict).values();

    var frequencyDf = _.zip(labels,counts).map(function(a) {
      return {label: a[0], count: a[1]}
    });

    var vlspec = {
      data: {values: frequencyDf},
      marktype: "bar",
      encoding: {
        x: {type: "O", name: "label"},
        y: {type: "Q", name: "count"}
      }
    };

    var vgspec = vl.compile(vlspec);
    var visEl = (
        <div>
        </div>
    );

    var me = this;

    vg.parse.spec(vgspec, function(chart) {
      console.log('inside vega callback')
      var view = chart({renderer: 'svg'}).update();
      wait(500, function() {
        $(ReactDOM.findDOMNode(me)).html(view.svg());
      })
    });

    console.log('inside ResultHist render');

    // var foo = vg.parse.spec(vgspec, function(chart) {
    //   var view = chart({renderer: 'svg'}).update();
    //   return view.svg();
    // });

    console.log(visEl)
    return visEl;

  }
});

var Result = React.createClass({
  getInitialState: function() {
    return {fresh: true, pieces: []};
  },
  clear: function() {
    this.setState({
      pieces: []
    })
  },
  add: function(x) {
    // NB: calling this.setState on an object with an updated messages
    // property resulted in weird bugs.
    // might be related to:
    //    "There is no guarantee of synchronous operation of calls to
    //    setState and calls may be batched for performance gains."
    this.setState(function(state, props) {
      return {pieces: state.pieces.concat(x)}
    });
  },
  getClassNames: function() {
    return this.state.fresh ? 'result' : 'result stale';
  },
  render: function() {
    var piecesKeyed = this.state.pieces.map(function(x,i) { return (<div key={i}>{x}</div>) });
    return (
      <div className={this.getClassNames()}>
        {piecesKeyed}
      </div>);
  }
});

//var hist = function(

var wait = function(ms,f) {
  return setTimeout(f,ms);
}

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code
    }
  },
  runCode: function() {
    var result = this.refs.result;
    result.setState({fresh: false});

    global.print = function(s,k,a,x) {
      result.add(<ResultText message={x} />);
      return k(s);
    };

    global.hist = function(s, k, a, samples) {
      result.add(<ResultHist samples={samples} />);
      return k(s);
    }


    // var compiled = webppl.compile(this.props.input.props.value);
    // console.log(compiled);

    var code = this.state.code;
    // pause 30ms so that the stale style is applied
    // might wanna do this with didComponentUpdate instead
    // see http://stackoverflow.com/a/28748160/351392
    wait(30,function() {
      try {
        result.setState({pieces: []});
        webppl.run(code,
                   function(s, x) {
                     result.add(<ResultText message={JSON.stringify(x)} />);
                     result.setState({fresh: true});
                   },
                   true);
      } catch(e) {
        var err = (<ResultError message={e.message} />)
        result.add(err);
        result.setState({fresh: true})
      }
    });


  },
  updateCode: function(newCode) {
    this.setState({
      code: newCode
    })
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
          <Result ref="result" value={this.state.result} />
      </div>
    );


  }
});

// var Result = React.createClass({
//   getInitialState: function() {
//     return
// })

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


global.installEditor = function(_webppl) {
  webppl = _webppl;
  webppl.editor = {
    literate: setupLiterate,
    code: setupCode
  }
};
