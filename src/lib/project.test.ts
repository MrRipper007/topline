import { describe, expect, it } from 'vitest'
import { matchFiles, mergeLook, parseProject, serializeProject, type ProjectSource } from './project'
import { TEMPLATES } from '../templates'
import type { Clip } from '../store/project'

const clip = (over: Partial<Clip>): Clip => ({
  id: 'a', group: 'a', name: 'fall.mp4', size: 1000, url: 'blob:x', thumb: 'data:y', duration: 5, trimIn: 0.5, trimOut: 4,
  volume: 0.8, muted: false, rank: 2, label: 'Treadmill Betrayal', context: 'guy falls', ...over,
})

const source = (clips: Clip[]): ProjectSource => ({
  clips, look: TEMPLATES[0].look, templateId: 'topline', customTemplates: [], script: 'hello world',
  voiceName: 'voice.mp3', voiceSize: 500, voiceDuration: 12, voiceVolume: 0.9, seed: 7,
})

describe('project file', () => {
  it('round-trips edits but leaves out the media and any keys', () => {
    const file = serializeProject(source([clip({})]))
    const text = JSON.stringify(file)
    expect(text).not.toContain('blob:x')
    expect(text).not.toContain('data:y')
    expect(text.toLowerCase()).not.toContain('apikey')
    const r = parseProject(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = r.project.clips[0]
    expect(c).toMatchObject({ name: 'fall.mp4', size: 1000, trimIn: 0.5, trimOut: 4, volume: 0.8, rank: 2, label: 'Treadmill Betrayal', context: 'guy falls' })
    expect(r.project.script).toBe('hello world')
    expect(r.project.voice).toEqual({ name: 'voice.mp3', size: 500, duration: 12, volume: 0.9 })
    expect(r.project.seed).toBe(7)
  })

  it('keeps split halves in one group', () => {
    const file = serializeProject(source([clip({ id: 'a' }), clip({ id: 'b', group: 'a', trimIn: 4, trimOut: 5 })]))
    const r = parseProject(JSON.stringify(file))
    expect(r.ok && r.project.clips.map((c) => c.group)).toEqual(['a', 'a'])
  })

  it('rejects junk, other apps and newer versions with a clear message', () => {
    expect(parseProject('not json')).toMatchObject({ ok: false })
    expect(parseProject('{"app":"other","version":1,"clips":[]}')).toMatchObject({ ok: false })
    expect(parseProject('{"app":"topline","version":99,"clips":[]}')).toMatchObject({ ok: false, error: expect.stringContaining('newer') })
    expect(parseProject('{"app":"topline","version":1}')).toMatchObject({ ok: false })
  })

  it('repairs bad numbers and fills in missing look settings', () => {
    const r = parseProject(JSON.stringify({
      app: 'topline', version: 1,
      clips: [{ name: 'x.mp4', trimIn: 3, trimOut: 1, volume: 9, rank: -4, duration: 'oops' }],
      look: { title: { text: 'Custom', highlights: [1, 'x'] } },
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = r.project.clips[0]
    expect(c.trimOut).toBeGreaterThan(c.trimIn)
    expect(c.volume).toBe(1)
    expect(c.rank).toBe(1)
    expect(r.project.look.title.text).toBe('Custom')
    expect(r.project.look.title.highlights).toEqual([1])
    expect(r.project.look.ranking.badge).toBe(TEMPLATES[0].look.ranking.badge) // filled from default
  })

  it('mergeLook tolerates garbage', () => {
    expect(mergeLook(null).fit).toBe(TEMPLATES[0].look.fit)
    expect(mergeLook('x').title.font).toBe(TEMPLATES[0].look.title.font)
  })
})

describe('relinking media', () => {
  const missing = (id: string, name: string, size: number) => ({ id, name, size, missing: true as const })
  const f = (name: string, size: number) => ({ name, size })

  it('matches by name and size, and one file can relink several split halves', () => {
    const m = matchFiles([missing('1', 'a.mp4', 10), missing('2', 'a.mp4', 10), missing('3', 'b.mp4', 20)], [f('b.mp4', 20), f('a.mp4', 10)])
    expect(m.clips.map((x) => [x.file.name, x.clipIds, x.sizeMismatch])).toEqual([['b.mp4', ['3'], false], ['a.mp4', ['1', '2'], false]])
    expect(m.unmatched).toEqual([])
  })

  it('links a same-name file with a different size but flags it', () => {
    const m = matchFiles([missing('1', 'a.mp4', 10)], [f('a.mp4', 99)])
    expect(m.clips[0].sizeMismatch).toBe(true)
  })

  it('reports files that are not part of the project and ignores already-linked clips', () => {
    const linked = { id: '9', name: 'c.mp4', size: 5, missing: false }
    const m = matchFiles([missing('1', 'a.mp4', 10), linked], [f('c.mp4', 5), f('zzz.mp4', 1)])
    expect(m.clips).toEqual([])
    expect(m.unmatched.map((x) => x.name)).toEqual(['c.mp4', 'zzz.mp4'])
  })

  it('finds the voiceover by name', () => {
    const m = matchFiles([], [f('voice.mp3', 500)], { name: 'voice.mp3', size: 500, missing: true })
    expect(m.voice?.name).toBe('voice.mp3')
  })
})
