import { useProject } from '../store/project'
import { ColorField, FontPicker, Section, Seg, Slider } from './ui'

export function CanvasTitlePanel() {
  const s = useProject()
  const t = s.look.title
  const words = t.text.split(/\s+/).filter(Boolean)
  const persistent = t.forever || s.look.ranking.enabled

  function toggleWord(i: number) {
    s.setTitle({ highlights: t.highlights.includes(i) ? t.highlights.filter((x) => x !== i) : [...t.highlights, i] })
  }

  return (
    <>
      <Section title="CANVAS" desc="Vertical 1080x1920 output.">
        <div className="label">Clip fit</div>
        <Seg value={s.look.fit} onChange={(v) => s.setLook({ fit: v })}
          options={[{ value: 'fill', label: 'Fill frame' }, { value: 'fit', label: 'Fit inside' }]} />
        <p className="hint">Fill crops landscape footage to 9:16; fit letterboxes it against the background.</p>
        <ColorField label="Background" value={s.look.bgColor} onChange={(v) => s.setLook({ bgColor: v })} />
      </Section>

      <Section title="HOOK TITLE" desc="Optional text held over the opening seconds."
        on={t.enabled} onToggle={(v) => s.setTitle({ enabled: v })}
        offText="Most facts Shorts run captions only. Turn this on if you want a burned-in hook.">
        <input className="text" value={t.text} onChange={(e) => s.setTitle({ text: e.target.value })} placeholder="Top 5 wildest moments" />
        <div className="label">Tap a word to highlight it</div>
        <div className="chips">
          {words.map((w, i) => (
            <button key={i} className={t.highlights.includes(i) ? 'hl' : ''} onClick={() => toggleWord(i)}>{w}</button>
          ))}
        </div>
        <div className="label">Font</div>
        <FontPicker value={t.font} sample={t.text.split(/\s+/).slice(0, 3).join(' ')} onChange={(v) => s.setTitle({ font: v })} />
        <Slider label="Size" value={t.size} min={30} max={200} onChange={(v) => s.setTitle({ size: v })} />
        <Slider label="Height" value={t.height} min={2} max={90} unit="%" onChange={(v) => s.setTitle({ height: v })} />
        <label className="check">
          <input type="checkbox" checked={t.forever} onChange={(e) => s.setTitle({ forever: e.target.checked })} />
          Keep on screen the whole video
        </label>
        <Slider label="Hold" value={t.hold} min={1} max={30} unit="s" disabled={persistent} onChange={(v) => s.setTitle({ hold: v })} />
        <Slider label="Outline" value={t.outline} min={0} max={20} onChange={(v) => s.setTitle({ outline: v })} />
        <ColorField label="Text" value={t.color} onChange={(v) => s.setTitle({ color: v })} />
        <ColorField label="Highlight" value={t.highlight} onChange={(v) => s.setTitle({ highlight: v })} />
        <p className="hint mono">{persistent ? 'Stays on screen for the whole video' : `Fades out after ${t.hold}s`}</p>
      </Section>
    </>
  )
}
