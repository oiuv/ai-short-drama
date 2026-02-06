#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AI短剧素材生成系统数据模型
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class Character:
    """角色数据模型"""
    id: str                     # 角色ID
    name: str                   # 角色姓名
    type: str                   # 角色类型（protagonist/antagonist/supporting）
    personality: List[str]       # 性格特征
    voice_id: str               # 分配音色ID
    description: str             # 外貌描述
    reference_image: str = ""    # 参考图片路径
    default_emotion: str = ""    # 默认情绪
    
@dataclass
class Dialogue:
    """对话数据模型"""
    character: str              # 角色ID
    text: str                  # 对话文本
    emotion: str               # 情感类型
    timing: int = 0            # 在镜头中的时间点（秒）
    
@dataclass
class Twist:
    """反转/爽点数据模型"""
    timing: int                # 时间点（秒）
    description: str           # 描述
    type: str = "twist"       # 类型（twist/reveal/slap等）

@dataclass
class Scene:
    """场景/镜头数据模型"""
    scene_id: int              # 场景ID
    duration: int             # 时长（秒）
    timing_range: tuple        # 时间范围（开始秒, 结束秒）
    hook: bool = False        # 是否为开篇钩子
    hook_text: str = ""       # 钩子文本
    conflict_level: int = 0    # 冲突强度（1-10）
    emotion_type: str = ""     # 情绪类型
    emotion_intensity: int = 0 # 情绪强度（1-10）
    narrator: str = ""         # 说书人旁白
    dialogues: Optional[List[Dialogue]] = None  # 对话列表
    visual_prompt: str = ""    # 视觉描述
    camera_action: str = ""    # 运镜动作
    twists: Optional[List[Twist]] = None # 反转列表
    bgm_type: str = ""        # 背景音乐类型
    sfx: Optional[List[str]] = None      # 音效列表
    video_file: str = ""       # 视频文件路径
    scene_image: str = ""      # 场景图片路径
    narrator_audio: str = ""    # 说书人音频路径
    
    def __post_init__(self):
        if self.dialogues is None:
            self.dialogues = []
        if self.twists is None:
            self.twists = []
        if self.sfx is None:
            self.sfx = []

@dataclass
class EpisodeInfo:
    """剧集信息数据模型"""
    episode_number: int         # 集数
    title: str                 # 标题
    source_chapters: List[int]  # 来源章节
    target_duration: int       # 目标时长（秒）
    hook_type: str = ""        # 钩子类型
    cliffhanger_type: str = "" # 悬念类型
    
@dataclass
class Script:
    """剧本数据模型"""
    episode_info: EpisodeInfo   # 剧集信息
    characters: List[Character] # 角色列表
    scenes: List[Scene]        # 场景列表
    
@dataclass
class ChapterAnalysis:
    """章节分析数据模型"""
    chapter_number: int        # 章节号
    content: str              # 章节内容
    density_score: int        # 密度分数（0-100）
    dialogue_ratio: float     # 对话比例
    conflict_count: int       # 冲突事件数
    emotion_intensity: float   # 情感强度
    estimated_duration: int   # 预计时长（秒）
    key_events: Optional[List[str]] = None  # 关键事件列表
    
    def __post_init__(self):
        if self.key_events is None:
            self.key_events = []

@dataclass
class EpisodePlan:
    """分集规划数据模型"""
    episode_number: int       # 集数
    chapters: List[int]      # 包含章节
    reason: str              # 规划理由
    estimated_scenes: int     # 预计镜头数
    estimated_duration: int   # 预计时长（秒）
    
@dataclass
class DramaPlan:
    """整体剧集规划数据模型"""
    total_chapters: int      # 总章节数
    recommended_episodes: int # 推荐集数
    episodes: List[EpisodePlan] # 分集列表
    total_duration: int = 0  # 总时长（秒）
    
    def __post_init__(self):
        if self.total_duration == 0:
            self.total_duration = sum(ep.estimated_duration for ep in self.episodes)

@dataclass
class MaterialSet:
    """素材集合数据模型"""
    episode_number: int       # 集数
    output_dir: str          # 输出目录
    script: Script           # 剧本
    generated_at: Optional[datetime] = None  # 生成时间
    
    def __post_init__(self):
        if self.generated_at is None:
            self.generated_at = datetime.now()