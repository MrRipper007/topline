import { create } from 'zustand'
import { seededShuffle } from '../engine/shuffle'
import { splitAt, fitToDuration, nextRank } from '../engine/timeline'
import { TEMPLATES, type Template } from '../templates'
import type { ProjectFile } from '../lib/project'

export interface Clip {
  id: string
  /** Halves of a cut clip share a group, and with it their rank, label and label size. */
  group: string
  name: string
  url: string
  thumb: string
  duration: number
  trimIn: number
  trimOut: number
  volume: number
  muted: boolean
  rank: number
  label: string
  /** Per-clip override of the global label size; undefined follows the global value. */
  labelSize?: number
  /** Optional note about what happens in the clip, used when asking Claude for a title. */
  context?: string
  /** Size of the source file in bytes; with the name it lets a saved project find its media again. */
  size?: number
  /** True when the project was opened from a file and this clip's video has not been re-added yet. */
  missing?: boolean
}

export interface RankingStyle {
  enabled: boolean
  badge: boolean
  badgeColor: string
  segLabel: boolean
  segSize: number
  segHeight: number
  list: boolean
  listSize: number
  listHeight: number
}

export interface TitleStyle {
  enabled: boolean
  text: string
  highlights: number[]
  font: string
  size: number
  height: number
  hold: number
  forever: boolean
  outline: number
  color: string
  highlight: string
}

export interface CaptionStyle {
  enabled: boolean
  font: string
  size: number
  height: number
  words: number
  outline: number
  color: string
  box: boolean
  boxColor: string
}

export interface Look {
  fit: 'fill' | 'fit'
  bgColor: string
  ranking: RankingStyle
  title: TitleStyle
  caption: CaptionStyle
}

const GROUP_FIELDS = ['rank', 'label', 'labelSize', 'context'] as const

interface State {
  clips: Clip[]
  selectedId: string | null
  look: Look
  templateId: string
  customTemplates: Template[]
  script: string
  voiceUrl: string | null
  voiceName: string
  voiceSize: number
  voiceMissing: boolean
  voiceDuration: number
  voiceVolume: number
  seed: number
  prevOrder: string[] | null
  addClip: (c: Omit<Clip, 'group' | 'rank'>) => void
  updateClip: (id: string, patch: Partial<Clip>) => void
  removeClip: (id: string) => void
  select: (id: string | null) => void
  reorder: (ids: string[]) => void
  shuffle: (seed?: number) => void
  undoOrder: () => void
  splitAtTime: (t: number) => boolean
  fitToVoiceover: () => void
  setLook: (patch: Partial<Look>) => void
  setRanking: (patch: Partial<RankingStyle>) => void
  setTitle: (patch: Partial<TitleStyle>) => void
  setCaption: (patch: Partial<CaptionStyle>) => void
  applyTemplate: (id: string) => void
  saveTemplate: (name: string) => void
  loadLook: (look: Look) => void
  setScript: (s: string) => void
  setVoice: (url: string | null, duration: number, meta?: { name: string; size: number }) => void
  loadProject: (p: ProjectFile) => void
  relinkClips: (ids: string[], media: { url: string; thumb: string; duration: number; size: number }) => void
  relinkVoice: (url: string, duration: number) => void
  setVoiceVolume: (v: number) => void
}

/** Keep what the user switched on/off and typed; take only the design from a template. */
function mergeDesign(cur: Look, tpl: Look): Look {
  return {
    ...tpl,
    ranking: { ...tpl.ranking, enabled: cur.ranking.enabled, badge: cur.ranking.badge, segLabel: cur.ranking.segLabel, list: cur.ranking.list },
    title: { ...tpl.title, enabled: cur.title.enabled, text: cur.title.text, highlights: cur.title.highlights, forever: cur.title.forever, hold: cur.title.hold },
    caption: { ...tpl.caption, enabled: cur.caption.enabled },
  }
}

