// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-service-install
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';

var _ = require('lodash');
var async = require('async');
var child_process = require('child_process');
var chownr = require('chownr');
var debug = require('debug')('strong-service-installer');
var fmt = require('util').format;
var fs = require('fs');
var mkdirp = require('mkdirp');
var passwd = require('./lib/passwd');
var path = require('path');
var shell = require('shell-quote');
var systemdMaker = require('strong-service-systemd');
var uidNumber = require('uid-number');
var upstartMaker = require('strong-service-upstart');
var which = require('which');

module.exports = install;
install.log = console.log;
install.error = console.error;
install.platform = process.platform;
install.$0 = process.env.CMD || path.basename(process.argv[1]);
install.execPath = process.execPath;
install.ignorePlatform = process.env.SL_INSTALL_IGNORE_PLATFORM;

function install(opts, cb) {
  var steps = [
    dryRunCheck,
    optionsPrecheck,
    resolveCommand,
    normalizeOptions,
    checkExistingJob,
    ensureJobFileDir,
    ifUser(ensureUser),
    ifUser(fillInGroup),
    ifUser(fillInHome),
    ifUser(ensureGroup),
    ifUser(resolveIds),
    ensureDirectories,
    opts.preWrite || noop,
    ifUser(ensureOwnership),
    generateJob,
    writeJob,
  ].map(logCall);
  async.applyEachSeries(steps, opts, function(err) {
    if (err)
      return cb(err);
    install.log('Service %s installed (%s)', opts.name, opts.jobFile);
    cb(null, fmt('%s (%s)', opts.name, opts.jobFile));
  });

  function logCall(fn) {
    return wrapped;

    function wrapped(opts, cb) {
      debug('enter %s', fn.name);
      fn(opts, function(err) {
        debug('exit %s (%s)', fn.name, err && err.message);
        cb.apply(this, arguments);
      });
    }
  }
}

function dryRunCheck(opts, next) {
  if (opts['dry-run'] || opts.dryRun || opts.n) {
    opts.dryRun = true;
    install.log('dry-run mode');
    opts.writeFile = opts.writeFile || fakeWriteFile;
    opts.mkdirp = opts.mkdirp || fakeMkdirp;
    opts.chown = opts.chown || fakeChown;
    opts.chownr = opts.chownr || fakeChown;
  } else {
    opts.dryRun = false;
    opts.writeFile = opts.writeFile || fs.writeFile;
    opts.mkdirp = opts.mkdirp || mkdirp;
    opts.chown = opts.chown || fs.chown;
    opts.chownr = opts.chownr || chownr;
  }
  opts.passwd = passwd;
  setImmediate(next);
}

function optionsPrecheck(opts, next) {
  var errors = [];

  if (!opts.command && !opts.name) {
    errors.push('Missing command or name');
  }

  if (install.platform !== 'linux') {
    install.error('%s: only Upstart on Linux is supported',
                  install.ignorePlatform ? 'Warning' : 'Error');
    if (!install.ignorePlatform)
      errors.push('Unsupported platform');
  }

  if (!opts.systemd && !opts.upstart) {
    opts.upstart = '1.4'; // default
  } else if (opts.systemd && opts.upstart) {
    install.error(
      'Invalid usage (cannot specify both --systemd and --upstart)' +
      ', see `%s --help`', install.$0);
    errors.push('Cannot specify both systemd and Upstart');
  }
  opts.upstart = String(opts.upstart);
  if (!opts.systemd && opts.upstart !== '0.6' && opts.upstart !== '1.4') {
    install.error('Invalid usage (only upstart "0.6" and "1.4" supported)' +
                  ', see `%s --help`', install.$0);
    errors.push('Invalid upstart target (only 0.6 and 1.4 are supported)');
  }

  if (opts.systemd) {
    opts.generator = systemdMaker;
  } else {
    opts.generator = upstartMaker;
  }
  if (opts.upstart) {
    opts.version = opts.upstart;
    delete opts.upstart;
  }

  if (opts.execPath) {
    opts.execpath = opts.execPath;
    delete opts.execPath;
  }

  if (errors.length > 0)
    return setImmediate(next, new Error(errors.join(', ')));
  else
    setImmediate(next);
}

