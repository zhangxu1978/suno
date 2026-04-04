@echo off
echo 🎵 启动 Suno 歌曲管理系统服务器...
echo.

REM 检查是否已安装 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 启动服务器
node server.js

pause