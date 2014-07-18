#!/bin/bash

CMD="node ../bin/sl-svc-install.js"

. common.sh

# command given, name should be derived, should exit cleanly
assert 0 $CMD --dry-run -- ../bin/sl-svc-install.js

# no arguments is an error, exit code 1
assert 1 $CMD

assert_report
