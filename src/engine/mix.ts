import type { Clip } from '../store/project'
import { clipLength, segments } from './timeline'

/**
 * Mixes every clip's audio (respecting trim, volume, mute) plus the voiceover into one
 * stereo buffer, offline and faster than real time.
 */
export async function mixAudio(
  clips: Clip[],
  voiceUrl: string | null,
  voiceVolume: number,
  total: number,
  sampleRate = 48000,
): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sampleRate)), sampleRate)
  const cache = new Map<string, AudioBuffer | null>()

  async function decode(url: string) {
    if (!cache.has(url)) {
      try {
        cache.set(url, await off.decodeAudioData(await (await fetch(url)).arrayBuffer()))
      } catch {
        cache.set(url, null) // no audio track
      }
    }
    return cache.get(url)!
  }

  for (const seg of segments(clips)) {
    if (seg.clip.missing || seg.clip.muted || seg.clip.volume <= 0) continue
    const buf = await decode(seg.clip.url)
    if (!buf) continue
    const src = off.createBufferSource()
    src.buffer = buf
    const gain = off.createGain()
    gain.gain.value = seg.clip.volume
    src.connect(gain).connect(off.destination)
    src.start(seg.start, seg.clip.trimIn, clipLength(seg.clip))
  }

  if (voiceUrl) {
    const buf = await decode(voiceUrl)
    if (buf) {
      const src = off.createBufferSource()
      src.buffer = buf
      const gain = off.createGain()
      gain.gain.value = voiceVolume
      src.connect(gain).connect(off.destination)
      src.start(0)
    }
  }
  return off.startRendering()
}
