@echo off
setlocal
cd /d "%~dp0"
if not exist "client-data" (
  echo client-data folder was not found.
  exit /b 1
)
if not exist "client-data\backups" mkdir "client-data\backups"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'; Compress-Archive -Path 'client-data\\company','client-data\\exports','client-data\\pdfs','client-data\\prices','client-data\\projects','client-data\\templates' -DestinationPath \"client-data\\backups\\client-data-$stamp.zip\" -Force"
