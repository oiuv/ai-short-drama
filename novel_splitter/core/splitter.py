#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小说拆分器 - 按部或章节拆分小说
"""

import os
from pathlib import Path
from typing import List, Dict
from utils.filename_sanitizer import sanitize_filename

class NovelSplitter:
    """小说拆分器"""
    
    def __init__(self, parser, output_dir: str):
        self.parser = parser
        self.output_dir = Path(output_dir)
        self._ensure_output_dirs()
    
    def _ensure_output_dirs(self):
        """确保输出目录存在"""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        (self.output_dir / "parts").mkdir(exist_ok=True)
        (self.output_dir / "chapters").mkdir(exist_ok=True)
    
    def split_by_parts(self, parts: List[Dict]) -> List[Dict]:
        """按部拆分小说"""
        print(f"\n按部拆分...")
        part_files = []
        
        for part in parts:
            part_num = part['part_number']
            cn_num = part['cn_number']
            title = part['part_title']
            start_line = part['start_line']
            end_line = part['end_line']
            
            filename = f"第{cn_num}部-{sanitize_filename(title)}.txt"
            filepath = self.output_dir / "parts" / filename
            
            self._write_section(filepath, start_line, end_line)
            
            file_info = {
                'part_number': part_num,
                'filename': filename,
                'filepath': str(filepath),
                'chapter_count': 0
            }
            part_files.append(file_info)
            
            print(f"  [OK] 第{part_num}部: {title} ({filename})")
        
        print(f"[OK] 完成，生成 {len(part_files)} 个分部文件")
        return part_files
    
    def split_by_chapters(self, chapters: List[Dict]) -> List[Dict]:
        """按章节拆分小说"""
        print(f"\n按章节拆分...")
        chapter_files = []
        
        current_part_dir = None
        
        for chapter in chapters:
            part_num = chapter['part_number']
            cn_chapter_num = chapter['cn_number']
            chapter_num = chapter['chapter_number']
            title = chapter['chapter_title']
            start_line = chapter['start_line']
            end_line = chapter['end_line']
            
            # 创建分部目录
            part_dir_name = f"第{self._arabic_to_cn(part_num)}部"
            part_dir = self.output_dir / "chapters" / part_dir_name
            part_dir.mkdir(exist_ok=True)
            
            filename = f"第{cn_chapter_num}章-{sanitize_filename(title)}.txt"
            filepath = part_dir / filename
            
            self._write_section(filepath, start_line, end_line)
            
            file_info = {
                'chapter_number': chapter_num,
                'part_number': part_num,
                'filename': filename,
                'filepath': str(filepath)
            }
            chapter_files.append(file_info)
            
            if chapter_num <= 10 or chapter_num % 50 == 0:
                print(f"  [OK] 第{part_num}部-第{chapter_num}章: {title}")
        
        print(f"[OK] 完成，生成 {len(chapter_files)} 个章节文件")
        return chapter_files
    
    def _write_section(self, filepath: Path, start_line: int, end_line: int):
        """写入指定行范围的内容"""
        content_lines = self.parser.lines[start_line - 1:end_line]
        content = ''.join(content_lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _arabic_to_cn(self, num: int) -> str:
        """阿拉伯数字转中文数字"""
        cn_map = {
            1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
            6: '六', 7: '七', 8: '八', 9: '九', 10: '十',
            11: '十一', 12: '十二'
        }
        return cn_map.get(num, str(num))
