@echo off
set PATH=%PATH%;C:\Users\03738917250\.cargo\bin
cd src-tauri
echo Verificando codigo Rust...
cargo build --release
