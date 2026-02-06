#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.novel_processor.plot_summarizer import PlotSummarizer

def test_mock_mode():
    print("="*50)
    print("Test Plot Summarizer - Mock Mode")
    print("="*50)
    
    summarizer = PlotSummarizer(style="default")
    
    chapters_content = [
        "Chapter 1: Test content for chapter 1 - Lorem ipsum dolor sit amet",
        "Chapter 2: Test content for chapter 2 - Consectetur adipiscing elit", 
        "Chapter 3: Test content for chapter 3 - Sed do eiusmod tempor incididunt"
    ]
    
    chapter_numbers = [1, 2, 3]
    
    print("\nGenerating summary...")
    summary = summarizer.generate(chapters_content, chapter_numbers)
    
    print("\n" + "="*50)
    print("Summary Result")
    print("="*50)
    print(f"ID: {summary.summary_id}")
    print(f"Source chapters: {summary.source_chapters}")
    print(f"\nContent length: {len(summary.content)} chars")
    print(f"\nContent:")
    print("-" * 50)
    print(summary.content)
    print("-" * 50)
    
    print(f"\nKey roles found: {len(summary.key_roles)}")
    if summary.key_roles:
        for i, role in enumerate(summary.key_roles, 1):
            print(f"  {i}. {role.name} - Chapter {role.first_appearance} - {role.role_type}")
    
    print(f"\nKey settings found: {len(summary.key_settings)}")
    for i, setting in enumerate(summary.key_settings, 1):
        print(f"  {i}. {setting}")
    
    print(f"\nGenerated at: {summary.generated_at}")
    print("="*50)

if __name__ == '__main__':
    test_mock_mode()
