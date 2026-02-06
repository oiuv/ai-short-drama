#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
灵影短剧系统 - 核心数据模型
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class Character:
    """角色数据模型"""
    character_id: str                     # 角色ID
    name: str                             # 角色姓名
    type: str                              # 角色类型（protagonist/antagonist/supporting）
    personality: List[str]                  # 性格特征
    voice_id: str                          # 分配音色ID
    description: str                        # 外貌描述
    reference_image: str = ""               # 参考图片路径
    default_emotion: str = ""               # 默认情绪

@dataclass
class RoleInfo:
    """角色信息（从小说中提取）"""
    name: str                              # 角色姓名
    first_appearance: int                  # 首次出现章节
    role_type: str                          # 角色定位（主角/配角/反派）
    description: str                         # 描述
    relationships: List[str] = field(default_factory=list)  # 关系列表

@dataclass
class PlotSummary:
    """剧情梗概数据模型"""
    summary_id: str                        # 梗概ID
    source_chapters: List[int]              # 来源章节列表
    content: str                            # 梗概内容
    key_roles: List[RoleInfo]              # 关键角色首次出场信息
    key_settings: List[str]                 # 重要设定
    generated_at: datetime = field(default_factory=datetime.now)

@dataclass
class Storyline:
    """故事线数据模型"""
    storyline_id: str                       # 故事线ID
    storyline_type: str                     # 类型（main/sub/foil）
    character_ids: List[str]                # 涉及角色ID列表
    key_events: List[Dict]                  # 关键事件列表
    timeline: List[Dict]                    # 时间线
    description: str                         # 描述

@dataclass
class TwistPoint:
    """卡点剧情数据模型"""
    twist_id: str                           # 卡点ID
    twist_type: str                         # 类型（climax/reveal/slap/hook）
    chapter_number: int                     # 章节号
    timeline_position: float               # 在故事线中的位置（0-1）
    intensity: int                          # 强度（1-10）
    description: str                        # 描述
    setup_chapter: int = None              # 铺垫章节

@dataclass
class ChapterHighlight:
    """章节亮点数据模型"""
    chapter_number: int                     # 章节号
    main_plot: str                          # 主线剧情
    key_twists: List[str]                   # 关键反转
    characters_involved: List[str]           # 涉及角色
    emotional_arc: str                      # 情绪弧线

@dataclass
class DetailedOutline:
    """细纲数据模型"""
    outline_id: str                         # 细纲ID
    source_chapters: List[int]              # 来源章节
    main_storyline: str                     # 主线故事
    sub_storylines: List[str]               # 支线故事列表
    chapter_highlights: List[ChapterHighlight]  # 章节亮点列表
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class EpisodeOutline:
    """集纲数据模型"""
    episode_number: int                     # 集数
    title: str                              # 标题
    source_chapters: List[int]              # 来源章节
    main_conflict: str                       # 主要冲突
    opening_hook: str                       # 开篇钩子
    climax_event: str                       # 高潮事件
    ending_hook: str                        # 结尾悬念
    estimated_duration: int                  # 预计时长（秒）
    key_characters: List[str]               # 关键角色

@dataclass
class DialogueLine:
    """对话行数据模型"""
    character_id: str                       # 角色ID
    text: str                                # 对话文本
    emotion: str                             # 情感类型
    tone: str = ""                           # 语气

@dataclass
class Scene:
    """场景数据模型"""
    scene_id: int                           # 场景ID
    scene_title: str                         # 场景标题
    scene_type: str                          # 场景类型（dialogue/action/narration）
    duration: int                            # 时长（秒）
    characters: List[str]                   # 场景角色列表
    dialogue_lines: List[DialogueLine]        # 对话列表
    narration: str = ""                     # 旁白
    action_description: str = ""              # 动作描述
    emotion_type: str = ""                  # 情绪类型

@dataclass
class EpisodeScript:
    """剧集剧本数据模型"""
    episode_number: int                     # 集数
    title: str                              # 标题
    source_chapters: List[int]              # 来源章节
    scenes: List[Scene]                     # 场景列表
    total_duration: int                      # 总时长（秒）
    generated_at: datetime = field(default_factory=datetime.now)
