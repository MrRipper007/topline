function seekTo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
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

/**
 * Grabs `count` evenly spaced stills between `from` and `to` seconds, scaled so the long side is
 * `maxSide` px, as base64 JPEG (no data: prefix) ready for the Claude API.
 */
export async function extractFrames(url: string, from: number, to: number, count = 4, maxSide = 512): Promise<string[]> {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.playsInline = true
  await new Promise<void>((resolve, reject) => {
    v.onloadeddata = () => resolve()
    v.onerror = () => reject(new Error('Could not read a clip to take frames from it.'))
    v.src = url
  })
  const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(v.videoWidth * scale))
  c.height = Math.max(1, Math.round(v.videoHeight * scale))
  const g = c.getContext('2d')!
  const frames: string[] = []
  const span = Math.max(0.1, to - from)
  for (let i = 0; i < count; i++) {
    await seekTo(v, from + ((i + 0.5) / count) * span)
    g.drawImage(v, 0, 0, c.width, c.height)
    frames.push(c.toDataURL('image/jpeg', 0.72).split(',')[1])
  }
  v.removeAttribute('src')
  v.load()
  return frames
}
