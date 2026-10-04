export type Provider = 'gemini' | 'claude'

export interface ClaudeSettings {
  provider: Provider
  /** Gemini (Google AI Studio) key and model. */
  geminiKey: string
  geminiModel: string
  /** Claude (Anthropic) key, model and optional local proxy (server/proxy.mjs). */
  apiKey: string
  model: string
  proxyUrl: string
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: 'image/jpeg' }

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string | Block[]
}

export interface ModelRequest {
  system: string
  messages: ChatMsg[]
  maxTokens: number
  /** Ask the model to answer with raw JSON (Gemini enforces this; Claude is told in the prompt). */
  json?: boolean
  /** Progress messages such as "busy, retrying". */
  onStatus?: (msg: string) => void
}

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const asBlocks = (c: string | Block[]): Block[] => (typeof c === 'string' ? [{ type: 'text', text: c }] : c)

export const providerName = (p: Provider) => (p === 'gemini' ? 'Gemini' : 'Claude')

export function hasCredentials(s: ClaudeSettings): boolean {
  return s.provider === 'gemini' ? !!s.geminiKey : !!s.apiKey || !!s.proxyUrl
}

/** Send one request to whichever provider is selected and return the reply text. */
export function callModel(s: ClaudeSettings, req: ModelRequest): Promise<string> {
  return s.provider === 'gemini' ? callGemini(s, req) : callClaude(s, req)
}

async function callClaude(s: ClaudeSettings, req: ModelRequest): Promise<string> {
  const body = {
    model: s.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: asBlocks(m.content).map((b) =>
        b.type === 'text'
          ? { type: 'text', text: b.text }
          : { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } },
      ),
    })),
  }
  const useProxy = !!s.proxyUrl
  const res = await fetch(useProxy ? s.proxyUrl : 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: useProxy
      ? { 'content-type': 'application/json' }
      : {
          'content-type': 'application/json',
          'x-api-key': s.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return (json.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
}

/** Strip a leading "models/" so users can paste either form. */
const modelId = (m: string) => m.trim().replace(/^models\//, '')

let persistModel: ((model: string) => void) | null = null
/** The settings store registers itself here so an auto-picked model is remembered. */
export function registerModelPersist(fn: (model: string) => void) {
  persistModel = fn
}

/**
 * Pick the best fast, image-capable Gemini model from a list. Prefers the "-latest" alias (it never gets
 * retired), then the newest stable Flash, then newest stable Pro. Skips embedding, image-output, audio, etc.
 */
export function pickGeminiModel(names: string[]): string | null {
  const usable = names.filter((n) => !/embed|tts|image|live|audio|robotics|computer-use|learnlm|gemma|aqa|imagen|veo/i.test(n))
  if (usable.includes('gemini-flash-latest')) return 'gemini-flash-latest'
  const version = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const best = (re: RegExp, allowPreview: boolean) =>
    usable
      .filter((n) => re.test(n) && !/lite/.test(n) && (allowPreview || !/preview|exp/.test(n)))
      .sort((a, b) => version(b) - version(a) || a.length - b.length)[0]
  return best(/flash/, false) ?? best(/flash/, true) ?? best(/pro/, false) ?? best(/pro/, true) ?? usable[0] ?? null
}

/** Delays (ms) before each automatic retry when Google says it is overloaded. Tests set this to zeros. */
export const retryConfig = { delays: [1500, 4000, 8000] }
const TRANSIENT = new Set([500, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** POST to one model, retrying while Google reports a temporary overload. */
async function postGemini(s: ClaudeSettings, body: unknown, model: string, retries: number, onStatus?: (msg: string) => void): Promise<Response> {
  for (let i = 0; ; i++) {
    // The key goes in a header, not the URL, so it never ends up in logs or history.
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.geminiKey },
      body: JSON.stringify(body),
    })
    if (TRANSIENT.has(res.status) && i < retries) {
      const wait = retryConfig.delays[i] ?? 0
      onStatus?.(`Gemini is busy (${res.status}). Retrying in ${Math.round(wait / 1000)}s…`)
      await sleep(wait)
      continue
    }
    return res
  }
}

async function geminiError(status: number, text: string): Promise<Error> {
  const hint =
    TRANSIENT.has(status) ? "Google's Gemini servers are overloaded right now. This is temporary: wait a minute and try again."
    : status === 429 ? 'Rate limit or free daily quota reached. Wait a bit, or generate fewer clips at once.'
    : status === 403 ? 'This key is not allowed to use the API. Check it in Google AI Studio.'
    : status === 400 && /api key/i.test(text) ? 'The API key looks invalid. Create a new one in Google AI Studio.'
    : ''
  return new Error(`Gemini API ${status}: ${hint} ${text.slice(0, 300)}`.replace(/\s+/g, ' ').trim())
}

/** Every usable model, best first (so we can try the next one when a model is overloaded). */
function rankGeminiModels(names: string[]): string[] {
  const out: string[] = []
  let pool = names.slice()
  for (let m = pickGeminiModel(pool); m; m = pickGeminiModel(pool)) {
    out.push(m)
    pool = pool.filter((x) => x !== m)
  }
  return [...out, ...pool.filter((n) => /flash.*lite|lite.*flash/.test(n) && !/embed|tts|image|live|audio/.test(n))]
}

async function callGemini(s: ClaudeSettings, req: ModelRequest): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: asBlocks(m.content).map((b) =>
        b.type === 'text' ? { text: b.text } : { inlineData: { mimeType: b.mediaType, data: b.data } },
      ),
    })),
    // Thinking models spend part of this budget before answering, so leave plenty of room.
    generationConfig: { maxOutputTokens: Math.max(req.maxTokens, 4096), ...(req.json ? { responseMimeType: 'application/json' } : {}) },
  }
  const model = modelId(s.geminiModel)
  let res = await postGemini(s, body, model, retryConfig.delays.length, req.onStatus)

  if (res.status === 404) {
    // The saved model name no longer exists. Ask the key what it can use, switch, and retry.
    const original = await res.text()
    let fallback: string | null = null
    try {
      fallback = pickGeminiModel(await listGeminiModels(s.geminiKey))
    } catch {
      /* fall through to the error below */
    }
    if (!fallback || fallback === model) {
      throw new Error(`Gemini API 404: model "${model}" was not found and no other model could be found for this key. ${original}`)
    }
    res = await postGemini(s, body, fallback, retryConfig.delays.length, req.onStatus)
    if (res.ok) persistModel?.(fallback)
  } else if (TRANSIENT.has(res.status)) {
    // Still overloaded after retrying: try other models once each. Not remembered, since this is temporary.
    try {
      const tried = new Set([model])
      for (const alt of rankGeminiModels(await listGeminiModels(s.geminiKey)).slice(0, 4)) {
        if (tried.has(alt)) continue
        tried.add(alt)
        req.onStatus?.(`${model} is busy. Trying ${alt}…`)
        const next = await postGemini(s, body, alt, 0)
        if (next.ok) {
          res = next
          break
        }
        if (tried.size >= 3) break
      }
    } catch {
      /* keep the original overload response */
    }
  }

  if (!res.ok) throw await geminiError(res.status, await res.text())
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  const cand = json.candidates?.[0]
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (!text) {
    const why = json.promptFeedback?.blockReason ?? cand?.finishReason ?? 'no content'
    throw new Error(`Gemini returned no text (${why}). Try again, or add context to the clip.`)
  }
  return text
}

/** Models on this key that can generate content, e.g. ["gemini-2.5-flash", ...]. Also proves the key works. */
export async function listGeminiModels(key: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
  return (json.models ?? [])
    .filter((m) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
}
