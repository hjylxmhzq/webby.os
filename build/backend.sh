#!/bin/bash

cd "$(dirname "$0")"
cd ../server

cargo build --release
mkdir ../dist
mkdir ../dist/files
cp target/release/webbyos ../dist/webbyos
cd ..
