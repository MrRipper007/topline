import type { Player } from './player'

/** Records the canvas + mixed audio in real time and returns a WebM blob. */
export async function exportWebm(player: Player, onProgress: (p: number) => void): Promise<Blob> {
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  )
  if (!mime) throw new Error('This browser cannot record WebM.')
  const stream = player.canvas.captureStream(30)
  player.recordDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
  })
  player.seek(0)
  const prevTick = player.onTick
  const prevEnd = player.onEnd
  player.onTick = (t) => {
    prevTick(t)
    onProgress(t / Math.max(player.duration, 0.01))
  }
  player.onEnd = () => {
    prevEnd()
    setTimeout(() => rec.stop(), 300)
  }
  rec.start(250)
  await player.play()
  const blob = await done
  player.onTick = prevTick
  player.onEnd = prevEnd
  return blob
}
