import type { AnalysisMode, DeviceChoice, TrackerType } from '../api/types'
import { useStore } from '../lib/store'
import { Dialog, Field, SectionTitle, Toggle } from './Dialog'

const ALL_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck', 'train', 'boat',
  'traffic light', 'stop sign', 'dog', 'cat', 'backpack', 'handbag', 'suitcase',
]

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen)
  const close = useStore((s) => s.openSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const persist = useStore((s) => s.persistSettings)
  const system = useStore((s) => s.system)

  const modePreset = system?.modes?.[settings.mode]

  return (
    <Dialog
      open={open}
      title="Settings"
      subtitle="Model, tracking, display and performance. Model/tracking changes apply to the next analysis run; display changes apply immediately."
      onClose={() => close(false)}
      width="max-w-3xl"
      footer={
        <>
          <button className="btn" onClick={() => close(false)}>Close</button>
          <button className="btn btn-primary" onClick={() => { void persist(); close(false) }}>
            Save settings
          </button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionTitle>Model</SectionTitle>
          <div className="space-y-3">
            <Field label="Detection model" hint="Weights download automatically on first use and are cached in data/models.">
              <select
                className="field"
                value={settings.model}
                onChange={(e) => setSettings({ model: e.target.value })}
              >
                {(system?.models ?? [{ id: settings.model, label: settings.model, note: '', downloaded: true }])
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.note}{m.downloaded ? '' : ' (downloads on use)'}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={`Confidence threshold — ${settings.confidence.toFixed(2)}`}>
              <input type="range" min={0.05} max={0.9} step={0.05} value={settings.confidence}
                     onChange={(e) => setSettings({ confidence: Number(e.target.value) })} />
            </Field>
            <Field label={`IoU threshold — ${settings.iou.toFixed(2)}`}>
              <input type="range" min={0.1} max={0.9} step={0.05} value={settings.iou}
                     onChange={(e) => setSettings({ iou: Number(e.target.value) })} />
            </Field>
            <Field label="Classes to track">
              <div className="flex flex-wrap gap-1">
                {ALL_CLASSES.map((cls) => {
                  const on = settings.classes.includes(cls)
                  return (
                    <button
                      key={cls}
                      onClick={() => setSettings({
                        classes: on
                          ? settings.classes.filter((c) => c !== cls)
                          : [...settings.classes, cls],
                      })}
                      className={`chip ${on ? 'border-neon/50 text-neon' : ''}`}
                    >
                      {cls}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Tracking</SectionTitle>
          <div className="space-y-3">
            <Field label="Tracker" hint="ByteTrack is fast and robust. BoT-SORT adds motion compensation and is slower.">
              <select className="field" value={settings.tracker}
                      onChange={(e) => setSettings({ tracker: e.target.value as TrackerType })}>
                <option value="bytetrack">ByteTrack</option>
                <option value="botsort">BoT-SORT</option>
              </select>
            </Field>
            <Field label={`Max lost frames — ${settings.max_lost_frames}`}
                   hint="How long a track survives an occlusion before its ID is retired.">
              <input type="range" min={5} max={150} step={5} value={settings.max_lost_frames}
                     onChange={(e) => setSettings({ max_lost_frames: Number(e.target.value) })} />
            </Field>
            <Field label={`Trajectory length — ${settings.trajectory_length} points`}>
              <input type="range" min={5} max={300} step={5} value={settings.trajectory_length}
                     onChange={(e) => setSettings({ trajectory_length: Number(e.target.value) })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Trail colour">
                <input type="color" className="field h-8 p-1" value={settings.trajectory_color}
                       onChange={(e) => setSettings({ trajectory_color: e.target.value })} />
              </Field>
              <Field label="Selected colour">
                <input type="color" className="field h-8 p-1" value={settings.selected_color}
                       onChange={(e) => setSettings({ selected_color: e.target.value })} />
              </Field>
            </div>
            <Field label={`Line thickness — ${settings.trajectory_thickness}px`}>
              <input type="range" min={1} max={6} step={1} value={settings.trajectory_thickness}
                     onChange={(e) => setSettings({ trajectory_thickness: Number(e.target.value) })} />
            </Field>
          </div>
        </div>

        <div>
          <SectionTitle>Display</SectionTitle>
          <div className="grid gap-2">
            <Toggle label="Bounding boxes" checked={settings.show_boxes} onChange={(v) => setSettings({ show_boxes: v })} />
            <Toggle label="Labels" checked={settings.show_labels} onChange={(v) => setSettings({ show_labels: v })} />
            <Toggle label="Confidence" checked={settings.show_confidence} onChange={(v) => setSettings({ show_confidence: v })} />
            <Toggle label="Trajectories" checked={settings.show_trajectories} onChange={(v) => setSettings({ show_trajectories: v })} />
            <Toggle label="Zones" checked={settings.show_zones} onChange={(v) => setSettings({ show_zones: v })} />
            <Toggle label="Timers" checked={settings.show_timers} onChange={(v) => setSettings({ show_timers: v })} />
            <Toggle label="Live preview stream" checked={settings.preview} onChange={(v) => setSettings({ preview: v })} />
          </div>
        </div>

        <div>
          <SectionTitle>Performance</SectionTitle>
          <div className="space-y-3">
            <Field label="Analysis mode">
              <select className="field" value={settings.mode}
                      onChange={(e) => setSettings({ mode: e.target.value as AnalysisMode, imgsz: null, detect_every_n: null })}>
                <option value="fast">Fast — lower resolution, skips frames</option>
                <option value="balanced">Balanced — recommended</option>
                <option value="high_accuracy">High accuracy — every frame, slower</option>
              </select>
            </Field>
            <Field
              label={`Processing resolution — ${settings.imgsz ?? modePreset?.imgsz ?? 640}px`}
              hint="Long side of the frame passed to the model. Leave at the preset unless you know you need more."
            >
              <input type="range" min={320} max={1280} step={32}
                     value={settings.imgsz ?? modePreset?.imgsz ?? 640}
                     onChange={(e) => setSettings({ imgsz: Number(e.target.value) })} />
            </Field>
            <Field
              label={`Detect every ${settings.detect_every_n ?? modePreset?.detect_every_n ?? 1} frame(s)`}
              hint="Higher values process faster; overlays then hold the last analysed frame between samples."
            >
              <input type="range" min={1} max={10} step={1}
                     value={settings.detect_every_n ?? modePreset?.detect_every_n ?? 1}
                     onChange={(e) => setSettings({ detect_every_n: Number(e.target.value) })} />
            </Field>
            <Field
              label="Device"
              hint={system?.cuda_available
                ? `CUDA available: ${system.cuda_device_name}`
                : 'No CUDA GPU detected — CPU will be used even if CUDA is selected.'}
            >
              <select className="field" value={settings.device}
                      onChange={(e) => setSettings({ device: e.target.value as DeviceChoice })}>
                <option value="auto">Auto (GPU when available)</option>
                <option value="cpu">Force CPU</option>
                <option value="cuda">Force CUDA</option>
              </select>
            </Field>
            {system && (
              <div className="rounded-md border border-ink-600 bg-ink-900/60 p-2.5 font-mono text-[10px] leading-relaxed text-slate-500">
                torch {system.torch_version ?? '—'} · opencv {system.opencv_version} · ultralytics {system.ultralytics_version ?? '—'}
                <br />device in use: <span className="text-neon">{system.device_in_use}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
