var assert = require('assert');
var util = require('util');
var path = require('path');
var fs = require('fs');

var upstartMaker = require('strong-service-upstart');
var uidNumber = require('uid-number');
var mkdirp = require('mkdirp');
var which = require('which');
var async = require('async');

module.exports = exports = install;
exports.writeFile = fs.writeFile;
exports.mkdirp = mkdirp; // could use a comment as to why, and it isn't really exported, is it? this is just an alias to give the fake one a name diff from real one?
exports.chown = fs.chown;

// I know this is an internal module, but still, this could use a comment
// describing the valid keys in opts, and what install() should have done
// when its complete. knowing the inputs and outputs, code would probably be
// easy to read.
function install(opts, cb) {
  var steps = [
    dryRunCheck,
    optionsPrecheck,
    resolveCommand,
    normalizeOptions,
    checkExistingJob,
    checkExistingUser,
    generateJob,
    ensureJobFileDir,
    ensureWorkingDir,
    writeJob,
  ];
  async.applyEachSeries(steps, opts, function(err) {
    if (err)
      return cb(err);
    else
      return cb(null, util.format('%s (%s)', opts.name, opts.jobFile));
  });
}

// please reorder functions in same order as steps
function dryRunCheck(opts, next) {
  if (opts['dry-run'] || opts.dry_run || opts.n) {
    console.log('dry-run mode');
    exports.writeFile = fakeWriteFile;
    exports.mkdirp = fakeMkdirp;
  }
  setImmediate(next);
}

function checkExistingJob(opts, next) {
  fs.exists(opts.jobFile, function(exists) {
    if (exists) {
      if (opts.force) {
        console.log('Warning: overwriting file "%s"', opts.jobFile);
      } else {
        return next(new Error('Job file "' + opts.jobFile + '" exists. Move it or re-run with --force to overwrite.'));
      }
    }
    next();
  });
}

function ensureJobFileDir(opts, cb) {
  var dir = path.dirname(opts.jobFile);
  exports.mkdirp(dir, {}, function(err, made) {
    if (!err)
      console.log('created %s...', made);
    cb(err);
  });
}

function ensureWorkingDir(opts, cb) {
  if (!opts.cwd)
    return setImmediate(cb);
  exports.mkdirp(opts.cwd, {}, function(err, made) {
    if (!err && made) {
      console.log('created %s...', made);
      uidNumber(opts.user, opts.group, function(err, uid, gid) {
        if (err)
          return cb(err);
        exports.chown(made, uid, gid, function(err) {
          cb(err);
        });
      });
    } else {
      cb(err);
    }
  });
}

function checkExistingUser(opts, next) {
  // XXX(rmg): we should do this check and create if they don't exist
  console.log('Please ensure the user "%s" and group "%s" exists',
              opts.user, opts.group);
  setImmediate(next);
}

function generateJob(opts, next) {
  upstartMaker(opts, function(err, job) {
    if (!err)
      opts.generatedJob = job;
    next(err);
  });
}

function writeJob(opts, next) {
  console.log('Writing job...');
  exports.writeFile(opts.jobFile, opts.generatedJob, {}, next);
}

// this could use a comment about what it is trying to do, I think its trying
// to find if command is in path, or if is name of .js file, but its
// particularly hard to know because in this function, I don't know what inputs
// or outputs are, opts.command came from outside this module, I think,
function resolveCommand(opts, next) {
  if (!Array.isArray(opts.command)) {
    opts.command = opts.command.split(/\s+/); // having trouble seeing where command comes from, but if there are spaces in any args this will go poorly
  }
  var local = path.resolve(opts.command[0]);
  fs.exists(local, function(exists) {
    if (exists) {
      return useExec(local, true);
    } else {
      which(opts.command[0], function(err, system) {
        if (!err)
          return useExec(system, true);
        else
          console.log('Could not resolve command:', opts.command);
        return next(err);
      });
    }
  });
  function useExec(exec, shouldShift) {
    if (!opts.execpath) {
      if (path.extname(exec) === '.js')
        opts.execpath = process.execPath;
      else {
        opts.execpath = exec;
        if (shouldShift)
          opts.command.shift();
      }
    }
    opts.script = opts.command;
    setImmediate(next);
  }
}

function normalizeOptions(opts, next) {
  if (!opts.name) {
    opts.name = path.basename(opts.script[0]);
  }

  // if sl-pm-install doesn't actually depend on this, maybe get rid of it, use
  // use substack's shellparse, or something.
  if (Array.isArray(opts.script)) {
    opts.script = opts.script.join(' ');
  }

  if (!opts.jobFile) {
    opts.jobFile = '/etc/init/' + opts.name + '.conf';
  }

  // ensure absolute path
  opts.jobFile = path.resolve(opts.jobFile);

  setImmediate(next);
}

function optionsPrecheck(opts, next) {
  var errors = [];

  if (!opts.command && !opts.name) {
    errors.push('Missing command or name');
  }

  if (errors.length > 0)
    return setImmediate(next, new Error(errors.join(', ')));
  else
    setImmediate(next);
}

function fakeMkdirp(path, opts, cb) {
  console.log('fake mkdirp(%j, %j)', path, opts);
  setImmediate(cb);
}

function fakeWriteFile(path, data, opts, cb) {
  console.log('fake fs.writeFile(%j, <data>, %j)', path, cb ? opts : {});
  setImmediate(cb);
}

function fakeChown(path, uid, gid, cb) {
  console.log('fake fs.chown(%j, %j, %j)', path, uid, gid);
  setImmediate(cb);
}
