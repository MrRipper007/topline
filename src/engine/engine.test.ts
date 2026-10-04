import { describe, expect, it } from 'vitest'
import { seededShuffle } from './shuffle'
import { buildCaptions, captionAt } from './captions'
import { buildList, fitToDuration, locate, splitAt, totalLength } from './timeline'
import type { Clip } from '../store/project'

const clip = (id: string, rank: number, len: number, label = ''): Clip => ({
  id, group: id, name: id, url: '', thumb: '', duration: len + 5, trimIn: 0, trimOut: len,
  volume: 1, muted: false, rank, label,
})

describe('shuffle', () => {
  it('is repeatable for the same seed and keeps all items', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(seededShuffle(a, 42)).toEqual(seededShuffle(a, 42))
    expect(seededShuffle(a, 42).slice().sort()).toEqual(a)
  })
  it('keeps each clip rank (ranks stay with their clips)', () => {
    const clips = [clip('a', 1, 2), clip('b', 2, 2), clip('c', 3, 2)]
    for (const c of seededShuffle(clips, 7)) expect(c.rank).toBe(clips.find((x) => x.id === c.id)!.rank)
  })
})

describe('captions', () => {
  it('spreads chunks over the duration', () => {
    const caps = buildCaptions('a b c d e f g h', 8, 4)
    expect(caps).toHaveLength(2)
    expect(caps[1].end).toBeCloseTo(8)
    expect(captionAt(caps, 5)?.text).toBe('e f g h')
  })
})

describe('timeline', () => {
  it('locates the playing clip', () => {
    const clips = [clip('a', 1, 2), clip('b', 2, 3)]
    expect(locate(clips, 1)?.clip.id).toBe('a')
    expect(locate(clips, 2.5)?.clip.id).toBe('b')
    expect(locate(clips, 99)?.clip.id).toBe('b')
  })

  it('splits a clip into halves that share rank and label', () => {
    const clips = [clip('a', 1, 4, 'Blah')]
    const out = splitAt(clips, 1.5)!
    expect(out).toHaveLength(2)
    expect(out[0].trimOut).toBe(1.5)
    expect(out[1].trimIn).toBe(1.5)
    expect(out[1].rank).toBe(1)
    expect(out[1].label).toBe('Blah')
    expect(out[1].group).toBe(out[0].group)
    expect(totalLength(out)).toBeCloseTo(4)
  })

  it('refuses to split at a clip edge', () => {
    expect(splitAt([clip('a', 1, 4)], 0.05)).toBeNull()
  })

  it('fits clip lengths to a target duration', () => {
    const out = fitToDuration([clip('a', 1, 2), clip('b', 2, 2)], 2)
    expect(totalLength(out)).toBeCloseTo(2)
  })

  it('reveals list titles only once their clip has started', () => {
    const clips = [clip('a', 1, 2, 'Blah'), clip('b', 2, 2, 'Hello')]
    const early = buildList(clips, 1)
    expect(early.map((i) => i.revealed)).toEqual([true, false])
    expect(buildList(clips, 3)[1].revealed).toBe(true)
  })

  it('marks only the playing clip as active, following the playhead', () => {
    const clips = [clip('a', 1, 2, 'Blah'), clip('b', 2, 2, 'Hello'), clip('c', 3, 2)]
    expect(buildList(clips, 1).map((i) => i.active)).toEqual([true, false, false])
    expect(buildList(clips, 2.5).map((i) => i.active)).toEqual([false, true, false])
    expect(buildList(clips, 5).map((i) => i.active)).toEqual([false, false, true])
  })

  it('follows ranks, not order, so a shuffle keeps titles with their clips', () => {
    const clips = [clip('b', 2, 2, 'Hello'), clip('a', 1, 2, 'Blah')] // shuffled: rank 2 plays first
    expect(buildList(clips, 1).map((i) => i.active)).toEqual([false, true])
  })

  it('lists up to the highest rank even if clips are missing', () => {
    expect(buildList([clip('a', 5, 2)], 0)).toHaveLength(5)
  })
})

import { parseTitles } from '../lib/claude'

describe('parseTitles', () => {
  it('reads plain JSON', () => {
    expect(parseTitles('{"titles":[{"n":1,"title":"Treadmill Betrayal"},{"n":2,"title":"Gym Ninja"}]}')).toEqual({ 1: 'Treadmill Betrayal', 2: 'Gym Ninja' })
  })
  it('tolerates code fences, chatter and wrapping quotes', () => {
    const reply = 'Sure!\n```json\n{"titles":[{"n":1,"title":"\\"Wrong Machine\\""}]}\n```'
    expect(parseTitles(reply)).toEqual({ 1: 'Wrong Machine' })
  })
  it('returns nothing for junk', () => {
    expect(parseTitles('no json here')).toEqual({})
    expect(parseTitles('{bad json}')).toEqual({})
  })
})
