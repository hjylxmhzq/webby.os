#!/bin/bash

cd "$(dirname "$0")"
cd ..

rm -rf /temp_app
mkdir /temp_app

git clone . /temp_app
cd /temp_app

source ./build/init-env.sh
source ./build/build.sh
mkdir /app/${1}
cp dist/webbyos /app/${1}/webbyos
