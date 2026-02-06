# 提示词管理系统文档

## 📖 概述

提示词管理系统是灵影短剧系统的核心组件之一，负责管理所有AI生成器的系统提示词。系统采用角色化设计，每个生成器对应一个AI专家角色，提示词独立保存为文件，支持多种风格切换。

---

## 🎯 设计目标

1. **角色化设计**：每个生成器对应一个AI专家角色
2. **提示词独立管理**：所有系统提示词保存为独立文件
3. **风格适配**：支持不同类型短剧（古风、现代、科幻、玄幻等）
4. **易于维护**：统一的文件结构和命名规范
5. **动态加载**：运行时根据配置加载对应风格的提示词

---

## 📁 文件组织结构

```
data/
└── prompts/                              # 提示词根目录
    ├── base/                             # 基础风格提示词
    │   ├── default/                      # 默认风格（通用）
    │   │   ├── role_descriptions.json    # AI角色描述库
    │   │   ├── plot_summarizer.txt       # 剧情梗概生成器
    │   │   ├── core_element_extractor.txt # 核心元素提取器
    │   │   ├── storyline_parser.txt      # 故事线拆解器
    │   │   ├── twist_detector.txt        # 卡点剧情识别器
    │   │   ├── detailed_outline_generator.txt # 细纲生成器
    │   │   ├── episode_outline_generator.txt  # 集纲生成器
    │   │   ├── episode_script_generator.txt   # 短剧正文生成器
    │   │   ├── script_optimizer.txt      # 剧本优化器
    │   │   ├── character_card_creator.txt    # 角色卡创建器
    │   │   ├── storyboard_generator.txt     # 场景分镜生成器
    │   │   ├── visual_prompt_generator.txt   # 视觉描述生成器
    │   │   └── ...
    │   ├── ancient/                      # 古风风格
    │   │   ├── plot_summarizer.txt
    │   │   ├── episode_script_generator.txt
    │   │   ├── script_optimizer.txt
    │   │   └── ...
    │   ├── modern/                       # 现代风格
    │   │   ├── plot_summarizer.txt
    │   │   ├── episode_script_generator.txt
    │   │   └── ...
    │   ├── scifi/                        # 科幻风格
    │   │   ├── plot_summarizer.txt
    │   │   ├── episode_script_generator.txt
    │   │   └── ...
    │   └── wuxia/                        # 武侠风格
    │       ├── plot_summarizer.txt
    │       ├── episode_script_generator.txt
    │       └── ...
    │
    └── templates/                        # 用户提示词模板（运行时注入）
        ├── plot_summarizer.txt
        ├── episode_script_generator.txt
        └── ...
```

---

## 🤖 AI角色列表

### 小说处理模块

| 角色名称 | 生成器文件 | 功能描述 |
|---------|-----------|---------|
| 剧情梗概生成专家 | plot_summarizer.txt | 将多章小说内容提炼为剧情梗概 |
| 核心元素分析专家 | core_element_extractor.txt | 提取人设、设定、世界观等核心元素 |
| 故事线分析专家 | storyline_parser.txt | 拆解多条故事线，识别主线、支线、伏笔 |
| 剧情节奏把控专家 | twist_detector.txt | 识别剧情高潮、反转、爽点等卡点剧情 |

### 剧本创作模块

| 角色名称 | 生成器文件 | 功能描述 |
|---------|-----------|---------|
| 细纲创作专家 | detailed_outline_generator.txt | 根据故事线和卡点剧情生成细纲 |
| 集纲规划专家 | episode_outline_generator.txt | 规划每集章节分配和剧情节奏 |
| 短剧剧本创作专家 | episode_script_generator.txt | 创作短剧剧本正文 |
| 剧本优化专家 | script_optimizer.txt | 优化剧本，去除小说化表达 |

### 角色管理模块

| 角色名称 | 生成器文件 | 功能描述 |
|---------|-----------|---------|
| 角色卡创作专家 | character_card_creator.txt | 创建和维护角色卡 |

### 分镜设计模块

| 角色名称 | 生成器文件 | 功能描述 |
|---------|-----------|---------|
| 分镜设计专家 | storyboard_generator.txt | 为剧本设计分镜 |
| AI视觉描述专家 | visual_prompt_generator.txt | 生成图像和视频生成所需的视觉描述提示词 |

---

## ⚙️ 配置管理

### 配置文件位置

`config/prompt_config.json`

### 配置结构

```json
{
  "current_style": "default",
  "style_mappings": {
    "default": {
      "name": "默认风格（通用）",
      "description": "适用于各种类型的短剧，不特别强调某种风格",
      "generators": {
        "plot_summarizer": "base/default/plot_summarizer.txt",
        "core_element_extractor": "base/default/core_element_extractor.txt",
        ...
      }
    },
    "ancient": {
      "name": "古风风格",
      "description": "适用于古风、武侠、仙侠类短剧",
      "language_style": "半文半白，古韵盎然",
      "generators": {
        "plot_summarizer": "base/ancient/plot_summarizer.txt",
        "episode_script_generator": "base/ancient/episode_script_generator.txt",
        ...
      }
    },
    ...
  }
}
```

---

## 🔧 提示词管理器 API

### 初始化

```python
from utils.prompt_manager import PromptManager

# 使用默认风格
prompt_manager = PromptManager()

# 使用指定风格
prompt_manager = PromptManager(style="ancient")
```

### 获取系统提示词

```python
# 获取指定生成器的系统提示词
system_prompt = prompt_manager.get_system_prompt("plot_summarizer")

# 获取指定风格的系统提示词
system_prompt = prompt_manager.get_system_prompt(
    "episode_script_generator",
    style="modern"
)
```

### 获取角色描述

