#!/bin/bash
cd $(dirname "${BASH_SOURCE[0]}")
source common.sh

if ! which vagrant; then
  skip "vagrant not found"
  exit
fi

if test -n "$SKIP_VAGRANT"; then
  skip "disabled with SKIP_VAGRANT"
  exit
fi

NODE_VERSION=0.10.40
NODE_TGZ="node-v$NODE_VERSION-linux-x64.tar.gz"

if ! test -f $NODE_TGZ; then
  curl http://nodejs.org/dist/v$NODE_VERSION/$NODE_TGZ > $NODE_TGZ
fi

PKG=$(npm pack ..)

comment "destroying any existing VMs..."
PKG_NAME=$PKG NODE_TGZ=$NODE_TGZ vagrant destroy --force
# vagrant destroy --force ubuntu centos6 centos7

comment "creating VMs"
PKG_NAME=$PKG NODE_TGZ=$NODE_TGZ vagrant up --parallel \
  && ok "created vagrant VMs" \
  || fail "failed to provision VMs"

curl -sI 'http://127.0.0.1:10001/foo/bar?baz=quux' >&2 \
  && ok 'Upstart 1.4 on Ubuntu 14.04' \
  || fail 'Upstart 1.4 on Ubuntu 14.04'

curl -sI 'http://127.0.0.1:10002/foo/bar?baz=quux' >&2 \
  && ok 'Upstart 0.6 on CentOS 6.5' \
  || fail 'Upstart 0.6 on CentOS 6.5'

curl -sI 'http://127.0.0.1:10003/foo/bar?baz=quux' >&2 \
  && ok 'systemd on CentOS 7' \
  || fail 'systemd on CentOS 7'

assert_report
