#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
章节分析模块 - 分析小说章节，评估剧情密度
"""

import re
from typing import List
from data.models import ChapterAnalysis
from config import DRAMA_CONFIG

class ChapterAnalyzer:
    """章节分析器"""
    
    def __init__(self):
        self.min_conflict_level = DRAMA_CONFIG["script"]["min_conflict_level"]
        
    def analyze_chapter(self, chapter_number: int, content: str) -> ChapterAnalysis:
        """
        分析单个章节
        
        Args:
            chapter_number: 章节号
            content: 章节内容
            
        Returns:
            ChapterAnalysis: 章节分析结果
        """
        # 基础分析
        dialogue_ratio = self._calculate_dialogue_ratio(content)
        conflict_count = self._count_conflict_events(content)
        emotion_intensity = self._calculate_emotion_intensity(content)
        
        # 计算密度分数
        density_score = self._calculate_density_score(
            dialogue_ratio, conflict_count, emotion_intensity
        )
        
        # 估算时长
        estimated_duration = self._estimate_duration(content, density_score)
        
        # 提取关键事件
        key_events = self._extract_key_events(content)
        
        return ChapterAnalysis(
            chapter_number=chapter_number,
            content=content,
            density_score=density_score,
            dialogue_ratio=dialogue_ratio,
            conflict_count=conflict_count,
            emotion_intensity=emotion_intensity,
            estimated_duration=estimated_duration,
            key_events=key_events
        )
    
    def analyze_multiple_chapters(self, chapters: List[tuple]) -> List[ChapterAnalysis]:
        """
        分析多个章节
        
        Args:
            chapters: [(chapter_number, content), ...] 列表
            
        Returns:
            List[ChapterAnalysis]: 章节分析结果列表
        """
        analyses = []
        for chapter_number, content in chapters:
            analysis = self.analyze_chapter(chapter_number, content)
            analyses.append(analysis)
        return analyses
    
    def _calculate_dialogue_ratio(self, content: str) -> float:
        """
        计算对话比例
        
        Args:
            content: 章节内容
            
        Returns:
            float: 对话比例（0-1）
        """
        # 匹配中文对话格式
        dialogue_pattern = r'"[^"]*"|'[^']*'|「[^」]*」|【[^】]*】'
        dialogues = re.findall(dialogue_pattern, content)
        
        dialogue_length = sum(len(d) for d in dialogues)
        total_length = len(content)
        
        return dialogue_length / total_length if total_length > 0 else 0
    
    def _count_conflict_events(self, content: str) -> int:
        """
        统计冲突事件数量
        
        Args:
            content: 章节内容
            
        Returns:
            int: 冲突事件数
        """
        # 冲突关键词
        conflict_keywords = [
            '争吵', '打架', '冲突', '矛盾', '反对', '拒绝',
            '愤怒', '生气', '威胁', '警告', '挑战',
            '反转', '意外', '突然', '震惊', '愣住',
            '打脸', '羞辱', '嘲笑', '讽刺', '质疑'
        ]
        
        conflict_count = 0
        for keyword in conflict_keywords:
            conflict_count += len(re.findall(keyword, content))
        
        return conflict_count
    
    def _calculate_emotion_intensity(self, content: str) -> float:
        """
        计算情感强度
        
        Args:
            content: 章节内容
            
        Returns:
            float: 情感强度（0-10）
        """
        # 情感词汇映射
        emotion_words = {
            '高情感': ['激动', '愤怒', '狂喜', '绝望', '震惊', '恐惧', '爱慕', '仇恨'],
            '中情感': ['开心', '难过', '紧张', '兴奋', '担忧', '期待', '失望'],
            '低情感': ['平静', '普通', '日常', '描述', '说明', '介绍']
        }
        
        total_emotion_score = 0
        word_count = 0
        
        for level, words in emotion_words.items():
            for word in words:
                count = len(re.findall(word, content))
                if level == '高情感':
                    total_emotion_score += count * 3
                elif level == '中情感':
                    total_emotion_score += count * 2
                else:
                    total_emotion_score += count * 1
                word_count += count
        
        # 归一化到0-10范围
        if word_count == 0:
            return 1.0  # 基础情感强度
        
        avg_emotion = total_emotion_score / word_count
        return min(avg_emotion, 10.0)
    
    def _calculate_density_score(self, dialogue_ratio: float, 
                              conflict_count: int, emotion_intensity: float) -> int:
        """
        计算剧情密度分数
        
        Args:
            dialogue_ratio: 对话比例
            conflict_count: 冲突事件数
            emotion_intensity: 情感强度
            
        Returns:
            int: 密度分数（0-100）
        """
        # 加权计算
        dialogue_score = dialogue_ratio * 30  # 对话占比30%
        conflict_score = min(conflict_count * 5, 40)  # 冲突占比40%，最高40分
        emotion_score = emotion_intensity * 3  # 情感占比30%
        
        total_score = dialogue_score + conflict_score + emotion_score
        return min(int(total_score), 100)
    
    def _estimate_duration(self, content: str, density_score: int) -> int:
        """
        估算章节时长（秒）
        
        Args:
            content: 章节内容
            density_score: 密度分数
            
        Returns:
            int: 估算时长（秒）
        """
        base_duration = len(content) / 50  # 基础：每50字1秒
        
        # 密度调整：高密度内容需要更多时间展示
        density_multiplier = 1 + (density_score / 100)
        
        adjusted_duration = int(base_duration * density_multiplier)
        
        # 限制在合理范围内
        return min(max(adjusted_duration, 60), 600)  # 1-10分钟
    
    def _extract_key_events(self, content: str) -> List[str]:
        """
        提取关键事件
        
        Args:
            content: 章节内容
            
        Returns:
            List[str]: 关键事件列表
        """
        key_events = []
        
        # 使用句子分割提取关键事件
        sentences = re.split(r'[。！？；]', content)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 10:
                continue
                
            # 检查是否包含关键事件标识
            key_indicators = [
                '突然', '意外', '原来', '没想到', '竟然',
                '决定', '发现', '意识到', '明白',
                '愤怒', '震惊', '激动', '感动'
            ]
            
            if any(indicator in sentence for indicator in key_indicators):
                key_events.append(sentence[:50])  # 限制长度
        
        return key_events[:10]  # 最多返回10个关键事件