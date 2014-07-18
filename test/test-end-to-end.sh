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

NODE_TGZ="node-v0.10.29-linux-x64.tar.gz"

if ! test -f $NODE_TGZ; then
  wget http://nodejs.org/dist/v0.10.29/$NODE_TGZ
fi

PKG=`npm pack ..`

vagrant destroy --force
PKGNAME=$PKG NODE_TGZ=$NODE_TGZ vagrant up --provision

rm -rf loopback-example-app
git clone --quiet git@github.com:strongloop/loopback-example-app.git

(cd loopback-example-app &&
  echo "PORT=8888" > .env &&
  echo '{"restApiRoot": "/api","host": "0.0.0.0"}' > server/config.json &&
  git add .env server/config.json &&
  git commit -m "listen on port 8888" &&
  git push --quiet http://localhost:7777/repo HEAD)

echo "# waiting for strong-pm to deploy our app..."
sleep 5
vagrant ssh -- sudo cat /var/log/upstart/sl-pm.log

echo "# polling...."
sleep 5

while ! curl -sI http://localhost:8888/; do
  echo "# nothing yet, sleeping for 5s..."
  sleep 5
done
