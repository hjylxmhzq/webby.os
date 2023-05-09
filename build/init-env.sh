#!/bin/bash

cd "$(dirname "$0")"
cd ..

# use yarn v3
corepack enable
corepack prepare yarn@stable --activate
