#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
元数据管理器 - 生成和管理小说元数据
"""

import json
from pathlib import Path
from datetime import datetime

class MetadataManager:
    """元数据管理器"""
    
    def __init__(self, output_dir: str, novel_title: str):
        self.output_dir = Path(output_dir)
        self.novel_title = novel_title
    
    def generate_metadata(self, structure_info: Dict, file_stats: Dict) -> Dict:
        """生成元数据"""
        metadata = {
            'title': self.novel_title,
            'generated_at': datetime.now().isoformat(),
            'file_info': {
                'filepath': file_stats['filepath'],
                'size_bytes': file_stats['size'],
                'size_mb': round(file_stats['size'] / 1024 / 1024, 2),
                'total_lines': file_stats['lines'],
                'encoding': file_stats['encoding']
            },
            'structure': {
                'total_parts': structure_info['total_parts'],
                'total_chapters': structure_info['total_chapters'],
                'parts': [],
                'chapters': structure_info['chapters']
            }
        }
        
        # 添加分部信息
        for part in structure_info['parts']:
            part_info = {
                'part_number': part['part_number'],
                'cn_number': part['cn_number'],
                'title': part['part_title'],
                'start_line': part['start_line'],
                'end_line': part['end_line'],
                'chapters_count': sum(1 for c in structure_info['chapters'] 
                                     if c['part_number'] == part['part_number'])
            }
            metadata['structure']['parts'].append(part_info)
        
        return metadata
    
    def save_metadata(self, metadata: Dict) -> str:
        """保存元数据到文件"""
        metadata_path = self.output_dir / 'metadata.json'
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return str(metadata_path)
