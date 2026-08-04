# 雪风AI短剧工坊

雪风AI短剧工坊用于把一个想法或故事变成一部完整影片。它是面向个人本机部署的六步 AI 短剧制作工作台，参考 XuefengAI 的影视工坊工作流重新设计，只保留「剧本 → 角色 → 场景 → 道具 → 分镜 → 剪辑成片」这一条完整制作线；没有注册登录、用户体系、积分、OSS、任务 Worker 或其他平台模块。

## 功能

1. **剧本**：DeepSeek 加载 `drama-script` 爽剧创作 Skill，根据故事想法或爽剧底稿生成项目梗概、分集剧本，以及结构化的角色、场景、道具档案；支持逐集编辑和确认。
2. **角色**：维护角色及造型版本，用 Seedream 5.0 Lite 生成角色设定图，也可上传本地 Base64 图片。
3. **场景**：维护无人场景和出场集数，生成并选择场景图片版本。
4. **道具**：维护关键道具、类别和描述，生成并选择道具图片版本。
5. **分镜**：DeepSeek 拆解单集镜头；选择最多 9 张本地素材作为参考，以 Base64 data URL 提交给 Seedance 2.0 / Fast / Mini，轮询结果后立即下载到本机。
6. **剪辑**：按集排列生成成功的镜头，设置启用状态、入点和出点，保存草稿并调用本机 FFmpeg 合成为 MP4。

建立片场时可从常用爽剧题材列表中选择，也可以填写自定义题材；画面比例只提供 `9:16` 竖屏和 `16:9` 横屏。视觉风格完整迁移 XuefengAI 的 39 个精选预设（真人、2D、3D），预览素材随项目保存在 `public/style-previews/`，运行时不依赖 OSS。

## 技术结构

- Next.js 16、React 19、TypeScript、Tailwind CSS
- SQLite（`better-sqlite3`）保存项目、剧本、素材档案、分镜状态和剪辑草稿
- `data/media/` 保存图片、视频和导出成片；数据库仅记录相对路径
- DeepSeek 负责执行项目内的标准影视 Skills
- 火山方舟 Seedream 5.0 Lite 负责图片生成，响应使用 `b64_json`
- 火山方舟 Seedance 2.0 系列负责视频生成
- FFmpeg 负责本机剪辑与拼接

项目没有 OSS 依赖。图片上传和模型参考图参数均使用 Base64 data URL；Seedance 返回的临时视频 URL 只用于服务端即时下载，持久化后页面只访问本地媒体路由。

## 标准影视 Skills

专业提示词不再硬编码在 API 中，而是作为可独立使用的标准 Skill 保存在 `skills/`：

```text
skills/
├── drama-script/
│   ├── SKILL.md
│   ├── agents/openai.yaml
│   └── references/
│       ├── satisfaction-model.md
│       ├── theme-patterns.md
│       └── template-analysis.md
├── drama-cast-scene/
│   ├── SKILL.md
│   └── agents/openai.yaml
└── drama-shot-prompt/
    ├── SKILL.md
    └── agents/openai.yaml
```

- `drama-script`：当前迁移的是爽剧创作 Skill，适合从故事想法或爽剧底稿创作可拍摄的分集剧本，并输出角色、场景、道具档案。剧本步骤会自动加载它及正文直接引用的专业资料。
- `drama-cast-scene`：从已有剧本独立提取相互解耦的角色造型、无人场景和关键道具，可由其他支持标准 Skill 的工具单独使用。
- `drama-shot-prompt`：把单集剧本与可用资产拆为 4–15 秒的 Seedance 2.0 视频片段；分镜步骤会自动加载它。

> **剧本能力范围**
>
> 当前开源单机版只迁移了 XuefengAI 的爽剧创作能力，没有迁移 `general-script` 通用短剧创作，也没有迁移上传个人剧本后的专业改写与续作流程。如需专业小说改编剧本、通用短剧创作，或上传个人剧本继续创作视频，请访问 [有彩视界](https://youcai.art)。

每个 `SKILL.md` 的 YAML frontmatter 只有标准字段 `name` 和 `description`，不配置表单参数、模型、Token、响应格式或应用权限。应用上下文由调用时的用户消息传入，模型选择仍由 `.env.local` 的 `DEEPSEEK_MODEL` 控制。`lib/skills.ts` 只负责安全读取、标准校验和直接引用资料的预加载，不包含注册后台、鉴权或积分逻辑。

## 运行要求

- Node.js 20.9 或更高版本
- npm
- FFmpeg（只有导出剪辑成片时需要），确保终端中可运行 `ffmpeg -version`
- DeepSeek API Key
- 火山方舟 API Key，并已开通 Seedream 5.0 Lite 与所选 Seedance 2.0 模型

## 本机启动

```bash
npm install
copy .env.example .env.local
npm run db:init
npm run dev
```

macOS/Linux 第二步使用：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```dotenv
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro

VOLCENGINE_API_KEY=your_volcengine_key
SEEDREAM_MODEL=doubao-seedream-5-0-260128
SEEDANCE_MODEL=doubao-seedance-2-0-260128
```

打开 <http://localhost:3000>，建立第一个片场即可。`db:init` 也可以省略，服务首次访问数据库时会自动初始化。

生产运行：

```bash
npm run build
npm start
```

## 数据目录

默认目录：

```text
data/
├── studio.db
├── media/
│   ├── images/
│   ├── uploads/
│   ├── videos/
│   └── exports/
└── tmp/
```

可通过 `DATA_DIR` 改到其他磁盘，例如：

```dotenv
DATA_DIR=D:\ai-short-drama-data
```

`data/` 和 `.env*` 已加入 Git 忽略。备份项目时复制数据目录即可；删除界面中的项目会删除数据库记录，但当前不会自动清理已生成的孤立媒体文件。

## 模型与参数

| 用途 | 默认模型 | 可配置项 |
| --- | --- | --- |
| 剧本、素材提取、分镜拆解 | `deepseek-v4-pro` | `DEEPSEEK_MODEL` |
| 图片 | `doubao-seedream-5-0-260128` | `SEEDREAM_MODEL` |
| 视频 | `doubao-seedance-2-0-260128` | `SEEDANCE_MODEL`，界面也可选 Fast / Mini |

Seedance 时长会限制在 4–15 秒。标准版支持 480p、720p、1080p、4K；Fast 和 Mini 在界面中限制为 480p、720p。实际可用模型、额度和区域权限以火山方舟账户为准。

## 开发验证

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

自动化测试覆盖模型 ID/画幅/时长约束、Base64 data URL 解析、本地媒体 URL 编码和目录穿越防护。真实模型调用需要配置有效密钥，会产生供应商费用，因此不包含在离线测试中。

## 当前边界

- 剧本创作目前仅包含爽剧创作；专业小说改编、通用短剧和上传个人剧本创作视频请使用 [有彩视界](https://youcai.art)。
- 这是单机个人工具，不提供多人协作、远程账户、权限隔离或云端部署方案。
- 视频任务状态在打开分镜页时由浏览器轮询；应用重启后仍可根据 SQLite 中的任务 ID 继续查询。
- 剪辑功能定位于镜头选取、裁切和顺序拼接，不包含多轨字幕、配音、音乐、转场或专业调色。
- 请勿把服务直接暴露到公网；项目没有登录和访问控制。

## License

MIT
