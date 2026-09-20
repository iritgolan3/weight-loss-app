export type AnalysisMode = 'fast' | 'balanced' | 'high_accuracy'
export type TrackerType = 'bytetrack' | 'botsort'
export type DeviceChoice = 'auto' | 'cpu' | 'cuda'

export interface VideoInfo {
  id: string
  /** 'live' is a camera or stream; 'file' is an uploaded video. */
  kind: 'file' | 'live'
  source?: string | null
  filename: string
  size_bytes: number
  width: number
  height: number
  fps: number
  frame_count: number
  duration: number
  codec: string
  created_at: number
  analyzed: boolean
  analysis: AnalysisSummary | null
}

export interface AnalysisSummary {
  video_id: string
  video_filename: string
  kind?: 'file' | 'live'
  recording?: string | null
  job_id: string
  completed_at: number
  stopped_early: boolean
  frames_analyzed: number
  frames_decoded: number
  duration_analyzed: number
  unique_objects: number
  class_counts: Record<string, number>
  device: string
  model: string
  fps: number
  width: number
  height: number
  detect_every_n: number
  zones: Zone[]
  speed_note: string
}

export interface ZoneTimeInfo {
  zone_id: string
  zone_name: string
  inside: boolean
  entered_at: number | null
  exited_at: number | null
  total_time: number
  entries: number
}

/** Per-frame object as streamed over the websocket. */
export interface LiveObject {
  id: number
  cls: string
  confidence: number
  bbox: [number, number, number, number]
  center: [number, number]
  first_seen: number
  last_seen: number
  visible_duration: number
  status: 'moving' | 'stationary'
  speed_px_per_s: number | null
  speed_real_world: null
  zones: ZoneTimeInfo[]
}

export interface TrackSummary {
  id: number
  cls: string
  confidence: number
  max_confidence: number
  first_seen: number
  last_seen: number
  first_frame: number
  last_frame: number
  visible_duration: number
  samples: number
  status: string
  last_bbox: [number, number, number, number]
  speed_px_per_s: number | null
  speed_real_world: null
  zones: ZoneTimeInfo[]
  trajectory?: { x: number; y: number; time: number }[]
}

/** Compact timeline sample: o = [id, clsIdx, conf, x1,y1,x2,y2, status, zoneIdx, zoneTime] */
export type TimelineObject = [number, number, number, number, number, number, number, number, number, number]

export interface TimelineSample {
  f: number
  t: number
  o: TimelineObject[]
}

export interface Timeline {
  video_id: string
  fps: number
  width: number
  height: number
  detect_every_n: number
  classes: string[]
  zone_ids: string[]
  samples: TimelineSample[]
  schema: string
}

export interface Zone {
  id: string
  name: string
  color: string
  visible: boolean
  points: [number, number][]
}

export interface JobStats {
  processing_fps: number
  detection_fps: number
  video_fps: number
  frames_processed: number
  frames_total: number
  detections_last_frame: number
  tracked_objects: number
  unique_objects: number
  elapsed: number
  eta: number | null
}

export type JobStatus = 'queued' | 'running' | 'stopping' | 'stopped' | 'completed' | 'failed'

export interface JobState {
  id: string
  video_id: string
  live: boolean
  recording: string | null
  status: JobStatus
  progress: number
  stats: JobStats
  config: Record<string, unknown>
  device: string
  model: string
  error: ApiErrorBody | null
  started_at: number | null
  finished_at: number | null
}

export interface ApiErrorBody {
  code: string
  message: string
  hint?: string | null
  details?: unknown
}

export interface SystemInfo {
  torch_version: string | null
  cuda_available: boolean
  cuda_device_name: string | null
  device_in_use: string
  opencv_version: string
  ultralytics_version: string | null
  models: { id: string; label: string; note: string; downloaded: boolean }[]
  modes: Record<AnalysisMode, { imgsz: number; detect_every_n: number; label: string }>
  default_classes: string[]
  demo_video_available: boolean
  backend_ready: boolean
  warnings: string[]
}

export interface AppSettings {
  model: string
  confidence: number
  iou: number
  tracker: TrackerType
  max_lost_frames: number
  trajectory_length: number
  mode: AnalysisMode
  device: DeviceChoice
  classes: string[]
  imgsz: number | null
  detect_every_n: number | null
  show_boxes: boolean
  show_labels: boolean
  show_trajectories: boolean
  show_confidence: boolean
  show_zones: boolean
  show_timers: boolean
  trajectory_color: string
  selected_color: string
  trajectory_thickness: number
  preview: boolean
}

export interface ExportJobState {
  id: string
  video_id: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  output: string | null
  filename: string | null
  error: ApiErrorBody | null
}

export type SocketEvent =
  | { type: 'state'; job: JobState }
  | { type: 'frame'; frame: number; timestamp: number; objects: LiveObject[]; stats: JobStats; progress: number; preview?: string; preview_size?: [number, number] }
  | { type: 'zone_event'; event: 'enter' | 'exit'; zone_id: string; zone_name: string; track_id: number; cls: string; timestamp: number; total_time: number; reason?: string }
  | { type: 'error'; error: ApiErrorBody }
  | { type: 'done'; job: JobState }
  | { type: 'export'; job: ExportJobState }

export interface DiscoveredCamera {
  source: string
  label: string
  width: number
  height: number
  fps: number
}

/** Options that only apply to a live run. */
export interface LiveOptions {
  maxDuration: number | null
  record: boolean
}
