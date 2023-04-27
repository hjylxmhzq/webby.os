# Webby.os

A Web based os support third-party apps and many native capabilities.

![ci status](https://github.com/hjylxmhzq/webby.os/actions/workflows/build.yml/badge.svg)

![Sample](https://raw.githubusercontent.com/hjylxmhzq/webby.os/main/docs/images/sample.png)

## Download

You can get the prebuilt binary from [release page](https://github.com/hjylxmhzq/webby.os/releases)

currently support Linux_x86_64 & Windows_x86_64

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

