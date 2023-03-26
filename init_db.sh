cargo install diesel_cli --no-default-features --features sqlite
cd server
echo "start database migration"
diesel setup
diesel migration run
echo "migration finish"