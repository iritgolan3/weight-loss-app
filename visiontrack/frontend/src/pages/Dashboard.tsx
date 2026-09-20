import { useRef, useState } from 'react'

import { ObjectDetail } from '../components/ObjectDetail'
import { ObjectPanel } from '../components/ObjectPanel'
import { PlayerControls } from '../components/PlayerControls'
import { StatsBar } from '../components/StatsBar'
import { VideoInfoCard } from '../components/VideoInfoCard'
import { VideoStage } from '../components/VideoStage'
import { ZonePanel } from '../components/ZonePanel'

export function Dashboard() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex min-h-[38vh] flex-1 overflow-hidden rounded-lg lg:min-h-0">
          <VideoStage containerRef={stageRef} />
        </div>
        <PlayerControls containerRef={stageRef} />
        <StatsBar />
      </div>

      <button
        className="btn w-full lg:hidden"
        onClick={() => setSidebarOpen((open) => !open)}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? 'Hide tracking panel' : 'Show tracking panel'}
      </button>

      <aside
        className={`flex min-h-0 flex-col gap-3 lg:flex lg:overflow-hidden ${sidebarOpen ? 'flex' : 'hidden'}`}
      >
        <VideoInfoCard />
        <ObjectDetail />
        <ObjectPanel />
        <ZonePanel />
      </aside>
    </div>
  )
}
