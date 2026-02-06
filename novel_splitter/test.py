#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
from pathlib import Path

def test_splitter():
    """简单的拆分测试"""
    print("=== 小说拆分测试 ===")
    
    # 小说文件路径
    novel_file = Path("../../ebook/《奥术神座》- 爱潜水的乌贼.txt")
    
    if not novel_file.exists():
        print(f"错误：文件不存在: {novel_file}")
        return
    
    print(f"小说文件: {novel_file}")
    print(f"文件大小: {novel_file.stat().st_size / 1024 / 1024:.1f} MB")
    
    # 读取文件
    try:
        with open(novel_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        print(f"读取文件失败: {e}")
        return
    
    print(f"总行数: {len(lines)}")
    
    # 扫描结构
    print("\n[1/3] 扫描小说结构...")
    
    # 查找分部
    part_lines = []
    part_info = []
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped.startswith("第") and "部" in line_stripped:
            part_info.append({
                "line_number": i + 1,
                "title": line_stripped
            })
            print(f"  发现分部: {line_stripped} (第{i + 1}行)")
    
    print(f"发现 {len(part_info)} 个分部")
    
    # 查找章节
    print("\n[2/3] 扫描章节...")
    chapter_lines = []
    chapter_info = []
    current_part = 1
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if line_stripped.startswith("第") and "章" in line_stripped:
            # 确定分部
            for j in range(len(part_info)):
                if i > part_info[j]["line_number"]:
                    current_part = j + 1
            
            chapter_info.append({
                "line_number": i + 1,
                "part_number": current_part,
                "title": line_stripped
            })
            print(f"  {current_part}部: {line_stripped} (第{i + 1}行)")
    
    print(f"发现 {len(chapter_info)} 个章节")
    
    # 创建输出目录
    print("\n[3/3] 创建输出文件...")
    output_dir = Path("ai_short_drama/novels/测试输出")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    parts_dir = output_dir / "parts"
    parts_dir.mkdir(exist_ok=True)
    
    chapters_dir = output_dir / "chapters"
    chapters_dir.mkdir(exist_ok=True)
    
    # 保存分部文件（只保存前4个分部作为示例）
    saved_parts = 0
    for part in part_info[:4]:
        # 查找下一个分部或文件结束
        end_line = len(lines)
        for i in range(len(chapter_info)):
            if chapter_info[i]["line_number"] > part["line_number"]:
                end_line = chapter_info[i]["line_number"] - 1
                break
        
        content = "\n".join(lines[part["line_number"]-1:end_line])
        
        # 清理文件名
        title_part = part["title"].replace(" ", "_")
        filename = f"{title_part}.txt"
        filepath = parts_dir / filename
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        saved_parts += 1
        print(f"  保存: {filename} (第{part['line_number']}-{end_line}行)")
    
    print(f"\n成功保存 {saved_parts} 个分部文件")
    print(f"输出目录: {output_dir}")
    print("\n测试完成！拆分工具基础功能正常。")

if __name__ == "__main__":
    test_splitter()