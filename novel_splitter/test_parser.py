#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.parser import NovelParser

def test_parser():
    """测试小说解析器"""
    print("=== 小说解析器测试 ===")
    
    # 小说文件路径
    novel_file = Path("../../ebook/《奥术神座》- 爱潜水的乌贼.txt")
    
    if not novel_file.exists():
        print(f"错误：文件不存在: {novel_file}")
        return
    
    print(f"小说文件：{novel_file.name}")
    print(f"文件大小：{novel_file.stat().st_size / 1024 / 1024:.1f} MB")
    
    # 解析小说
    parser = NovelParser(str(novel_file))
    structure_info = parser.scan_structure()
    
    print(f"\n=== 解析结果 ===")
    print(f"分部数量：{structure_info['total_parts']}")
    print(f"章节数量：{structure_info['total_chapters']}")
    print(f"\n分部详情：")
    
    for part in structure_info['parts']:
        print(f"  第{part['part_number']}部: {part['part_title']}")
    
    print(f"\n章节详情（只显示前20章）：")
    for chapter in structure_info['chapters'][:20]:
        print(f"  第{chapter['chapter_number']}章: {chapter['chapter_title']}")
    
    if len(structure_info['chapters']) > 20:
        print(f"  ... 还有{len(structure_info['chapters']) - 20} 章")

if __name__ == '__main__':
    test_parser()