// Split a command string into it's base components for strong-service-upstart
// command './bin/myapp.js --flag --two 2'
//  -> execPath: '/path/to/node'
//  -> script: ['/path/to/bin/myapp.js', '--flag', '--two', '2']
// command 'global-cmd sub-cmd --flag --two 2'
//  -> execPath: '/path/to/global-cmd' (resolved from $PATH)
//  -> script: ['sub-cmd', '--flag', '--two', '2']
function resolveCommand(opts, next) {

  // If opts.command is given by CLI it is most certainly a string
  if (!Array.isArray(opts.command)) {
    opts.command = shell.parse(opts.command);
  }

  which(opts.command[0], function(err, fromPath) {
    if (err)
      return maybeLocal();
    if (!opts.execpath) {
      // exec + script = command
      opts.execpath = fromPath;
      opts.script = opts.command.slice(1);
    }
    return next();
  });

  function maybeLocal() {
    var local = path.resolve(opts.command[0]);
    fs.exists(local, function(exists) {
      if (exists) {
        // exec + script = node + expanded path + args
        opts.execpath = opts.execpath || install.execPath;
        opts.script = [local].concat(opts.command.slice(1));
      } else {
        return next(new Error('Could not resolve command:', opts.command));
      }
    });
  }
}

function normalizeOptions(opts, next) {
  if (!opts.name) {
    opts.name = path.basename(opts.script[0] || opts.execpath);
  }

  // strong-service-upstart requires a string for script
  if (Array.isArray(opts.script)) {
    opts.script = shell.quote(opts.script);
  }

  if (!opts.jobFile) {
    if (opts.generator === systemdMaker) {
      opts.jobFile = '/etc/systemd/system/' + opts.name + '.service';
    } else if (opts.generator === upstartMaker) {
      opts.jobFile = '/etc/init/' + opts.name + '.conf';
    } else {
      return next(new Error('Unknown init type, no path given'));
    }
  }

  opts.user = opts.user || 'nobody';
  opts.groups = [].concat(opts.groups);

  if (!opts.dirs) {
    opts.dirs = [];
  }
  if (opts.cwd) {
    opts.dirs.push(opts.cwd);
  }
  opts.dirs = _.uniq(opts.dirs);

  // ensure absolute path
  opts.jobFile = path.resolve(opts.jobFile);

  setImmediate(next);
}


function checkExistingJob(opts, next) {
  fs.exists(opts.jobFile, function(exists) {
    if (exists) {
      if (opts.force) {
        install.log('Warning: overwriting file "%s"', opts.jobFile);
      } else if (opts.dryRun) {
        install.log('Warning: install would fail because %j already exists',
                    opts.jobFile);
      } else {
        var message = fmt('File "%s" exists. Remove it or re-run with --force',
                          opts.jobFile);
        return next(Error(message));
      }
    }
    next();
  });
}

function generateJob(opts, next) {
  opts.generator(opts, function(err, job) {
    if (!err)
      opts.generatedJob = job;
    next(err);
  });
}

function ensureJobFileDir(opts, cb) {
  var dir = path.dirname(opts.jobFile);
  opts.mkdirp(dir, {}, function(err, made) {
    if (!err && made)
      install.log('created %s...', made);
    cb(err);
  });
}

function ensureUser(opts, callback) {
  userExists(opts.user, function(err, exists) {
    if (err || exists)
      return callback(err);
    if (opts.dryRun) {
      install.log('skipping user creation in dry-run');
      return callback();
    }
    if (install.platform !== 'linux') {
      install.log('skipping user creation on non-Linux platform');
      return callback();
    }
    opts.home = '/var/lib/' + opts.user;
    useradd(opts.user, opts.home, opts.groups, callback);
  });
}

function useradd(name, home, groups, callback) {
  var cmd = '/usr/sbin/useradd';
  var args = [
    '--home', home,
    '--shell', '/bin/false',
    '--skel', '/dev/null',
    '--create-home', '--user-group', '--system',
  ];
  if (groups.length > 0) {
    args.push('-G');
    args.push(groups.join(','));
  }
  args.push(name);
  child_process.execFile(cmd, args, function(err, stdout, stderr) {
    if (err) {
      install.error('Error adding user %s:\n%s\n%s',
                    name, stdout, stderr);
    }
    callback(err);
  });
}

function userExists(name, callback) {
  var cmd = '/usr/bin/id';
  var args = [name];
  child_process.execFile(cmd, args, function(err) {
    callback(null, !err);
  });
}

function fillInGroup(opts, callback) {
  var cmd = '/usr/bin/id';
  var args = ['-gn', opts.user];
  if (opts.group) {
    return setImmediate(callback);
  }
  child_process.execFile(cmd, args, function(err, stdout) {
    if (err) {
      install.error('Could not determine group for service user \'%s\': %s',
                    opts.user, err.message);
    } else {
      opts.userGroup = stdout.trim();
      opts.group = opts.group || opts.userGroup;
    }
    callback(err);
  });
}

