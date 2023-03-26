cd ./server
cargo build --release
mkdir ../dist
mkdir ../dist/files
cp target/release/server ../dist/filego
cd ..
