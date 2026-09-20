import { useEffect, useRef } from 'react'

import { socketUrl } from '../api/client'
import type { SocketEvent } from '../api/types'
import { frameBuffer } from '../lib/frameBuffer'
import { useStore } from '../lib/store'

const OBJECT_UPDATE_MS = 220   // sidebar refresh rate
const STATS_UPDATE_MS = 400    // FPS/progress readout refresh rate

/**
 * Subscribes to the analysis websocket for the active job.
 *
 * Frame payloads go straight into the mutable frame buffer (read by the canvas
 * render loop); only throttled snapshots are pushed into React state.
 */
export function useJobSocket(jobId: string | null): void {
  const lastObjects = useRef(0)
  const lastStats = useRef(0)

  useEffect(() => {
    if (!jobId) return
    const store = useStore.getState
    const socket = new WebSocket(socketUrl(`/ws/jobs/${jobId}`))
    let closed = false

    socket.onmessage = (message) => {
      let event: SocketEvent
      try {
        event = JSON.parse(message.data as string)
      } catch {
        return
      }
      const now = performance.now()

      switch (event.type) {
        case 'frame': {
          frameBuffer.push({
            frame: event.frame,
            timestamp: event.timestamp,
            objects: event.objects,
          })
          if (event.preview) frameBuffer.setPreview(event.preview)
          if (now - lastObjects.current > OBJECT_UPDATE_MS) {
            lastObjects.current = now
            store().pushLiveFrame(event.objects)
            store().setPlaybackTime(event.timestamp)
          }
          if (now - lastStats.current > STATS_UPDATE_MS) {
            lastStats.current = now
            const job = store().job
            if (job) {
              store().setJob({ ...job, stats: event.stats, progress: event.progress })
            }
          }
          break
        }
        case 'state':
          store().setJob(event.job)
          break
        case 'zone_event': {
          const verb = event.event === 'enter' ? 'entered' : 'left'
          store().logZoneEvent(
            `${event.cls} ID:${event.track_id} ${verb} ${event.zone_name} @ ${event.timestamp.toFixed(1)}s`,
          )
          break
        }
        case 'error':
          store().toast('error', event.error.message, event.error.hint ?? undefined)
          break
        case 'done': {
          store().setJob(event.job)
          if (event.job.status === 'failed') {
            const err = event.job.error
            if (err) store().toast('error', err.message, err.hint ?? undefined)
          } else {
            const stopped = event.job.status === 'stopped'
            store().toast(
              stopped ? 'info' : 'success',
              stopped ? 'Analysis stopped' : 'Analysis complete',
              `${event.job.stats.unique_objects} objects tracked on ${event.job.device.toUpperCase()}`,
            )
            void store().loadResults(event.job.video_id).then(() => {
              // A camera has no file to replay; stay on the live canvas.
              if (store().video?.kind !== 'live') store().setViewMode('playback')
            })
            if (event.job.recording) {
              store().toast('success', 'Recording saved', event.job.recording)
            }
          }
          break
        }
        default:
          break
      }
    }

    socket.onerror = () => {
      if (!closed) {
        store().toast('error', 'Lost the live connection to the backend.',
          'The analysis may still be running — reload the page to reconnect.')
      }
    }

    return () => {
      closed = true
      socket.close()
    }
  }, [jobId])
}