export const useProject = create<State>((set, get) => ({
  clips: [],
  selectedId: null,
  look: structuredClone(TEMPLATES[0].look),
  templateId: TEMPLATES[0].id,
  customTemplates: [],
  script: '',
  voiceUrl: null,
  voiceName: '',
  voiceSize: 0,
  voiceMissing: false,
  voiceDuration: 0,
  voiceVolume: 1,
  seed: 1,
  prevOrder: null,
  addClip: (c) =>
    set((s) => ({ clips: [...s.clips, { ...c, group: c.id, rank: nextRank(s.clips) }] })),
  updateClip: (id, patch) =>
    set((s) => {
      const target = s.clips.find((c) => c.id === id)
      if (!target) return {}
      const groupPatch = Object.fromEntries(GROUP_FIELDS.filter((k) => k in patch).map((k) => [k, patch[k]]))
      return {
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, ...patch } : c.group === target.group ? { ...c, ...groupPatch } : c,
        ),
      }
    }),
  removeClip: (id) =>
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  select: (selectedId) => set({ selectedId }),
  reorder: (ids) =>
    set((s) => ({
      prevOrder: s.clips.map((c) => c.id),
      clips: ids.map((id) => s.clips.find((c) => c.id === id)!).filter(Boolean),
    })),
  shuffle: (seed) => {
    const s = get()
    const next = seed ?? Math.floor(Math.random() * 1e6)
    // Ranks live on the clips, so shuffling changes playback order only.
    set({ seed: next, prevOrder: s.clips.map((c) => c.id), clips: seededShuffle(s.clips, next) })
  },
  undoOrder: () => {
    const { prevOrder, clips } = get()
    if (!prevOrder) return
    set({ prevOrder: null, clips: prevOrder.map((id) => clips.find((c) => c.id === id)!).filter(Boolean) })
  },
  splitAtTime: (t) => {
    const next = splitAt(get().clips, t)
    if (!next) return false
    set({ clips: next })
    return true
  },
  fitToVoiceover: () => {
    const { clips, voiceDuration } = get()
    if (voiceDuration > 0) set({ clips: fitToDuration(clips, voiceDuration) })
  },
  setLook: (patch) => set((s) => ({ look: { ...s.look, ...patch } })),
  setRanking: (patch) => set((s) => ({ look: { ...s.look, ranking: { ...s.look.ranking, ...patch } } })),
  setTitle: (patch) => set((s) => ({ look: { ...s.look, title: { ...s.look.title, ...patch } } })),
  setCaption: (patch) => set((s) => ({ look: { ...s.look, caption: { ...s.look.caption, ...patch } } })),
  applyTemplate: (id) => {
    const t = [...TEMPLATES, ...get().customTemplates].find((x) => x.id === id)
    if (t) set((s) => ({ look: mergeDesign(s.look, structuredClone(t.look)), templateId: id }))
  },
  saveTemplate: (name) =>
    set((s) => {
      const t: Template = { id: `custom-${Date.now()}`, name, look: structuredClone(s.look) }
      return { customTemplates: [...s.customTemplates, t], templateId: t.id }
    }),
  loadLook: (look) => set((s) => ({ look: mergeDesign(s.look, look) })),
  setScript: (script) => set({ script }),
  setVoice: (voiceUrl, voiceDuration, meta) =>
    set(
      voiceUrl
        ? { voiceUrl, voiceDuration, voiceName: meta?.name ?? '', voiceSize: meta?.size ?? 0, voiceMissing: false }
        : { voiceUrl: null, voiceDuration: 0, voiceName: '', voiceSize: 0, voiceMissing: false },
    ),
  loadProject: (p) =>
    set({
      clips: p.clips.map((c) => ({ ...c, url: '', thumb: '', missing: true })),
      look: p.look,
      templateId: p.templateId,
      customTemplates: p.customTemplates,
      script: p.script,
      seed: p.seed,
      voiceUrl: null,
      voiceMissing: !!p.voice,
      voiceName: p.voice?.name ?? '',
      voiceSize: p.voice?.size ?? 0,
      voiceDuration: p.voice?.duration ?? 0,
      voiceVolume: p.voice?.volume ?? 1,
      prevOrder: null,
      selectedId: null,
    }),
  relinkClips: (ids, media) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (!ids.includes(c.id)) return c
        // The file may be a different length than when saved, so keep the trims inside it.
        const trimOut = Math.min(c.trimOut, media.duration)
        return { ...c, url: media.url, thumb: media.thumb, duration: media.duration, size: media.size, missing: false, trimOut, trimIn: Math.min(c.trimIn, Math.max(0, trimOut - 0.1)) }
      }),
    })),
  relinkVoice: (voiceUrl, voiceDuration) => set({ voiceUrl, voiceDuration, voiceMissing: false }),
  setVoiceVolume: (voiceVolume) => set({ voiceVolume }),
}))
