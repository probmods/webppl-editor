'use strict';

var webppl; // set by exports.install

var React = require('react');
var ReactDOM = require('react-dom');

// global.CodeMirror = require('codemirror');
var Codemirror = require('react-codemirror');

var $ = require('jquery');
//global.$ = $;

// // doesn't work
// require('codemirror/mode/javascript/javascript');

//require('react-codemirror/node_modules/codemirror/mode/javascript/javascript');
// might be able to avoid reaching into react-codemirror's copy of codemirror
// by doing some browserify tricks with -x or -r or factor-bundle (TODO: investigate)

var RunButton = React.createClass({

  handleClick: function() {
    var append = this.props.result.append;

    global.print = function(s,k,a,x) {
      append(x);
      return k(s);
    }

    var compiled = webppl.compile(this.props.input.props.value);
    console.log(compiled);

    this.props.result.clear();

    webppl.run(this.props.input.props.value,
               function(s, x) {  },
               true);
  },
  render: function() {
    return (
      <button ref='runbutton' className='run' type="button" onClick={this.handleClick}>run</button>
    );
  }
});

var Result = React.createClass({
  getInitialState: function() {
    return {messages: []};
  },
  clear: function() {
    this.setState({
      messages: []
    })
  },
  append: function(x) {
    var messages = this.state.messages.slice();
    messages.push(x);
    console.log(messages.join(','));
    this.setState({
      messages: messages
    });
  },
  render: function() {
    var ps = this.state.messages.map(function(x,i) { return (<p key={i}>{x}</p>) });
    return (
      <div>
          {ps}
      </div>);
  }
});

var CodeEditor = React.createClass({
  getInitialState: function() {
    return {
      code: this.props.code
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
          <RunButton ref="runbutton" input={this.refs.editor} result={this.refs.result} />
          <Result ref="result" value={this.state.result} />
      </div>
    );


  }
});

global.print = function(s,k,a,x) {

}

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
