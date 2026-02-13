@echo off
setlocal
set PATH=%PATH%;C:\Users\03738917250\.cargo\bin

echo ========================================
echo   INICIANDO TESTE DO BUILDER (TAURI)
echo ========================================

echo [1/3] Limpando arquivos temporarios...
if exist src-tauri\target\release rmdir /s /q src-tauri\target\release
if exist out rmdir /s /q out

echo [2/3] Iniciando Build do Tauri...
echo Isso pode levar alguns minutos. O log sera salvo em log_builder_test.txt...
call npm run tauri build > log_builder_test.txt 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] O build falhou! Verifique o arquivo log_builder_test.txt para detalhes.
    exit /b %ERRORLEVEL%
)

echo [3/3] Verificando artefatos gerados...
set ARTIFACT_FOUND=0

for /r "src-tauri\target\release\bundle" %%f in (*.msi *.exe) do (
    echo [OK] Artefato encontrado: %%~nxf
    set ARTIFACT_FOUND=1
)

if %ARTIFACT_FOUND% EQU 0 (
    echo [ERRO] Build concluido, mas nenhum instalador (.msi ou .exe) foi encontrado!
    exit /b 1
)

echo ========================================
echo   TESTE DO BUILDER CONCLUIDO COM SUCESSO!
echo ========================================
pause
