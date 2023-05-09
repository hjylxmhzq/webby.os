#!/bin/bash

cd "$(dirname "$0")"
cd ..

rm -rf /temp_app
mkdir /temp_app

git clone . /temp_app
cd /temp_app

cp /app/build/.cargo-config ~/.cargo/config

source ./build/init-env.sh
source ./build/build.sh
mkdir -p /app/dist/${1}
cp dist/webbyos /app/dist/${1}/webbyos
