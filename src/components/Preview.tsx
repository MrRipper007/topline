import { useEffect, useRef, useState } from 'react'
import { Player } from '../engine/player'
import { setPlayer } from '../engine/instance'
import { useProject } from '../store/project'
import { useUi } from '../store/ui'
import { totalLength } from '../engine/timeline'
import { preloadFonts } from '../fonts'
import { fmt } from './ui'

export function Preview() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const player = useRef<Player | null>(null)
  const [vol, setVol] = useState(1)
  const { playing, time, exporting } = useUi()
  const clips = useProject((s) => s.clips)
  const voiceUrl = useProject((s) => s.voiceUrl)
  const total = totalLength(clips)

  useEffect(() => {
    preloadFonts()
    const p = new Player(canvas.current!)
    player.current = p
    setPlayer(p)
    return () => {
      p.destroy()
      setPlayer(null)
    }
  }, [])

  // Keep media elements and gains in step with the project.
  useEffect(() => {
    const p = player.current
    if (!p) return
    p.sync()
    if (p.time > total) p.seek(total)
  }, [clips, voiceUrl, total])

  async function toggle() {
    const p = player.current!
    if (p.playing) p.pause()
    else await p.play()
  }

  return (
    <section className="preview">
      <div className="phone">
        <canvas ref={canvas} className="stage" />
      </div>
      <input className="scrub" type="range" min={0} max={total || 1} step={0.02} value={Math.min(time, total || 1)}
        disabled={exporting || !clips.length} onChange={(e) => player.current?.seek(+e.target.value)} />
      <div className="transport">
        <span className="mono">{fmt(time)}.{String(Math.floor((time % 1) * 100)).padStart(2, '0')}</span>
        <div className="tbtns">
          <button className="ico" disabled={exporting || !clips.length} onClick={() => player.current?.step(-1)} title="Previous clip">⏮</button>
          <button className="play" disabled={exporting || !clips.length} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
          <button className="ico" disabled={exporting || !clips.length} onClick={() => player.current?.step(1)} title="Next clip">⏭</button>
        </div>
        <span className="vol">
          🔊
          <input type="range" min={0} max={1} step={0.01} value={vol}
            onChange={(e) => { setVol(+e.target.value); player.current?.setVolume(+e.target.value) }} />
        </span>
        <span className="mono dim">{fmt(total)}</span>
      </div>
    </section>
  )
}
