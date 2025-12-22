#!/bin/bash

# 停止脚本 - Nornir Network Management System

echo "🛑 停止 Nornir Network Management System"

# 查找并停止 uvicorn 进程
echo "查找运行中的服务进程..."
PIDS=$(
  {
    pgrep -f "uvicorn.*--app-dir backend main:app" 2>/dev/null || true
    pgrep -f "uvicorn.*backend.main:app" 2>/dev/null || true
    pgrep -f "uvicorn.*main:app" 2>/dev/null || true
  } | sort -u | tr '\n' ' '
)

if [ -n "$PIDS" ]; then
    echo "发现运行中的服务进程: $PIDS"
    echo "正在停止服务..."
    kill -TERM $PIDS 2>/dev/null || true

    # 等待进程优雅退出
    sleep 2

    # 检查进程是否还在运行
    REMAINING=$(pgrep -f "uvicorn.*backend.main:app" 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo "强制停止进程..."
        kill -KILL $REMAINING 2>/dev/null || true
    fi

    echo "✅ 服务已停止"
else
    echo "❌ 未发现运行中的服务进程"
fi

echo "🎉 停止完成"
