importScripts('webppl.js')

onmessage = function(evt) {
  var code = evt.data;

  postMessage({type: 'status', status: 'compiling...'})
  var compiledCode = webppl.compile(code);

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
  postMessage({type: 'hist',
               samples: samples})
  return k(s)
};
