#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
灵影短剧系统 - 主命令行接口
"""

import argparse
import os
import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

class LingyingCLI:
    """灵影短剧系统 CLI"""

    def __init__(self):
        self.novel_path = ""
        self.style = "default"
        self.chapter_start = 1
        self.chapter_end = 3
        self.group_id = os.getenv('MINIMAX_GROUP_ID', '')
        self.api_key = os.getenv('MINIMAX_API_KEY', '')

        if not self.group_id or not self.api_key:
            print("[X] 错误：请设置环境变量 MINIMAX_GROUP_ID 和 MINIMAX_API_KEY")
            sys.exit(1)

    def cmd_plot_summary(self, args):
        """
        生成剧情梗概命令

        Args:
            args: 命令行参数
        """
        print("=" * 60)
        print("灵影短剧系统 - 剧情梗概生成")
        print("=" * 60)

        from core.novel_processor.plot_summarizer import PlotSummarizer
        from core.novel_processor.chapter_reader import ChapterReader
        from api.minimax_client import MiniMaxClient

        # 配置
        self.novel_path = args.novel
        self.style = args.style
        self.chapter_start = args.start
        self.chapter_end = args.end

        # 读取章节
        print(f"\n[1/7] 读取小说章节: 第{self.chapter_start}章到第{self.chapter_end}章")
        print(f"小说路径: {self.novel_path}")

        reader = ChapterReader(self.novel_path)
        chapters = reader.read_chapters_by_range(self.chapter_start, self.chapter_end)

        if not chapters:
            print(f"[X] 未找到章节: 第{self.chapter_start}章到第{self.chapter_end}章")
            return

        print(f"[OK] 读取到 {len(chapters)} 个章节")

        # 读取章节内容
        print("\n[2/7] 读取章节内容...")
        chapter_data = []
        chapter_numbers = []

        for i, chapter in enumerate(chapters, 1):
            try:
                # 确保filepath是文件路径
                filepath = chapter.get('filepath') or chapter.get('file_path')
                if not filepath:
                    print(f"  [X] 第{i}章缺少文件路径")
                    continue

                # 打印文件路径，用于调试
                print(f"  读取文件: {filepath}")

                # 检查路径是否存在
                from pathlib import Path
                path_obj = Path(filepath)
                if not path_obj.exists():
                    print(f"  [X] 文件不存在: {filepath}")
                    continue
                if not path_obj.is_file():
                    print(f"  [X] 不是文件路径: {filepath}")
                    continue

                content = reader.read_chapter_content(filepath)
                chapter_data.append(content)
                chapter_numbers.append(chapter['chapter_number'])
                print(f"  第{i}章: {chapter['chapter_title']} ({len(content)} 字符)")
            except Exception as e:
                print(f"  [X] 第{i}章读取失败: {e}")

        # 初始化梗概生成器
        print(f"\n[3/7] 初始化剧情梗概生成器 (风格: {self.style})...")
        summarizer = PlotSummarizer(style=self.style)

        # 初始化MiniMax客户端
        print(f"\n[4/7] 初始化MiniMax API客户端...")
        minimax_client = None
        try:
            minimax_client = MiniMaxClient()
            # 设置AI客户端
            group_id_display = minimax_client.group_id[:8] if minimax_client.group_id else "Unknown"
            print(f"  MiniMax API客户端就绪 (Group ID: {group_id_display}...)...")
            summarizer.set_ai_client(minimax_client)
        except Exception as e:
            print(f"  [X] MiniMax客户端初始化失败: {e}")
            print(f"  请设置环境变量 MINIMAX_GROUP_ID 和 MINIMAX_API_KEY")
            sys.exit(1)

        # 生成梗概
        print(f"\n[5/7] 正在生成剧情梗概...")

        try:
            summary = summarizer.generate(chapter_data, chapter_numbers)

            # 保存结果
            output_dir = Path("output/plot_summaries")
            output_dir.mkdir(parents=True, exist_ok=True)

            timestamp = summary.generated_at.strftime("%Y%m%d_%H%M%S")
            output_file = output_dir / f"chapters_{self.chapter_start}_to_{self.chapter_end}_{timestamp}.json"

            result = {
                "summary_id": summary.summary_id,
                "source_chapters": summary.source_chapters,
                "content": summary.content,
                "key_roles": [{
                    "name": r.name,
                    "first_appearance": r.first_appearance,
                    "role_type": r.role_type,
                    "description": r.description
                } for r in summary.key_roles],
                "key_settings": summary.key_settings,
                "generated_at": summary.generated_at.isoformat()
            }

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            # 输出结果
            print("\n" + "=" * 60)
            print("剧情梗概生成完成！")
            print("=" * 60)
            print(f"输出文件: {output_file}")
            print()
            print(f"梗概ID: {summary.summary_id}")
            print(f"来源章节: {summary.source_chapters}")
            print(f"内容长度: {len(summary.content)} 字符")
            print()
            print("=== 梗概内容 ===")
            print(summary.content)
            print("=" * 60)
            print()
            print(f"关键角色: {len(summary.key_roles)}")
            for i, role in enumerate(summary.key_roles, 1):
                print(f"  {i}. {role.name} (第{role.first_appearance}章, {role.role_type})")
            print()
            print(f"重要设定: {len(summary.key_settings)}")
            for i, setting in enumerate(summary.key_settings, 1):
                print(f"  {i}. {setting}")
            print()
            print(f"生成时间: {summary.generated_at}")
            print("=" * 60)

            print("\n[OK] 剧情梗概已保存到文件！")

        except Exception as e:
            print(f"\n[X] 剧情梗概生成失败: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def cmd_read_chapters(self, args):
        """读取章节命令"""
        from core.novel_processor.chapter_reader import ChapterReader

        print("=" * 60)
        print("灵影短剧系统 - 读取小说章节")
        print("=" * 60)

        self.novel_path = args.novel

        reader = ChapterReader(self.novel_path)

        # 读取章节范围
        start = args.start if args.start else 1
        end = args.end if args.end else 10

        print(f"\n读取章节: 第{start}章到第{end}章")
        print(f"小说路径: {self.novel_path}")

        try:
            chapters = reader.read_chapters_by_range(start, end)

            print(f"\n读取到 {len(chapters)} 个章节:")
            print("=" * 60)

            # 按分部分组显示
            current_part = None
            for chapter in chapters:
                if chapter['part_number'] != current_part:
                    print(f"\n### 第{chapter['part_number']}部: {chapter['part_title']}")
                    current_part = chapter['part_number']

                print(f"  第{chapter['chapter_number']}章: {chapter['chapter_title']}")
                print(f"    字数: {chapter['word_count']}")

            print("\n" + "=" * 60)
            print(f"总结: 第{start}章到第{end}章，共{len(chapters)}章")
            print(f"字数总计: {sum(c['word_count'] for c in chapters)}")
            print("=" * 60)

        except Exception as e:
            print(f"读取章节失败: {e}")
            import traceback
            traceback.print_exc()

    def cmd_list_genres(self, args):
        """列出可用的生成器"""
        from utils.prompt_manager import PromptManager

        print("=" * 60)
        print("灵影短剧系统 - 可用生成器列表")
        print("=" * 60)

        style = getattr(args, 'style', 'default')
        prompt_manager = PromptManager(style=style)

        generators = prompt_manager.list_generators(style=style)

        print(f"\n当前风格: {prompt_manager.get_current_style()}")
        print(f"风格描述: {prompt_manager.config['style_mappings'][style]['description']}\n")

        print("可用生成器列表:")
        for gen_name, role_name in sorted(generators.items()):
            marker = "[OK]" if gen_name in ['plot_summarizer', 'core_element_extractor'] else "    "
            print(f"{marker} {gen_name}: {role_name}")

        print("\n其他风格:")
        for style_name in prompt_manager.list_styles():
            if style_name != style:
                print(f"  {style_name}: {prompt_manager.config['style_mappings'][style_name]['name']}")

        print("\n" + "=" * 60)
        print("提示词管理器状态")
        print("=" * 60)

        # 验证提示词
        results = prompt_manager.validate_all_prompts()
        missing = [path for path, exists in results.items() if not exists]

        if missing:
            print(f"\n[X] 缺失 {len(missing)} 个提示词文件:")
            for path in missing:
                print(f"  - {path}")
        else:
            print("\n[OK] 所有提示词文件都存在！")

    def cmd_core_elements(self, args):
        """
        提取核心元素命令
        """
        print("=" * 60)
        print("灵影短剧系统 - 核心元素提取")
        print("=" * 60)

        from core.core_element_extractor import CoreElementExtractor
        from core.novel_processor.chapter_reader import ChapterReader
        from api.minimax_client import MiniMaxClient

        # 配置
        self.novel_path = args.novel
        self.style = args.style
        self.chapter_start = args.start
        self.chapter_end = args.end

        # 读取章节
        print(f"\n[1/7] 读取小说章节: 第{self.chapter_start}章到第{self.chapter_end}章")
        print(f"小说路径: {self.novel_path}")

        reader = ChapterReader(self.novel_path)
        chapters = reader.read_chapters_by_range(self.chapter_start, self.chapter_end)

        if not chapters:
            print(f"[X] 未找到章节: 第{self.chapter_start}章到第{self.chapter_end}章")
            return

        print(f"[OK] 读取到 {len(chapters)} 个章节")

        # 读取章节内容
        print("\n[2/7] 读取章节内容...")
        chapter_data = []
        chapter_numbers = []

        for i, chapter in enumerate(chapters, 1):
            try:
                # 确保filepath是文件路径
                filepath = chapter.get('filepath') or chapter.get('file_path')
                if not filepath:
                    print(f"  [X] 第{i}章缺少文件路径")
                    continue

                content = reader.read_chapter_content(filepath)
                chapter_data.append(content)
                chapter_numbers.append(chapter['chapter_number'])
                print(f"  第{i}章: {chapter['chapter_title']} ({len(content)} 字符)")
            except Exception as e:
                print(f"  [X] 第{i}章读取失败: {e}")

        # 初始化核心元素提取器
        print(f"\n[3/7] 初始化核心元素提取器 (风格: {self.style})...")
        extractor = CoreElementExtractor(style=self.style)

        # 初始化MiniMax客户端
        print(f"\n[4/7] 初始化MiniMax API客户端...")
        minimax_client = None
        try:
            minimax_client = MiniMaxClient()
            # 设置AI客户端
            group_id_display = minimax_client.group_id[:8] if minimax_client.group_id else "Unknown"
            print(f"  MiniMax API客户端就绪 (Group ID: {group_id_display}...)...")
            extractor.set_ai_client(minimax_client)
        except Exception as e:
            print(f"  [X] MiniMax客户端初始化失败: {e}")
            print(f"  请设置环境变量 MINIMAX_GROUP_ID 和 MINIMAX_API_KEY")
            print("  将使用模拟模式提取核心元素")

        # 提取核心元素
        print(f"\n[5/7] 正在提取核心元素...")

        try:
            elements = extractor.extract(chapter_data, chapter_numbers)

            # 保存结果
            output_dir = Path("output/core_elements")
            output_dir.mkdir(parents=True, exist_ok=True)

            timestamp = elements.generated_at.strftime("%Y%m%d_%H%M%S")
            output_file = output_dir / f"chapters_{self.chapter_start}_to_{self.chapter_end}_{timestamp}.json"

            result = {
                "elements_id": elements.elements_id,
                "source_chapters": elements.source_chapters,
                "roles": [{
                    "name": r.name,
                    "age": r.age,
                    "gender": r.gender,
                    "appearance": r.appearance,
                    "personality": r.personality,
                    "identity": r.identity,
                    "abilities": r.abilities,
                    "role_type": r.role_type,
                    "first_appearance": r.first_appearance
                } for r in elements.roles],
                "settings": [{
                    "type": s.setting_type,
                    "content": s.content
                } for s in elements.settings],
                "relationships": [{
                    "role_a": r.role_a,
                    "role_b": r.role_b,
                    "type": r.relationship_type,
                    "strength": r.strength
                } for r in elements.relationships],
                "themes": {
                    "core_theme": elements.themes.core_theme,
                    "emotional_tone": elements.themes.emotional_tone,
                    "values": elements.themes.values
                },
                "generated_at": elements.generated_at.isoformat()
            }

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            # 输出结果
            print("\n" + "=" * 60)
            print("核心元素提取完成！")
            print("=" * 60)
            print(f"输出文件: {output_file}")
            print()
            print(f"元素ID: {elements.elements_id}")
            print(f"来源章节: {elements.source_chapters}")
            print()

            print("=== 角色信息 ===")
            for i, role in enumerate(elements.roles, 1):
                print(f"  {i}. {role.name}")
                if role.age:
                    print(f"     年龄: {role.age}")
                if role.gender:
                    print(f"     性别: {role.gender}")
                if role.appearance:
                    print(f"     外貌: {role.appearance}")
                if role.personality:
                    print(f"     性格: {role.personality}")
                if role.identity:
                    print(f"     身份: {role.identity}")
                if role.abilities:
                    print(f"     能力: {role.abilities}")
                if role.role_type:
                    print(f"     类型: {role.role_type}")
                if role.first_appearance:
                    print(f"     出场: 第{role.first_appearance}章")
            print()

            print("=== 设定信息 ===")
            for i, setting in enumerate(elements.settings, 1):
                print(f"  {i}. {setting.setting_type}: {setting.content}")
            print()

            print("=== 关系信息 ===")
            for i, relationship in enumerate(elements.relationships, 1):
                print(f"  {i}. {relationship.role_a} 与 {relationship.role_b}: {relationship.relationship_type} (强度: {relationship.strength}/10)")
            print()

            print("=== 主题信息 ===")
            print(f"  核心主题: {elements.themes.core_theme}")
            print(f"  情感基调: {elements.themes.emotional_tone}")
            print(f"  价值观: {elements.themes.values}")
            print()
            print(f"生成时间: {elements.generated_at}")
            print("=" * 60)

            print("\n[OK] 核心元素已保存到文件！")

        except Exception as e:
            print(f"\n[X] 核心元素提取失败: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    cli = LingyingCLI()

    parser = argparse.ArgumentParser(
        description="灵影短剧系统 - AI漫剧智能创作系统 v1.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
   # 1. 生成剧情梗概
  python cli.py plot-summary --novel "novels/《奥术神座》- 爱潜水的乌贼" --start 1 --end 30 --style ancient

  # 2. 读取章节
  python cli.py read-chapters --novel "novels/《奥术神座》- 爱潜水的乌贼" --start 1 --end 30

  # 3. 提取核心元素
  python cli.py core-elements --novel "novels/《奥术神座》- 爱潜水的乌贼" --start 1 --end 30 --style ancient
        """
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # plot-summary - 生成剧情梗概
    plot_parser = subparsers.add_parser(
        "plot-summary",
        help="生成剧情梗概"
    )
    plot_parser.add_argument("--novel", "-n", required=True,
                       help="小说目录路径")
    plot_parser.add_argument("--start", "-s", type=int, default=1,
                       help="起始章节（默认: 1）")
    plot_parser.add_argument("--end", "-e", type=int, default=3,
                       help="结束章节（默认: 3）")
    plot_parser.add_argument("--style", "-st", default="default",
                       choices=["default", "ancient", "modern", "scifi", "wuxia"],
                       help="短剧风格（默认: default）")
    plot_parser.set_defaults(func=cli.cmd_plot_summary)

    # read-chapters - 读取章节
    read_parser = subparsers.add_parser(
        "read-chapters",
        help="读取小说章节"
    )
    read_parser.add_argument("--novel", "-n", required=True,
                        help="小说目录路径")
    read_parser.add_argument("--start", "-s", type=int, default=1,
                        help="起始章节（默认: 1）")
    read_parser.add_argument("--end", "-e", type=int, default=10,
                        help="结束章节（默认: 10）")
    read_parser.set_defaults(func=cli.cmd_read_chapters)

    # list-generators - 列出生成器
    list_parser = subparsers.add_parser(
        "list-generators",
        help="列出可用生成器"
    )
    list_parser.add_argument("--style", "-st", default="default",
                     choices=["default", "ancient", "modern", "scifi", "wuxia"],
                     help="显示指定风格的生成器列表")
    list_parser.set_defaults(func=cli.cmd_list_genres)

    # list-styles - 列出风格
    style_parser = subparsers.add_parser(
        "list-styles",
        help="列出可用短剧风格"
    )
    style_parser.set_defaults(func=cli.cmd_list_genres)

    # core-elements - 提取核心元素
    core_parser = subparsers.add_parser(
        "core-elements",
        help="提取核心元素"
    )
    core_parser.add_argument("--novel", "-n", required=True,
                       help="小说目录路径")
    core_parser.add_argument("--start", "-s", type=int, default=1,
                       help="起始章节（默认: 1）")
    core_parser.add_argument("--end", "-e", type=int, default=3,
                       help="结束章节（默认: 3）")
    core_parser.add_argument("--style", "-st", default="default",
                       choices=["default", "ancient", "modern", "scifi", "wuxia"],
                       help="短剧风格（默认: default）")
    core_parser.set_defaults(func=cli.cmd_core_elements)

    args = parser.parse_args()

    if not hasattr(args, 'func'):
        parser.print_help()
        return

    args.func(args)

    print("\n[OK] 灵影短剧系统 v1.0 - AI漫剧智能创作系统")
    print("[INFO] 输入命令查看所有可用命令")
    print("[INFO] 使用 --help 查看帮助信息")


if __name__ == '__main__':
    main()