function ensureGroup(opts, callback) {
  userInRequiredGroup(opts.user, opts.group, function(err, present) {
    if (err || present) {
      if (opts.dryRun) {
        err = null;
      }
      return callback(err);
    }
    if (opts.dryRun) {
      install.log('skipping user modification in dry-run');
      return callback();
    }
    if (install.platform !== 'linux') {
      install.log('skipping user modification on non-Linux platform');
      return callback();
    }
    addUserToGroup(opts.user, opts.group, callback);
  });
}

function userInRequiredGroup(user, group, callback) {
  var cmd = '/usr/bin/id';
  var args = ['-Gn', user];
  child_process.execFile(cmd, args, function(err, stdout) {
    var groups = [];
    if (err) {
      install.error('Could not determine groups for service user \'%s\': %s',
                    user, err.message);
    } else {
      groups = stdout.trim().split(/\s+/);
    }
    callback(err, _.includes(groups, group));
  });
}

function addUserToGroup(user, group, callback) {
  var cmd = '/usr/sbin/usermod';
  var args = [
    '--append',
    '--groups', group,
    user,
  ];
  child_process.execFile(cmd, args, function(err, stdout, stderr) {
    if (err) {
      install.error('Error adding user %s to group %s:\n%s\n%s',
                    user, group, stdout, stderr);
    }
    callback(err);
  });
}

function fillInHome(opts, callback) {
  return opts.passwd(opts.user, function(err, user) {
    if (err) {
      install.error('Could not determine $HOME of \'%s\':',
                    opts.user, err.message);
    }
    if (!err) {
      opts.env = opts.env || {};
      opts.env.HOME = user && user.homedir || process.env.HOME;
      opts.cwd = opts.cwd || opts.env.HOME;
      opts.dirs.push(opts.cwd);
    }
    if (opts.dryRun) {
      err = null;
    }
    callback(err);
  });
}

function resolveIds(opts, callback) {
  if (opts.dryRun) {
    install.log('skipping uid resolution in dry-run');
    return setImmediate(callback);
  }
  uidNumber(opts.user, opts.userGroup, function(err, uid, gid) {
    if (err) {
      install.error('Error getting numeric uid/gid of %s/%s: %s',
                    opts.user, opts.userGroup, err.message);
      return callback(err);
    }
    opts._userId = uid;
    opts._groupId = gid;
    callback();
  });
}

function ensureDirectories(opts, cb) {
  return async.eachSeries(opts.dirs, ensureDir, cb);

  function ensureDir(dir, next) {
    if (!dir) {
      return next();
    }
    opts.mkdirp(dir, {}, function(err, made) {
      if (!err && made) {
        install.log('created %s...', made);
        uidNumber(opts.user, opts.group, function(err, uid, gid) {
          if (err)
            return next(err);
          opts.chown(made, uid, gid, function(err) {
            next(err);
          });
        });
      } else {
        next(err);
      }
    });
  }
}

function ensureOwnership(opts, callback) {
  var tasks = [].concat(
    // non-recusive for anything we are told about, since they may have already
    // existed (like $HOME for an existing user, with lots of files in it)
    _(opts.dirs || []).compact().uniq().map(makeChownTask).value(),

    // recursive for everything we created, since we use mkdirp to create them
    _(opts._touched || []).compact().uniq().map(makeChownRTask).value()
  );

  return async.parallel(tasks, callback);

  function makeChownTask(dir) {
    return chown;
    function chown(next) {
      opts.chown(dir, opts._userId, opts._groupId, next);
    }
  }

  function makeChownRTask(dir) {
    return chownr;
    function chownr(next) {
      opts.chownr(dir, opts._userId, opts._groupId, next);
    }
  }
}

function ifUser(fn) {
  return ifUserWrap;

  function ifUserWrap(opts, next) {
    if (opts.user) {
      return fn(opts, next);
    }
    return setImmediate(next);
  }
}

function noop(opts, next) {
  return setImmediate(next);
}

function writeJob(opts, next) {
  install.log('Writing job...');
  opts.writeFile(opts.jobFile, opts.generatedJob, {}, next);
}

function fakeMkdirp(path, opts, cb) {
  debug('fake mkdirp(%j, %j)', path, opts);
  setImmediate(cb);
}

function fakeWriteFile(path, data, opts, cb) {
  debug('fake fs.writeFile(%j, <data>, %j)', path, cb ? opts : {});
  setImmediate(cb);
}

function fakeChown(path, uid, gid, cb) {
  debug('fake fs.chown(%j, %j, %j)', path, uid, gid);
  setImmediate(cb);
}
