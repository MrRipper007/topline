import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { useProject } from '../store/project'
import { buildCaptions } from './captions'
import { composeFrame } from './frame'
import { mixAudio } from './mix'
import { H, W } from './renderer'
import { locate, totalLength } from './timeline'

export interface RenderOptions {
  fps: number
  /** Video bitrate in bits per second. */
  bitrate: number
  onProgress: (fraction: number, stage: string) => void
  signal: { cancelled: boolean }
}

const SAMPLE_RATE = 48000
const AUDIO_BITRATE = 256_000
// H.264 High, then Main, then Baseline, at level 4.2 (1080x1920 @ up to 60 fps).
const AVC_CODECS = ['avc1.64002A', 'avc1.4D002A', 'avc1.42E02A']

export function webCodecsSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

export interface Support {
  /** Working H.264 profile string, or '' if none. */
  h264: string
  /** AAC is what every social platform expects; Opus is the fallback. */
  audio: 'aac' | 'opus' | null
}

/** What this browser can encode, checked against the real 1080x1920 configuration. */
export async function probeSupport(fps = 30, bitrate = 16_000_000): Promise<Support> {
  if (!webCodecsSupported()) return { h264: '', audio: null }
  let h264 = ''
  for (const c of AVC_CODECS) {
    if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate, framerate: fps })).supported) {
      h264 = c
      break
    }
  }
  const cfg = { sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE }
  const audio = (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', ...cfg })).supported
    ? 'aac'
    : (await AudioEncoder.isConfigSupported({ codec: 'opus', ...cfg })).supported
      ? 'opus'
      : null
  return { h264, audio }
}

function seek(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - t) < 0.0005 && el.readyState >= 2) return resolve()
    const done = () => {
      el.removeEventListener('seeked', done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, 3000)
    el.addEventListener('seeked', done)
    el.currentTime = t
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => resolve(v)
    v.onerror = () => reject(new Error('Could not load a clip for rendering.'))
    v.src = url
  })
}

/**
 * Renders the project offline, frame by frame, to an H.264 + AAC MP4 (1080x1920).
 * Not tied to real time, so the tab can be busy and the result is frame-accurate.
 */
export async function renderMp4(opts: RenderOptions): Promise<Blob> {
  const { fps, bitrate, onProgress, signal } = opts
  const s = useProject.getState()
  const total = totalLength(s.clips)
  if (!s.clips.length) throw new Error('Add at least one clip first.')
  if (s.clips.some((c) => c.missing)) throw new Error('Some clips have no video linked yet. Re-add them in the Media tab first.')
  if (!webCodecsSupported()) throw new Error('This browser has no WebCodecs support. Use Chrome, Edge or another Chromium browser, or pick WebM.')
  const check = () => {
    if (signal.cancelled) throw new Error('Cancelled')
  }

  const support = await probeSupport(fps, bitrate)
  const codec = support.h264
  if (!codec) throw new Error('H.264 encoding is not available in this browser. Use Chrome or Edge, or the WebM option.')
  if (!support.audio) throw new Error('No MP4-compatible audio encoder (AAC or Opus) is available in this browser. Use Chrome or Edge, or the WebM option.')
  const audioCodec = support.audio

  let fatal: Error | null = null
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: { codec: audioCodec, numberOfChannels: 2, sampleRate: SAMPLE_RATE },
    fastStart: 'in-memory',
  })
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (fatal = e),
  })
  videoEncoder.configure({ codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } })
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => (fatal = e),
  })
  audioEncoder.configure({ codec: audioCodec === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE })

  try {
    // 1. Audio: mix offline, then encode in one-second chunks.
    onProgress(0, 'Mixing audio')
    const mix = await mixAudio(s.clips, s.voiceUrl, s.voiceVolume, total, SAMPLE_RATE)
    check()
    onProgress(0.05, 'Encoding audio')
    const left = mix.getChannelData(0)
    const right = mix.numberOfChannels > 1 ? mix.getChannelData(1) : left
    for (let off = 0; off < mix.length; off += SAMPLE_RATE) {
      const n = Math.min(SAMPLE_RATE, mix.length - off)
      const data = new Float32Array(n * 2)
      data.set(left.subarray(off, off + n), 0)
      data.set(right.subarray(off, off + n), n)
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / SAMPLE_RATE) * 1e6), data })
      audioEncoder.encode(ad)
      ad.close()
      if (fatal) throw fatal
    }

    // 2. Video: a dedicated element per clip, seeked to each frame's exact time.
    onProgress(0.08, 'Loading clips')
    const videos = new Map<string, HTMLVideoElement>()
    for (const c of s.clips) videos.set(c.id, await loadVideo(c.url))
    check()

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const caps = buildCaptions(s.script, s.voiceDuration || total, s.look.caption.words)
    const frames = Math.max(1, Math.round(total * fps))
    const keyEvery = fps * 2

    for (let i = 0; i < frames; i++) {
      check()
      if (fatal) throw fatal
      const t = Math.min(i / fps, total - 1e-3)
      const loc = locate(s.clips, t)
      if (loc) await seek(videos.get(loc.clip.id)!, loc.clip.trimIn + loc.local)
      composeFrame(ctx, s.clips, s.look, caps, t, (id) => videos.get(id) ?? null)
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
      videoEncoder.encode(frame, { keyFrame: i % keyEvery === 0 })
      frame.close()
      while (videoEncoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
      if (i % 5 === 0) onProgress(0.1 + 0.87 * (i / frames), `Rendering frame ${i} of ${frames}`)
    }

    onProgress(0.98, 'Finalizing')
    await videoEncoder.flush()
    await audioEncoder.flush()
    if (fatal) throw fatal
    muxer.finalize()
    onProgress(1, 'Done')
    return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: 'video/mp4' })
  } finally {
    if (videoEncoder.state !== 'closed') videoEncoder.close()
    if (audioEncoder.state !== 'closed') audioEncoder.close()
  }
}
