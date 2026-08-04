import { StudioShell } from '@/components/studio/studio-shell'

export default async function StudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <StudioShell projectId={projectId} />
}
