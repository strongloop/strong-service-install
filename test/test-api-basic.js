// Copyright IBM Corp. 2014,2015. All Rights Reserved.
// Node module: strong-service-install
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var install = require('../');
var tap = require('tap');

tap.test('api shape', function(t) {
  t.type(install, 'function', 'main export is a function');
  t.end();
});
