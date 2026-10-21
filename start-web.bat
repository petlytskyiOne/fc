@echo off
chcp 65001 >nul
title Картки НКЦПФР — веб
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [Помилка] Node.js не знайдено. Встановіть його з https://nodejs.org і запустіть файл ще раз.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Встановлюю залежності, це може зайняти кілька хвилин...
  call npm install
  if errorlevel 1 (
    echo [Помилка] Не вдалося встановити залежності.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo [Увага] Немає файлу .env — застосунок покаже екран налаштування.
  echo Скопіюйте .env.example у .env і впишіть параметри Firebase ^(див. README.md^).
  echo.
)

echo Запускаю застосунок. Браузер відкриється автоматично: http://localhost:5173
echo Щоб зупинити, закрийте це вікно або натисніть Ctrl+C.
echo.
call npm run dev -- --open --port 5173
pause
