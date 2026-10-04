import type { Clip } from '../store/project'

export interface Segment {
  clip: Clip
  index: number
  start: number
  end: number
}

export interface ListItem {
  rank: number
  label: string
  revealed: boolean
  /** True for the entry whose clip is playing at the current time. */
  active: boolean
}

export const clipLength = (c: Clip) => Math.max(0.1, c.trimOut - c.trimIn)
export const totalLength = (clips: Clip[]) => clips.reduce((a, c) => a + clipLength(c), 0)

export function segments(clips: Clip[]): Segment[] {
  let acc = 0
  return clips.map((clip, index) => {
    const start = acc
    acc += clipLength(clip)
    return { clip, index, start, end: acc }
  })
}

/** The segment playing at time t (the last one if t is past the end). */
export function locate(clips: Clip[], t: number): (Segment & { local: number }) | null {
  const segs = segments(clips)
  for (const s of segs) {
    if (t < s.end || s === segs[segs.length - 1]) {
      return { ...s, local: Math.min(Math.max(t - s.start, 0), s.end - s.start) }
    }
  }
  return null
}

/** Cut the clip under t in two. Halves share rank, label and group. Null if t is too close to an edge. */
export function splitAt(clips: Clip[], t: number): Clip[] | null {
  const loc = locate(clips, t)
  if (!loc || loc.local < 0.2 || loc.local > clipLength(loc.clip) - 0.2) return null
  const cut = loc.clip.trimIn + loc.local
  const first: Clip = { ...loc.clip, trimOut: cut }
  const second: Clip = { ...loc.clip, id: crypto.randomUUID(), trimIn: cut }
  const out = clips.slice()
  out.splice(loc.index, 1, first, second)
  return out
}

/** Scale clip lengths so the timeline matches `target` seconds, limited by each source's length. */
export function fitToDuration(clips: Clip[], target: number): Clip[] {
  const total = totalLength(clips)
  if (!clips.length || total <= 0 || target <= 0) return clips
  const scale = target / total
  return clips.map((c) => {
    const want = Math.max(0.2, clipLength(c) * scale)
    return { ...c, trimOut: Math.min(c.duration, c.trimIn + want) }
  })
}

export function nextRank(clips: Clip[]): number {
  return clips.reduce((m, c) => Math.max(m, c.rank), 0) + 1
}

/** Entries for the on-screen countdown list. A title is revealed once its clip has started playing. */
export function buildList(clips: Clip[], t: number): ListItem[] {
  const byRank = new Map<number, { label: string; start: number }>()
  for (const s of segments(clips)) {
    const cur = byRank.get(s.clip.rank)
    if (!cur) byRank.set(s.clip.rank, { label: s.clip.label, start: s.start })
    else if (!cur.label && s.clip.label) cur.label = s.clip.label
  }
  const count = Math.min(20, Math.max(byRank.size, ...byRank.keys(), 0))
  const playing = locate(clips, t)?.clip.rank
  const items: ListItem[] = []
  for (let r = 1; r <= count; r++) {
    const e = byRank.get(r)
    items.push({ rank: r, label: e?.label ?? '', revealed: !!e && t >= e.start, active: r === playing })
  }
  return items
}
