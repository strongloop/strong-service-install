#!/bin/sh

if ! which vagrant; then
  echo "ok # skip vagrant tests, vagrant not found"
  echo "no vagrant" >&2
  exit
fi

if test -n "$SKIP_VAGRANT"; then
  echo "ok # skip vagrant tests, disabled with SKIP_VAGRANT"
  echo "skip vagrant" >&2
  exit
fi

NODE_VERSION=0.10.33
export NODE_TGZ="node-v$NODE_VERSION-linux-x64.tar.gz"

if ! test -f $NODE_TGZ; then
  curl http://nodejs.org/dist/v$NODE_VERSION/$NODE_TGZ > $NODE_TGZ
fi

export PKG=$(npm pack ..)

vagrant destroy --force ubuntu centos6 centos7 >&2
vagrant up --provision --parallel ubuntu centos6 centos7 >&2

FAIL=0

if curl -sI 'http://127.0.0.1:10001/foo/bar?baz=quux' >&2; then
  echo 'ok # Upstart 1.4 on Ubuntu 12.04'
else
  echo 'not ok # Upstart 1.4 on Ubuntu 12.04 failed'
  export FAIL=1
fi

if curl -sI 'http://127.0.0.1:10002/foo/bar?baz=quux' >&2; then
  echo 'ok # Upstart 0.6 on CentOS 6.5'
else
  echo 'not ok # Upstart 0.6 on CentOS 6 failed'
  export FAIL=1
fi

if curl -sI 'http://127.0.0.1:10003/foo/bar?baz=quux' >&2; then
  echo 'ok # systemd on CentOS 7'
else
  echo 'not ok # systemd on CentOS 7 failed'
  export FAIL=1
fi

exit $FAIL
