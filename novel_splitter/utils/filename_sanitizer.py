#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小说拆分工具 - 文件名清理工具
"""

import re
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import FILENAME_CONFIG

def sanitize_filename(filename: str) -> str:
    """
    清理文件名，移除非法字符
    
    Args:
        filename: 原始文件名
        
    Returns:
        str: 清理后的文件名
    """
    # 移除非法字符
    for char in FILENAME_CONFIG["remove_chars"]:
        filename = filename.replace(char, '')
    
    # 移除首尾空格和点
    filename = filename.strip('. ')
    
    # 限制长度
    if len(filename) > FILENAME_CONFIG["max_length"]:
        filename = filename[:FILENAME_CONFIG["max_length"]]
    
    # 替换连续空格为单个空格
    filename = re.sub(r'\s+', ' ', filename)
    
    return filename

def create_part_filename(part_number: int, part_title: str) -> str:
    """
    创建分部文件名
    
    Args:
        part_number: 分部号
        part_title: 分部标题
        
    Returns:
        str: 文件名（如：第一部-圣咏之城.txt）
    """
    # 中文数字转换
    cn_numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    cn_num = cn_numbers[part_number - 1] if part_number <= len(cn_numbers) else str(part_number)
    
    filename = f"第{cn_num}部-{part_title}.txt"
    return sanitize_filename(filename)

def create_chapter_filename(chapter_number: str, chapter_title: str, 
                           part_number: int = None) -> str:
    """
    创建章节文件名
    
    Args:
        chapter_number: 章节号（如：'1', '十一', '135'）
        chapter_title: 章节标题
        part_number: 分部号（可选，用于子目录）
        
    Returns:
        str: 文件名（如：第1章-燃烧的火刑架.txt）
    """
    if part_number is not None:
        cn_numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
        part_cn = cn_numbers[part_number - 1] if part_number <= len(cn_numbers) else str(part_number)
        filename = f"第{part_cn}部-{chapter_number}章-{chapter_title}.txt"
    else:
        filename = f"第{chapter_number}章-{chapter_title}.txt"
    
    return sanitize_filename(filename)