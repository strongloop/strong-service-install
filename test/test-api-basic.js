var install = require('../');
var tap = require('tap');

tap.test('api shape', function(t) {
  t.type(install, 'function', 'main export is a function');
  t.end();
});
