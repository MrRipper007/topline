import { create } from 'zustand'
import { hasCredentials, registerModelPersist, type ClaudeSettings } from '../lib/ai'

const KEY = 'topline-ai'
const OLD_KEY = 'rankreel-claude' // from before the rename; read once so saved API keys carry over
const DEFAULTS: ClaudeSettings = {
  provider: 'gemini',
  geminiKey: '',
  // "-latest" is an alias Google keeps pointing at a current Flash model, so it doesn't get retired.
  geminiModel: 'gemini-flash-latest',
  apiKey: '',
  model: 'claude-sonnet-5-5',
  proxyUrl: '',
}

function load(): ClaudeSettings {
  try {
    const saved = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? '{}') }
    // Earlier builds saved a model name that Google has since retired; move to the alias.
    if (saved.geminiModel === 'gemini-2.5-flash') saved.geminiModel = DEFAULTS.geminiModel
    return saved
  } catch {
    return DEFAULTS
  }
}

/** Provider, API keys and models. Stored only in this browser's localStorage. */
export const useClaudeSettings = create<{ cfg: ClaudeSettings; save: (c: ClaudeSettings) => void }>((set) => ({
  cfg: load(),
  save: (cfg) => {
    set({ cfg })
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg))
    } catch {
      /* storage unavailable */
    }
  },
}))

// If a request had to switch to another Gemini model, remember it.
registerModelPersist((geminiModel) => {
  const s = useClaudeSettings.getState()
  s.save({ ...s.cfg, geminiModel })
})

export { hasCredentials }
