import { useState } from 'react'
import { askClaude, parseActions, describeAction, applyAction, type Action } from '../lib/claude'
import { useClaudeSettings, hasCredentials } from '../store/claudeSettings'
import { providerName } from '../lib/ai'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  actions?: Action[]
  applied?: boolean
}

export function ClaudePanel() {
  const cfg = useClaudeSettings((s) => s.cfg)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!input.trim() || busy) return
    if (!hasCredentials(cfg)) {
      setError('Add your API key under AI settings above first.')
      return
    }
    const history: Msg[] = [...msgs, { role: 'user', content: input }]
    setMsgs(history)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const reply = await askClaude(cfg, history.map(({ role, content }) => ({ role, content })))
      setMsgs([...history, { role: 'assistant', content: reply, actions: parseActions(reply) }])
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  function approve(i: number) {
    msgs[i].actions?.forEach(applyAction)
    setMsgs(msgs.map((m, j) => (j === i ? { ...m, applied: true } : m)))
  }

  return (
    <section className="sec">
      <div className="sec-head"><h3>CHAT</h3></div>
      <p className="desc">Ask {providerName(cfg.provider)} to change the project, e.g. shuffle, pick a template, rewrite the hook title. You approve changes before they apply.</p>
      <div className="chat">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <p>{m.content.replace(/```json[\s\S]*?```/g, '').trim()}</p>
            {!!m.actions?.length && (
              <div className="actions">
                <ul>{m.actions.map((a, k) => <li key={k}>{describeAction(a)}</li>)}</ul>
                <button className="primary" disabled={m.applied} onClick={() => approve(i)}>
                  {m.applied ? 'Applied ✓' : 'Apply changes'}
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="dim">{providerName(cfg.provider)} is thinking…</div>}
        {error && <p className="err">{error}</p>}
      </div>
      <div className="row">
        <input className="text" value={input} placeholder='e.g. "shuffle and apply Neon Countdown"'
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="primary" onClick={send} disabled={busy}>Send</button>
      </div>
    </section>
  )
}
