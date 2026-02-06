#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.parser import NovelParser
from core.splitter import NovelSplitter
from core.metadata_manager import MetadataManager

def main():
    parser = argparse.ArgumentParser(
        description='小说拆分工具 - 将小说按部和/章节拆分'
    )
    
    parser.add_argument('--input', '-i', required=True, help='小说文件路径')
    parser.add_argument('--mode', '-m', default='both', 
                       choices=['part', 'chapter', 'both'])
    parser.add_argument('--output', '-o', default=None, help='输出目录')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误：文件不存在: {input_path}")
        sys.exit(1)
    
    print("=== 小说拆分工具 v1.0 ===")
    print(f"小说文件：{input_path.name}")
    print(f"文件大小：{input_path.stat().st_size / 1024 / 1024:.1f} MB")
    
    if args.output:
        output_dir = Path(args.output)
    else:
        novel_title = input_path.stem
        output_dir = Path("../novels") / novel_title
    
    print(f"输出目录：{output_dir}")
    
    print("\n[1/3] 解析小说结构...")
    novel_parser = NovelParser(str(input_path))
    structure_info = novel_parser.scan_structure()
    
    print(f"\n[2/3] 拆分小说（模式: {args.mode}）...")
    novel_splitter = NovelSplitter(novel_parser, str(output_dir))
    
    result_files = {}
    if args.mode in ['part', 'both']:
        part_files = novel_splitter.split_by_parts(structure_info['parts'])
        result_files['parts'] = part_files
    
    if args.mode in ['chapter', 'both']:
        chapter_files = novel_splitter.split_by_chapters(structure_info['chapters'])
        result_files['chapters'] = chapter_files
    
    print(f"\n[3/3] 生成元数据...")
    file_stats = {
        'filepath': str(input_path),
        'size': input_path.stat().st_size,
        'lines': novel_parser.total_lines,
        'encoding': novel_parser.encoding
    }
    
    metadata_manager = MetadataManager(str(output_dir), input_path.stem)
    metadata = metadata_manager.generate_metadata(structure_info, file_stats)
    metadata_path = metadata_manager.save_metadata(metadata)
    
    print("\n=== 拆分完成！ ===")
    print(f"分部文件：{len(result_files.get('parts', []))} 个")
    print(f"章节文件：{len(result_files.get('chapters', []))} 个")
    print(f"元数据：{metadata_path}")
    print(f"\n输出目录：{output_dir}")
    print("\n所有文件已保存，可以开始后续的剧本改写功能。")

if __name__ == '__main__':
    main()