/**
 * 视频风格统一配置
 * 
 * 从 XuefengAI 迁移的 39 种精选风格，覆盖热门、常用与小众影视创作场景：
 * - 真人（16种）
 * - 2D（12种）
 * - 3D（11种）
 * 
 * 被以下模块引用：
 * - lib/drama/workbench-helpers.ts (STYLE_PRESETS)
 * - lib/video-prompt/shot-shortcuts.ts (快捷指令)
 * - lib/drama/helpers.ts (DEFAULT_VIDEO_STYLE)
 * - skills/video-prompt/SKILL.md (videoStyle 参数)
 */

export type VideoStyleCategory = 'live-action' | '2d' | '3d'

export interface VideoStyle {
  id: string
  label: string
  category: VideoStyleCategory
  /** 影视工坊持久化和选择器匹配使用，已有值保持稳定。 */
  promptValue: string
  /** 实际交给图像/视频模型的完整视觉风格描述。 */
  generationPrompt: string
  previewImageUrl: string
}

const STYLE_PREVIEW_BASE_URL = '/style-previews'

/**
 * 39种精选风格
 * 
 * 设计原则：
 * - 每个风格都有明确的媒介、材质、色彩、光影或构图区分
 * - 覆盖影视创作场景（真人电影 + 2D动画 + 3D动画）
 * - 同类相似风格不重复拆分，避免增加无效选择
 */
