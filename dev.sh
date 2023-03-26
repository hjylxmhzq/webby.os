cd server
export RUSTUP_DIST_SERVER=https://mirrors.ustc.edu.cn/rust-static
export RUSTUP_UPDATE_ROOT=https://mirrors.ustc.edu.cn/rust-static/rustup
cargo install --path .
cargo install diesel_cli --no-default-features --features sqlite
cargo install cargo-watch
cd ../
sh ./init_db.sh
cd server
cargo watch -x run
