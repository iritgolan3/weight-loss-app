import { useEffect, useState } from 'react'

import { CameraDialog } from './components/CameraDialog'
import { ExportDialog } from './components/ExportDialog'
import { Landing } from './components/Landing'
import { SettingsDialog } from './components/SettingsDialog'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { VideoLibrary } from './components/VideoLibrary'
import { useJobSocket } from './hooks/useJobSocket'
import { Dashboard } from './pages/Dashboard'
import { useStore } from './lib/store'

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap)
  const video = useStore((s) => s.video)
  const job = useStore((s) => s.job)
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => { void bootstrap() }, [bootstrap])

  // Live analysis feed for the active job.
  useJobSocket(
    job && ['queued', 'running', 'stopping'].includes(job.status) ? job.id : null,
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar onOpenLibrary={() => setLibraryOpen(true)} />
      {video ? <Dashboard /> : <Landing />}
      <VideoLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <CameraDialog />
      <SettingsDialog />
      <ExportDialog />
      <Toasts />
    </div>
  )
}
