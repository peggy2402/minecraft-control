@echo off
title 🌍 Minecraft Auto Save - TRẦN VĂN CHIẾN
color 0A

setlocal ENABLEDELAYEDEXPANSION

echo.
echo ===========================================
echo    TRINH TU DONG LUU SERVER MINECRAFT
echo    Gui lenh /save-all moi 5 phut ( 300s )
echo    \File target: server-input.txt
echo ===========================================
echo.

set /a counter=1

:loop
echo [!counter!] Dang gui lenh save-all vao server_input.txt
echo save-all > server_input.txt

REM Hiển thị thời gian hiện tại
for /f "tokens=1-2 delims= " %%a in ("%date% %time%") do set datetime=%%a %%b
echo Thoi gian: !datetime!

REM Tăng số lần đếm
set /a counter+=1

REM Chờ 5 phút (300 giây)
timeout /t 300 >nul

goto loop
