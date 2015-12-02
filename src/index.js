'use strict';

var webppl; // set by exports.install

var React = require('react');
var ReactDOM = require('react-dom');

// global.CodeMirror = require('codemirror');
var Codemirror = require('react-codemirror');

var $ = require('jquery');
//global.$ = $;

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


var Result = React.createClass({
  getInitialState: function() {
    return {pieces: []};
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
  render: function() {
    var piecesKeyed = this.state.pieces.map(function(x,i) { return (<div key={i}>{x}</div>) });
    return (
      <div className='result'>
        {piecesKeyed}
      </div>);
  }
});

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code
    }
  },
  runCode: function() {
    var result = this.refs.result;

    global.print = function(s,k,a,x) {
      result.add(<ResultText message={x} />);
      return k(s);
    };

    // var compiled = webppl.compile(this.props.input.props.value);
    // console.log(compiled);

    result.clear();

    try {
      webppl.run(this.state.code,
                 function(s, x) { result.add(<ResultText message={JSON.stringify(x)} />); },
                 true);
    } catch(e) {
      //result.text('error: ' + e.message)
      var err = (<ResultError message={e.message} />)
      result.add(err);
    }

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
