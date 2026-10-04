import { useEffect, useRef, useState } from 'react'
import { Library } from './components/Library'
import { Preview } from './components/Preview'
import { Timeline } from './components/Timeline'
import { ScriptPanel } from './components/ScriptPanel'
import { RankingPanel } from './components/RankingPanel'
import { CaptionsPanel } from './components/CaptionsPanel'
import { CanvasTitlePanel } from './components/CanvasTitlePanel'
import { TemplatesPanel } from './components/TemplatesPanel'
import { ClaudePanel } from './components/ClaudePanel'
import { TitleGenerator } from './components/TitleGenerator'
import { AiSettings } from './components/AiSettings'
import { Tabs, fmt } from './components/ui'
import { useProject } from './store/project'
import { RenderDialog } from './components/RenderDialog'
import { totalLength } from './engine/timeline'
import { ProjectButtons, RestoreBanner, useAutosave } from './components/ProjectBar'

const LEFT = ['Script & voice', 'Media', 'Ranking'] as const
const CENTER = ['Captions', 'Canvas & title', 'Templates', 'AI'] as const

function Header({ onOpened }: { onOpened: () => void }) {
  const clips = useProject((s) => s.clips)
  const [open, setOpen] = useState(false)

  return (
    <header>
      <div className="brand">
        <span className="logo">T</span>
        <b>Topline</b>
        <span className="pill-studio">STUDIO</span>
      </div>
      <span className="status mono">
        {clips.length} clip{clips.length === 1 ? '' : 's'} · {fmt(totalLength(clips))} · 1080×1920 · renders in your browser
      </span>
      <ProjectButtons onOpened={onOpened} />
      <button className="render" disabled={!clips.length} onClick={() => setOpen(true)}>⬆ Render</button>
      {open && <RenderDialog onClose={() => setOpen(false)} />}
    </header>
  )
}

/** A pixel size that is remembered between sessions. */
function useSize(key: string, def: number, min: number, max: number) {
  const [v, setV] = useState(() => {
    try {
      const n = Number(localStorage.getItem(key))
      return n >= min && n <= max ? n : def
    } catch {
      return def
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, String(v))
    } catch {
      /* storage unavailable */
    }
  }, [key, v])
  return [v, (n: number) => setV(Math.min(max, Math.max(min, n))), () => setV(def)] as const
}

/** Drag handle between panels. Double-click resets the size. */
function Splitter({ dir, onDrag, onReset }: { dir: 'col' | 'row'; onDrag: (delta: number) => void; onReset: () => void }) {
  const last = useRef(0)
  const pos = (e: React.PointerEvent) => (dir === 'col' ? e.clientX : e.clientY)
  return (
    <div
      className={`splitter ${dir === 'col' ? 'vert' : 'horiz'}`}
      title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = pos(e)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        onDrag(pos(e) - last.current)
        last.current = pos(e)
      }}
    />
  )
}

export default function App() {
  const [left, setLeft] = useState<(typeof LEFT)[number]>('Ranking')
  const [center, setCenter] = useState<(typeof CENTER)[number]>('Canvas & title')
  const [zoom, setZoom] = useState(1)
  const [leftW, setLeftW, resetLeftW] = useSize('topline-left', 360, 240, 900)
  const [rightW, setRightW, resetRightW] = useSize('topline-right', 340, 220, 900)
  const [tlH, setTlH, resetTlH] = useSize('topline-timeline', 200, 130, 600)
  useAutosave()
  // After opening a project the clips need their videos again, which is done in the Media tab.
  const toMedia = () => setLeft('Media')
  return (
    <div className="app" style={{ '--lw': `${leftW}px`, '--rw': `${rightW}px`, '--th': `${tlH}px` } as React.CSSProperties}>
      <div className="topbar">
        <Header onOpened={toMedia} />
        <RestoreBanner onOpened={toMedia} />
      </div>
      <main>
        <aside className="col">
          <Tabs tabs={LEFT} value={left} onChange={setLeft} />
          <div className="scroll">
            {left === 'Script & voice' && <ScriptPanel />}
            {left === 'Media' && <Library />}
            {left === 'Ranking' && <RankingPanel />}
          </div>
        </aside>
        <Splitter dir="col" onDrag={(d) => setLeftW(leftW + d)} onReset={resetLeftW} />
        <aside className="col">
          <Tabs tabs={CENTER} value={center} onChange={setCenter} />
          <div className="scroll">
            {center === 'Captions' && <CaptionsPanel />}
            {center === 'Canvas & title' && <CanvasTitlePanel />}
            {center === 'Templates' && <TemplatesPanel />}
            {center === 'AI' && (
              <>
                <AiSettings />
                <TitleGenerator />
                <ClaudePanel />
              </>
            )}
          </div>
        </aside>
        <Splitter dir="col" onDrag={(d) => setRightW(rightW - d)} onReset={resetRightW} />
        <Preview />
      </main>
      <Splitter dir="row" onDrag={(d) => setTlH(tlH - d)} onReset={resetTlH} />
      <Timeline zoom={zoom} onZoom={setZoom} />
    </div>
  )
}
