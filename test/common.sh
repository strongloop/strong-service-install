#!/bin/bash
fails=0

function assert() {
  expected="$1"
  shift
  cmd="$*"
  output=`$cmd 2>&1`
  result=$?
  if test $result -ne $expected; then
    report="exit $result not $expected, cmd: '$cmd'"
    echo "not ok # $report"
    # if test -n "$output"; then
      echo "# $report" >&2
      echo "$output" >&2
    fails=$((fails+1))
    # fi
  else
    echo ok
  fi
}

function assert_report() {
  exit $fails
}
