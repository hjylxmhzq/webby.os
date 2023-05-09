#!/bin/bash

cd "$(dirname "$0")"
cd ..

container_name=build_env_native
image_name=build_env_native

docker build --tag $image_name - < ./docker/build-env.native.dockerfile

# if [ "$(docker ps -a -q -f name=$container_name)" ]; then
#     docker start $container_name
# fi

docker run --rm --name $container_name -v $(pwd):/app -it $image_name /bin/bash -c "bash /app/build/build-in-docker.sh native"
