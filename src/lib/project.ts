import type { Clip, Look } from '../store/project'
import { TEMPLATES, type Template } from '../templates'

export const PROJECT_VERSION = 1

/** A clip as stored in a project file: everything except the video itself. */
export type SavedClip = Omit<Clip, 'url' | 'thumb' | 'missing'>

export interface ProjectFile {
  app: 'topline'
  version: number
  savedAt: string
  clips: SavedClip[]
  look: Look
  templateId: string
  customTemplates: Template[]
  script: string
  voice: { name: string; size: number; duration: number; volume: number } | null
  seed: number
}

export interface ProjectSource {
  clips: Clip[]
  look: Look
  templateId: string
  customTemplates: Template[]
  script: string
  voiceName: string
  voiceSize: number
  voiceDuration: number
  voiceVolume: number
  seed: number
}

/** Build the file contents. API keys are never part of a project. */
export function serializeProject(s: ProjectSource): ProjectFile {
  return {
    app: 'topline',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    clips: s.clips.map(({ url: _url, thumb: _thumb, missing: _missing, ...saved }) => saved),
    look: s.look,
    templateId: s.templateId,
    customTemplates: s.customTemplates,
    script: s.script,
    voice: s.voiceName ? { name: s.voiceName, size: s.voiceSize, duration: s.voiceDuration, volume: s.voiceVolume } : null,
    seed: s.seed,
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Fill any missing look settings from the default template so older/partial files still load. */
export function mergeLook(saved: unknown): Look {
  const base = structuredClone(TEMPLATES[0].look)
  if (!isObj(saved)) return base
  const part = (k: 'ranking' | 'title' | 'caption') => (isObj(saved[k]) ? (saved[k] as object) : {})
  const look: Look = {
    ...base,
    fit: saved.fit === 'fit' ? 'fit' : saved.fit === 'fill' ? 'fill' : base.fit,
    bgColor: str(saved.bgColor) || base.bgColor,
    ranking: { ...base.ranking, ...part('ranking') },
    title: { ...base.title, ...part('title') },
    caption: { ...base.caption, ...part('caption') },
  }
  if (!Array.isArray(look.title.highlights)) look.title.highlights = []
  look.title.highlights = look.title.highlights.filter((n) => typeof n === 'number')
  return look
}

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; error: string }

/** Read and sanitise a project file. Never throws. */
export function parseProject(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON, so it is not a Topline project.' }
  }
  if (!isObj(raw) || raw.app !== 'topline') return { ok: false, error: 'This is not a Topline project file.' }
  const version = num(raw.version, 0)
  if (version < 1) return { ok: false, error: 'This project file has no version, so it cannot be read.' }
  if (version > PROJECT_VERSION) return { ok: false, error: 'This project was saved by a newer version of Topline. Update the app and try again.' }
  if (!Array.isArray(raw.clips)) return { ok: false, error: 'This project file has no clip list.' }

  const clips: SavedClip[] = raw.clips.filter(isObj).map((c, i) => {
    const id = str(c.id) || crypto.randomUUID()
    const duration = Math.max(0.1, num(c.duration, 0))
    const trimIn = Math.max(0, num(c.trimIn, 0))
    return {
      id,
      group: str(c.group) || id,
      name: str(c.name) || `clip ${i + 1}`,
      size: num(c.size, 0),
      duration,
      trimIn,
      trimOut: Math.max(trimIn + 0.1, num(c.trimOut, duration)),
      volume: clamp(num(c.volume, 1), 0, 1),
      muted: !!c.muted,
      rank: Math.max(1, Math.round(num(c.rank, i + 1))),
      label: str(c.label),
      labelSize: typeof c.labelSize === 'number' ? c.labelSize : undefined,
      context: str(c.context) || undefined,
    }
  })

  const v = isObj(raw.voice) ? raw.voice : null
  return {
    ok: true,
    project: {
      app: 'topline',
      version,
      savedAt: str(raw.savedAt),
      clips,
      look: mergeLook(raw.look),
      templateId: str(raw.templateId) || TEMPLATES[0].id,
      customTemplates: Array.isArray(raw.customTemplates) ? (raw.customTemplates.filter((t) => isObj(t) && isObj(t.look)) as unknown as Template[]) : [],
      script: str(raw.script),
      voice: v && str(v.name) ? { name: str(v.name), size: num(v.size, 0), duration: num(v.duration, 0), volume: clamp(num(v.volume, 1), 0, 1) } : null,
      seed: num(raw.seed, 1),
    },
  }
}

export interface FileLike {
  name: string
  size: number
}

export interface RelinkMatch<F extends FileLike> {
  file: F
  clipIds: string[]
  /** The name matched but the size is different, so it may be another file or an edited copy. */
  sizeMismatch: boolean
}

/**
 * Match chosen files to clips that still need media. Split halves share one file, so one file can link
 * several clips. Exact name + size wins; a same-name file with a different size is accepted with a warning.
 */
export function matchFiles<F extends FileLike>(
  clips: Pick<Clip, 'id' | 'name' | 'size' | 'missing'>[],
  files: F[],
  voice?: { name: string; size: number; missing: boolean },
): { clips: RelinkMatch<F>[]; voice: F | null; unmatched: F[] } {
  const matches: RelinkMatch<F>[] = []
  const used = new Set<F>()
  let voiceFile: F | null = null
  const missing = clips.filter((c) => c.missing)

  for (const file of files) {
    const ids = missing.filter((c) => c.name === file.name).map((c) => c.id)
    if (ids.length) {
      const exact = missing.some((c) => c.name === file.name && (!c.size || c.size === file.size))
      matches.push({ file, clipIds: ids, sizeMismatch: !exact })
      used.add(file)
    } else if (voice?.missing && !voiceFile && voice.name === file.name) {
      voiceFile = file
      used.add(file)
    }
  }
  return { clips: matches, voice: voiceFile, unmatched: files.filter((f) => !used.has(f)) }
}
