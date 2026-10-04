export interface Caption {
  text: string
  start: number
  end: number
}

/** Split a script into chunks of ~maxWords and spread them across `duration` seconds by word count. */
export function buildCaptions(script: string, duration: number, maxWords = 4): Caption[] {
  const words = script.trim().split(/\s+/).filter(Boolean)
  if (!words.length || duration <= 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords))
  let cursor = 0
  return chunks.map((c) => {
    const start = (cursor / words.length) * duration
    cursor += c.length
    return { text: c.join(' '), start, end: (cursor / words.length) * duration }
  })
}

export function captionAt(caps: Caption[], t: number): Caption | undefined {
  return caps.find((c) => t >= c.start && t < c.end)
}
