#!/bin/bash

cd $(dirname "${BASH_SOURCE[0]}")
source common.sh

# Setup
CMD="node ../bin/sl-svc-install.js --systemd"
TMP=`mktemp -d -t sl-svc-installXXXXXX`
CURRENT_USER=`id -un`
CURRENT_GROUP=`id -gn`
comment "using tmpdir: $TMP"

export SL_INSTALL_IGNORE_PLATFORM=true

# command given, name should be derived, should exit cleanly
assert_exit 0 $CMD --dry-run -- ../bin/sl-svc-install.js

# ensure that directories don't exist before creating the service
assert_exit 1 test -d $TMP/etc/systemd/system
assert_exit 1 test -d $TMP/home
assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/systemd/system/cat.service -- cat

# Simple lines that should be in the service file for this config
assert_file $TMP/etc/systemd/system/cat.service "ExecStart=$(which cat)"
assert_file $TMP/etc/systemd/system/cat.service "WorkingDirectory=$TMP/home"
assert_file $TMP/etc/systemd/system/cat.service "Description=A node app"
assert_file $TMP/etc/systemd/system/cat.service "User=$CURRENT_USER"
assert_file $TMP/etc/systemd/system/cat.service "Group=$CURRENT_GROUP"

# Should have created --cwd if it didn't exist
assert_exit 0 test -d $TMP/home
# Should exit non-zero because jobfile already exists
assert_exit 1 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/systemd/system/cat.service -- cat
# Should exit cleanly because --dry-run says so
assert_exit 0 $CMD --user $CURRENT_USER --group $CURRENT_GROUP --cwd $TMP/home --jobFile $TMP/etc/systemd/system/cat.service --dry-run -- cat

assert_exit 0 $CMD --user not-a-user --group not-a-group --cwd $TMP/home --jobFile $TMP/dry-run.service --dry-run -- test
assert_exit 0 $CMD --user not-a-user --group not-a-group --cwd $TMP/home --dry-run -- test

# no arguments is an error, exit code 1
assert_exit 1 $CMD

unset SL_INSTALL_IGNORE_PLATFORM

assert_report
