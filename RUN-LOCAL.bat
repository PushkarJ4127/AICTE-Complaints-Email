@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
if not exist .env (
  echo Missing .env configuration.
  echo Copy .env.example to .env and fill in the Supabase project URL and public anon/publishable key first.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
echo.
echo AICTE Dashboard: http://localhost:3000/
echo CPGRAMS Portal:  http://localhost:3000/cpgrams.html
echo Both pages use the same Supabase backend.
echo Keep this window open while testing.
echo.
call npm run dev -- --host 127.0.0.1
pause
