#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
核心元素提取器 - Phase 1
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime
from core.models import CoreElements, RoleInfo, SettingInfo, RelationshipInfo, ThemeInfo
from utils.prompt_manager import PromptManager

logger = logging.getLogger(__name__)

class CoreElementExtractor:
    """核心元素提取器"""

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
            self.system_prompt = self.prompt_manager.get_system_prompt("core_element_extractor")
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

    def extract(self, chapters_content: List[str],
                 chapter_numbers: List[int]) -> CoreElements:
        """
        提取核心元素

        Args:
            chapters_content: 章节内容列表
            chapter_numbers: 章节号列表

        Returns:
            CoreElements: 核心元素
        """
        if not self.ai_client:
            logger.warning("AI客户端未设置，使用模拟模式")
            return self._extract_mock(chapters_content, chapter_numbers)

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
                    max_tokens=2048
                )

            # 记录AI响应长度，用于调试
            logger.debug(f"AI响应长度: {len(response)} 字符")

            # 解析响应
            elements = self._parse_response(response, chapter_numbers)

            logger.info(f"核心元素提取成功")
            return elements

        except Exception as e:
            logger.error(f"核心元素提取失败: {e}")
            raise

    def extract_by_range(self, novel_path: str,
                         start_chapter: int, end_chapter: int) -> CoreElements:
        """
        按范围提取核心元素

        Args:
            novel_path: 小说目录路径
            start_chapter: 起始章节
            end_chapter: 结束章节

        Returns:
            CoreElements: 核心元素
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

        # 提取核心元素
        return self.extract(chapter_contents, chapter_numbers)

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
        return f"请从以下{chapter_count}章小说内容中提取核心元素，包括角色信息、设定信息、关系信息和核心主题：\n\n{content}\n\n**严格禁止**：\n1. **绝对禁止**编造任何不存在的角色、情节或设定\n2. **绝对禁止**添加小说中没有的任何内容\n3. **绝对禁止**修改小说中的任何情节、人物关系或设定\n\n**强制要求**：\n1. **只提取**小说中实际存在的角色，如路西恩、艾丽萨、乔尔、艾文、本杰明牧师、主教等\n2. 角色信息必须包含详细的外貌描写，**直接基于小说原文**\n3. 每个角色只提取一次，不要重复\n4. 严格按照【角色信息】、【设定信息】、【关系信息】、【核心主题】的格式输出\n5. 确保信息准确完整，**完全基于小说原文内容**\n\n请开始提取核心元素："

    def _parse_response(self, response: str,
                       chapter_numbers: List[int]) -> CoreElements:
        """
        解析AI响应

        Args:
            response: AI响应文本
            chapter_numbers: 章节号列表

        Returns:
            CoreElements: 核心元素
        """
        # 提取角色信息
        roles = self._extract_roles(response)

        # 提取设定信息
        settings = self._extract_settings(response)

        # 提取关系信息
        relationships = self._extract_relationships(response)

        # 提取主题信息
        themes = self._extract_themes(response)

        # 生成ID
        elements_id = f"core_elements_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return CoreElements(
            elements_id=elements_id,
            source_chapters=chapter_numbers,
            roles=roles,
            settings=settings,
            relationships=relationships,
            themes=themes
        )

    def _extract_roles(self, response: str) -> List[RoleInfo]:
        """
        提取角色信息

        Args:
            response: AI响应

        Returns:
            List[RoleInfo]: 角色信息列表（去重后的，属性统一）
        """
        lines = response.split('\n')
        roles = []
        in_roles = False
        current_role = None

        for line in lines:
            line = line.strip()
            if '【角色信息】' in line or '角色信息：' in line:
                in_roles = True
                continue
            elif (line.startswith('【') and '角色信息' not in line) or line.startswith('设定信息：') or line.startswith('关系信息：') or line.startswith('核心主题：'):
                in_roles = False
                # 保存最后一个角色
                if current_role:
                    roles.append(current_role)
                # 不要break，继续处理其他部分
            elif in_roles:
                if line.startswith('- ') and ('：' in line or ':' in line):
                    # 新角色开始
                    if current_role:
                        roles.append(current_role)

                    # 支持两种格式：- 角色名： 和 - 角色名:
                    if '：' in line:
                        role_name = line.split('：')[0][2:].strip()
                    else:
                        role_name = line.split(':')[0][2:].strip()
                    current_role = RoleInfo(
                        name=role_name,
                        age="未知",
                        gender="未知",
                        appearance="未知",
                        personality="未知",
                        identity="未知",
                        abilities="未知",
                        role_type="未知",
                        first_appearance=0
                    )
                elif current_role and (':' in line or '：' in line):
                    # 角色属性，支持中文冒号
                    if ':' in line:
                        key, value = line.split(':', 1)
                    else:
                        key, value = line.split('：', 1)
                    key = key.strip()
                    value = value.strip()

                    if '年龄' in key:
                        current_role.age = value if value else "未知"
                    elif '性别' in key:
                        current_role.gender = value if value else "未知"
                    elif '外貌' in key:
                        current_role.appearance = value if value else "未知"
                    elif '性格' in key:
                        current_role.personality = value if value else "未知"
                    elif '身份' in key:
                        current_role.identity = value if value else "未知"
                    elif '能力' in key:
                        current_role.abilities = value if value else "未知"
                    elif '类型' in key:
                        current_role.role_type = value if value else "未知"
                    elif '出场' in key:
                        # 提取章节号
                        import re
                        match = re.search(r'第(\d+)章', value)
                        if match:
                            current_role.first_appearance = int(match.group(1))
                        else:
                            current_role.first_appearance = 0

        # 添加最后一个角色
        if current_role:
            roles.append(current_role)

        # 去重：根据角色名去重
        unique_roles = []
        seen_names = set()
        for role in roles:
            # 过滤掉不是角色的条目（如属性名、设定信息等）
            if role.name and not role.name in ['年龄', '性别', '外貌', '性格', '身份', '能力', '类型', '出场', '世界观', '背景', '规则', '地点', '物品', '组织']:
                if role.name not in seen_names:
                    seen_names.add(role.name)
                    unique_roles.append(role)

        return unique_roles

    def _extract_settings(self, response: str) -> List[SettingInfo]:
        """
        提取设定信息

        Args:
            response: AI响应

        Returns:
            List[SettingInfo]: 设定信息列表（去重后的）
        """
        lines = response.split('\n')
        settings = []
        in_settings = False
        current_setting = None

        for line in lines:
            line = line.strip()
            if '【设定信息】' in line or '设定信息：' in line:
                in_settings = True
                continue
            elif (line.startswith('【') and '设定信息' not in line) or line.startswith('关系信息：') or line.startswith('核心主题：'):
                in_settings = False
                # 保存最后一个设定
                if current_setting:
                    settings.append(current_setting)
                # 不要break，继续处理其他部分
            elif in_settings:
                if line.startswith('- ') and (':' in line or '：' in line):
                    # 新设定开始
                    if current_setting:
                        settings.append(current_setting)

                    # 支持AI实际输出的格式：- 世界观：内容
                    line = line[2:]  # 移除开头的 "- "
                    # 支持中文冒号
                    if ':' in line:
                        key, value = line.split(':', 1)
                    else:
                        key, value = line.split('：', 1)
                    key = key.strip()
                    value = value.strip()

                    setting_type = key.replace('-', '')
                    current_setting = SettingInfo(
                        setting_type=setting_type,
                        content=value
                    )
                elif current_setting and line:
                    # 处理多行内容
                    current_setting.content += ' ' + line

        # 去重：根据设定类型去重
        unique_settings = []
        seen_types = set()
        for setting in settings:
            if setting.setting_type not in seen_types:
                seen_types.add(setting.setting_type)
                unique_settings.append(setting)

        return unique_settings

    def _extract_relationships(self, response: str) -> List[RelationshipInfo]:
        """
        提取关系信息

        Args:
            response: AI响应

        Returns:
            List[RelationshipInfo]: 关系信息列表
        """
        lines = response.split('\n')
        relationships = []
        in_relationships = False

        for line in lines:
            line = line.strip()
            if '【关系信息】' in line or '关系信息：' in line:
                in_relationships = True
                continue
            elif (line.startswith('【') and '关系信息' not in line) or line.startswith('核心主题：'):
                in_relationships = False
                # 不要break，继续处理其他部分
            elif in_relationships and line.startswith('- '):
                # 解析关系行
                relation_text = line[2:]
                # 提取角色A、角色B、关系类型和强度
                import re
                # 支持两种格式："角色A与角色B：关系类型（强度：X/10）" 和 "角色A与角色B - 关系类型（强度：X/10）"
                match = re.search(r'(.*)与(.*)[：-](.*)（强度：(\d+)/10）', relation_text)
                if match:
                    role_a = match.group(1).strip()
                    role_b = match.group(2).strip()
                    relation_type = match.group(3).strip()
                    strength = int(match.group(4))
                else:
                    # 简化解析
                    if '：' in relation_text:
                        parts = relation_text.split('：')
                    elif '-' in relation_text:
                        parts = relation_text.split('-', 1)
                    else:
                        continue
                    
                    if len(parts) == 2:
                        roles_part = parts[0].strip()
                        relation_part = parts[1].strip()

                        role_parts = roles_part.split('与')
                        if len(role_parts) == 2:
                            role_a = role_parts[0].strip()
                            role_b = role_parts[1].strip()

                            # 提取关系类型和强度
                            strength_match = re.search(r'强度：(\d+)/10', relation_part)
                            if strength_match:
                                strength = int(strength_match.group(1))
                                relation_type = relation_part.replace(f'（强度：{strength}/10）', '').strip()
                            else:
                                relation_type = relation_part
                                strength = 5
                        else:
                            continue
                    else:
                        continue

                relationships.append(RelationshipInfo(
                    role_a=role_a,
                    role_b=role_b,
                    relationship_type=relation_type,
                    strength=strength
                ))

        return relationships

    def _extract_themes(self, response: str) -> ThemeInfo:
        """
        提取主题信息

        Args:
            response: AI响应

        Returns:
            ThemeInfo: 主题信息
        """
        lines = response.split('\n')
        themes = ThemeInfo(
            core_theme="",
            emotional_tone="",
            values=""
        )
        in_themes = False
        current_key = None

        for line in lines:
            line = line.strip()
            if '【核心主题】' in line or '核心主题：' in line:
                in_themes = True
                continue
            elif line.startswith('【') and '核心主题' not in line:
                in_themes = False
                # 不要break，继续处理其他部分
            elif in_themes:
                if line.startswith('- ') and (':' in line or '：' in line):
                    # 新主题项开始
                    line = line[2:]  # 移除开头的 "- "
                    # 支持中文冒号
                    if ':' in line:
                        key, value = line.split(':', 1)
                    else:
                        key, value = line.split('：', 1)
                    key = key.strip()
                    value = value.strip()

                    if '主题' in key:
                        themes.core_theme = value
                        current_key = '主题'
                    elif '情感' in key:
                        themes.emotional_tone = value
                        current_key = '情感'
                    elif '价值观' in key:
                        themes.values = value
                        current_key = '价值观'
                elif line and current_key:
                    # 处理多行内容
                    if current_key == '主题':
                        themes.core_theme += ' ' + line
                    elif current_key == '情感':
                        themes.emotional_tone += ' ' + line
                    elif current_key == '价值观':
                        themes.values += ' ' + line

        return themes

    def _extract_mock(self, chapters_content: List[str],
                      chapter_numbers: List[int]) -> CoreElements:
        """
        模拟提取核心元素（用于测试）

        Args:
            chapters_content: 章节内容列表
            chapter_numbers: 章节号列表

        Returns:
            CoreElements: 模拟核心元素
        """
        logger.info("使用模拟模式提取核心元素")

        # 创建模拟数据
        roles = [
            RoleInfo(
                name="主角",
                age="20岁",
                gender="男",
                appearance="普通大学生",
                personality="勇敢善良",
                identity="穿越者",
                abilities="未知",
                role_type="主角",
                first_appearance=chapter_numbers[0]
            )
        ]

        settings = [
            SettingInfo(
                setting_type="世界观",
                content="一个未知的世界"
            ),
            SettingInfo(
                setting_type="背景",
                content="主角穿越到异世界"
            )
        ]

        relationships = []

        themes = ThemeInfo(
            core_theme="冒险、成长",
            emotional_tone="积极向上",
            values="勇气、友谊"
        )

        return CoreElements(
            elements_id=f"mock_core_elements_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            source_chapters=chapter_numbers,
            roles=roles,
            settings=settings,
            relationships=relationships,
            themes=themes
        )