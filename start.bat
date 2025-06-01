@echo off
chcp 65001 > nul
title Danmu2RCON 弹幕转RCON系统
color 0A

echo =====================================
echo 🎮 Danmu2RCON 弹幕转RCON系统 启动中...
echo =====================================
echo.

:: 检查端口占用
set "PORT_FOUND=0"
for /f "tokens=2" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000"') do (
    set "PORT_FOUND=1"
)

if "%PORT_FOUND%"=="1" (
    echo ❌ 错误: 端口 3000 已被占用
    echo 💡 请尝试以下操作:
    echo   1. 关闭占用端口的程序
    echo   2. 修改配置文件中的端口
    echo.
    echo 📝 要修改端口，请编辑 config.js 文件
    echo   将 webPort 的值改为其他端口号
    echo.
    pause
    exit /b 1
)

:: 检查 Node.js
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js
    echo 📥 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 检测成功

:: 检查依赖包
if not exist "node_modules" (
    echo 📦 正在安装依赖包...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖包安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖包检查通过
)

echo.
echo 🚀 启动系统...
echo 🌐 Web管理界面: http://localhost:3000
echo 🔌 Event Bridge: ws://localhost:9696
echo.
echo ⚠️  启动后请不要关闭此窗口
echo 💡 按 Ctrl+C 可以停止运行
echo =====================================
echo.

:: 启动应用
node index.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ 系统运行出错
    echo 💡 请检查上方的错误信息
    echo.
    pause
    exit /b 1
)

echo.
echo 🎮 系统已停止运行
echo 💡 关闭窗口或按任意键退出
echo =====================================
pause > nul 