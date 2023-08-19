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

- @webby/components: ui components


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

## Development

### Build entire project

```sh
yarn build
```

### Build frontend code only

```sh
yarn build-frontend
```

### Build backend code only

```sh
cd server
cargo build --release
```


## Cross compile

Build Linux executable binary on Windows/MacOS

a. Built for the same architecture as the host platform

```sh
yarn build_linux_native
```

b. Built for the Linux_x86 from other architecture (e.g. arm64 mac)

```sh
yarn build_linux_x86
```

Be aware that cross compile uses docker as virtualization layer, so you should make sure docker is available in your environment.

## TODOs

- [x] notification push
- [x] wasm ffmpeg transcode
- [x] virtual scrollbar component