import { create } from 'zustand'

import { ApiError, api } from '../api/client'
import type {
  AppSettings, ExportJobState, JobState, LiveObject, SystemInfo, Timeline,
  TrackSummary, VideoInfo, Zone,
} from '../api/types'
import { frameBuffer } from './frameBuffer'

export type ViewMode = 'live' | 'playback'
export type Toast = { id: number; kind: 'info' | 'error' | 'success'; title: string; body?: string }

const DEFAULT_SETTINGS: AppSettings = {
  model: 'yolov8n.pt',
  confidence: 0.35,
  iou: 0.5,
  tracker: 'bytetrack',
  max_lost_frames: 30,
  trajectory_length: 60,
  mode: 'balanced',
  device: 'auto',
  classes: ['person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck'],
  imgsz: null,
  detect_every_n: null,
  show_boxes: true,
  show_labels: true,
  show_trajectories: true,
  show_confidence: true,
  show_zones: true,
  show_timers: true,
  trajectory_color: '#39ff14',
  selected_color: '#ff2bd1',
  trajectory_thickness: 2,
  preview: true,
}

interface State {
  system: SystemInfo | null
  settings: AppSettings
  videos: VideoInfo[]
  video: VideoInfo | null
  job: JobState | null
  timeline: Timeline | null
  tracks: TrackSummary[]
  zones: Zone[]
  liveObjects: LiveObject[]
  playbackTime: number
  viewMode: ViewMode
  selectedId: number | null
  zoneEditing: boolean
  settingsOpen: boolean
  exportOpen: boolean
  exportJob: ExportJobState | null
  busy: string | null
  uploadProgress: number | null
  toasts: Toast[]
  zoneLog: { id: number; text: string; at: number }[]

  bootstrap: () => Promise<void>
  selectVideo: (video: VideoInfo | null) => Promise<void>
  upload: (file: File) => Promise<void>
  loadDemo: () => Promise<void>
  removeVideo: (id: string) => Promise<void>
  startAnalysis: () => Promise<void>
  stopAnalysis: () => Promise<void>
  setJob: (job: JobState) => void
  pushLiveFrame: (objects: LiveObject[]) => void
  logZoneEvent: (text: string) => void
  loadResults: (videoId: string) => Promise<void>
  refreshZones: (videoId: string) => Promise<void>
  addZone: (points: number[][], name: string, color: string) => Promise<void>
  patchZone: (zoneId: string, patch: Partial<Zone>) => Promise<void>
  removeZone: (zoneId: string) => Promise<void>
  setSettings: (patch: Partial<AppSettings>) => void
  persistSettings: () => Promise<void>
  setViewMode: (mode: ViewMode) => void
  setSelected: (id: number | null) => void
  setPlaybackTime: (t: number) => void
  setZoneEditing: (on: boolean) => void
  openSettings: (open: boolean) => void
  openExport: (open: boolean) => void
  setExportJob: (job: ExportJobState | null) => void
  toast: (kind: Toast['kind'], title: string, body?: string) => void
  dismissToast: (id: number) => void
  reportError: (error: unknown, fallback: string) => void
}

let toastSeq = 0