export const VIDEO_STYLES: VideoStyle[] = [
  // ==================== 真人（16种）====================
  {
    id: 'cinematic',
    label: '电影质感',
    category: 'live-action',
    promptValue: '电影级光影, 高对比度, 浅景深, 自然光影',
    generationPrompt: '真人写实电影质感，电影级布光，高动态范围，真实肤质与材质，克制的电影调色，浅景深，细腻胶片颗粒，明暗层次丰富',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/008-new_cn_urban_drama_realism_style.webp`,
  },
  {
    id: 'korean-drama',
    label: '韩剧质感',
    category: 'live-action',
    promptValue: '韩剧都市柔光, 自然手持跟拍, 柔光滤镜, 浅景深, 暖色调',
    generationPrompt: '真人韩剧都市美学，柔和高调布光，通透自然肤色，低对比暖调，干净背景，浅景深，细腻浪漫氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/007-new_kdrama_urban_soft_light_style.webp`,
  },
  {
    id: 'japanese-drama',
    label: '日剧质感',
    category: 'live-action',
    promptValue: '日式青春胶片, 自然生活感, 柔和色调, 浅景深',
    generationPrompt: '真人日式生活电影质感，自然日光，低饱和清透色彩，真实生活场景，轻微胶片颗粒，留白构图，安静细腻氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/006-new_jdrama_life_naturalism_style.webp`,
  },
  {
    id: 'ancient-romance',
    label: '古装唯美',
    category: 'live-action',
    promptValue: '古偶柔光滤镜, 唯美色调, 柔和光影, 浅景深',
    generationPrompt: '真人古装唯美风格，柔光雾化，雅致传统服饰，精细妆发，低对比粉青色调，轻盈景深，浪漫诗意氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/004-new_guzhuang_romance_soft_light_style.webp`,
  },
  {
    id: 'palace-drama',
    label: '古装权谋',
    category: 'live-action',
    promptValue: '宫斗权谋冷峻, 低饱和冷色调, 压迫感, 紧张氛围',
    generationPrompt: '真人古装权谋正剧风格，庄重宫廷美术，低饱和冷色调，硬朗侧光，深景深，对称构图，克制压迫氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/002-palace_intrigue_cover_q50.webp`,
  },
  {
    id: 'wuxia',
    label: '武侠江湖',
    category: 'live-action',
    promptValue: '武侠江湖写实摄影, 动作张力, 自然光影, 电影质感',
    generationPrompt: '真人武侠电影风格，写实东方山水与古建筑，利落服饰纹理，强动作张力，风沙与衣袂动态，冷暖对比光影，开阔电影构图',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/009-wuxia_jianghu_cover_q50.webp`,
  },
  {
    id: 'suspense',
    label: '悬疑冷调',
    category: 'live-action',
    promptValue: '国产悬疑冷调, 冷色调, 压迫氛围, 紧张感',
    generationPrompt: '真人悬疑犯罪电影风格，冷青灰低饱和色调，局部硬光与深阴影，潮湿环境反光，倾斜或压迫构图，紧张未知氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/003-new_cn_suspense_cold_realism_style.webp`,
  },
  {
    id: 'hongkong-90s',
    label: '港风复古',
    category: 'live-action',
    promptValue: '90年代港片风格, 复古港风, 高对比度, 电影质感',
    generationPrompt: '真人90年代香港电影风格，霓虹街景，青绿与暖红对比色，强反差光影，颗粒胶片质感，手持纪实感，浓郁都市情绪',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/031-novel_style_row_052.webp`,
  },
  {
    id: 'retro-film',
    label: '复古胶片',
    category: 'live-action',
    promptValue: '复古电影摄影风格, 胶片颗粒感, 暖黄胶片质感, 年代感',
    generationPrompt: '真人复古胶片电影风格，柔和暖棕调，明显但细腻的胶片颗粒，轻微褪色与晕光，复古服化道，自然低反差光线',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/012-novel_style_row_054.webp`,
  },
  {
    id: 'rural-period-realism',
    label: '年代乡土写实',
    category: 'live-action',
    promptValue: '中国年代乡土写实电影风格',
    generationPrompt: '真人中国年代乡土写实电影风格，20世纪乡村生活场景，朴素服装与真实生活道具，自然日光，低饱和土黄色与青灰色调，纪实构图，克制表演，细腻胶片颗粒',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/014-novel_style_row_033.webp`,
  },
  {
    id: 'cyberpunk',
    label: '赛博朋克',
    category: 'live-action',
    promptValue: '霓虹赛博电影风格, 冷蓝紫色调, 未来科幻, 高对比度',
    generationPrompt: '真人赛博朋克电影风格，未来高密度城市，蓝紫霓虹与红色点光源，湿地反射，机械细节与全息界面，高对比暗调，迷雾体积光',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/013-novel_style_row_042.webp`,
  },
  {
    id: 'war-epic',
    label: '战争史诗',
    category: 'live-action',
    promptValue: '真人史诗战争电影风格',
    generationPrompt: '真人史诗战争电影风格，宏大战场与真实年代装备，低饱和土灰色调，烟尘体积光，强烈逆光，大全景层次，沉重壮阔氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/021-novel_style_row_037.webp`,
  },
  {
    id: 'western-wilderness',
    label: '荒野西部',
    category: 'live-action',
    promptValue: '真人荒野西部电影风格',
    generationPrompt: '真人荒野西部电影风格，辽阔荒原与边境小镇，粗粝皮革和木材，低饱和沙土色，强烈日照与长阴影，宽银幕构图，风沙颗粒，孤独冒险氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/019-novel_style_row_044.webp`,
  },
  {
    id: 'classic-black-white',
    label: '经典黑白',
    category: 'live-action',
    promptValue: '真人经典黑白电影风格',
    generationPrompt: '真人经典黑白电影风格，高反差单色影调，银盐胶片颗粒，硬朗轮廓光，深阴影，经典三点布光，克制戏剧化构图',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/036-novel_style_row_053.webp`,
  },
  {
    id: 'horror-film',
    label: '恐怖电影',
    category: 'live-action',
    promptValue: '真人恐怖电影风格',
    generationPrompt: '真人恐怖电影风格，低照度冷色调，局部暖色危险光源，深阴影与高反差，幽闭或荒废场景，压迫构图，真实材质，持续不安氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/022-novel_style_row_038.webp`,
  },
  {
    id: 'retro-atomic-punk',
    label: '复古原子科幻',
    category: 'live-action',
    promptValue: '复古未来主义原子朋克风格',
    generationPrompt: '真人复古未来主义原子朋克风格，1950年代太空时代美学，流线型金属设备，胶片广告色彩，奶油色与橙红配色，明亮硬光，乐观又怪诞的复古科幻氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/001-retro_atomic_punk_cover_800x600.webp`,
  },

  // ==================== 2D（12种）====================
  {
    id: 'chinese-anime',
    label: '国漫二次元',
    category: '2d',
    promptValue: '国漫二次元风格, 国产动漫质感, 2D手绘',
    generationPrompt: '高质量国漫二维动画风格，清晰利落线稿，东方人物设计，细腻赛璐璐上色，丰富环境层次，电影化光影，稳定统一色彩',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/064-novel_style_row_085.webp`,
  },
  {
    id: 'anime-japanese',
    label: '日系手绘动画',
    category: '2d',
    promptValue: '日系平涂插画风格, 宫崎骏/新海诚风格, 手绘质感, 柔和色调',
    generationPrompt: '日系手绘二维动画风格，干净线稿，柔和赛璐璐上色，自然清透光线，细腻天空与环境背景，青春生活感，轻盈色彩',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/059-novel_style_row_080.webp`,
  },
  {
    id: 'shanghai-animation',
    label: '上美画风',
    category: '2d',
    promptValue: '上美画风, 中国经典动画风格, 大闹天宫质感, 传统色彩',
    generationPrompt: '中国经典美术片风格，传统工笔与装饰性造型，民族色彩体系，手绘纹理，平面化构图，含蓄写意，古典叙事气质',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/083-novel_style_row_064.webp`,
  },
  {
    id: 'american-cartoon-2d',
    label: '美式卡通动画',
    category: '2d',
    promptValue: '美国漫画动画插画风格, 迪士尼2D/美漫风格, 明亮色彩',
    generationPrompt: '美式二维卡通动画风格，富有弹性的角色造型，清晰粗线条，明快高饱和配色，夸张表情与动作，层次清楚的平涂阴影',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/075-novel_style_row_068.webp`,
  },
  {
    id: 'ink-wash',
    label: '水墨风格',
    category: '2d',
    promptValue: '黑白水墨风格, 中国传统水墨, 墨色晕染, 留白意境',
    generationPrompt: '中国水墨动画风格，宣纸纤维质感，墨色浓淡与自然晕染，大面积留白，写意造型，淡雅设色，诗意流动构图',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/093-novel_style_row_089.webp`,
  },
  {
    id: 'pixel-art',
    label: '像素风格',
    category: '2d',
    promptValue: '像素风格, 复古游戏像素, 8-bit风格, 方块感',
    generationPrompt: '精致像素艺术风格，清晰像素网格，有限协调色板，逐像素光影与材质，复古游戏美术，轮廓明确，画面细节丰富',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/094-novel_style_row_082.webp`,
  },
  {
    id: 'dark-comic',
    label: '暗黑漫画',
    category: '2d',
    promptValue: '暗黑漫画风格, 悬疑恐怖题材动画, 高对比度, 冷色调',
    generationPrompt: '暗黑二维漫画风格，锋利线稿与重墨阴影，低饱和冷色，高反差明暗，夸张透视，粗粝纸张纹理，压迫神秘氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/090-novel_style_row_065.webp`,
  },
  {
    id: 'black-white-comic',
    label: '黑白漫画',
    category: '2d',
    promptValue: '黑白二维漫画动画风格',
    generationPrompt: '黑白二维漫画动画风格，清晰墨线，纯黑白高反差，网点与排线阴影，分镜式构图，夸张透视和动态线，纸张印刷质感，画面无彩色',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/078-novel_style_row_070.webp`,
  },
  {
    id: 'cinematic-painterly',
    label: '电影厚涂',
    category: '2d',
    promptValue: '电影感二维厚涂概念艺术风格',
    generationPrompt: '电影感二维厚涂动画风格，油画般厚重笔触，半写实人物与环境，综合色块塑造光影，深邃低饱和色彩，史诗场景层次，概念艺术构图，保留可见绘画肌理',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/081-novel_style_row_061.webp`,
  },
  {
    id: 'shonen-anime',
    label: '热血漫',
    category: '2d',
    promptValue: '高质量二维热血漫画动画风格',
    generationPrompt: '高质量二维热血漫画动画风格，力量感线稿，鲜明赛璐璐上色，速度线与冲击构图，夸张动作张力，高对比光影，热烈饱和色彩',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/079-novel_style_row_081.webp`,
  },
  {
    id: 'crayon-illustration',
    label: '儿童蜡笔',
    category: '2d',
    promptValue: '儿童蜡笔手绘插画风格',
    generationPrompt: '儿童蜡笔手绘插画风格，明显蜡笔笔触与纸张纹理，稚拙圆润造型，明快温暖配色，简洁构图，童真亲切氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/077-novel_style_row_073.webp`,
  },
  {
    id: 'shadow-puppet',
    label: '皮影剪纸',
    category: '2d',
    promptValue: '中国皮影剪纸动画风格',
    generationPrompt: '中国皮影与剪纸动画风格，侧面剪影人物，镂空纹样，半透明皮革或纸张质感，平面层叠构图，暖黄背光，传统民间色彩与戏剧舞台感',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/087-novel_style_row_087.webp`,
  },

  // ==================== 3D（11种）====================
  {
    id: '3d-chinese',
    label: '3D国风动画',
    category: '3d',
    promptValue: '3D国风高清渲染风格, 国风3D动画质感, 传统色彩',
    generationPrompt: '高品质国风三维动画，东方人物与服饰设计，精细布料和发丝材质，传统建筑与山水美术，写实光照，雅致国风配色，电影级渲染',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/042-novel_style_row_005.webp`,
  },
  {
    id: '3d-cartoon',
    label: '3D卡通动画',
    category: '3d',
    promptValue: '3D卡通渲染风格, 国产3D卡通质感, 明亮色彩',
    generationPrompt: '高品质三维卡通动画，圆润友好的角色造型，柔软材质，明快协调配色，柔和全局光照，清晰表情，细腻动画电影渲染',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/050-novel_style_row_002.webp`,
  },
  {
    id: '3d-american',
    label: '美式3D动画',
    category: '3d',
    promptValue: '美国卡通3D渲染风格, 皮克斯/迪士尼3D风格, 柔和彩色自然光',
    generationPrompt: '欧美院线级三维动画风格，夸张但可信的角色比例，丰富面部表情，精细毛发与布料，柔和彩色光照，饱满层次，电影级渲染',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/066-novel_style_row_025.webp`,
  },
  {
    id: 'clay-motion',
    label: '粘土动画',
    category: '3d',
    promptValue: '粘土动画风格, 手工柔软质感, 定格动画',
    generationPrompt: '粘土动画风格，手工捏塑角色与场景，可见指纹和不规则表面，柔软哑光材质，微缩布景，温暖棚拍光线，逐帧手作质感',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/065-novel_style_row_019.webp`,
  },
  {
    id: 'stop-motion',
    label: '定格动画',
    category: '3d',
    promptValue: '定格动画风格, 木偶/纸片硬质材料, 逐帧质感',
    generationPrompt: '实体模型定格动画风格，木偶或纸艺角色，真实手工接缝与材质，微缩实体布景，棚拍硬光，轻微逐帧顿挫感，复古手作氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/071-novel_style_row_026.webp`,
  },
  {
    id: 'ue5-realistic',
    label: '高端写实3D',
    category: '3d',
    promptValue: 'UE5写实渲染风格, 高端游戏写实质感, PBR渲染',
    generationPrompt: '高端写实三维CG风格，物理正确的PBR材质，真实全局光照与反射，高精度建模，电影级体积光，丰富环境细节，接近实拍的渲染质感',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/048-novel_style_row_029.webp`,
  },
  {
    id: 'stylized-3d',
    label: '风格化3D',
    category: '3d',
    promptValue: '风格化三维动画渲染风格',
    generationPrompt: '高品质风格化三维动画，半写实角色比例，造型与材质适度夸张，清晰轮廓与丰富色块，手绘感纹理，电影化布光，在卡通和写实之间保持统一的艺术化渲染',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/027-novel_style_row_010.webp`,
  },
  {
    id: 'cel-shaded-3d',
    label: '动漫三渲二',
    category: '3d',
    promptValue: '动漫三渲二风格',
    generationPrompt: '动漫三渲二风格，三维角色骨骼与空间，二维赛璐璐明暗分层，干净描边，动画化表情，流畅动作，平面色彩与立体镜头结合',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/046-novel_style_row_003.webp`,
  },
  {
    id: 'miniature-3d',
    label: '3D微缩景观',
    category: '3d',
    promptValue: '三维卡通微缩景观风格',
    generationPrompt: '三维卡通微缩景观风格，俯视或移轴构图，精巧模型化建筑与人物，丰富微小细节，柔和景深，明快配色，玩具沙盘般精致质感',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/037-novel_style_row_031.webp`,
  },
  {
    id: 'designer-toy-3d',
    label: '盲盒潮玩',
    category: '3d',
    promptValue: '潮玩盲盒三维风格',
    generationPrompt: '潮玩盲盒三维风格，头身比例夸张的可爱角色，光滑树脂与喷涂材质，干净轮廓，柔和棚拍光，低饱和潮流配色，产品级精致渲染',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/045-novel_style_row_021.webp`,
  },
  {
    id: 'victorian-dark-fantasy',
    label: '维多利亚暗黑奇幻',
    category: '3d',
    promptValue: '维多利亚暗黑奇幻三维动画风格',
    generationPrompt: '高品质维多利亚暗黑奇幻三维动画，19世纪欧洲哥特建筑与服饰，蒸汽机械、黄铜仪器和神秘学符号，煤气灯与冷雾，深青黑与暗金配色，精细PBR材质，电影级体积光，诡谲庄严氛围',
    previewImageUrl: `${STYLE_PREVIEW_BASE_URL}/039-novel_style_row_011.webp`,
  },
]

/**
 * 获取默认视频风格（电影质感）
 */
export const getDefaultVideoStyle = () => VIDEO_STYLES[0]

/**
 * 获取指定分类的风格列表
 */
export const getStylesByCategory = (category: VideoStyleCategory) => 
  VIDEO_STYLES.filter(s => s.category === category)

/**
 * 根据 ID 获取风格
 */
export const getStyleById = (id: string) => 
  VIDEO_STYLES.find(s => s.id === id)

/**
 * 根据 promptValue 获取风格（用于匹配用户输入）
 */
export const getStyleByPromptValue = (promptValue: string) =>
  VIDEO_STYLES.find(s => s.promptValue === promptValue)

/** 将持久化的稳定风格值解析为实际交给模型的完整描述。 */
export const resolveVideoStylePrompt = (promptValue: string) =>
  getStyleByPromptValue(promptValue)?.generationPrompt || promptValue

/**
 * 获取所有风格的 ID 列表（用于 SKILL 参数）
 */
export const getStyleIds = () => VIDEO_STYLES.map(s => s.id)

/**
 * 获取风格预设选项列表（用于下拉选择）
 * 格式：{ value: promptValue, label: label }
 */
export const getStylePresets = () => VIDEO_STYLES.map(s => ({
  value: s.promptValue,
  label: s.label,
}))
