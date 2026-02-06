#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
配置文件
"""

# 输出配置
OUTPUT_CONFIG = {
    "base_dir": "ai_short_drama/novels/",
    "parts_dir": "parts/",
    "chapters_dir": "chapters/",
    "metadata_file": "metadata.json"
}

# 文件名配置
FILENAME_CONFIG = {
    "naming_style": "title",  # title（标题版）| simple（简洁版）
    "max_length": 100,
    "remove_chars": ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
}

# 正则表达式
PATTERNS = {
    "part": r"^第([一二三四五六七八九十百千]+)部\s+(.+)$",
    "chapter": r"^第([零一二三四五六七八九十]+)章\s+(.+)$"
}

# 编码配置
ENCODING_CONFIG = {
    "preferred": "utf-8",
    "fallback": ["gbk", "gb18030", "gb2312"]
}