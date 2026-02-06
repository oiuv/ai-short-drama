#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
提示词管理器 - 负责加载和管理所有AI角色的系统提示词
"""

import json
from pathlib import Path
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class PromptManager:
    """提示词管理器"""
    
    def __init__(self, style: str = "default"):
        """
        初始化提示词管理器
        
        Args:
            style: 风格名称（default/ancient/modern/scifi/wuxia）
        """
        self.style = style
        self.base_dir = Path(__file__).parent.parent / "data" / "prompts"
        self.config_file = Path(__file__).parent.parent / "config" / "prompt_config.json"
        
        self._load_config()
        self._load_role_descriptions()
    
    def _load_config(self):
        """加载提示词配置文件"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            logger.info(f"提示词配置加载成功: {self.config_file}")
        except Exception as e:
            logger.error(f"提示词配置加载失败: {e}")
            raise
    
    def _load_role_descriptions(self):
        """加载角色描述库"""
        role_desc_file = self.base_dir / "base" / "default" / "role_descriptions.json"
        try:
            with open(role_desc_file, 'r', encoding='utf-8') as f:
                self.role_descriptions = json.load(f)
            logger.info(f"角色描述库加载成功: {role_desc_file}")
        except Exception as e:
            logger.error(f"角色描述库加载失败: {e}")
            raise
    
    def get_system_prompt(self, generator_name: str, 
                         style: Optional[str] = None) -> str:
        """
        获取指定生成器的系统提示词
        
        Args:
            generator_name: 生成器名称（如：plot_summarizer）
            style: 风格名称（如：ancient/modern/scifi），默认使用初始化时的风格
            
        Returns:
            str: 系统提示词内容
        """
        style = style or self.style
        prompt_path = self._get_prompt_path(generator_name, style)
        
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                prompt = f.read()
            logger.info(f"提示词加载成功: {prompt_path}")
            return prompt
        except Exception as e:
            logger.error(f"提示词加载失败 ({generator_name}/{style}): {e}")
            raise
    
    def _get_prompt_path(self, generator_name: str, style: str) -> Path:
        """
        获取提示词文件路径
        
        Args:
            generator_name: 生成器名称
            style: 风格名称
            
        Returns:
            Path: 提示词文件路径
        """
        style_config = self.config["style_mappings"].get(style)
        if not style_config:
            raise ValueError(f"不支持的风格: {style}")
        
        prompt_rel_path = style_config["generators"].get(generator_name)
        if not prompt_rel_path:
            logger.warning(f"风格 {style} 未找到 {generator_name} 的提示词，回退到默认风格")
            default_config = self.config["style_mappings"]["default"]
            prompt_rel_path = default_config["generators"][generator_name]
        
        prompt_path = self.base_dir / prompt_rel_path
        
        if not prompt_path.exists():
            raise FileNotFoundError(f"提示词文件不存在: {prompt_path}")
        
        return prompt_path
    
    def get_role_description(self, role_name: str) -> Dict:
        """
        获取角色描述
        
        Args:
            role_name: 角色名称（如：plot_summarizer）
            
        Returns:
            Dict: 角色描述
        """
        role = self.role_descriptions["roles"].get(role_name)
        if not role:
            raise ValueError(f"未找到角色描述: {role_name}")
        return role
    
    def list_styles(self) -> Dict[str, str]:
        """
        列出所有可用风格
        
        Returns:
            Dict: 风格名称到描述的映射
        """
        return {
            name: info["name"]
            for name, info in self.config["style_mappings"].items()
        }
    
    def list_generators(self, style: Optional[str] = None) -> Dict[str, str]:
        """
        列出指定风格的所有生成器
        
        Args:
            style: 风格名称，默认为当前风格
            
        Returns:
            Dict: 生成器名称到角色名称的映射
        """
        style = style or self.style
        style_config = self.config["style_mappings"][style]
        
        result = {}
        for gen_name, _ in style_config["generators"].items():
            role_desc = self.get_role_description(gen_name)
            result[gen_name] = role_desc["name"]
        
        return result
    
    def set_style(self, style: str):
        """
        设置当前风格
        
        Args:
            style: 风格名称
        """
        if style not in self.config["style_mappings"]:
            raise ValueError(f"不支持的风格: {style}")
        self.style = style
        logger.info(f"当前风格设置为: {style}")
    
    def get_current_style(self) -> str:
        """
        获取当前风格
        
        Returns:
            str: 当前风格名称
        """
        return self.style
    
    def validate_all_prompts(self) -> Dict[str, bool]:
        """
        验证所有提示词文件是否存在
        
        Returns:
            Dict: 提示词路径到验证结果的映射
        """
        results = {}
        
        for style_name, style_config in self.config["style_mappings"].items():
            for gen_name, prompt_rel_path in style_config["generators"].items():
                prompt_path = self.base_dir / prompt_rel_path
                exists = prompt_path.exists()
                results[str(prompt_path)] = exists
                
                if not exists:
                    logger.warning(f"提示词文件缺失: {prompt_path}")
        
        return results
