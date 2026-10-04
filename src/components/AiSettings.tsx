import { useState } from 'react'
import { useClaudeSettings, hasCredentials } from '../store/claudeSettings'
import { listGeminiModels, pickGeminiModel } from '../lib/ai'
import { Section, Seg } from './ui'

/** Pick the AI provider and enter its key. Gemini's free tier is the default. */
export function AiSettings() {
  const { cfg, save } = useClaudeSettings()
  const [models, setModels] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(!hasCredentials(cfg))

  async function check() {
    setChecking(true)
    setMsg(null)
    try {
      const list = await listGeminiModels(cfg.geminiKey)
      setModels(list)
      const best = pickGeminiModel(list)
      const missing = !list.includes(cfg.geminiModel.replace(/^models\//, ''))
      if (missing && best) save({ ...cfg, geminiModel: best })
      setMsg({ ok: true, text: `Key works. ${list.length} Gemini models available.${missing && best ? ` "${cfg.geminiModel}" is not available, so I switched to ${best}.` : ''}` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setChecking(false)
    }
  }

  return (
    <Section title="AI SETTINGS" desc={hasCredentials(cfg) ? `Using ${cfg.provider === 'gemini' ? 'Gemini' : 'Claude'}. Your key stays in this browser.` : 'Add a key to turn on the title generator and the chat.'}>
      <Seg value={cfg.provider} onChange={(provider) => save({ ...cfg, provider })}
        options={[{ value: 'gemini', label: 'Gemini (free tier)' }, { value: 'claude', label: 'Claude' }]} />
      <button className="link" onClick={() => setOpen(!open)}>{open ? 'hide settings' : 'show settings'}</button>

      {open && cfg.provider === 'gemini' && (
        <div className="cfg">
          <label className="mini-label">Gemini API key
            <input className="text" type="password" value={cfg.geminiKey} placeholder="AIza..."
              onChange={(e) => save({ ...cfg, geminiKey: e.target.value })} />
          </label>
          <p className="hint">
            Get a free key at <b>aistudio.google.com/apikey</b> (sign in, click “Create API key”). Free-tier use has rate limits, and
            Google may use free-tier content to improve its products, so avoid private footage.
          </p>
          <label className="mini-label">Model
            {models.length ? (
              <select value={cfg.geminiModel} onChange={(e) => save({ ...cfg, geminiModel: e.target.value })}>
                {!models.includes(cfg.geminiModel) && <option>{cfg.geminiModel}</option>}
                {models.map((m) => <option key={m}>{m}</option>)}
              </select>
            ) : (
              <input className="text" value={cfg.geminiModel} onChange={(e) => save({ ...cfg, geminiModel: e.target.value })} />
            )}
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button disabled={!cfg.geminiKey || checking} onClick={check}>{checking ? 'Checking…' : '✓ Check key & list models'}</button>
          </div>
          {msg && <p className={msg.ok ? 'hint mono' : 'err'}>{msg.text}</p>}
          <p className="hint">If a model name stops working, press the check button and pick one from the list.</p>
        </div>
      )}

      {open && cfg.provider === 'claude' && (
        <div className="cfg">
          <label className="mini-label">Anthropic API key
            <input className="text" type="password" value={cfg.apiKey} placeholder="sk-ant-..."
              onChange={(e) => save({ ...cfg, apiKey: e.target.value })} />
          </label>
          <label className="mini-label">Model
            <input className="text" value={cfg.model} onChange={(e) => save({ ...cfg, model: e.target.value })} />
          </label>
          <label className="mini-label">Proxy URL (optional, keeps the key off the browser)
            <input className="text" value={cfg.proxyUrl} placeholder="http://localhost:8787"
              onChange={(e) => save({ ...cfg, proxyUrl: e.target.value })} />
          </label>
          <p className="hint">Claude API use is billed per request on your Anthropic account.</p>
        </div>
      )}
    </Section>
  )
}
