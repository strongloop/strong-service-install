#!/bin/bash

CMD="node ../bin/sl-svc-install.js"

. common.sh

# command given, name should be derived, should exit cleanly
assert_exit 0 $CMD --dry-run -- ../bin/sl-svc-install.js

TMP=`mktemp -d -t sl-svc-installXXXXXX`
assert_exit 1 test -d $TMP/etc/init
assert_exit 1 test -d $TMP/home
assert_exit 0 $CMD --cwd $TMP/home --jobFile $TMP/etc/init/test.conf -- test
# Should have written the job file at the specified path
assert_file $TMP/etc/init/test.conf
# Should have created --cwd if it didn't exist
assert_exit 0 test -d $TMP/home
# Should exit non-zero because jobfile already exists
assert_exit 1 $CMD --cwd $TMP/home --jobFile $TMP/etc/init/test.conf -- test
# Should exit cleanly because --dry-run says so
assert_exit 0 $CMD --cwd $TMP/home --jobFile $TMP/etc/init/test.conf --dry-run -- test
# no arguments is an error, exit code 1
assert_exit 1 $CMD

assert_report
