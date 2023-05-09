touch ./dist/config.toml
echo "host = \"0.0.0.0\"" > ./dist/config.toml
docker build -t hjylxmhzq/webbyos .
