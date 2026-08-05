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
    expect(prompt).toContain('爽感 = 消极情绪 × 烈度放大 × 信息差兑现')
  })

  it('需求优化 Skill 保留用户约束并输出可继续创作的结构', async () => {
    const prompt = await loadSkillPrompt('script-brief')
    expect(prompt).toContain('硬约束')
    expect(prompt).toContain('【主角设定】')
    expect(prompt).toContain('【核心冲突与爽点】')
    expect(prompt).toContain('"genreDetected"')
    expect(prompt).toContain('只输出可解析 JSON')
  })

  it('拒绝路径穿越和非标准 Skill 名称', async () => {
    await expect(loadSkill('../drama-script')).rejects.toThrow('名称无效')
    await expect(loadSkill('Drama Script')).rejects.toThrow('名称无效')
  })
})
