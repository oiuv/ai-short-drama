#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
小说分章读取处理器
"""

import re
from pathlib import Path
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class ChapterReader:
    """小说分章读取处理器"""
    
    def __init__(self, novel_path: str):
        """
        初始化
        
        Args:
            novel_path: 小说文件路径、小说目录路径或章节目录路径
        """
        self.novel_path = Path(novel_path)
        self.encoding = None
        self.is_chapter_directory = self._detect_chapter_directory()
    
    def _detect_chapter_directory(self) -> bool:
        """
        检测是否为章节目录
        
        Returns:
            bool: 是否为章节目录
        """
        # 检查路径是否包含chapters目录
        if 'chapters' in str(self.novel_path):
            return True
        
        # 检查路径是否直接包含.txt文件
        txt_files = list(self.novel_path.glob('*.txt'))
        if txt_files:
            return True
        
        return False
    
    def detect_encoding(self, filepath=None) -> str:
        """
        检测文件编码
        
        Args:
            filepath: 可选的文件路径，如果不提供则使用第一个章节文件
            
        Returns:
            str: 编码类型（utf-8/gbk/gb18030/gb2312）
        """
        if self.encoding:
            return self.encoding
        
        # 确定要检测的文件路径
        test_path = None
        if filepath:
            test_path = Path(filepath)
        else:
            # 尝试找到第一个章节文件
            if self.is_chapter_directory:
                # 如果是章节目录，查找其中的第一个txt文件
                chapter_files = list(self.novel_path.glob('*.txt'))
                if chapter_files:
                    test_path = chapter_files[0]
            else:
                # 如果是小说根目录，查找chapters目录下的第一个txt文件
                chapters_dir = self.novel_path / "chapters"
                if chapters_dir.exists():
                    for part_dir in chapters_dir.iterdir():
                        if part_dir.is_dir():
                            chapter_files = list(part_dir.glob('*.txt'))
                            if chapter_files:
                                test_path = chapter_files[0]
                                break
        
        # 如果找不到测试文件，使用默认编码
        if not test_path or not test_path.exists():
            logger.warning("无法找到测试文件，使用默认编码: utf-8")
            self.encoding = 'utf-8'
            return 'utf-8'
        
        # 尝试不同的编码
        for encoding in ['utf-8', 'gbk', 'gb18030', 'gb2312']:
            try:
                with open(test_path, 'r', encoding=encoding) as f:
                    f.read(1000)
                self.encoding = encoding
                logger.info(f"检测到文件编码: {encoding}")
                return encoding
            except UnicodeDecodeError:
                continue
        
        logger.warning("编码检测失败，使用默认编码: utf-8")
        self.encoding = 'utf-8'
        return 'utf-8'
    
    def read_chapters_from_split_directory(self) -> List[Dict]:
        """
        从拆分后的目录中读取章节信息
        
        Returns:
            List[Dict]: 章节信息列表
                [
                    {
                        'chapter_number': int,
                        'chapter_title': str,
                        'part_number': int,
                        'filepath': str,
                        'word_count': int
                    },
                    ...
                ]
        """
        if not self.novel_path.exists():
            raise FileNotFoundError(f"目录不存在: {self.novel_path}")
        
        chapters = []
        
        if self.is_chapter_directory:
            # 直接处理章节目录
            logger.info(f"直接处理章节目录: {self.novel_path}")
            
            # 解析分部号
            part_number = 1
            part_name = self.novel_path.name
            part_match = re.match(r'第(.+?)部', part_name)
            if part_match:
                cn_part_num = part_match.group(1)
                part_number = self._cn_num_to_arabic(cn_part_num)
            
            # 读取该目录下的所有章节文件
            chapter_files = sorted(self.novel_path.glob("*.txt"))
            
            for chapter_file in chapter_files:
                chapter_info = self._parse_chapter_filename(chapter_file.name)
                if chapter_info:
                    chapter_info['part_number'] = part_number
                    chapter_info['part_title'] = self.novel_path.name
                    chapter_info['filepath'] = str(chapter_file)
                    chapter_info['word_count'] = self._get_word_count(chapter_file)
                    chapters.append(chapter_info)
        else:
            # 查找chapters目录
            chapters_dir = self.novel_path / "chapters"
            if not chapters_dir.exists():
                raise FileNotFoundError(f"chapters目录不存在: {chapters_dir}")
            
            # 遍历所有分部目录
            for part_dir in sorted(chapters_dir.iterdir()):
                if not part_dir.is_dir():
                    continue
                
                # 从目录名解析分部号（如："第一部"）
                part_match = re.match(r'第(.+?)部', part_dir.name)
                if not part_match:
                    continue
                
                cn_part_num = part_match.group(1)
                part_number = self._cn_num_to_arabic(cn_part_num)
                
                # 读取该分部下的所有章节文件
                chapter_files = sorted(part_dir.glob("*.txt"))
                
                for chapter_file in chapter_files:
                    chapter_info = self._parse_chapter_filename(chapter_file.name)
                    if chapter_info:
                        chapter_info['part_number'] = part_number
                        chapter_info['part_title'] = part_dir.name
                        chapter_info['filepath'] = str(chapter_file)
                        chapter_info['word_count'] = self._get_word_count(chapter_file)
                        chapters.append(chapter_info)
        
        # 按章节号排序
        chapters.sort(key=lambda x: x['chapter_number'])
        logger.info(f"从目录读取到 {len(chapters)} 个章节（已按章节号排序）")
        return chapters
    
    def read_chapters_by_range(self, start: int, end: int) -> List[Dict]:
        """
        按范围读取章节
        
        Args:
            start: 起始章节号
            end: 结束章节号
            
        Returns:
            List[Dict]: 章节信息列表
        """
        all_chapters = self.read_chapters_from_split_directory()
        
        # 按章节号筛选
        filtered_chapters = []
        for c in all_chapters:
            if start <= c['chapter_number'] <= end:
                # 确保filepath是文件路径
                if 'filepath' in c and Path(c['filepath']).is_file():
                    filtered_chapters.append(c)
                else:
                    logger.warning(f"章节 {c['chapter_number']} 的文件路径无效: {c.get('filepath')}")
        
        logger.info(f"按范围读取：第{start}章到第{end}章，共{len(filtered_chapters)}章")
        return filtered_chapters
    
    def read_chapter_content(self, filepath: str) -> str:
        """
        读取单个章节内容
        
        Args:
            filepath: 章节文件路径
            
        Returns:
            str: 章节内容
        """
        path = Path(filepath)
        
        # 确保路径是文件
        if path.is_dir():
            # 尝试从目录中查找章节文件
            logger.warning(f"路径是目录，尝试查找章节文件: {path}")
            chapter_files = list(path.glob('*.txt'))
            if chapter_files:
                path = chapter_files[0]
                logger.info(f"使用找到的文件: {path}")
            else:
                raise FileNotFoundError(f"目录中没有找到章节文件: {path}")
        
        encoding = self.detect_encoding(filepath) if not self.encoding else self.encoding
        
        try:
            with open(path, 'r', encoding=encoding) as f:
                content = f.read()
            logger.info(f"读取章节: {path.name}, 字数: {len(content)}")
            return content
        except Exception as e:
            logger.error(f"读取章节失败: {e}")
            logger.error(f"文件路径: {path}")
            raise
    
    def read_multiple_chapters(self, chapter_list: List[Dict]) -> List[Tuple[int, str]]:
        """
        批量读取章节内容
        
        Args:
            chapter_list: 章节信息列表
            
        Returns:
            List[Tuple[int, str]]: [(章节号, 内容), ...]
        """
        results = []
        
        for chapter_info in chapter_list:
            try:
                content = self.read_chapter_content(chapter_info['filepath'])
                results.append((chapter_info['chapter_number'], content))
            except Exception as e:
                logger.error(f"读取第{chapter_info['chapter_number']}章失败: {e}")
        
        logger.info(f"批量读取完成: 成功{len(results)}/{len(chapter_list)}章")
        return results
    
    def get_chapter_metadata(self) -> Dict:
        """
        获取小说元数据
        
        Returns:
            Dict: 小说元数据
        """
        metadata_file = self.novel_path / "metadata.json"
        
        if not metadata_file.exists():
            raise FileNotFoundError(f"元数据文件不存在: {metadata_file}")
        
        import json
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        return metadata
    
    def _parse_chapter_filename(self, filename: str) -> Dict:
        """
        解析章节文件名
        
        Args:
            filename: 文件名（如："第一章-燃烧的火刑架.txt"）
            
        Returns:
            Dict: 章节信息
        """
        pattern = re.compile(r'^第(.+?)章-(.+)\.txt$')
        match = pattern.match(filename)
        
        if not match:
            return None
        
        cn_chapter_num = match.group(1)
        title = match.group(2).strip()
        
        return {
            'chapter_number': self._cn_num_to_arabic(cn_chapter_num),
            'cn_chapter_number': cn_chapter_num,
            'chapter_title': title,
            'filename': filename
        }
    
    def _get_word_count(self, filepath: Path) -> int:
        """
        获取章节字数
        
        Args:
            filepath: 章节文件路径
            
        Returns:
            int: 字数
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            return len(content)
        except:
            return 0
    
    def _cn_num_to_arabic(self, cn_num: str) -> int:
        """
        中文数字转阿拉伯数字
        
        Args:
            cn_num: 中文数字（如："一"、"十一"、"三十五"）
            
        Returns:
            int: 阿拉伯数字
        """
        digit_map = {
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
            '十六': 16, '十七': 17, '十八': 18, '十九': 19,
            '二十': 20, '三十': 30, '四十': 40, '五十': 50,
            '六十': 60, '七十': 70, '八十': 80, '九十': 90
        }
        
        return digit_map.get(cn_num, 0)
