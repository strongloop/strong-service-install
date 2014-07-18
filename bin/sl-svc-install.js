#!/usr/bin/env node

var minimist = require('minimist');
var install = require('../');

var opts = minimist(process.argv.slice(2));

if (!opts.command) {
  if (opts._.length > 0)
    opts.command = opts._;
  delete opts._;
}

install(opts, function(err, result) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  }
});
