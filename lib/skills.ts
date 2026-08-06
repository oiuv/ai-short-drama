import path from 'node:path'
import { readFile } from 'node:fs/promises'

const SKILL_NAME = /^[a-z0-9-]{1,63}$/
const SKILLS_ROOT = path.join(process.cwd(), 'skills')

export interface StandardSkill {
  name: string
  description: string
  instructions: string
  references: Array<{ path: string; content: string }>
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) return trimmed.slice(1, -1)
  return trimmed
}

function parseStandardSkill(source: string, expectedName: string): Omit<StandardSkill, 'references'> {
  const normalized = source.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`Skill ${expectedName} 缺少有效 YAML frontmatter`)

  const entries = match[1]
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trimStart().startsWith('#'))
    .map(line => {
      const separator = line.indexOf(':')
      if (separator < 1 || /^\s/.test(line)) throw new Error(`Skill ${expectedName} frontmatter 格式无效`)
      return [line.slice(0, separator).trim(), stripYamlScalar(line.slice(separator + 1))] as const
    })
  const metadata = Object.fromEntries(entries)
  const keys = Object.keys(metadata)
  if (keys.some(key => key !== 'name' && key !== 'description')) {
    throw new Error(`Skill ${expectedName} frontmatter 只能包含 name 和 description`)
  }
  if (metadata.name !== expectedName) throw new Error(`Skill 目录名与 name 不一致：${expectedName}`)
  if (!metadata.description) throw new Error(`Skill ${expectedName} 缺少 description`)
  const instructions = match[2].trim()
  if (!instructions) throw new Error(`Skill ${expectedName} 没有正文`)
  return { name: metadata.name, description: metadata.description, instructions }
}

function resolveInsideSkill(skillDir: string, relativePath: string): string {
  const resolved = path.resolve(skillDir, relativePath)
  const root = path.resolve(skillDir)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Skill 引用路径越界')
  }
  return resolved
}

export async function loadSkill(name: string): Promise<StandardSkill> {
  if (!SKILL_NAME.test(name)) throw new Error(`Skill 名称无效：${name}`)
  const skillDir = path.join(SKILLS_ROOT, name)
  const skillFile = resolveInsideSkill(skillDir, 'SKILL.md')
  const parsed = parseStandardSkill(await readFile(skillFile, 'utf8'), name)
  const referencePaths = Array.from(new Set(
    Array.from(parsed.instructions.matchAll(/\]\((references\/[a-zA-Z0-9._/-]+\.md)(?:#[^)]+)?\)/g), match => match[1]),
  ))
  const references = await Promise.all(referencePaths.map(async relativePath => ({
    path: relativePath,
    content: (await readFile(resolveInsideSkill(skillDir, relativePath), 'utf8')).trim(),
  })))
  return { ...parsed, references }
}

export async function loadSkillPrompt(name: string): Promise<string> {
  const skill = await loadSkill(name)
  if (skill.references.length === 0) return skill.instructions

  const referenceText = skill.references.map(reference => (
    `# 参考资料：${reference.path}\n\n${reference.content}`
  )).join('\n\n---\n\n')
  return `${referenceText}\n\n---\n\n# Skill 正文（优先级高于以上参考资料）\n\n${skill.instructions}`
}
