@echo off
title 自动创建版本标签 - Danmu2RCON
color 0A
echo =====================================
echo 🏷️  Danmu2RCON 版本标签创建工具
echo =====================================
echo.

:: 检查Git是否可用
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到Git
    echo 📥 请先安装Git: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

:: 检查是否在Git仓库中
git status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 当前目录不是Git仓库
    echo 💡 请在项目根目录运行此脚本
    echo.
    pause
    exit /b 1
)

echo ✅ Git环境检查通过
echo.

:: 获取当前分支
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%i
echo 📍 当前分支: %CURRENT_BRANCH%

:: 检查是否在main分支
if not "%CURRENT_BRANCH%"=="main" (
    echo ⚠️  警告: 当前不在main分支
    echo 💡 建议在main分支创建正式版本标签
    set /p CONTINUE="是否继续？(y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo 操作已取消
        pause
        exit /b 0
    )
)

:: 检查工作区状态
git diff-index --quiet HEAD --
if %errorlevel% neq 0 (
    echo ⚠️  警告: 工作区有未提交的更改
    echo 📝 未提交的文件:
    git status --porcelain
    echo.
    set /p CONTINUE="是否继续？(y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo 操作已取消
        pause
        exit /b 0
    )
)

:: 拉取最新代码
echo 🔄 拉取最新代码...
git pull origin %CURRENT_BRANCH%
if %errorlevel% neq 0 (
    echo ❌ 拉取代码失败，请检查网络连接和权限
    pause
    exit /b 1
)

echo.
echo 📋 现有标签:
git tag -l --sort=-version:refname | head -10
echo.

:: 获取版本号
:INPUT_VERSION
set /p VERSION="请输入新版本号 (格式: 1.0.0): "
if "%VERSION%"=="" (
    echo ❌ 版本号不能为空
    goto INPUT_VERSION
)

:: 验证版本号格式
echo %VERSION% | findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if %errorlevel% neq 0 (
    echo ❌ 版本号格式不正确，请使用语义版本格式 (如: 1.0.0)
    goto INPUT_VERSION
)

set TAG_NAME=v%VERSION%

:: 检查标签是否已存在
git rev-parse %TAG_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ 标签 %TAG_NAME% 已存在
    echo 📋 现有标签:
    git tag -l | findstr %VERSION%
    goto INPUT_VERSION
)

:: 获取标签描述
echo.
echo 📝 请输入版本描述 (可选，直接回车跳过):
set /p TAG_MESSAGE=""

:: 确认信息
echo.
echo =====================================
echo 📋 发布信息确认
echo =====================================
echo 🏷️  标签名称: %TAG_NAME%
echo 📝 版本描述: %TAG_MESSAGE%
echo 🌿 当前分支: %CURRENT_BRANCH%
echo 📅 创建时间: %DATE% %TIME%
echo =====================================
echo.

set /p CONFIRM="确认创建并推送标签？(y/N): "
if /i not "%CONFIRM%"=="y" (
    echo 操作已取消
    pause
    exit /b 0
)

:: 创建标签
echo.
echo 🏷️  创建标签 %TAG_NAME%...
if "%TAG_MESSAGE%"=="" (
    git tag %TAG_NAME%
) else (
    git tag -a %TAG_NAME% -m "%TAG_MESSAGE%"
)

if %errorlevel% neq 0 (
    echo ❌ 创建标签失败
    pause
    exit /b 1
)

echo ✅ 标签创建成功

:: 推送标签
echo 📤 推送标签到远程仓库...
git push origin %TAG_NAME%

if %errorlevel% neq 0 (
    echo ❌ 推送标签失败
    echo 💡 您可以稍后手动推送: git push origin %TAG_NAME%
    pause
    exit /b 1
)

echo.
echo =====================================
echo 🎉 版本标签创建成功！
echo =====================================
echo 🏷️  标签: %TAG_NAME%
echo 📤 已推送到远程仓库
echo.
echo 🔗 相关链接:
echo   - GitHub Actions: https://github.com/WittF/danmu2rcon/actions
echo   - 发布页面: https://github.com/WittF/danmu2rcon/releases
echo.
echo 📋 接下来会发生什么:
echo   1. ⚡ GitHub Actions 自动触发构建工作流
echo   2. 📦 自动创建发布包 (完整版 + 源码版)
echo   3. 🎯 创建 GitHub Release
echo   4. 🌐 上传到 WebDAV 服务器
echo   5. 📧 发送发布通知
echo.
echo 💡 提示: 请访问 Actions 页面查看构建进度
echo ⏰ 整个发布过程通常需要 3-5 分钟
echo =====================================
echo.

:: 询问是否打开浏览器
set /p OPEN_BROWSER="是否打开 GitHub Actions 页面？(y/N): "
if /i "%OPEN_BROWSER%"=="y" (
    start https://github.com/WittF/danmu2rcon/actions
)

echo.
echo ✨ 感谢您的使用！
echo 🎮 祝您的 Minecraft 直播更加精彩！
echo.
pause 