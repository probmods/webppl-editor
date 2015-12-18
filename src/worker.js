var _ = require('underscore');

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


module.exports = function(self) {
  // with this approach, could try including webppl as a dependency
  // and then doing require('webppl') here
  // importScripts('webppl.js');

  var compileCache = {};

  self.onmessage = function(evt) {
    // let's call the event data the attachment
    var attachment = evt.data;

    if (typeof attachment == 'object' && attachment.type == 'init') {
      importScripts(attachment.path);
      return;
    }

    var code = attachment.code;

    if (attachment.language == 'javascript') {
      postMessage({type: 'status', status: 'running...'})
      var jsReturnValue = eval(code);
      postMessage({type: 'text',
                   done: true,
                   obj: serializeReturnValue(jsReturnValue) })
      return;
    }

    // cache results of code compilation
    // TODO: cache eviction? hashing keys?
    if (!compileCache[code]) {
      postMessage({type: 'status', status: 'compiling...'})
      compileCache[code] = webppl.compile(code, 'verbose');
    }

    var compiledCode = compileCache[code];

    // after webppl finishes, inform the main thread
    var k = function(s,x) {
      postMessage({type: 'text',
                   done: true,
                   obj: serializeReturnValue(x)});
    }

    postMessage({type: 'status', status: 'running...'})
    eval.call({}, compiledCode)({}, k, '');
  }

  print = function(s,k,a,x) {
    postMessage({type: 'text',
                 obj: x})
    return k(s)
  };

  hist = function(s,k,a, samples) {
    // compute inside hist to avoid big messages
    var frequencyDict = _(samples).countBy(function(x) { return typeof x === 'string' ? x : JSON.stringify(x) });
    var labels = _(frequencyDict).keys();
    var counts = _(frequencyDict).values();

    postMessage({type: 'barChart',
                 ivs: labels,
                 dvs: counts})
    return k(s)
  };

  barChart = function(s,k,a, ivs, dvs) {
    postMessage({type: 'barChart',
                 ivs: ivs,
                 dvs: dvs})
    return k(s)
  };

};
