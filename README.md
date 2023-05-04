# Webby.os

A Web based os support third-party apps and many native capabilities.

![ci status](https://github.com/hjylxmhzq/webby.os/actions/workflows/build.yml/badge.svg)

![Sample](https://raw.githubusercontent.com/hjylxmhzq/webby.os/main/docs/images/sample.png)

## Download

### Run binary

You can get the prebuilt binary from [release page](https://github.com/hjylxmhzq/webby.os/releases)

Prebuilt version currently supports Linux_x86_64 & Windows_x86_64

Source code build worflow is passed in env as follow:

- Windows_x86_64
- Windows_aarch64
- Macos_aarch64
- Linux_x86_64

### Run in Docker

A more simple way is to run webbyos in docker

[docker hub](https://hub.docker.com/r/hjylxmhzq/webbyos)

An example:

```sh
docker run -p 0.0.0.0:7002:7001 -it hjylxmhzq/webbyos
```

## Dependencies

- @webby/client: frontend client

- @webby/core: provide core capabilities

- @webby/server: backend


## Build binary from source code

1. Clone the Repository

```shell
git clone https://github.com/hjylxmhzq/webby.os.git
cd ./webby.os
```

2. Install build toolchain

```shell
bash ./build/init-env.sh
```

3. build the whole project to ./dist

```shell
bash ./build/build.sh
```

4. run

```shell
cd ./dist
./webbyos
```

### TODO

1. App Store

