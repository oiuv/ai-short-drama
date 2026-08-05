import type { Metadata } from 'next'
import { CreateProjectPage } from '@/components/create-project-page'

export const metadata: Metadata = {
  title: '建立片场 · 雪风AI短剧工坊',
  description: '设置故事、题材、画幅和视觉风格，开始一部新的 AI 短剧。',
}

export default function NewProjectPage() {
  return <CreateProjectPage />
}
