#!/usr/bin/env node

var g = require('strong-globalize');
var install = require('../');
var minimist = require('minimist');
var path = require('path');

var opts = minimist(process.argv.slice(2));

if (!opts.command && opts._.length > 0) {
  opts.command = opts._;
}
delete opts._;

if (opts.help || opts.h) {
  g.log('sl-service-install.txt', process.argv[1]);
  process.exit(0);
}

if (opts.version || opts.v) {
  console.log(require('../package.json').version);
  process.exit(0);
}

g.setRootDir(path.resolve(__dirname));

install(opts, function(err) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  }
});
