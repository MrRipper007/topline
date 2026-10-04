import { useProject } from '../store/project'
import { Section, Slider, fmt } from './ui'
import { clipLength } from '../engine/timeline'

export function RankingPanel() {
  const s = useProject()
  const r = s.look.ranking
  return (
    <>
      <Section
        title="RANKING"
        desc="Countdown chrome for Top-5 style videos. Turning it on also keeps the title on screen for the whole video."
        on={r.enabled}
        onToggle={(v) => s.setRanking({ enabled: v })}
        offText="Off: nothing ranking-related is drawn on the video. Switch it on to number your clips, label the moments, and count them down on screen."
      >
        <div className="row">
          <button disabled={s.clips.length < 2} onClick={() => s.shuffle()}>🔀 Shuffle order</button>
          <button disabled={!s.prevOrder} onClick={s.undoOrder}>↶ Undo</button>
        </div>
        <p className="hint">Order changes. Ranks stay with their clips.</p>
      </Section>

      {r.enabled && (
        <>
          <Section title="RANK BADGE" desc="The #N pill pinned to the frame, updating with every clip."
            on={r.badge} onToggle={(v) => s.setRanking({ badge: v })} />

          <Section title="SEGMENT LABEL"
            desc="The playing clip's label, burned in big. Font, colors and outline follow Canvas & title."
            on={r.segLabel} onToggle={(v) => s.setRanking({ segLabel: v })}>
            <Slider label="Text size" value={r.segSize} min={20} max={140} unit=" px" onChange={(v) => s.setRanking({ segSize: v })} />
            <Slider label="Height" value={r.segHeight} min={5} max={95} unit="%" onChange={(v) => s.setRanking({ segHeight: v })} />
            <p className="hint mono">Captions sit at their own height; keep the two apart if both are on.</p>
            {r.list && <p className="warn">The Countdown list already highlights the playing clip's title, so this shows it twice. Turn this off to show it once.</p>}
          </Section>

          <Section title="COUNTDOWN LIST"
            desc="Every number on screen from the start; titles fill in as their clips play."
            on={r.list} onToggle={(v) => s.setRanking({ list: v })}>
            <Slider label="Text size" value={r.listSize} min={20} max={90} unit=" px" onChange={(v) => s.setRanking({ listSize: v })} />
            <Slider label="Height" value={r.listHeight} min={5} max={80} unit="%" onChange={(v) => s.setRanking({ listHeight: v })} />
          </Section>

          <Section title="CLIPS" desc="Rank numbers and labels, in playback order. Cut halves share theirs.">
            {!s.clips.length && <div className="off">Add clips in the Media tab.</div>}
            <div className="cliprows">
              {s.clips.map((c, i) => (
                <div key={c.id} className={`cliprow ${s.selectedId === c.id ? 'sel' : ''}`} onClick={() => s.select(c.id)}>
                  <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                  {c.thumb ? <img src={c.thumb} alt="" /> : <span className="thumb" />}
                  <label className="pill" title="Rank number">
                    #<input type="number" min={1} max={99} value={c.rank}
                      onChange={(e) => s.updateClip(c.id, { rank: Math.max(1, +e.target.value || 1) })} />
                  </label>
                  <input className="text" placeholder="Label, e.g. Close call" value={c.label}
                    onChange={(e) => s.updateClip(c.id, { label: e.target.value })} />
                  <input className="text px" type="number" min={20} max={200} placeholder={String(r.segSize)}
                    title="Label size for this clip (blank = global)" value={c.labelSize ?? ''}
                    onChange={(e) => s.updateClip(c.id, { labelSize: e.target.value ? +e.target.value : undefined })} />
                  <span className="dur">{fmt(clipLength(c))}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </>
  )
}
