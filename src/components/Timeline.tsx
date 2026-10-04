import { useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProject, type Clip } from '../store/project'
import { useUi } from '../store/ui'
import { getPlayer } from '../engine/instance'
import { clipLength, segments, totalLength } from '../engine/timeline'
import { fmt } from './ui'

const PAD = 80 // empty room after the last clip so the end is easy to reach
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]

const label = (t: number, step: number) =>
  step < 1 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : fmt(t)

export function Timeline({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void }) {
  const clips = useProject((s) => s.clips)
  const selectedId = useProject((s) => s.selectedId)
  const voiceDuration = useProject((s) => s.voiceDuration)
  const voiceUrl = useProject((s) => s.voiceUrl)
  const voiceMissing = useProject((s) => s.voiceMissing)
  const voiceName = useProject((s) => s.voiceName)
  const { reorder, select, removeClip, fitToVoiceover } = useProject.getState()
  const time = useUi((s) => s.time)
  const playing = useUi((s) => s.playing)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const scroller = useRef<HTMLDivElement>(null)
  const pps = 40 * zoom // pixels per second; the scale is linear so the ruler is exact
  const total = totalLength(clips)
  const innerW = Math.max(total, voiceDuration) * pps + PAD
  const step = STEPS.find((s) => s * pps >= 70) ?? 600

  const seek = (t: number) => getPlayer()?.seek(Math.min(Math.max(t, 0), total))

  // Follow the playhead while playing.
  useEffect(() => {
    const el = scroller.current
    if (!el || !playing) return
    const x = time * pps
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 60)
  }, [time, playing, pps])

  // Mouse wheel scrolls sideways; Ctrl/Cmd + wheel zooms.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        onZoom(Math.min(8, Math.max(0.2, zoom * (e.deltaY < 0 ? 1.15 : 0.87))))
      } else if (e.deltaX === 0 && el.scrollWidth > el.clientWidth && el.scrollHeight <= el.clientHeight + 2) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, onZoom])

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    const ids = clips.map((c) => c.id)
    reorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))))
  }

  function doSplit() {
    if (!useProject.getState().splitAtTime(time)) alert('Move the playhead into a clip, at least 0.2s from its edges, to split it.')
    else getPlayer()?.sync()
  }

  const ticks: number[] = []
  for (let t = 0; t <= innerW / pps; t += step) ticks.push(t)
  const selected = clips.find((c) => c.id === selectedId)

  return (
    <section className="timeline-bar">
      <div className="tl-head">
        <h3>Timeline</h3>
        <button onClick={doSplit} disabled={!clips.length}>✂ Split</button>
        <button onClick={() => { if (selected) { removeClip(selected.id); getPlayer()?.sync() } }} disabled={!selected}>🗑 Delete</button>
        <button onClick={() => { fitToVoiceover(); getPlayer()?.sync() }} disabled={!voiceUrl || !clips.length}>⟳ Fit to voiceover</button>
        <span className="spacer" />
        <span className="mono timecode">{label(time, 0.5)} <span className="dim">/ {label(total, 0.5)}</span></span>
        <span className="mono dim">{clips.length} clips</span>
        <label className="zoom mono">ZOOM
          <input type="range" min={0.2} max={8} step={0.05} value={zoom} onChange={(e) => onZoom(+e.target.value)} />
        </label>
      </div>
      <div className="tl-scroll" ref={scroller}>
        <div className="tl-inner" style={{ width: innerW }}>
          <Ruler ticks={ticks} step={step} pps={pps} onSeek={seek} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={clips.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              <div className="track">
                {segments(clips).map((s) => (
                  <Chip key={s.clip.id} clip={s.clip} width={clipLength(s.clip) * pps} selected={s.clip.id === selectedId}
                    onPick={(frac) => {
                      select(s.clip.id)
                      seek(s.start + frac * clipLength(s.clip))
                    }} />
                ))}
                {!clips.length && <div className="dim empty">Upload clips in the Media tab to build your timeline</div>}
              </div>
            </SortableContext>
          </DndContext>
          <div className="track audio">
            {voiceUrl
              ? <div className="vbar" style={{ width: voiceDuration * pps }}>🎙 Voiceover · {fmt(voiceDuration)}</div>
              : <span className="dim">{voiceMissing ? `Voiceover "${voiceName}" not linked. Use Relink media.` : 'No voiceover. Add one in Script & voice.'}</span>}
          </div>
          {!!clips.length && <div className="playhead" style={{ left: time * pps }} />}
        </div>
      </div>
    </section>
  )
}

/** Time ruler. Click or drag anywhere on it to seek. */
function Ruler({ ticks, step, pps, onSeek }: { ticks: number[]; step: number; pps: number; onSeek: (t: number) => void }) {
  const at = (e: React.PointerEvent<HTMLDivElement>) => onSeek((e.clientX - e.currentTarget.getBoundingClientRect().left) / pps)
  return (
    <div
      className="ruler"
      title="Click or drag to seek"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        at(e)
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && at(e)}
    >
      {ticks.map((t) => (
        <span key={t} className="tick" style={{ left: t * pps }}>{label(t, step)}</span>
      ))}
    </div>
  )
}

function Chip({ clip, width, selected, onPick }: { clip: Clip; width: number; selected: boolean; onPick: (frac: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: clip.id })
  return (
    <div
      ref={setNodeRef}
      className={`chip ${selected ? 'sel' : ''} ${clip.missing ? 'missing' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width,
        backgroundImage: clip.thumb ? `linear-gradient(90deg, rgba(20,22,28,.9), rgba(20,22,28,.55)), url(${clip.thumb})` : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onPick((e.clientX - r.left) / r.width)
      }}
    >
      <b>{clip.missing ? '⚠ ' : ''}#{clip.rank}</b>
      <span>{clip.label || clip.name}</span>
      <em>{fmt(clipLength(clip))}</em>
    </div>
  )
}
