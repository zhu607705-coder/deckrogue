#!/usr/bin/env python3
"""
地图图标设置脚本
从现有资源或用户提供的图片创建地图房间图标
"""

import os
import shutil
from PIL import Image

# 配置
MAP_DIR = "/Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/map"
USER_IMAGE_PATH = "/Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/map/icons_strip.png"

# 房间类型配置
ROOM_TYPES = {
    "combat": {"name": "Combat", "color": "#dc2626", "icon": "⚔️"},
    "elite": {"name": "Elite", "color": "#f59e0b", "icon": "💀"},
    "event": {"name": "Event", "color": "#a855f7", "icon": "📜"},
    "shop": {"name": "Shop", "color": "#eab308", "icon": "💰"},
    "rest": {"name": "Rest", "color": "#f97316", "icon": "🔥"},
    "boss": {"name": "Boss", "color": "#b91c1c", "icon": "👑"},
}

def create_svg_icon(room_type, config):
    """创建 SVG 图标"""
    svg_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg-{room_type}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{config['color']};stop-opacity:0.4"/>
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:0.95"/>
    </linearGradient>
    <filter id="glow-{room_type}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="outer-glow-{room_type}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="blur" in2="SourceGraphic" operator="over"/>
    </filter>
  </defs>
  
  <!-- 背景 -->
  <rect width="128" height="128" fill="url(#bg-{room_type})" rx="12"/>
  
  <!-- 外边框发光 -->
  <rect x="2" y="2" width="124" height="124" fill="none" stroke="{config['color']}" stroke-width="1" rx="10" opacity="0.3" filter="url(#outer-glow-{room_type})"/>
  
  <!-- 内边框 -->
  <rect x="4" y="4" width="120" height="120" fill="none" stroke="{config['color']}" stroke-width="2" rx="8" opacity="0.6"/>
  
  <!-- 装饰角标 -->
  <path d="M 8 20 L 8 8 L 20 8" fill="none" stroke="{config['color']}" stroke-width="2" opacity="0.8"/>
  <path d="M 108 8 L 120 8 L 120 20" fill="none" stroke="{config['color']}" stroke-width="2" opacity="0.8"/>
  <path d="M 8 108 L 8 120 L 20 120" fill="none" stroke="{config['color']}" stroke-width="2" opacity="0.8"/>
  <path d="M 108 120 L 120 120 L 120 108" fill="none" stroke="{config['color']}" stroke-width="2" opacity="0.8"/>
  
  <!-- 图标 -->
  <text x="64" y="56" text-anchor="middle" font-family="serif" font-size="40" fill="{config['color']}" filter="url(#glow-{room_type})">{config['icon']}</text>
  
  <!-- 标签 -->
  <text x="64" y="95" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#a0a0a0" font-weight="500">{config['name']}</text>
</svg>
"""
    return svg_content

def extract_icons_from_user_image():
    """从用户提供的图片中提取图标"""
    if not os.path.exists(USER_IMAGE_PATH):
        print(f"❌ 用户图片不存在: {USER_IMAGE_PATH}")
        return False
    
    try:
        img = Image.open(USER_IMAGE_PATH)
        width, height = img.size
        print(f"📷 图片尺寸: {width}x{height}")
        
        # 假设是垂直排列的5个图标
        icon_height = height // 5
        
        # 房间类型列表（按图片顺序）
        room_order = ["combat", "elite", "event", "shop", "rest"]
        
        for i, room_type in enumerate(room_order):
            top = i * icon_height
            bottom = (i + 1) * icon_height
            
            # 裁剪图标
            icon = img.crop((0, top, width, bottom))
            
            # 调整大小为 128x128
            icon = icon.resize((128, 128), Image.Resampling.LANCZOS)
            
            # 保存为 PNG
            output_path = os.path.join(MAP_DIR, f"map_{room_type}.png")
            icon.save(output_path, "PNG")
            print(f"✅ 已保存: map_{room_type}.png")
        
        # 为 Boss 创建特殊图标（使用 Elite 的变体或创建 SVG）
        create_boss_icon()
        
        return True
        
    except Exception as e:
        print(f"❌ 提取图标失败: {e}")
        return False

def create_boss_icon():
    """创建 Boss 图标（使用 SVG）"""
    boss_config = ROOM_TYPES["boss"]
    svg_content = create_svg_icon("boss", boss_config)
    
    output_path = os.path.join(MAP_DIR, "map_boss.svg")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"✅ 已保存: map_boss.svg (Boss图标)")

def create_all_svg_icons():
    """创建所有 SVG 图标作为后备方案"""
    print("🎨 创建 SVG 图标...")
    
    for room_type, config in ROOM_TYPES.items():
        svg_content = create_svg_icon(room_type, config)
        output_path = os.path.join(MAP_DIR, f"map_{room_type}.svg")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"✅ 已保存: map_{room_type}.svg")

def main():
    """主函数"""
    print("🗺️  DeckRogue 地图图标设置\n")
    
    # 确保目录存在
    os.makedirs(MAP_DIR, exist_ok=True)
    
    # 尝试从用户图片提取
    if os.path.exists(USER_IMAGE_PATH):
        print("📁 发现用户提供的图片，正在提取图标...")
        if extract_icons_from_user_image():
            print("\n🎉 图标提取完成！")
            return
    
    # 如果提取失败或没有用户图片，创建 SVG 图标
    print("📝 使用 SVG 图标作为默认方案...")
    create_all_svg_icons()
    print("\n🎉 SVG 图标创建完成！")
    
    print(f"\n📂 图标目录: {MAP_DIR}")
    print("\n提示: 如需使用自定义图片，请将图片保存为:")
    print(f"  {USER_IMAGE_PATH}")
    print("然后重新运行此脚本。")

if __name__ == "__main__":
    main()
