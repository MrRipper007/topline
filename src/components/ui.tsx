import type { ReactNode } from 'react'
import { FONTS } from '../fonts'

export function Section(props: {
  title: string
  desc?: string
  on?: boolean
  onToggle?: (v: boolean) => void
  offText?: string
  children?: ReactNode
}) {
  const { title, desc, on, onToggle, offText, children } = props
  return (
    <div className="sec">
      <div className="sec-head">
        <h3>{title}</h3>
        {onToggle && (
          <label className="tog">
            <input type="checkbox" checked={!!on} onChange={(e) => onToggle(e.target.checked)} />
            <span className="box" />
            On
          </label>
        )}
      </div>
      {desc && <p className="desc">{desc}</p>}
      {onToggle && !on ? offText && <div className="off">{offText}</div> : children}
    </div>
  )
}

export function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className={`slider ${props.disabled ? 'disabled' : ''}`}>
      <div className="slider-head">
        <span>{props.label}</span>
        <span className="val">{props.value}{props.unit}</span>
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step ?? 1} value={props.value}
        disabled={props.disabled} onChange={(e) => props.onChange(+e.target.value)} />
    </div>
  )
}

export function ColorField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="colorfield">
      <span>{props.label}</span>
      <span className="hex">{props.value.toUpperCase()}</span>
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  )
}

export function Seg<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {props.options.map((o) => (
        <button key={o.value} className={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Five fonts, each button previewed in its own typeface. */
export function FontPicker(props: { value: string; sample: string; onChange: (id: string) => void }) {
  return (
    <div className="fonts">
      {FONTS.map((f) => (
        <button key={f.id} className={f.id === props.value ? 'on' : ''} onClick={() => props.onChange(f.id)}>
          <span className="fname">{f.id}</span>
          <span className="fsample" style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}>
            {props.sample || 'Top 5 moments'}
          </span>
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>(props: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs">
      {props.tabs.map((t) => (
        <button key={t} className={t === props.value ? 'on' : ''} onClick={() => props.onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
