#!/bin/bash

cd "$(dirname "$0")"
cd ..

yarn
yarn build-frontend

