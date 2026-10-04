import { useProject } from '../store/project'
import { ColorField, FontPicker, Section, Slider } from './ui'

export function CaptionsPanel() {
  const s = useProject()
  const c = s.look.caption
  return (
    <Section title="CAPTIONS" desc="Burned-in subtitles built from your script, timed to the voiceover (or the whole timeline if there is none)."
      on={c.enabled} onToggle={(v) => s.setCaption({ enabled: v })}
      offText="Off: no captions are drawn. Write a script in the Script & voice tab, then switch this on.">
      <div className="label">Font</div>
      <FontPicker value={c.font} sample="that's why" onChange={(v) => s.setCaption({ font: v })} />
      <Slider label="Size" value={c.size} min={24} max={120} onChange={(v) => s.setCaption({ size: v })} />
      <Slider label="Height" value={c.height} min={5} max={95} unit="%" onChange={(v) => s.setCaption({ height: v })} />
      <Slider label="Words per line" value={c.words} min={1} max={8} onChange={(v) => s.setCaption({ words: v })} />
      <Slider label="Outline" value={c.outline} min={0} max={20} onChange={(v) => s.setCaption({ outline: v })} />
      <ColorField label="Text" value={c.color} onChange={(v) => s.setCaption({ color: v })} />
      <label className="check">
        <input type="checkbox" checked={c.box} onChange={(e) => s.setCaption({ box: e.target.checked })} />
        Dark box behind captions
      </label>
    </Section>
  )
}
