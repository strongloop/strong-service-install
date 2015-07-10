# strong-service-install

Create/install system service for a given app.

Currently only supports Upstart ([strong-service-upstart](https://github.com/strongloop/strong-service-upstart))
and systemd
([strong-service-systemd](https://github.com/strongloop/strong-service-systemd)).

## Installation

`npm install strong-service-install`

## Usage

```js
var installer = require('strong-service-install');

var opts = {
  name: 'my-app',
  author: require('package.json').author,
  user: process.env.USER,
  command: 'my-app --with args --that work',
  cwd: process.env.HOME,
};

installer(opts, function(err, result) {
  if (err) {
    console.error('Failed to install "my-app" service:', err.message);
    process.exit(1);
  } else {
    console.log('Successfully installed "my-app" service:', result);
    process.exit(0);
  }
});
```

### CLI

There is a minimal CLI that exposes the API options as arguments:
```
usage: sl-svc-install [options] -- <app and args>

Options:
  -h,--help        Print this message and exit.
  --name NAME      Name to use for service (default derived from app)
  --user USER      User to run service as.
  --group GROUP    Group to run service as.
  --jobFile PATH   Upstart file to create (default /etc/init/<name>.conf)
  --cwd PATH       Directory to run the service from.
  --upstart [VER]  Generate Upstart job for VER: 0.6 or 1.4 (default)
  --systemd        Generate systemd service
```
