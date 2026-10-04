/** Read a clip's duration and grab a small poster frame for the clip list. */
export function probeVideo(url: string): Promise<{ duration: number; thumb: string }> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.playsInline = true
    let done = false
    const finish = (thumb = '') => {
      if (done) return
      done = true
      resolve({ duration: v.duration || 0, thumb })
    }
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.3, (v.duration || 0) / 2)
    }
    v.onseeked = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 90
        c.height = 160
        const g = c.getContext('2d')!
        const s = Math.max(90 / v.videoWidth, 160 / v.videoHeight)
        g.drawImage(v, (90 - v.videoWidth * s) / 2, (160 - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s)
        finish(c.toDataURL('image/jpeg', 0.6))
      } catch {
        finish()
      }
    }
    v.onerror = () => finish()
    setTimeout(() => finish(), 4000)
    v.src = url
  })
}

export function audioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio(url)
    a.onloadedmetadata = () => resolve(a.duration || 0)
    a.onerror = () => resolve(0)
  })
}
