#!/bin/bash
cd /Users/zhuhangcheng/Downloads/好玩/deckrogue

echo "=========================================="
echo "DeckRogue 战斗胜利跳转验证测试"
echo "=========================================="

# 检查服务器是否运行
if ! curl -s --max-time 3 http://127.0.0.1:3001 > /dev/null 2>&1; then
    echo "错误: 服务器未运行于 http://127.0.0.1:3001"
    echo "请先启动服务器: npm run dev"
    exit 1
fi

echo "服务器连接正常"
echo ""

# 运行测试
echo "启动 Playwright 测试..."
npx tsx scripts/validation/dogfood_victory_flow.ts

echo ""
echo "=========================================="
echo "测试完成，请查看报告"
echo "报告位置: dogfood-output/report.md"
echo "截图位置: dogfood-output/screenshots/"
echo "=========================================="
