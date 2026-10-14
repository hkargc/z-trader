@echo off
:: 强制让当前命令行窗口使用 UTF-8 编码，防止中文提示乱码
chcp 65001 >nul
cls

echo ==========================================
echo    Z-Trader 自动编译脚本
echo ==========================================

:: 1. 执行编译
echo [1/1] 正在生成 exe 程序...
:: -s -w 压缩体积
go clean -cache
go build -ldflags="-s -w" -o z-trader.exe main.go

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo 编译成功！生成文件: z-trader.exe
    echo ==========================================
) else (
    echo.
    echo [失败] 编译过程中出现错误，请检查代码或环境。
)

pause
