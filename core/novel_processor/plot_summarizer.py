#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
剧情梗概生成器 - Phase 1
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime
from core.models import PlotSummary, RoleInfo
from utils.prompt_manager import PromptManager

logger = logging.getLogger(__name__)

class PlotSummarizer:
    """剧情梗概生成器"""
    
    def __init__(self, style: str = "default"):
        """
        初始化
        
        Args:
            style: 风格名称（default/ancient/modern/scifi/wuxia）
        """
        self.style = style
        self.prompt_manager = PromptManager(style)
        self.system_prompt = None
        self.ai_client = None
        
        # 加载系统提示词
        self._load_system_prompt()
    
    def _load_system_prompt(self):
        """加载系统提示词"""
        try:
            self.system_prompt = self.prompt_manager.get_system_prompt("plot_summarizer")
            logger.info("系统提示词加载成功")
        except Exception as e:
            logger.error(f"系统提示词加载失败: {e}")
            raise
    
    def set_ai_client(self, client):
        """
        设置AI客户端
        
        Args:
            client: AI客户端对象（需要实现chat方法）
        """
        self.ai_client = client
        logger.info("AI客户端设置成功")
    
    def generate(self, chapters_content: List[str], 
                 chapter_numbers: List[int]) -> PlotSummary:
        """
        生成剧情梗概
        
        Args:
            chapters_content: 章节内容列表
            chapter_numbers: 章节号列表
            
        Returns:
            PlotSummary: 剧情梗概
        """
        if not self.ai_client:
            logger.warning("AI客户端未设置，使用模拟模式")
            return self._generate_mock(chapters_content, chapter_numbers)
        
        # 合并章节内容
        combined_content = self._combine_chapters(chapters_content)
        
        # 构建用户提示词
        user_prompt = self._build_user_prompt(
            combined_content,
            len(chapters_content)
        )
        
        # 调用AI生成
        try:
            response = self.ai_client.chat(
                message=user_prompt,
                system_prompt=self.system_prompt,
                temperature=0.7,
                max_tokens=2000
            )
            
            # 解析响应
            summary = self._parse_response(response, chapter_numbers)
            
            logger.info(f"剧情梗概生成成功: {summary.summary_id}")
            return summary
            
        except Exception as e:
            logger.error(f"剧情梗概生成失败: {e}")
            raise
    
    def generate_by_range(self, novel_path: str, 
                          start_chapter: int, end_chapter: int) -> PlotSummary:
        """
        按范围生成剧情梗概
        
        Args:
            novel_path: 小说目录路径
            start_chapter: 起始章节
            end_chapter: 结束章节
            
        Returns:
            PlotSummary: 剧情梗概
        """
        # 读取章节
        from core.novel_processor.chapter_reader import ChapterReader
        
        reader = ChapterReader(novel_path)
        chapters = reader.read_chapters_by_range(start_chapter, end_chapter)
        
        if not chapters:
            raise ValueError(f"未找到章节: 第{start_chapter}章到第{end_chapter}章")
        
        # 读取章节内容
        chapter_contents = []
        chapter_numbers = []
        
        for chapter in chapters:
            try:
                content = reader.read_chapter_content(chapter['filepath'])
                chapter_contents.append(content)
                chapter_numbers.append(chapter['chapter_number'])
            except Exception as e:
                logger.error(f"读取第{chapter['chapter_number']}章失败: {e}")
        
        # 生成梗概
        return self.generate(chapter_contents, chapter_numbers)
    
    def _combine_chapters(self, chapters_content: List[str]) -> str:
        """
        合并章节内容
        
        Args:
            chapters_content: 章节内容列表
            
        Returns:
            str: 合并后的内容
        """
        separator = "\n\n=== 章节分隔 ===\n\n"
        return separator.join(chapters_content)
    
    def _build_user_prompt(self, content: str, chapter_count: int) -> str:
        """
        构建用户提示词
        
        Args:
            content: 章节内容
            chapter_count: 章节数量
            
        Returns:
            str: 用户提示词
        """
        # 从模板加载
        template_path = self.prompt_manager.base_dir / "templates" / "plot_summarizer.txt"
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                template = f.read()
        except Exception as e:
            logger.warning(f"模板文件不存在，使用默认提示词: {e}")
            template = "请将以下{chapter_count}章小说内容总结为剧情梗概：\n\n{chapter_content}"
        
        return template.format(
            chapter_count=chapter_count,
            chapter_content=content
        )
    
    def _parse_response(self, response: str, 
                       chapter_numbers: List[int]) -> PlotSummary:
        """
        解析AI响应
        
        Args:
            response: AI响应文本
            chapter_numbers: 章节号列表
            
        Returns:
            PlotSummary: 剧情梗概
        """
        # 提取梗概内容
        summary_content = self._extract_summary_content(response)
        
        # 提取关键角色
        key_roles = self._extract_key_roles(response)
        
        # 提取重要设定
        key_settings = self._extract_key_settings(response)
        
        # 生成ID
        summary_id = f"plot_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return PlotSummary(
            summary_id=summary_id,
            source_chapters=chapter_numbers,
            content=summary_content,
            key_roles=key_roles,
            key_settings=key_settings
        )
    
    def _extract_summary_content(self, response: str) -> str:
        """
        提取梗概内容
        
        Args:
            response: AI响应
            
        Returns:
            str: 梗概内容
        """
        lines = response.split('\n')
        summary_lines = []
        in_summary = False
        
        for line in lines:
            line = line.strip()
            if '【剧情梗概】' in line:
                in_summary = True
                continue
            elif line.startswith('【') and '梗概】' not in line:
                in_summary = False
            elif in_summary and line:
                summary_lines.append(line)
        
        return '\n'.join(summary_lines).strip()
    
    def _extract_key_roles(self, response: str) -> List[RoleInfo]:
        """
        Extract key roles from response
        
        Args:
            response: AI response text
            
        Returns:
            List[RoleInfo]: List of key roles
        """
        lines = response.split('\n')
        roles = []
        in_roles = False
        
        marker1 = '【关键角色首次出场】'
        marker2 = '【重要设定】'
        
        for line in lines:
            if marker1 in line:
                in_roles = True
                continue
            elif marker2 in line:
                in_roles = False
            elif in_roles and line.strip().startswith('-'):
                role_info = self._parse_role_line(line.strip())
                if role_info:
                    roles.append(role_info)
        
        return roles
    
    def _parse_role_line(self, line: str) -> Optional[RoleInfo]:
        """
        Parse role information line
        
        Args:
            line: Role info line (e.g., "- Name: First appearance in Chapter 1, role type is protagonist")
            
        Returns:
            Optional[RoleInfo]: Role information or None
        """
        import re
        # 更灵活的正则表达式，匹配不同格式的角色信息
        pattern = re.compile(r'-(.+?)[:：]\s*首次出现在第(.+?)章，\s*角色定位是(.+)')
        match = pattern.search(line)
        
        if not match:
            # 尝试匹配另一种格式
            pattern2 = re.compile(r'-(.+?)[:：]\s*首次出现于第(.+?)章，\s*角色定位是(.+)')
            match = pattern2.search(line)
            if not match:
                return None
        
        name = match.group(1).strip()
        chapter_str = match.group(2).strip()
        role_type = match.group(3).strip()
        
        # Convert chapter number
        chapter_number = self._cn_num_to_arabic(chapter_str)
        
        # 确保章节号不为0且至少为1
        if chapter_number == 0:
            # 尝试直接解析数字
            try:
                chapter_number = int(chapter_str)
                # 确保章节号至少为1
                if chapter_number < 1:
                    chapter_number = 1
            except:
                # 如果解析失败，使用第一个章节号
                chapter_number = 1
        # 确保章节号至少为1
        elif chapter_number < 1:
            chapter_number = 1
        
        return RoleInfo(
            name=name,
            first_appearance=chapter_number,
            role_type=role_type,
            description=f"{role_type}角色"
        )
    
    def _extract_key_settings(self, response: str) -> List[str]:
        """
        Extract key settings from response
        
        Args:
            response: AI response text
            
        Returns:
            List[str]: List of key settings
        """
        lines = response.split('\n')
        settings = []
        in_settings = False
        
        marker1 = '【重要设定】'
        
        for line in lines:
            if marker1 in line:
                in_settings = True
                continue
            elif in_settings and line.strip().startswith('-'):
                setting = line.strip()[1:].strip()
                if setting:
                    settings.append(setting)
            elif line.strip() and line.strip().startswith('【'):
                in_settings = False
        
        return settings
    
    def _cn_num_to_arabic(self, cn_num: str) -> int:
        """
        中文数字转阿拉伯数字
        
        Args:
            cn_num: 中文数字
            
        Returns:
            int: 阿拉伯数字
        """
        digit_map = {
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
            '二十': 20, '三十': 30, '四十': 40, '五十': 50
        }
        
        return digit_map.get(cn_num, 0)
    
    def _generate_mock(self, chapters_content: List[str], 
                      chapter_numbers: List[int]) -> PlotSummary:
        """
        生成模拟梗概（用于测试）
        
        Args:
            chapters_content: 章节内容列表
            chapter_numbers: 章节号列表
            
        Returns:
            PlotSummary: 模拟梗概
        """
        logger.info("使用模拟模式生成剧情梗概")
        
        # 简单模拟
        combined_content = self._combine_chapters(chapters_content)
        summary_content = f"这是第{chapter_numbers[0]}章到第{chapter_numbers[-1]}章的模拟梗概。内容共{len(combined_content)}字。"
        
        return PlotSummary(
            summary_id=f"mock_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            source_chapters=chapter_numbers,
            content=summary_content,
            key_roles=[],
            key_settings=[]
        )
