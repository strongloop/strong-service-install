#!/usr/bin/env node
// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-service-install
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var install = require('../');
var minimist = require('minimist');

var opts = minimist(process.argv.slice(2));

if (!opts.command && opts._.length > 0) {
  opts.command = opts._;
}
delete opts._;

if (opts.help || opts.h) {
  return usage(process.argv[1], console.log.bind(console));
}

if (opts.version || opts.v) {
  return console.log(require('../package.json').version);
}

install(opts, function(err) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  }
});

function usage($0, p) {
  p('usage: %s [options] -- <app and args>', $0);
  p('');
  p('Options:');
  p('  -h,--help        Print this message and exit.');
  p('  --name NAME      Name to use for service (default derived from app)');
  p('  --user USER      User to run service as.');
  p('  --group GROUP    Group to run service as.');
  p('  --jobFile PATH   File to create (default /etc/init/<name>.conf)');
  p('  --cwd PATH       Directory to run the service from.');
  p('  --upstart [VER]  Generate Upstart job for VER: 0.6 or 1.4 (default)');
  p('  --systemd        Generate systemd service');
}
