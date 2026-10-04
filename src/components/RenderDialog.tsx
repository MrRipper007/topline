import { useEffect, useState } from 'react'
import { useProject } from '../store/project'
import { useUi } from '../store/ui'
import { totalLength } from '../engine/timeline'
import { getPlayer } from '../engine/instance'
import { exportWebm } from '../engine/exporter'
import { probeSupport, renderMp4, webCodecsSupported, type Support } from '../engine/mp4'
import { Seg, fmt } from './ui'

interface Preset {
  id: string
  name: string
  /** Video bitrate at 30 fps in Mbps. 60 fps gets 1.5x so motion keeps the same quality. */
  mbps: number
  note: string
  kind: 'mp4' | 'webm'
}

const PRESETS: Preset[] = [
  { id: 'universal', name: 'Universal MP4', mbps: 16, kind: 'mp4',
    note: 'Recommended. Accepted as-is by TikTok, Instagram Reels, YouTube Shorts, Facebook Reels, Snapchat, X, LinkedIn and Pinterest.' },
  { id: 'max', name: 'Maximum quality MP4', mbps: 35, kind: 'mp4',
    note: 'Highest fidelity for archiving or uploading to YouTube. Big file; some apps recompress it anyway.' },
  { id: 'small', name: 'Small file MP4', mbps: 8, kind: 'mp4',
    note: 'For messaging apps and platforms with tight upload size limits.' },
  { id: 'webm', name: 'WebM (compatibility)', mbps: 8, kind: 'webm',
    note: 'Fallback for browsers without H.264 encoding. Records in real time at 30 fps; keep this tab in front.' },
]

export function RenderDialog({ onClose }: { onClose: () => void }) {
  const clips = useProject((s) => s.clips)
  const total = totalLength(clips)
  const unlinked = clips.filter((c) => c.missing).length
  const supported = webCodecsSupported()
  const [id, setId] = useState(supported ? 'universal' : 'webm')
  const [fps, setFps] = useState<'30' | '60'>('30')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [signal] = useState({ cancelled: false })
  const [support, setSupport] = useState<Support | null>(null)
  useEffect(() => {
    void probeSupport().then(setSupport)
  }, [])
  const mp4Ok = supported && (support ? !!support.h264 && !!support.audio : true)

  const preset = PRESETS.find((p) => p.id === id)!
  const isMp4 = preset.kind === 'mp4'
  const rate = isMp4 ? Number(fps) : 30
  const mbps = isMp4 && rate === 60 ? preset.mbps * 1.5 : preset.mbps
  const sizeMb = ((mbps * 1e6 + 256_000) * total) / 8 / 1e6

  async function start() {
    setBusy(true)
    setError('')
    signal.cancelled = false
    getPlayer()?.pause()
    try {
      let blob: Blob
      if (isMp4) {
        blob = await renderMp4({ fps: rate, bitrate: mbps * 1e6, signal, onProgress: (p, s) => { setProgress(p); setStage(s) } })
      } else {
        const p = getPlayer()
        if (!p) throw new Error('Preview is not ready.')
        useUi.setState({ exporting: true })
        setStage('Recording in real time')
        blob = await exportWebm(p, setProgress)
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `topline-1080x1920-${rate}fps.${isMp4 ? 'mp4' : 'webm'}`
      a.click()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      useUi.setState({ exporting: false })
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        <div className="sec-head">
          <h3>RENDER</h3>
          {!busy && <button className="link" onClick={onClose}>close</button>}
        </div>
        <p className="desc">
          {clips.length} clip{clips.length === 1 ? '' : 's'} · {fmt(total)} · vertical 1080×1920. Pick where it is going.
        </p>
        {!supported && <p className="err">This browser can't encode MP4 (WebCodecs missing). Use Chrome or Edge for MP4, or WebM here.</p>}
        {supported && support && !mp4Ok && <p className="err">This browser can't encode H.264/MP4 audio. Use Chrome or Edge for MP4, or WebM here.</p>}
        {mp4Ok && support?.audio === 'opus' && (
          <p className="warn">
            AAC audio isn't available in this browser, so MP4 audio will be Opus. YouTube and most players accept it, but for
            TikTok/Instagram use Chrome or Edge, which usually include AAC.
          </p>
        )}
        {mp4Ok && support?.audio === 'aac' && <p className="hint mono">H.264 + AAC ready on this browser ✓</p>}

        <div className="label">Quality</div>
        <div className="presets">
          {PRESETS.map((p) => {
            const off = busy || (p.kind === 'mp4' && !mp4Ok)
            const m = p.kind === 'mp4' && rate === 60 ? p.mbps * 1.5 : p.mbps
            return (
              <button key={p.id} disabled={off} className={p.id === id ? 'on' : ''} onClick={() => setId(p.id)}>
                <b>{p.name}</b>
                <span className="mono">
                  {p.kind === 'mp4' ? `1080×1920 · H.264 + AAC · ${m} Mbps` : '1080×1920 · VP9 + Opus · real-time'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="label">Frame rate</div>
        <Seg value={isMp4 ? fps : '30'} onChange={setFps}
          options={[{ value: '30', label: '30 fps' }, { value: '60', label: '60 fps (smooth)' }]} />
        {!isMp4 && <p className="hint">WebM records in real time at 30 fps. Pick an MP4 quality for 60 fps.</p>}
        {isMp4 && rate === 60 && (
          <p className="hint">
            Renders every frame twice as often, so it takes about twice as long and the file is larger. Overlays, titles and
            captions come out smoother; footage only gains smoothness if your source clips are 60 fps.
          </p>
        )}

        <p className="hint">{preset.note}</p>
        <p className="hint mono">Estimated size ≈ {sizeMb < 1 ? '<1' : sizeMb.toFixed(sizeMb < 10 ? 1 : 0)} MB</p>

        {busy && (
          <div className="progress">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
            <span className="mono">{stage} · {Math.round(progress * 100)}%</span>
          </div>
        )}
        {unlinked > 0 && <p className="err">{unlinked} clip{unlinked === 1 ? ' has' : 's have'} no video linked yet. Use Relink media in the Media tab first.</p>}
        {error && <p className="err">{error}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          {busy ? (
            <button onClick={() => (signal.cancelled = true)}>Cancel</button>
          ) : (
            <button className="primary" disabled={!clips.length || unlinked > 0} onClick={start}>
              ⬆ Render {isMp4 ? `MP4 · ${rate} fps` : 'WebM'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
