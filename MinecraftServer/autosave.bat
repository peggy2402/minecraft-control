@echo off
title Minecraft Auto Backup
:loop
REM ---- Lệnh lưu ----
echo save-all | clip
REM ---- Gửi lệnh vào server ----
(
    echo save-all
) >> server_input.txt
timeout /t 300 >nul
goto loop
