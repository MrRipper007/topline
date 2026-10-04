import { useState } from 'react'
import { useProject, type Clip } from '../store/project'
import { useClaudeSettings, hasCredentials } from '../store/claudeSettings'
import { requestTitles, TONES, type TitleClip } from '../lib/claude'
import { providerName } from '../lib/ai'
import { extractFrames } from '../lib/frames'
import { Section, Slider } from './ui'
import { clipLength } from '../engine/timeline'

const FRAMES_PER_CLIP = 4

/** Frames are the slow part, so keep them while the clip's trim stays the same. */
const frameCache = new Map<string, string[]>()

async function framesFor(members: Clip[]): Promise<string[]> {
  if (members.some((m) => m.missing)) throw new Error('Re-add this clip video in the Media tab first, then generate its title.')
  // Split halves share a title, so spread the frame budget across the halves.
  const each = Math.max(1, Math.floor(FRAMES_PER_CLIP / members.length))
  const all: string[] = []
  for (const m of members) {
    const key = `${m.id}:${m.trimIn}:${m.trimOut}:${each}`
    if (!frameCache.has(key)) frameCache.set(key, await extractFrames(m.url, m.trimIn, m.trimOut, each))
    all.push(...frameCache.get(key)!)
  }
  return all
}

interface Group {
  id: string
  members: Clip[]
}

function groupsOf(clips: Clip[]): Group[] {
  const map = new Map<string, Group>()
  for (const c of clips) {
    if (!map.has(c.group)) map.set(c.group, { id: c.group, members: [] })
    map.get(c.group)!.members.push(c)
  }
  return [...map.values()]
}

export function TitleGenerator() {
  const clips = useProject((s) => s.clips)
  const updateClip = useProject((s) => s.updateClip)
  const cfg = useClaudeSettings((s) => s.cfg)
  const groups = groupsOf(clips)

  const [tone, setTone] = useState<string>(TONES[0])
  const [maxChars, setMaxChars] = useState(28)
  const [onlyEmpty, setOnlyEmpty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [proposals, setProposals] = useState<Record<string, string>>({})

  async function generate(targets: Group[], avoid?: Record<string, string>) {
    if (!hasCredentials(cfg)) {
      setError('Add your API key under AI settings above first.')
      return
    }
    if (!targets.length) {
      setError('Nothing to do. Every clip already has a title (untick "Only clips without a title").')
      return
    }
    setBusy(true)
    setError('')
    try {
      const req: TitleClip[] = []
      for (let i = 0; i < targets.length; i++) {
        const g = targets[i]
        setStatus(`Looking at clip ${i + 1} of ${targets.length}…`)
        const first = g.members[0]
        req.push({
          n: i + 1,
          rank: first.rank,
          seconds: g.members.reduce((a, m) => a + clipLength(m), 0),
          context: first.context ?? '',
          current: first.label,
          frames: await framesFor(g.members),
        })
      }
      setStatus(`Asking ${providerName(cfg.provider)}…`)
      const avoidByN = avoid && Object.fromEntries(targets.map((g, i) => [i + 1, avoid[g.id]]).filter(([, v]) => v))
      const titles = await requestTitles(cfg, { tone, maxChars, clips: req, avoid: avoidByN, onStatus: setStatus })
      const next: Record<string, string> = {}
      targets.forEach((g, i) => {
        if (titles[i + 1]) next[g.id] = titles[i + 1]
      })
      if (!Object.keys(next).length) throw new Error('The AI did not return any titles. Try again.')
      setProposals((p) => ({ ...p, ...next }))
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const apply = (g: Group) => {
    const title = proposals[g.id]
    if (title === undefined) return
    updateClip(g.members[0].id, { label: title })
    setProposals(({ [g.id]: _used, ...rest }) => rest)
  }

  const applyAll = () => groups.forEach(apply)
  const pending = groups.filter((g) => proposals[g.id] !== undefined)
  const targets = onlyEmpty ? groups.filter((g) => !g.members[0].label.trim()) : groups

  return (
    <Section title="TITLE GENERATOR" desc="The AI looks at a few frames from each clip and writes a title that fits what is happening. Nothing changes until you press Use.">
      {!clips.length ? (
        <div className="off">Add clips in the Media tab first.</div>
      ) : (
        <>
          <div className="label">Tone</div>
          <div className="chips">
            {TONES.map((t) => (
              <button key={t} className={t === tone ? 'hl' : ''} onClick={() => setTone(t)}>{t}</button>
            ))}
          </div>
          <Slider label="Max length" value={maxChars} min={12} max={60} unit=" chars" onChange={setMaxChars} />
          <label className="check">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
            Only clips without a title
          </label>

          <div className="cliprows">
            {groups.map((g) => {
              const first = g.members[0]
              const proposal = proposals[g.id]
              return (
                <div key={g.id} className="titlerow">
                  <div className="titlerow-top">
                    {first.thumb ? <img src={first.thumb} alt="" /> : <span className="thumb" />}
                    <span className="pill small">#{first.rank}</span>
                    <input className="text" placeholder="What happens in this clip? (optional)" value={first.context ?? ''}
                      onChange={(e) => updateClip(first.id, { context: e.target.value })} />
                  </div>
                  <div className="current dim">Now: {first.label || '(no title)'}</div>
                  {proposal !== undefined && (
                    <div className="proposal">
                      <input className="text" value={proposal} onChange={(e) => setProposals((p) => ({ ...p, [g.id]: e.target.value }))} />
                      <span className="mono dim">{proposal.length}</span>
                      <button className="primary" onClick={() => apply(g)}>Use</button>
                    </div>
                  )}
                  <button disabled={busy} onClick={() => generate([g], { [g.id]: proposal ?? first.label })}>
                    🔄 {proposal !== undefined || first.label ? 'Reroll this clip' : 'Generate for this clip'}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" disabled={busy} onClick={() => generate(targets)}>
              ✨ Generate titles for {targets.length} clip{targets.length === 1 ? '' : 's'}
            </button>
            {pending.length > 0 && <button onClick={applyAll}>Use all {pending.length}</button>}
          </div>
          <p className="hint">
            Sends about {FRAMES_PER_CLIP} small stills per clip ({targets.length * FRAMES_PER_CLIP} images) to {providerName(cfg.provider)}.
          </p>
          {busy && <p className="hint mono">{status}</p>}
          {error && <p className="err">{error}</p>}
        </>
      )}
    </Section>
  )
}
