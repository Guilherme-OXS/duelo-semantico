@echo off
title Duelo Semantico: Mais Proximo - Servidor Portatil
cd /d "%~dp0"
set "DRIVE=%~d0"
echo ========================================================
echo   DUELO SEMANTICO: MAIS PROXIMO (JOGO DE PALAVRAS)
echo   Desenvolvedor: Guilherme Otavio
echo ========================================================
echo.
if exist "%DRIVE%\Linguagens\Python\python.exe" (
    echo [+] Iniciando servidor local na porta 8080 via Python Portatil...
    start "" "http://localhost:8080"
    "%DRIVE%\Linguagens\Python\python.exe" -m http.server 8080
) else (
    echo [+] Abrindo index.html diretamente no navegador...
    start "" "%~dp0index.html"
)

