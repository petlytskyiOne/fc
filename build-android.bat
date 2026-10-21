@echo off
chcp 65001 >nul
setlocal
title Cards — збірка для Android
cd /d "%~dp0"

echo ============================================
echo   Cards: збірка APK для Android
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [Помилка] Node.js не знайдено. Встановіть його з https://nodejs.org
  goto :fail
)

where java >nul 2>nul
if errorlevel 1 (
  echo [Помилка] Java не знайдено. Потрібен JDK 21 ^(наприклад, Temurin з https://adoptium.net^).
  goto :fail
)

if "%ANDROID_HOME%"=="" if "%ANDROID_SDK_ROOT%"=="" (
  echo [Помилка] Не задано ANDROID_HOME. Встановіть Android SDK ^(Android Studio^) і вкажіть шлях у змінній ANDROID_HOME.
  goto :fail
)

if not exist ".env" (
  echo [Помилка] Немає файлу .env з параметрами Firebase. Без нього застосунок покаже лише екран налаштування.
  echo Скопіюйте .env.example у .env і заповніть ^(див. README.md^).
  goto :fail
)

if not exist "node_modules" (
  echo [  0%%] Крок 1/4: встановлюю залежності...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [  0%%] Крок 1/4: залежності вже встановлено.
)

if not exist "android" (
  echo Створюю Android-проєкт...
  call npx cap add android
  if errorlevel 1 goto :fail
)

echo [ 10%%] Крок 2/4: збираю веб-частину і синхронізую з Android...
call npm run android:sync
if errorlevel 1 goto :fail

echo [ 30%%] Крок 3/4: збираю APK. Нижче — індикатор Gradle у відсотках ^(перший раз може тривати кілька хвилин^)...
pushd android
call "%~dp0android\gradlew.bat" assembleDebug --console=rich
set "GRADLE_ERR=%errorlevel%"
popd
if not "%GRADLE_ERR%"=="0" goto :fail

set "APK=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" (
  echo [Помилка] APK не знайдено: %APK%
  goto :fail
)

echo [ 95%%] Крок 4/4: копіюю результат у папку app...
if not exist "app" mkdir "app"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%i"
rem У папці лишається тільки остання збірка
del /q "app\*.apk" 2>nul
copy /y "%APK%" "app\Cards_%STAMP%.apk" >nul

echo.
echo ============================================
echo   [100%%] Готово: app\Cards_%STAMP%.apk
echo ============================================
echo Скопіюйте цей файл на телефон і встановіть ^(дозвольте встановлення з невідомих джерел^).
start "" explorer "%~dp0app"
pause
exit /b 0

:fail
echo.
echo Збірку зупинено через помилку ^(див. повідомлення вище^).
pause
exit /b 1
