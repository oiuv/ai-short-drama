#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.novel_processor.plot_summarizer import PlotSummarizer
from core.novel_processor.chapter_reader import ChapterReader
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_mock_mode():
    print("=== Test Plot Summarizer - Mock Mode ===")
    
    summarizer = PlotSummarizer(style="default")
    
    chapters_content = [
        "Chapter 1: Test content 1",
        "Chapter 2: Test content 2",
        "Chapter 3: Test content 3"
    ]
    
    chapter_numbers = [1, 2, 3]
    
    print("Generating summary...")
    summary = summarizer.generate(chapters_content, chapter_numbers)
    
    print(f"\n=== Summary Result ===")
    print(f"ID: {summary.summary_id}")
    print(f"Source chapters: {summary.source_chapters}")
    print(f"\nContent:")
    print(summary.content)
    print(f"\nKey roles: {len(summary.key_roles)}")
    print(f"Key settings: {len(summary.key_settings)}")
    print(f"Generated at: {summary.generated_at}")

if __name__ == '__main__':
    test_mock_mode()
