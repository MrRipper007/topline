import type { Look } from '../store/project'
import { fontCss } from '../fonts'
import type { ListItem } from './timeline'

export const W = 1080
export const H = 1920

export interface FrameInput {
  look: Look
  video: HTMLVideoElement | null
  time: number
  rank: number | null
  label: string
  labelSize?: number
  list: ListItem[]
  caption?: string
}

interface BlockOpts {
  text: string
  font: string
  size: number
  y: number
  color: string
  outline: number
  highlights?: number[]
  highlight?: string
  box?: string
}

/** Draws one 1080x1920 frame. Used for both live preview and export so they match. */
export function drawFrame(ctx: CanvasRenderingContext2D, f: FrameInput) {
  const { look, video } = f
  ctx.fillStyle = look.bgColor
  ctx.fillRect(0, 0, W, H)
  if (video && video.videoWidth > 0 && video.readyState >= 2) {
    const vw = video.videoWidth
    const vh = video.videoHeight
    const s = look.fit === 'fill' ? Math.max(W / vw, H / vh) : Math.min(W / vw, H / vh)
    ctx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s)
  }

  const t = look.title
  const r = look.ranking
  if (t.enabled) {
    // With ranking on (or "keep on screen"), the title stays; otherwise it fades after `hold` seconds.
    const stays = t.forever || r.enabled
    const alpha = stays ? 1 : Math.min(1, Math.max(0, (t.hold - f.time) / 0.4))
    if (alpha > 0) {
      ctx.save()
      ctx.globalAlpha = alpha
      drawBlock(ctx, { text: t.text, font: t.font, size: t.size, y: (t.height / 100) * H, color: t.color, outline: t.outline, highlights: t.highlights, highlight: t.highlight })
      ctx.restore()
    }
  }

  if (r.enabled) {
    if (r.list && f.list.length) drawList(ctx, look, f.list)
    if (r.segLabel && f.label) {
      const size = f.labelSize ?? r.segSize
      drawBlock(ctx, { text: f.label, font: t.font, size, y: (r.segHeight / 100) * H - size / 2, color: t.color, outline: t.outline })
    }
    if (r.badge && f.rank != null) drawBadge(ctx, look, f.rank)
  }

  const c = look.caption
  if (c.enabled && f.caption) {
    drawBlock(ctx, { text: f.caption, font: c.font, size: c.size, y: (c.height / 100) * H - c.size / 2, color: c.color, outline: c.outline, box: c.box ? c.boxColor : undefined })
  }
}

function drawBlock(ctx: CanvasRenderingContext2D, o: BlockOpts) {
  const words = o.text.split(/\s+/).filter(Boolean)
  if (!words.length) return
  ctx.save()
  ctx.font = fontCss(o.font, o.size)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  const space = ctx.measureText(' ').width
  const maxW = W - 160
  const lines: { idx: number[]; w: number }[] = []
  let cur = { idx: [] as number[], w: 0 }
  words.forEach((wd, i) => {
    const ww = ctx.measureText(wd).width
    if (cur.idx.length && cur.w + space + ww > maxW) {
      lines.push(cur)
      cur = { idx: [i], w: ww }
    } else {
      cur.w += cur.idx.length ? space + ww : ww
      cur.idx.push(i)
    }
  })
  lines.push(cur)
  const lh = o.size * 1.12
  if (o.box) {
    const bw = Math.max(...lines.map((l) => l.w)) + 60
    ctx.fillStyle = o.box
    ctx.beginPath()
    ctx.roundRect((W - bw) / 2, o.y - 14, bw, lines.length * lh + 28, 18)
    ctx.fill()
  }
  lines.forEach((l, li) => {
    let x = (W - l.w) / 2
    const y = o.y + li * lh
    for (const i of l.idx) {
      if (o.outline > 0) {
        ctx.lineWidth = o.outline * 2
        ctx.strokeStyle = '#000'
        ctx.strokeText(words[i], x, y)
      }
      ctx.fillStyle = o.highlights?.includes(i) && o.highlight ? o.highlight : o.color
      ctx.fillText(words[i], x, y)
      x += ctx.measureText(words[i]).width + space
    }
  })
  ctx.restore()
}

function drawList(ctx: CanvasRenderingContext2D, look: Look, list: ListItem[]) {
  const { ranking: r, title: t } = look
  ctx.save()
  ctx.font = fontCss(t.font, r.listSize)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  const lh = r.listSize * 1.25
  list.forEach((it, i) => {
    const text = it.revealed && it.label ? `${it.rank}. ${it.label}` : `${it.rank}.`
    const x = 70
    const y = (r.listHeight / 100) * H + i * lh
    // The playing clip's entry gets a highlighted pill; played ones are normal; upcoming ones are dim.
    if (it.active) {
      const w = ctx.measureText(text).width
      ctx.save()
      ctx.globalAlpha = 0.28
      ctx.fillStyle = t.highlight
      ctx.beginPath()
      ctx.roundRect(x - 18, y - 8, w + 36, lh - 2, 14)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.globalAlpha = it.revealed || it.active ? 1 : 0.5
    if (t.outline > 0) {
      ctx.lineWidth = Math.max(2, t.outline)
      ctx.strokeStyle = '#000'
      ctx.strokeText(text, x, y)
    }
    ctx.fillStyle = it.active ? t.highlight : t.color
    ctx.fillText(text, x, y)
    ctx.restore()
  })
  ctx.restore()
}

function drawBadge(ctx: CanvasRenderingContext2D, look: Look, rank: number) {
  const text = `#${rank}`
  ctx.save()
  ctx.font = fontCss(look.title.font, 54)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const w = ctx.measureText(text).width + 56
  const h = 84
  const x = W - 60 - w
  ctx.fillStyle = look.ranking.badgeColor
  ctx.beginPath()
  ctx.roundRect(x, 60, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(text, x + w / 2, 60 + h / 2 + 3)
  ctx.restore()
}
