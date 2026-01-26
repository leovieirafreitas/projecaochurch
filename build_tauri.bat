@echo off
set PATH=%PATH%;C:\Users\03738917250\.cargo\bin
cd src-tauri
cd ..
echo Iniciando Build do Tauri com Bundle...
call npm run tauri build > log_tauri_bundle.txt 2>&1
