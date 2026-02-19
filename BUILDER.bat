@echo off
setlocal
set PATH=%PATH%;C:\Users\03738917250\.cargo\bin

title Projection Church - Builder Pro

echo ========================================
echo   INICIANDO SISTEMA DE BUILD (PRO)
echo ========================================

node BUILDER.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Ocorreu um problema durante o build.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo   PROCESSO CONCLUIDO!
echo ========================================
pause
