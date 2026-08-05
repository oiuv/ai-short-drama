import { describe, expect, it } from 'vitest'
import { loadSkill, loadSkillPrompt } from './skills'

const STANDARD_SKILLS = ['script-brief', 'drama-script', 'drama-cast-scene', 'drama-shot-prompt']

describe('标准影视 Skills', () => {
  it.each(STANDARD_SKILLS)('%s 只有标准元数据并可独立加载', async name => {
    const skill = await loadSkill(name)
    expect(skill.name).toBe(name)
    expect(skill.description.length).toBeGreaterThan(20)
    expect(skill.instructions).not.toContain('[TODO')
    expect(skill.instructions.length).toBeGreaterThan(1_000)
  })

  it('预加载编剧 Skill 直接引用的专业资料', async () => {
    const skill = await loadSkill('drama-script')
    expect(skill.references.map(reference => reference.path)).toEqual([
      'references/satisfaction-model.md',
      'references/theme-patterns.md',
      'references/template-analysis.md',
    ])
    const prompt = await loadSkillPrompt('drama-script')
    expect(prompt).toContain('# 参考资料：references/satisfaction-model.md')
    expect(prompt).toContain('爽感 = 消极情绪 × 烈度放大 × 信息差打脸')
  })

  it('需求优化 Skill 保留用户约束并输出可继续创作的结构', async () => {
    const prompt = await loadSkillPrompt('script-brief')
    expect(prompt).toContain('硬约束')
    expect(prompt).toContain('【主角设定】')
    expect(prompt).toContain('【核心冲突与爽点】')
    expect(prompt).toContain('"genreDetected"')
    expect(prompt).toContain('只输出可解析 JSON')
  })

  it('编剧 Skill 约束分批生成、续写、改写和结局集', async () => {
    const skill = await loadSkill('drama-script')
    const prompt = await loadSkillPrompt('drama-script')
    expect(skill.description).toContain('爽剧短剧剧本创作')
    expect(skill.description).toContain('不承担通用影视剧本、专业小说改编或上传剧本解析')
    expect(skill.references).toHaveLength(3)
    expect(prompt).toContain('【集数控制指令】')
    expect(prompt).toContain('“本次生成集数”是本次必须交付的批次数量')
    expect(prompt).toContain('单次最多输出 10 集')
    expect(prompt).toContain('计划总集数')
    expect(prompt).toContain('**续写**')
    expect(prompt).toContain('**指定分集改写**')
    expect(prompt).toContain('其他已有分集不得复述或修改')
    expect(prompt).toContain('禁止 `【本剧终】`')
    expect(prompt).toContain('绝对范围连续递增')
    expect(prompt).toContain('标准剧集每集写约 10 场完整戏')
    expect(prompt).toContain('情节复杂、多线并行时可扩展到 12–15 场')
    expect(prompt).toContain('同一集内禁止重号、跳号或中途重新从 `[1]` 开始')
    expect(prompt).toContain('爽感 = 消极情绪 × 烈度放大 × 信息差打脸')
    expect(prompt).toContain('每 5 集安排一个小高潮，每 10–20 集安排一个大反转')
    expect(prompt).toContain('角色形象 = 纯净主体')
    expect(prompt).toContain('空镜场景 = 无人舞台')
    expect(prompt).toContain('13 个剧本类型分析')
    expect(prompt).toContain('打脸时机选择')
    expect(prompt).not.toContain('60 秒短集通常只容纳 2–4 场')
  })

  it('拒绝路径穿越和非标准 Skill 名称', async () => {
    await expect(loadSkill('../drama-script')).rejects.toThrow('名称无效')
    await expect(loadSkill('Drama Script')).rejects.toThrow('名称无效')
  })
})
