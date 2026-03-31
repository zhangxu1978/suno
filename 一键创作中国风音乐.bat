@echo off
chcp 65001 >nul
title Suno 中国风音乐一键创作

echo.
echo  ╔════════════════════════════════════╗
echo  ║    🎵 Suno 中国风音乐一键创作     ║
echo  ╚════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: 检查 Node.js 是否安装
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查依赖是否安装
if not exist "node_modules\puppeteer" (
    echo [提示] 正在安装依赖...
    set PUPPETEER_SKIP_DOWNLOAD=true
    npm install puppeteer
)

echo [信息] 正在启动自动化脚本...
echo [信息] 请确保 Chrome 已以调试模式运行 (端口 48840)
echo.

node suno-create.js

echo.
echo [完成] 脚本执行结束，请查看浏览器中的创作进度
pause
