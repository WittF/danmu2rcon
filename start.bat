@echo off
title Danmu2RCON 弹幕转RCON系统
echo =====================================
echo 🎮 Danmu2RCON 弹幕转RCON系统 启动中...
echo =====================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到Node.js
    echo 📥 请先下载并安装Node.js: https://nodejs.org/
    echo ⚠️  建议安装LTS版本 ^(16.0+^)
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js检测成功
echo 📦 正在检查依赖包...

:: 检查node_modules是否存在
if not exist node_modules (
    echo 📥 首次运行，正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖包安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖包安装完成
) else (
    echo ✅ 依赖包检查通过
)

echo.
echo 🚀 启动系统...
echo 📱 Web管理界面: http://localhost:3000
echo 🌉 Event Bridge: ws://localhost:9696
echo.
echo ⚠️  启动后请不要关闭此窗口
echo 💡 按 Ctrl+C 可安全停止系统
echo =====================================
echo.

:: 启动主程序
node index.js

:: 如果程序意外退出，等待用户操作
echo.
echo =====================================
echo ⚠️  系统已停止运行
echo 📝 如果遇到问题，请检查上方的错误信息
echo 🔄 关闭窗口或按任意键退出
echo =====================================
pause >nul 