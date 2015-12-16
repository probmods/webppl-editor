var _ = require('underscore');

module.exports = function(self) {
  // with this approach, could try including webppl as a dependency
  // and then doing require('webppl') here
  // importScripts('webppl.js');

  var compileCache = {};

  self.onmessage = function(evt) {
    var data = evt.data;

    if (typeof data == 'object' || data.type == 'init') {
      importScripts(data.path);
      return;
    }

    // cache results of code compilation
    // TODO: cache eviction? hashing keys?
    if (!compileCache[data]) {
      postMessage({type: 'status', status: 'compiling...'})
      compileCache[data] = webppl.compile(data, 'verbose');
    }

    var compiledCode = compileCache[data];

    var k = function(s,x) {
      postMessage({type: 'text',
                   done: true,
                   obj: x});
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
