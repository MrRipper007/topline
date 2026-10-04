import { useProject } from '../store/project'
import { useUi } from '../store/ui'
import { buildCaptions, type Caption } from './captions'
import { W, H } from './renderer'
import { composeFrame } from './frame'
import { locate, segments, totalLength } from './timeline'

interface Node {
  el: HTMLVideoElement
  gain: GainNode
}

/**
 * Plays the timeline: one hidden <video> per clip routed through WebAudio, so what you
 * hear in preview is exactly what the exporter records.
 */
export class Player {
  canvas: HTMLCanvasElement
  ctx2d: CanvasRenderingContext2D
  audio = new AudioContext()
  master = this.audio.createGain()
  recordDest = this.audio.createMediaStreamDestination()
  nodes = new Map<string, Node>()
  voice: HTMLAudioElement | null = null
  voiceUrl: string | null = null
  voiceGain = this.audio.createGain()
  time = 0
  playing = false
  onTick: (t: number) => void = () => {}
  onEnd: () => void = () => {}
  private last = 0
  private raf = 0
  private activeId: string | null = null
  private capKey = ''
  private caps: Caption[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    this.ctx2d = canvas.getContext('2d')!
    this.master.connect(this.audio.destination)
    this.master.connect(this.recordDest)
    this.voiceGain.connect(this.master)
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  get duration() {
    return totalLength(useProject.getState().clips)
  }

  setVolume(v: number) {
    this.master.gain.value = v
  }

  /** Create/remove media elements so they match the project's clips. */
  sync() {
    const { clips, voiceUrl, voiceVolume } = useProject.getState()
    for (const c of clips) {
      if (c.missing || !c.url) continue
      if (!this.nodes.has(c.id)) {
        const el = document.createElement('video')
        el.src = c.url
        el.preload = 'auto'
        el.playsInline = true
        const gain = this.audio.createGain()
        this.audio.createMediaElementSource(el).connect(gain)
        gain.connect(this.master)
        this.nodes.set(c.id, { el, gain })
      }
      this.nodes.get(c.id)!.gain.gain.value = c.muted ? 0 : c.volume
    }
    for (const [id, n] of this.nodes) {
      if (!clips.find((c) => c.id === id)) {
        n.el.pause()
        n.gain.disconnect()
        this.nodes.delete(id)
      }
    }
    if (voiceUrl !== this.voiceUrl) {
      this.voice?.pause()
      this.voice = null
      this.voiceUrl = voiceUrl
      if (voiceUrl) {
        const a = new Audio(voiceUrl)
        this.audio.createMediaElementSource(a).connect(this.voiceGain)
        this.voice = a
      }
    }
    this.voiceGain.gain.value = voiceVolume
  }

  async play() {
    await this.audio.resume()
    this.sync()
    if (this.time >= this.duration) this.time = 0
    this.playing = true
    this.last = performance.now()
    this.activeId = null
    if (this.voice) {
      this.voice.currentTime = this.time
      void this.voice.play()
    }
    useUi.setState({ playing: true })
  }

  pause() {
    this.playing = false
    this.voice?.pause()
    for (const n of this.nodes.values()) n.el.pause()
    useUi.setState({ playing: false })
  }

  seek(t: number) {
    this.sync()
    this.time = Math.max(0, Math.min(t, this.duration))
    this.activeId = null
    if (this.voice) this.voice.currentTime = this.time
    const loc = locate(useProject.getState().clips, this.time)
    if (loc) {
      const n = this.nodes.get(loc.clip.id)
      if (n) n.el.currentTime = loc.clip.trimIn + loc.local
      if (this.playing) this.followTimeline()
    }
    useUi.setState({ time: this.time })
    if (!this.playing) this.draw()
  }

  /** Jump to the start of the next (dir=1) or previous (dir=-1) clip. */
  step(dir: 1 | -1) {
    const segs = segments(useProject.getState().clips)
    if (!segs.length) return
    const cur = locate(useProject.getState().clips, this.time)!
    const i = dir === 1 ? cur.index + 1 : cur.local > 0.5 ? cur.index : cur.index - 1
    this.seek(segs[Math.max(0, Math.min(i, segs.length - 1))].start)
  }

  /** Solo-style preview of a single clip's audio from the media library. */
  async previewClip(id: string, on: boolean) {
    this.sync()
    const n = this.nodes.get(id)
    if (!n) return
    await this.audio.resume()
    for (const [oid, other] of this.nodes) if (oid !== id) other.el.pause()
    if (on) {
      this.pause()
      const c = useProject.getState().clips.find((x) => x.id === id)!
      n.el.currentTime = c.trimIn
      await n.el.play()
    } else n.el.pause()
  }

  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop)
    if (this.playing) {
      this.time += (now - this.last) / 1000
      this.last = now
      if (this.time >= this.duration) {
        this.time = this.duration
        this.pause()
        this.onEnd()
      } else {
        this.followTimeline()
      }
      useUi.setState({ time: this.time })
      this.onTick(this.time)
    }
    this.draw()
  }

  private followTimeline() {
    const loc = locate(useProject.getState().clips, this.time)
    const n = loc && this.nodes.get(loc.clip.id)
    if (!loc || !n) return
    if (this.activeId !== loc.clip.id) {
      for (const [id, o] of this.nodes) if (id !== loc.clip.id) o.el.pause()
      this.activeId = loc.clip.id
      n.el.currentTime = loc.clip.trimIn + loc.local
      void n.el.play()
    } else if (n.el.currentTime >= loc.clip.trimOut) {
      n.el.pause()
    }
  }

  private captionsFor(script: string, length: number, words: number) {
    const key = `${script}|${length.toFixed(2)}|${words}`
    if (key !== this.capKey) {
      this.capKey = key
      this.caps = buildCaptions(script, length, words)
    }
    return this.caps
  }

  draw() {
    const s = useProject.getState()
    const caps = this.captionsFor(s.script, s.voiceDuration || this.duration, s.look.caption.words)
    composeFrame(this.ctx2d, s.clips, s.look, caps, this.time, (id) => this.nodes.get(id)?.el ?? null)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.pause()
    void this.audio.close()
  }
}

