#!/bin/bash

CMD="node ../bin/sl-svc-install.js"

. common.sh

# command given, name should be derived, should exit cleanly
assert 0 $CMD --dry-run -- ../bin/sl-svc-install.js

TMP=`mktemp -d -t sl-svc-install`
assert 1 test -d $TMP/etc/init
assert 1 test -d $TMP/home
assert 0 $CMD --cwd $TMP/home --jobFile $TMP/etc/init/test.conf -- test
assert 0 test -f $TMP/etc/init/test.conf
assert 0 test -d $TMP/home
# no arguments is an error, exit code 1
assert 1 $CMD

assert_report