export const useStore = create<State>((set, get) => ({
  system: null,
  settings: DEFAULT_SETTINGS,
  videos: [],
  video: null,
  job: null,
  timeline: null,
  tracks: [],
  zones: [],
  liveObjects: [],
  playbackTime: 0,
  viewMode: 'playback',
  selectedId: null,
  zoneEditing: false,
  settingsOpen: false,
  exportOpen: false,
  exportJob: null,
  busy: null,
  uploadProgress: null,
  toasts: [],
  zoneLog: [],

  async bootstrap() {
    try {
      const [system, settings, videos] = await Promise.all([
        api.system(), api.getSettings(), api.listVideos(),
      ])
      set({ system, settings, videos })
      frameBuffer.trailLength = settings.trajectory_length
      for (const warning of system.warnings) get().toast('info', warning)
    } catch (error) {
      get().reportError(error, 'Could not reach the backend.')
    }
  },

  async selectVideo(video) {
    frameBuffer.reset()
    set({
      video, job: null, timeline: null, tracks: [], zones: [], liveObjects: [],
      selectedId: null, playbackTime: 0, zoneLog: [], exportJob: null,
      viewMode: 'playback',
    })
    if (!video) return
    await get().refreshZones(video.id)
    if (video.analyzed) {
      await get().loadResults(video.id)
    }
    // Re-attach to an analysis that is still running (e.g. after a page reload).
    try {
      const running = await api.jobForVideo(video.id)
      if (running && ['queued', 'running', 'stopping'].includes(running.status)) {
        set({ job: running, viewMode: 'live' })
      }
    } catch {
      /* the job registry is in-memory; a missing job is not an error */
    }
  },

  async upload(file) {
    set({ busy: 'Uploading video…', uploadProgress: 0 })
    try {
      const video = await api.uploadVideo(file, (p) => set({ uploadProgress: p }))
      const videos = await api.listVideos()
      set({ videos })
      await get().selectVideo(video)
      get().toast('success', 'Video ready', `${video.filename} · ${video.width}×${video.height} · ${video.fps.toFixed(0)} fps`)
    } catch (error) {
      get().reportError(error, 'Upload failed.')
    } finally {
      set({ busy: null, uploadProgress: null })
    }
  },

  async loadDemo() {
    set({ busy: 'Loading demo video…' })
    try {
      const video = await api.loadDemo()
      const videos = await api.listVideos()
      set({ videos })
      await get().selectVideo(video)
    } catch (error) {
      get().reportError(error, 'Demo video is unavailable.')
    } finally {
      set({ busy: null })
    }
  },

  async removeVideo(id) {
    try {
      await api.deleteVideo(id)
      const videos = await api.listVideos()
      set({ videos })
      if (get().video?.id === id) await get().selectVideo(null)
    } catch (error) {
      get().reportError(error, 'Could not delete that video.')
    }
  },

  async startAnalysis() {
    const { video, settings } = get()
    if (!video) return
    frameBuffer.reset()
    frameBuffer.trailLength = settings.trajectory_length
    set({ busy: 'Starting analysis…', liveObjects: [], selectedId: null, zoneLog: [] })
    try {
      const job = await api.analyze(video.id, {
        mode: settings.mode,
        model: settings.model,
        confidence: settings.confidence,
        iou: settings.iou,
        tracker: settings.tracker,
        max_lost_frames: settings.max_lost_frames,
        trajectory_length: settings.trajectory_length,
        device: settings.device,
        classes: settings.classes,
        imgsz: settings.imgsz,
        detect_every_n: settings.detect_every_n,
        preview: settings.preview,
      })
      set({ job, viewMode: 'live', timeline: null, tracks: [] })
    } catch (error) {
      get().reportError(error, 'Could not start the analysis.')
    } finally {
      set({ busy: null })
    }
  },

  async stopAnalysis() {
    const job = get().job
    if (!job) return
    try {
      set({ job: await api.stopJob(job.id) })
    } catch (error) {
      get().reportError(error, 'Could not stop the job.')
    }
  },

  setJob(job) {
    set({ job })
  },

  pushLiveFrame(objects) {
    set({ liveObjects: objects })
  },

  logZoneEvent(text) {
    const entry = { id: toastSeq += 1, text, at: Date.now() }
    set((s) => ({ zoneLog: [entry, ...s.zoneLog].slice(0, 40) }))
  },

  async loadResults(videoId) {
    try {
      const [timeline, tracks, video] = await Promise.all([
        api.timeline(videoId), api.tracks(videoId, true), api.getVideo(videoId),
      ])
      set({ timeline, tracks, video })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return
      get().reportError(error, 'Could not load the analysis results.')
    }
  },

  async refreshZones(videoId) {
    try {
      const { zones } = await api.listZones(videoId)
      set({ zones })
    } catch (error) {
      get().reportError(error, 'Could not load zones.')
    }
  },

  async addZone(points, name, color) {
    const video = get().video
    if (!video) return
    try {
      await api.createZone(video.id, { name, points, color })
      await get().refreshZones(video.id)
      get().toast('success', `Zone "${name}" created`,
        'Re-run the analysis to compute dwell time for this zone.')
    } catch (error) {
      get().reportError(error, 'Could not create the zone.')
    }
  },

  async patchZone(zoneId, patch) {
    const video = get().video
    if (!video) return
    try {
      await api.updateZone(video.id, zoneId, patch)
      await get().refreshZones(video.id)
    } catch (error) {
      get().reportError(error, 'Could not update the zone.')
    }
  },

  async removeZone(zoneId) {
    const video = get().video
    if (!video) return
    try {
      await api.deleteZone(video.id, zoneId)
      await get().refreshZones(video.id)
    } catch (error) {
      get().reportError(error, 'Could not delete the zone.')
    }
  },

  setSettings(patch) {
    const settings = { ...get().settings, ...patch }
    if (patch.trajectory_length) frameBuffer.trailLength = patch.trajectory_length
    set({ settings })
  },

  async persistSettings() {
    try {
      const saved = await api.saveSettings(get().settings)
      set({ settings: saved })
    } catch (error) {
      get().reportError(error, 'Could not save settings.')
    }
  },

  setViewMode(viewMode) { set({ viewMode }) },
  setSelected(selectedId) { set({ selectedId }) },
  setPlaybackTime(playbackTime) { set({ playbackTime }) },
  setZoneEditing(zoneEditing) { set({ zoneEditing }) },
  openSettings(settingsOpen) { set({ settingsOpen }) },
  openExport(exportOpen) { set({ exportOpen }) },
  setExportJob(exportJob) { set({ exportJob }) },

  toast(kind, title, body) {
    const id = toastSeq += 1
    set((s) => ({ toasts: [...s.toasts, { id, kind, title, body }] }))
    if (kind !== 'error') {
      setTimeout(() => get().dismissToast(id), 6000)
    }
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  reportError(error, fallback) {
    if (error instanceof ApiError) {
      get().toast('error', error.message || fallback, error.hint ?? undefined)
    } else {
      get().toast('error', fallback, error instanceof Error ? error.message : String(error))
    }
  },
}))
