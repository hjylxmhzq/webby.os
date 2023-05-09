#!/bin/bash

cd "$(dirname "$0")"
cd ..

rm -rf /temp_app
mkdir /temp_app

git clone . /temp_app
cd /temp_app

source ./build/init-env.sh
source ./build/build.sh
cp dist/webbyos /app/dist/cross_webbyos
