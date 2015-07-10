#!/bin/bash

cd $(dirname "${BASH_SOURCE[0]}")
source common.sh

# Setup
CMD="node ../bin/sl-svc-install.js"
TMP=`mktemp -d -t sl-svc-installXXXXXX`
CURRENT_USER=`id -un`
CURRENT_GROUP=`id -gn`
comment "using tmpdir: $TMP"

export SL_INSTALL_IGNORE_PLATFORM=true

# command given, name should be derived, should exit cleanly
assert_exit 0 $CMD --dry-run -- ../bin/sl-svc-install.js
assert_exit 1 test -d $TMP/etc/init
assert_exit 1 test -d $TMP/home
assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test.conf -- test
# Should have written the job file at the specified path
assert_file $TMP/etc/init/test.conf
# Should have created --cwd if it didn't exist
assert_exit 0 test -d $TMP/home
# Should exit non-zero because jobfile already exists
assert_exit 1 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test.conf -- test
# Should exit cleanly because --dry-run says so
assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test.conf --dry-run -- test

# Should exit cleanly because --force says so
assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test.conf --force -- test

assert_exit 0 $CMD --user not-a-user --group not-a-group --cwd $TMP/home --jobFile $TMP/etc/init/test.conf --dry-run -- test
assert_exit 0 $CMD --user not-a-user --group not-a-group --cwd $TMP/home --dry-run -- test
# no arguments is an error, exit code 1
assert_exit 1 $CMD

assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test-0.6.conf --upstart 0.6 -- cat
# Upstart 0.6 template uses su because setuid & setgid aren't supported
assert_file $TMP/etc/init/test-0.6.conf "exec su -m -s"
assert_file $TMP/etc/init/test-0.6.conf "$CURRENT_USER --"

# Upstart 0.6 template uses logger because console log isn't supported
assert_file $TMP/etc/init/test-0.6.conf "mkfifo /tmp/cat-log-fifo"
assert_file $TMP/etc/init/test-0.6.conf "logger -t cat"

assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/init/test-1.4.conf --upstart 1.4 -- cat
assert_file $TMP/etc/init/test-1.4.conf "exec $(which cat)"

assert_file $TMP/etc/init/test-1.4.conf "setuid $CURRENT_USER"
assert_file $TMP/etc/init/test-1.4.conf "setgid $CURRENT_GROUP"

unset SL_PM_INSTALL_IGNORE_PLATFORM

assert_report
