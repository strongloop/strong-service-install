#!/bin/bash

cd $(dirname "${BASH_SOURCE[0]}")
source common.sh

# Setup
CMD="node ../bin/sl-svc-install.js"

assert_exit 0 $CMD -h
assert_exit 0 $CMD --help
assert_exit 0 $CMD -v
assert_exit 0 $CMD --version

assert_report
