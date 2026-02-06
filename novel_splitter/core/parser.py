#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小说解析器 - 简化版，只识别分部和章节
"""

import re
import os
from typing import List, Dict
from pathlib import Path

class NovelParser:
    """简化的小说解析器"""
    
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.encoding = self._detect_encoding()
        self.lines = self._read_file()
        self.total_lines = len(self.lines)
        
    def _detect_encoding(self) -> str:
        """检测文件编码"""
        for encoding in ['utf-8', 'gbk', 'gb18030', 'gb2312']:
            try:
                with open(self.filepath, 'r', encoding=encoding) as f:
                    f.read(1000)
                print(f"检测到文件编码: {encoding}")
                return encoding
            except UnicodeDecodeError:
                continue
        print("编码检测失败，使用默认编码: utf-8")
        return 'utf-8'
    
    def _read_file(self) -> List[str]:
        """读取文件内容"""
        try:
            with open(self.filepath, 'r', encoding=self.encoding) as f:
                lines = f.readlines()
            print(f"成功读取文件: {len(lines)} 行")
            return lines
        except Exception as e:
            print(f"读取文件失败: {e}")
            return []
    
    def scan_structure(self) -> Dict:
        """扫描小说结构"""
        print("\n[1/3] 扫描小说结构...")
        
        parts = self._parse_parts()
        chapters = self._parse_chapters(parts)
        
        result = {
            'parts': parts,
            'chapters': chapters,
            'total_chapters': len(chapters),
            'total_parts': len(parts)
        }
        
        print(f"[OK] 结构扫描完成")
        print(f"  - 分部数量: {len(parts)}")
        print(f"  - 章节总数: {len(chapters)}")
        
        return result
    
    def _parse_parts(self) -> List[Dict]:
        """解析分部信息"""
        parts = []
        part_pattern = re.compile(r'^第([一二三四五六七八九十百千]+)部\s+(.+)$')
        
        for i, line in enumerate(self.lines):
            line_stripped = line.strip()
            match = part_pattern.match(line_stripped)
            if match:
                cn_num = match.group(1)
                title = match.group(2).strip()
                
                # 中文数字转阿拉伯数字
                arabic_num = self._cn_num_to_arabic(cn_num)
                
                parts.append({
                    'part_number': arabic_num,
                    'cn_number': cn_num,
                    'part_title': title,
                    'start_line': i + 1
                })
        
        # 设置每部的结束行
        for i in range(len(parts)):
            if i < len(parts) - 1:
                parts[i]['end_line'] = parts[i + 1]['start_line'] - 1
            else:
                parts[i]['end_line'] = self.total_lines
        
        print(f"[OK] 解析到 {len(parts)} 个分部")
        for part in parts:
            print(f"    第{part['part_number']}部: {part['part_title']}")
        
        return parts
    
    def _parse_chapters(self, parts_info=None) -> List[Dict]:
        """解析章节信息"""
        chapters = []
        chapter_pattern = re.compile(r'^第([零一二三四五六七八九十]+)章\s+(.+)$')
        
        # 先解析分部信息（如果未提供）
        if parts_info is None:
            parts_info = self._parse_parts()
        
        # 创建分部行号到分部号的映射
        part_line_to_number = {}
        for part in parts_info:
            part_line_to_number[part['start_line']] = part['part_number']
        
        # 解析章节
        for i in range(len(self.lines)):
            line = self.lines[i].strip()
            match = chapter_pattern.match(line)
            
            if match:
                cn_num = match.group(1)
                title = match.group(2).strip()
                
                # 中文数字转阿拉伯数字
                arabic_num = self._cn_num_to_arabic(cn_num)
                
                # 确定当前章节属于哪个分部
                current_part = 1
                # 找到在当前章节行之前最近的分部
                for part_start_line in sorted(part_line_to_number.keys(), reverse=True):
                    if part_start_line <= i + 1:
                        current_part = part_line_to_number[part_start_line]
                        break
                
                chapters.append({
                    'chapter_number': arabic_num,
                    'cn_number': cn_num,
                    'chapter_title': title,
                    'part_number': current_part,
                    'start_line': i + 1
                })
        
        # 设置每章的结束行
        for i in range(len(chapters)):
            if i < len(chapters) - 1:
                chapters[i]['end_line'] = chapters[i + 1]['start_line'] - 1
            else:
                chapters[i]['end_line'] = self.total_lines
        
        print(f"[OK] 解析到 {len(chapters)} 个章节")
        for i, chapter in enumerate(chapters[:10], 1):
            print(f"  {chapter['chapter_number']}章: {chapter['chapter_title']}")
        
        if len(chapters) > 10:
            print(f"  ... 还有{len(chapters) - 10} 个章节")
        
        return chapters
    
    def _cn_num_to_arabic(self, cn_num: str) -> int:
        """中文数字转阿拉伯数字"""
        from .cn_num_mapping import cn_num_to_arabic as cn_converter
        return cn_converter(cn_num)