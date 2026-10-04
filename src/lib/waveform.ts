/** Decode a media file's audio and reduce it to `bars` peak values (0..1). Empty if no audio track. */
export async function computePeaks(url: string, bars = 80): Promise<number[]> {
  try {
    const buf = await (await fetch(url)).arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, 44100)
    const audio = await ctx.decodeAudioData(buf)
    const data = audio.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i++) {
      let max = 0
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 16) max = Math.max(max, Math.abs(data[j]))
      peaks.push(max)
    }
    return peaks
  } catch {
    return []
  }
}
