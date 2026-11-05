#!/bin/zsh
# 用法：tools/shot.sh <输出.png> <宽> <高> [url]  —— 无头 Chrome 原尺寸截图，用于检查像素
OUT=$1; W=$2; H=$3; URL=${4:-http://localhost:5177/}
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=$W,$H --virtual-time-budget=2500 \
  --screenshot="$OUT" "$URL" >/dev/null 2>&1
