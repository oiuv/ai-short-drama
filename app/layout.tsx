import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: '雪风AI短剧工坊',
  description: '把一个想法或故事，经过剧本、角色、场景、道具、分镜与剪辑，变成一部完整影片',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
