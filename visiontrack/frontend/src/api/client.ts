import type {
  AppSettings, DiscoveredCamera, ExportJobState, JobState, SystemInfo, Timeline,
  TrackSummary, VideoInfo, Zone,
} from './types'

export class ApiError extends Error {
  code: string
  hint?: string | null
  details?: unknown
  status: number

  constructor(status: number, body: { code: string; message: string; hint?: string | null; details?: unknown }) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.hint = body.hint
    this.details = body.details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (cause) {
    throw new ApiError(0, {
      code: 'backend_unreachable',
      message: 'Cannot reach the VisionTrack backend.',
      hint: 'Is the Python server running? Start it with start.bat (or uvicorn app.main:app).',
      details: String(cause),
    })
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  const payload = text ? safeParse(text) : null

  if (!response.ok) {
    const body = (payload as { error?: { code: string; message: string } } | null)?.error
    throw new ApiError(response.status, body ?? {
      code: 'http_error',
      message: `Request failed (${response.status} ${response.statusText}).`,
      hint: 'See the backend console for details.',
      details: text.slice(0, 400),
    })
  }
  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  system: () => request<SystemInfo>('/api/system'),

  getSettings: () => request<AppSettings>('/api/settings'),
  saveSettings: (settings: AppSettings) =>
    request<AppSettings>('/api/settings', { ...json(settings), method: 'PUT' }),

  listVideos: () => request<VideoInfo[]>('/api/videos'),
  getVideo: (id: string) => request<VideoInfo>(`/api/videos/${id}`),
  deleteVideo: (id: string) => request<void>(`/api/videos/${id}`, { method: 'DELETE' }),
  loadDemo: () => request<VideoInfo>('/api/videos/demo', { method: 'POST' }),

  uploadVideo: (file: File, onProgress?: (pct: number) => void) =>
    new Promise<VideoInfo>((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/videos')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
      }
      xhr.onload = () => {
        const payload = safeParse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) return resolve(payload as VideoInfo)
        const body = (payload as { error?: { code: string; message: string } } | null)?.error
        reject(new ApiError(xhr.status, body ?? {
          code: 'upload_failed',
          message: `Upload failed (${xhr.status}).`,
          hint: 'Check the file format and the backend console.',
        }))
      }
      xhr.onerror = () => reject(new ApiError(0, {
        code: 'backend_unreachable',
        message: 'Upload failed — the backend is not reachable.',
        hint: 'Start the Python server and try again.',
      }))
      xhr.send(form)
    }),

  analyze: (videoId: string, config: Record<string, unknown>) =>
    request<JobState>(`/api/videos/${videoId}/analyze`, json(config)),
  getJob: (jobId: string) => request<JobState>(`/api/jobs/${jobId}`),
  stopJob: (jobId: string) => request<JobState>(`/api/jobs/${jobId}/stop`, { method: 'POST' }),
  jobForVideo: (videoId: string) => request<JobState | null>(`/api/videos/${videoId}/job`),

  tracks: (videoId: string, trajectory = true) =>
    request<TrackSummary[]>(`/api/videos/${videoId}/tracks?trajectory=${trajectory}`),
  timeline: (videoId: string) => request<Timeline>(`/api/videos/${videoId}/timeline`),
  clearResults: (videoId: string) =>
    request<void>(`/api/videos/${videoId}/results`, { method: 'DELETE' }),

  discoverCameras: () =>
    request<{ cameras: DiscoveredCamera[]; hint: string | null }>('/api/cameras/discover'),
  listCameras: () => request<VideoInfo[]>('/api/cameras'),
  openCamera: (source: string, label?: string) =>
    request<VideoInfo>('/api/cameras', json({ source, label: label ?? null })),
  closeCamera: (cameraId: string) =>
    request<void>(`/api/cameras/${cameraId}`, { method: 'DELETE' }),

  listZones: (videoId: string) =>
    request<{ video_id: string; zones: Zone[] }>(`/api/videos/${videoId}/zones`),
  createZone: (videoId: string, body: { name: string; points: number[][]; color: string }) =>
    request<Zone>(`/api/videos/${videoId}/zones`, json(body)),
  updateZone: (videoId: string, zoneId: string, body: Partial<Zone>) =>
    request<Zone>(`/api/videos/${videoId}/zones/${zoneId}`, { ...json(body), method: 'PATCH' }),
  deleteZone: (videoId: string, zoneId: string) =>
    request<void>(`/api/videos/${videoId}/zones/${zoneId}`, { method: 'DELETE' }),

  exportVideo: (videoId: string, options: Record<string, unknown>) =>
    request<ExportJobState>(`/api/videos/${videoId}/export/video`, json(options)),
  exportStatus: (exportId: string) => request<ExportJobState>(`/api/exports/${exportId}`),

  streamUrl: (videoId: string) => `/api/videos/${videoId}/stream`,
  dataExportUrl: (videoId: string, format: 'json' | 'csv', dataset: 'detections' | 'tracks' = 'detections') =>
    `/api/videos/${videoId}/export/data?format=${format}&dataset=${dataset}`,
  exportDownloadUrl: (exportId: string) => `/api/exports/${exportId}/download`,
}

export function socketUrl(path: string): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}${path}`
}
