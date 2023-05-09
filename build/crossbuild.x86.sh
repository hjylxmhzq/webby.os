#!/bin/bash

cd "$(dirname "$0")"
cd ..

container_name=build_env_x86
image_name=build_env_x86

docker build --tag $image_name - < ./docker/build-env.x86.dockerfile

if [ "$(docker ps -a -q -f name=$container_name)" ]; then
    docker start $container_name
fi

if [ ! "$(docker ps -a -q -f name=$container_name)" ]; then
    docker run --name $container_name -v $(pwd):/app -it $image_name /bin/bash -c "bash /app/build/build-in-docker.sh"
fi
