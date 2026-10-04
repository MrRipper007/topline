import { useEffect, useState } from 'react'
import { useProject } from '../store/project'
import { getPlayer } from '../engine/instance'
import { Section, Slider, fmt } from './ui'

const MAX_WORDS = 5000

export function ScriptPanel() {
  const s = useProject()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const words = s.script.trim() ? s.script.trim().split(/\s+/).length : 0

  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices())
    load()
    speechSynthesis.addEventListener('voiceschanged', load)
    return () => speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  function speak() {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(s.script)
    const v = voices.find((x) => x.name === voice)
    if (v) u.voice = v
    speechSynthesis.speak(u)
  }

  function onVoiceFile(f: File | undefined) {
    if (!f) return
    const url = URL.createObjectURL(f)
    const a = new Audio(url)
    a.onloadedmetadata = () => {
      s.setVoice(url, a.duration, { name: f.name, size: f.size })
      getPlayer()?.sync()
    }
  }

  return (
    <>
      <Section title="SCRIPT" desc="Narration text. It drives the captions.">
        <textarea rows={7} placeholder="Write the narration…" value={s.script}
          onChange={(e) => e.target.value.split(/\s+/).length <= MAX_WORDS && s.setScript(e.target.value)} />
        <p className="hint mono">{words} / {MAX_WORDS} words</p>
      </Section>

      <Section title="VOICEOVER" desc="Upload narration audio from any text-to-speech tool. It is mixed into the export and sets the caption timing.">
        <label className="btn">{s.voiceUrl ? 'Replace voiceover file' : 'Upload voiceover file'}
          <input type="file" accept="audio/*" hidden onChange={(e) => onVoiceFile(e.target.files?.[0])} />
        </label>
        {s.voiceUrl && (
          <>
            <p className="hint mono">Voiceover · {fmt(s.voiceDuration)}</p>
            <Slider label="Voice volume" value={s.voiceVolume} min={0} max={1} step={0.01}
              onChange={(v) => { s.setVoiceVolume(v); getPlayer()?.sync() }} />
            <button onClick={() => { s.setVoice(null, 0); getPlayer()?.sync() }}>Remove voiceover</button>
          </>
        )}
      </Section>

      <Section title="BROWSER VOICE" desc="Preview only. Browsers can't record built-in speech into the export.">
        <select value={voice} onChange={(e) => setVoice(e.target.value)}>
          <option value="">Default voice</option>
          {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <button disabled={!s.script} onClick={speak}>▶ Speak script</button>
          <button onClick={() => speechSynthesis.cancel()}>■ Stop</button>
        </div>
      </Section>
    </>
  )
}
