import { useProject, type Look } from '../store/project'
import { TEMPLATES } from '../templates'
import { FONTS } from '../fonts'
import { Section } from './ui'

export function TemplatesPanel() {
  const s = useProject()
  const all = [...TEMPLATES, ...s.customTemplates]

  function exportTemplate() {
    const blob = new Blob([JSON.stringify(s.look, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'topline-template.json'
    a.click()
  }

  async function importTemplate(f: File | undefined) {
    if (!f) return
    try {
      const look = JSON.parse(await f.text()) as Look
      if (!look.title || !look.ranking || !look.caption) throw new Error('not a template')
      s.loadLook(look)
    } catch {
      alert('That file is not a valid template.')
    }
  }

  return (
    <Section title="TEMPLATES" desc="A template changes the design (fonts, colors, badge, fit). Your toggles and text stay as they are.">
      <div className="tpls">
        {all.map((t) => {
          const f = FONTS.find((x) => x.id === t.look.title.font)!
          return (
            <button key={t.id} className={t.id === s.templateId ? 'on' : ''} onClick={() => s.applyTemplate(t.id)}
              style={{ background: t.look.bgColor }}>
              <span style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight, color: t.look.title.color }}>
                Top <b style={{ color: t.look.title.highlight }}>5</b>
              </span>
              <small style={{ color: t.look.title.color }}>{t.name}</small>
            </button>
          )
        })}
      </div>
      <div className="row">
        <button onClick={() => { const n = prompt('Template name?'); if (n) s.saveTemplate(n) }}>Save current</button>
        <button onClick={exportTemplate}>Export JSON</button>
        <label className="btn">Import
          <input type="file" accept="application/json" hidden onChange={(e) => importTemplate(e.target.files?.[0])} />
        </label>
      </div>
    </Section>
  )
}
