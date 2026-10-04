import { useEffect, useState } from 'react'
import { useProject } from '../store/project'
import { getPlayer } from '../engine/instance'
import { parseProject, serializeProject, type ProjectFile } from '../lib/project'
import { canWriteInPlace, openProjectFile, saveProjectFile } from '../lib/projectIo'

const DRAFT_KEY = 'topline-draft'

const snapshot = (): ProjectFile => serializeProject(useProject.getState())

/** Replace the current project with one read from a file. Media stays unlinked until the user re-adds it. */
function applyProject(p: ProjectFile) {
  const player = getPlayer()
  player?.pause()
  useProject.getState().loadProject(p)
  player?.sync()
  player?.seek(0)
}

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Open / Save buttons for the header. Ctrl+S saves. */
export function ProjectButtons({ onOpened }: { onOpened: () => void }) {
  const [note, setNote] = useState('')
  const hasWork = useProject((s) => s.clips.length > 0 || !!s.script.trim())

  async function save(saveAs = false) {
    try {
      const day = new Date().toISOString().slice(0, 10)
      const name = await saveProjectFile(JSON.stringify(snapshot(), null, 2), `topline-${day}.topline`, saveAs)
      if (name) setNote(`Saved ${name} · ${stamp()}`)
    } catch (e) {
      setNote(`Could not save: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function open() {
    try {
      const file = await openProjectFile()
      if (!file) return
      const parsed = parseProject(file.text)
      if (!parsed.ok) {
        alert(parsed.error)
        return
      }
      const st = useProject.getState()
      if ((st.clips.length || st.script.trim()) && !confirm('Replace the current project? Anything you have not saved will be lost.')) return
      applyProject(parsed.project)
      onOpened()
      setNote(`Opened ${file.name}. Re-add your videos in the Media tab.`)
    } catch (e) {
      setNote(`Could not open: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save(e.shiftKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      {note && <span className="save-note mono" title={note}>{note}</span>}
      <button onClick={open} title="Open a saved .topline project">📂 Open</button>
      <button disabled={!hasWork} onClick={() => save(false)}
        title={canWriteInPlace() ? 'Save (Ctrl+S). After the first save it overwrites the same file.' : 'Download the project file (Ctrl+S)'}>
        💾 Save
      </button>
      <button disabled={!hasWork} onClick={() => save(true)} title="Save as a new file (Ctrl+Shift+S)">Save as…</button>
    </>
  )
}

/** Keeps a draft of the project in this browser so a refresh or crash doesn't lose your edits. */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const unsub = useProject.subscribe((s) => {
      // An empty project never overwrites a draft, so a fresh page can still offer to restore it.
      if (!s.clips.length && !s.script.trim()) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot()))
        } catch {
          /* storage full or unavailable */
        }
      }, 800)
    })
    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [])
}

function readDraft(): ProjectFile | null {
  try {
    const text = localStorage.getItem(DRAFT_KEY)
    if (!text) return null
    const r = parseProject(text)
    return r.ok && (r.project.clips.length || r.project.script.trim()) ? r.project : null
  } catch {
    return null
  }
}

/** Offered on a fresh page when an unsaved draft is waiting. */
export function RestoreBanner({ onOpened }: { onOpened: () => void }) {
  const [draft, setDraft] = useState<ProjectFile | null>(readDraft)
  const hasWork = useProject((s) => s.clips.length > 0 || !!s.script.trim())
  if (!draft || hasWork) return null

  const when = draft.savedAt ? new Date(draft.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'earlier'
  return (
    <div className="banner">
      <span>
        Found an unsaved draft from {when}: {draft.clips.length} clip{draft.clips.length === 1 ? '' : 's'}.
        The videos aren't stored in the draft, so you'll re-add them.
      </span>
      <button className="primary" onClick={() => { applyProject(draft); onOpened(); setDraft(null) }}>Restore</button>
      <button onClick={() => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } setDraft(null) }}>Discard</button>
    </div>
  )
}
