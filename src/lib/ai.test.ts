import { afterEach, describe, expect, it, vi } from 'vitest'
import { callModel, listGeminiModels, hasCredentials, registerModelPersist, retryConfig, type ClaudeSettings } from './ai'

const base: ClaudeSettings = {
  provider: 'gemini', geminiKey: 'AIza-test', geminiModel: 'models/gemini-2.5-flash',
  apiKey: 'sk-ant-test', model: 'claude-sonnet-5-5', proxyUrl: '',
}

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

const req = {
  system: 'sys',
  maxTokens: 100,
  json: true,
  messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }, { type: 'image' as const, mediaType: 'image/jpeg' as const, data: 'QUJD' }] }],
}

describe('Gemini', () => {
  it('sends images and system prompt, keeps the key out of the URL', async () => {
    const f = mockFetch({ candidates: [{ content: { parts: [{ text: '{"titles":[]}' }] } }] })
    const out = await callModel(base, req)
    expect(out).toBe('{"titles":[]}')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(url).not.toContain('AIza')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-test')
    const body = JSON.parse(init.body as string)
    expect(body.systemInstruction.parts[0].text).toBe('sys')
    expect(body.contents[0].role).toBe('user')
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096)
  })

  it('maps assistant turns to the model role', async () => {
    const f = mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await callModel(base, { system: 's', maxTokens: 10, messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] })
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
  })

  it('explains a blocked or empty reply', async () => {
    mockFetch({ candidates: [], promptFeedback: { blockReason: 'SAFETY' } })
    await expect(callModel(base, req)).rejects.toThrow(/SAFETY/)
  })

  it('surfaces API errors with the status', async () => {
    mockFetch({ error: { message: 'API key not valid' } }, false, 400)
    await expect(callModel(base, req)).rejects.toThrow(/Gemini API 400/)
  })

  it('lists only gemini models that can generate content', async () => {
    mockFetch({
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/imagen-3', supportedGenerationMethods: ['predict'] },
      ],
    })
    expect(await listGeminiModels('k')).toEqual(['gemini-2.5-flash'])
  })
})

describe('Claude', () => {
  it('converts images to Anthropic blocks', async () => {
    const f = mockFetch({ content: [{ type: 'text', text: 'done' }] })
    expect(await callModel({ ...base, provider: 'claude' }, req)).toBe('done')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse(init.body as string)
    expect(body.messages[0].content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } })
  })
})

describe('credentials', () => {
  it('checks the key of the selected provider', () => {
    expect(hasCredentials({ ...base, provider: 'gemini', geminiKey: '' })).toBe(false)
    expect(hasCredentials({ ...base, provider: 'gemini' })).toBe(true)
    expect(hasCredentials({ ...base, provider: 'claude', apiKey: '' })).toBe(false)
    expect(hasCredentials({ ...base, provider: 'claude', apiKey: '', proxyUrl: 'http://localhost:8787' })).toBe(true)
  })
})

import { pickGeminiModel } from './ai'

describe('model fallback', () => {
  it('prefers the -latest alias, then newest stable flash, skipping non-chat models', () => {
    expect(pickGeminiModel(['gemini-2.5-flash', 'gemini-flash-latest'])).toBe('gemini-flash-latest')
    expect(pickGeminiModel(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-embedding-001', 'gemini-2.5-flash-image', 'gemini-2.5-pro']))
      .toBe('gemini-2.5-flash')
    expect(pickGeminiModel(['gemini-2.5-pro', 'gemini-2.5-flash-tts'])).toBe('gemini-2.5-pro')
    expect(pickGeminiModel([])).toBeNull()
  })

  it('on a 404 it lists models, retries with a working one and remembers it', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      if (url.includes('/models?')) {
        return { ok: true, status: 200, json: async () => ({ models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] }), text: async () => '' }
      }
      if (url.includes('gemini-2.5-flash:')) return { ok: false, status: 404, json: async () => ({}), text: async () => 'not found' }
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }), text: async () => '' }
    }))
    const remembered: string[] = []
    registerModelPersist((m) => remembered.push(m))
    expect(await callModel(base, req)).toBe('hello')
    expect(calls.map((c) => c.split('/v1beta/')[1])).toEqual(['models/gemini-2.5-flash:generateContent', 'models?pageSize=200', 'models/gemini-3-flash:generateContent'])
    expect(remembered).toEqual(['gemini-3-flash'])
  })

  it('reports a clear error when no model can be found', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('/models?')
        ? { ok: true, status: 200, json: async () => ({ models: [] }), text: async () => '' }
        : { ok: false, status: 404, json: async () => ({}), text: async () => 'nope' }))
    await expect(callModel(base, req)).rejects.toThrow(/Gemini API 404/)
  })
})

describe('Gemini overload (503)', () => {
  const okBody = { candidates: [{ content: { parts: [{ text: 'fine' }] } }] }
  const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) })
  const listBody = { models: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-pro'].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) }
  const savedDelays = retryConfig.delays
  afterEach(() => { retryConfig.delays = savedDelays })

  it('retries a temporary 503 and then succeeds, reporting progress', async () => {
    retryConfig.delays = [0, 0, 0]
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => (++n < 3 ? res(503, { error: { message: 'The model is overloaded.' } }) : res(200, okBody))))
    const status: string[] = []
    expect(await callModel(base, { ...req, onStatus: (m) => status.push(m) })).toBe('fine')
    expect(n).toBe(3)
    expect(status).toHaveLength(2)
    expect(status[0]).toMatch(/busy \(503\)/)
  })

  it('switches to another model when the saved one stays overloaded', async () => {
    retryConfig.delays = [0, 0]
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/models?')) return res(200, listBody)
      if (url.includes('gemini-2.5-flash:')) return res(503) // the saved model is down
      return res(200, okBody)
    }))
    const remembered: string[] = []
    registerModelPersist((m) => remembered.push(m))
    expect(await callModel(base, req)).toBe('fine')
    expect(urls.some((u) => u.includes('gemini-flash-latest:'))).toBe(true)
    expect(remembered).toEqual([]) // a temporary outage must not change the saved model
  })

  it('gives a plain-English error when everything is overloaded', async () => {
    retryConfig.delays = [0]
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/models?') ? res(200, listBody) : res(503, { error: { message: 'overloaded' } }))))
    await expect(callModel(base, req)).rejects.toThrow(/Gemini API 503: Google's Gemini servers are overloaded/)
  })

  it('explains rate limits without retrying', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => (n++, res(429, { error: { message: 'quota' } }))))
    await expect(callModel(base, req)).rejects.toThrow(/Rate limit/)
    expect(n).toBe(1)
  })
})
