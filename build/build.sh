#!/bin/bash

cd "$(dirname "$0")"
cd ..


rm -rf ./dist
source ./build/frontend.sh
source ./build/backend.sh