```python
role_desc = prompt_manager.get_role_description("plot_summarizer")
print(role_desc["name"])  # 剧情梗概生成专家
print(role_desc["description"])
print(role_desc["capabilities"])
print(role_desc["personality"])
```

### 列出可用风格

```python
styles = prompt_manager.list_styles()
# 返回: {'default': '默认风格（通用）', 'ancient': '古风风格', ...}
```

### 列出风格下的生成器

```python
generators = prompt_manager.list_generators(style="ancient")
# 返回: {'plot_summarizer': '剧情梗概生成专家', ...}
```

### 切换风格

```python
prompt_manager.set_style("modern")
```

### 验证提示词文件

```python
results = prompt_manager.validate_all_prompts()
# 返回: {'path/to/prompt.txt': True/False}
```

---

## 📝 提示词编写规范

### 系统提示词结构

每个系统提示词文件应包含以下部分：

```
# 角色设定
你是【角色名称】，专门负责...

# 核心能力
- 能力1
- 能力2
...

# 工作原则
1. 原则1
2. 原则2
...

# 输出格式
请按照以下格式输出...

# 输入
以下是...
```

### 变量占位符

在提示词中使用 `{variable_name}` 作为变量占位符，运行时由模板引擎替换。

常用变量：
- `{chapter_count}` - 章节数量
- `{chapter_content}` - 章节内容
- `{episode_outline}` - 集纲
- `{character_cards}` - 角色卡
- `{scene_script}` - 场景剧本
- 等

---

## 🎨 风格差异化要点

### 古风风格
- **语言风格**：半文半白，古韵盎然
- **对话特点**：保留古风韵味，但保持通俗易懂
- **旁白风格**：说书人口吻，生动有力
- **视觉风格**：水墨风格，传统美学

### 现代风格
- **语言风格**：口语化，贴近生活
- **对话特点**：贴近现代人表达
- **旁白风格**：解说员口吻，直击要点
- **视觉风格**：扁平化，色彩鲜明

### 科幻风格
- **语言风格**：科技感强，术语准确
- **对话特点**：专业术语，未来感
- **旁白风格**：冷静客观，数据驱动
- **视觉风格**：赛博朋克，霓虹灯光

### 武侠风格
- **语言风格**：江湖气息，武侠韵味
- **对话特点**：武侠用语，江湖话语
- **旁白风格**：武侠说书，豪迈有力
- **视觉风格**：水墨武侠，气势磅礴

---

## 🔄 风格回退机制

当指定风格的生成器提示词不存在时，系统会自动回退到默认风格。

```python
# 尝试获取古风风格的 plot_summarizer
prompt = prompt_manager.get_system_prompt(
    "plot_summarizer",
    style="ancient"
)

# 如果古风风格不存在，自动回退到 default 风格
# 日志会记录: "风格 ancient 未找到 plot_summarizer 的提示词，回退到默认风格"
```

---

## ✅ 提示词验证

### 验证命令

```bash
python cli.py --validate-prompts
```

### 验证输出

```
=== 提示词验证 ===
✅ 所有提示词文件都存在
```

或

```
=== 提示词验证 ===
❌ 缺失 3 个提示词文件:
  - data/prompts/base/ancient/plot_summarizer.txt
  - data/prompts/base/ancient/script_optimizer.txt
  - data/prompts/base/ancient/visual_prompt_generator.txt
```

---

## 📊 使用示例

### 示例1：在生成器中使用

```python
from utils.prompt_manager import PromptManager
from api.minimax_client import MiniMaxClient

class PlotSummarizer:
    def __init__(self, style: str = "default"):
        self.style = style
        self.prompt_manager = PromptManager(style)
        self.client = MiniMaxClient()
        
        # 获取系统提示词
        self.system_prompt = self.prompt_manager.get_system_prompt("plot_summarizer")
    
    def generate(self, chapter_content: str, chapter_count: int = 30) -> str:
        # 加载用户提示词模板
        user_template_path = self.prompt_manager.base_dir / "templates" / "plot_summarizer.txt"
        with open(user_template_path, 'r', encoding='utf-8') as f:
            user_template = f.read()
        
        # 填充用户提示词
        user_prompt = user_template.format(
            chapter_count=chapter_count,
            chapter_content=chapter_content
        )
        
        # 调用AI模型
        response = self.client.chat(
            message=user_prompt,
            model="M2-her",
            temperature=0.7,
            max_tokens=2000,
            system_prompt=self.system_prompt
        )
        
        return response
```

### 示例2：CLI切换风格

```bash
# 使用古风风格生成剧本
python cli.py --style ancient --generate-script

# 列出所有可用风格
python cli.py --list-styles

# 验证提示词文件
python cli.py --validate-prompts
```

---

## 🔍 故障排除

### 问题1：提示词文件找不到

**错误信息**：
```
FileNotFoundError: 提示词文件不存在: data/prompts/base/ancient/plot_summarizer.txt
```

**解决方案**：
1. 检查文件路径是否正确
2. 检查提示词配置文件
3. 运行验证命令检查缺失的文件

### 问题2：风格不支持

**错误信息**：
```
ValueError: 不支持的风格: xxx
```

**解决方案**：
1. 使用 `--list-styles` 查看可用风格
2. 在配置文件中添加新风格配置
3. 创建对应的提示词文件

### 问题3：角色描述未找到

**错误信息**：
```
ValueError: 未找到角色描述: xxx
```

**解决方案**：
1. 检查 `role_descriptions.json` 文件
2. 确认角色名称拼写正确
3. 添加缺失的角色描述

---

## 📚 相关文档

- [提示词编写指南](./prompt_writing_guide.md)
- [风格适配指南](./style_adaptation_guide.md)
- [开发指南](./development_guide.md)
