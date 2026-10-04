import { useEffect, useRef, useState } from 'react'
import { useProject, type Clip } from '../store/project'
import { getPlayer } from '../engine/instance'
import { computePeaks } from '../lib/waveform'
import { audioDuration, probeVideo } from '../lib/media'
import { matchFiles } from '../lib/project'
import { Section } from './ui'

export function Library() {
  const clips = useProject((s) => s.clips)
  const addClip = useProject((s) => s.addClip)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('video/')) continue
      const url = URL.createObjectURL(f)
      const { duration, thumb } = await probeVideo(url)
      if (!duration) continue
      addClip({ id: crypto.randomUUID(), name: f.name, size: f.size, url, thumb, duration, trimIn: 0, trimOut: duration, volume: 1, muted: false, label: '' })
    }
  }

  return (
    <>
      <Relink />
      <Section title="MEDIA" desc="Upload your clips. Each one has its own audio preview, volume and trim.">
        <div
          className={`drop ${drag ? 'over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void onFiles(e.dataTransfer.files) }}
        >
          Drop videos here or click to upload
          <input ref={input} type="file" accept="video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
        <div className="cards">
          {clips.map((c, i) => <ClipCard key={c.id} clip={c} index={i} />)}
        </div>
      </Section>
    </>
  )
}

/** Shown after opening a saved project: choose the video files again and they are matched by name and size. */
function Relink() {
  const clips = useProject((s) => s.clips)
  const voiceMissing = useProject((s) => s.voiceMissing)
  const voiceName = useProject((s) => s.voiceName)
  const voiceSize = useProject((s) => s.voiceSize)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)

  const missing = clips.filter((c) => c.missing)
  if (!missing.length && !voiceMissing) return null
  const names = [...new Set(missing.map((c) => c.name))]

  async function link(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    const st = useProject.getState()
    const m = matchFiles(st.clips, Array.from(list), { name: voiceName, size: voiceSize, missing: voiceMissing })
    const out: string[] = []
    for (const hit of m.clips) {
      const url = URL.createObjectURL(hit.file)
      const { duration, thumb } = await probeVideo(url)
      if (!duration) {
        out.push(`Could not read ${hit.file.name}. Is it a video?`)
        continue
      }
      st.relinkClips(hit.clipIds, { url, thumb, duration, size: hit.file.size })
      if (hit.sizeMismatch) out.push(`${hit.file.name} has a different size than when you saved. It was linked, but check it is the same video.`)
    }
    if (m.voice) {
      const url = URL.createObjectURL(m.voice)
      st.relinkVoice(url, (await audioDuration(url)) || st.voiceDuration)
    }
    if (m.unmatched.length) out.push(`Not part of this project: ${m.unmatched.map((f) => f.name).join(', ')}`)
    getPlayer()?.sync()
    setNotes(out)
    setBusy(false)
  }

  return (
    <Section title="RELINK MEDIA"
      desc="This project was opened from a file, which holds the edits but not the videos. Choose the same video files again. Pick several at once; they are matched by file name and size.">
      <div className="missing-list">
        {names.map((n) => <div key={n}>⚠ {n}</div>)}
        {voiceMissing && <div>⚠ {voiceName} (voiceover)</div>}
      </div>
      <div
        className={`drop ${drag ? 'over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void link(e.dataTransfer.files) }}
      >
        {busy ? 'Linking…' : 'Drop the files here or click to choose them'}
        <input ref={input} type="file" accept="video/*,audio/*" multiple hidden onChange={(e) => void link(e.target.files)} />
      </div>
      {notes.map((n, i) => <p key={i} className="hint">{n}</p>)}
    </Section>
  )
}

function ClipCard({ clip, index }: { clip: Clip; index: number }) {
  const update = useProject((s) => s.updateClip)
  const remove = useProject((s) => s.removeClip)
  const select = useProject((s) => s.select)
  const selected = useProject((s) => s.selectedId === clip.id)
  const [playing, setPlaying] = useState(false)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    if (clip.missing) return
    let live = true
    setPeaks(null)
    computePeaks(clip.url).then((p) => live && setPeaks(p))
    return () => { live = false }
  }, [clip.url, clip.missing])

  async function toggle() {
    const p = getPlayer()
    if (!p) return
    const next = !playing
    setPlaying(next)
    await p.previewClip(clip.id, next)
    const el = p.nodes.get(clip.id)?.el
    if (next && el) el.onended = () => setPlaying(false)
  }

  if (clip.missing) {
    return (
      <div className={`card missing ${selected ? 'sel' : ''}`} onClick={() => select(clip.id)}>
        <div className="row">
          <span className="name" title={clip.name}>{String(index + 1).padStart(2, '0')} · ⚠ {clip.name}</span>
          <button onClick={() => remove(clip.id)} title="Remove">✕</button>
        </div>
        <p className="hint">Video not linked. Use Relink media above.</p>
      </div>
    )
  }

  return (
    <div className={`card ${selected ? 'sel' : ''}`} onClick={() => select(clip.id)}>
      <div className="row">
        {clip.thumb && <img className="mini" src={clip.thumb} alt="" />}
        <span className="name" title={clip.name}>{String(index + 1).padStart(2, '0')} · {clip.name}</span>
        <button onClick={() => { if (playing) void toggle(); remove(clip.id) }} title="Remove">✕</button>
      </div>
      <Wave peaks={peaks} />
      <div className="row">
        <button className="primary" onClick={toggle}>{playing ? '■ Stop audio' : '▶ Play audio'}</button>
        <button onClick={() => { update(clip.id, { muted: !clip.muted }); getPlayer()?.sync() }}>{clip.muted ? '🔇 Muted' : '🔊 On'}</button>
      </div>
      <label className="mini-label">Volume
        <input type="range" min={0} max={1} step={0.01} value={clip.volume}
          onChange={(e) => { update(clip.id, { volume: +e.target.value }); getPlayer()?.sync() }} />
      </label>
      <label className="mini-label">Start {clip.trimIn.toFixed(1)}s
        <input type="range" min={0} max={clip.duration} step={0.1} value={clip.trimIn}
          onChange={(e) => update(clip.id, { trimIn: Math.min(+e.target.value, clip.trimOut - 0.1) })} />
      </label>
      <label className="mini-label">End {clip.trimOut.toFixed(1)}s
        <input type="range" min={0} max={clip.duration} step={0.1} value={clip.trimOut}
          onChange={(e) => update(clip.id, { trimOut: Math.max(+e.target.value, clip.trimIn + 0.1) })} />
      </label>
    </div>
  )
}

function Wave({ peaks }: { peaks: number[] | null }) {
  if (peaks === null) return <div className="wave dim">analysing audio…</div>
  if (!peaks.length) return <div className="wave dim">no audio track</div>
  return (
    <div className="wave">
      {peaks.map((p, i) => <i key={i} style={{ height: `${Math.max(4, p * 100)}%` }} />)}
    </div>
  )
}
