@echo off
rem Lance LaTeX Home Edition dans le navigateur
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  start "LaTeX Home Edition - serveur" /min node server.js
  timeout /t 1 /nobreak >nul
  start "" http://localhost:8765
) else (
  start "" "%~dp0index.html"
)
