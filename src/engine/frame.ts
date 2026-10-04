import type { Clip, Look } from '../store/project'
import type { Caption } from './captions'
import { captionAt } from './captions'
import { drawFrame } from './renderer'
import { buildList, locate } from './timeline'

/** Composes the frame at time t. Shared by live preview and the offline MP4 renderer. */
export function composeFrame(
  ctx: CanvasRenderingContext2D,
  clips: Clip[],
  look: Look,
  caps: Caption[],
  t: number,
  videoFor: (id: string) => HTMLVideoElement | null,
) {
  const loc = locate(clips, t)
  drawFrame(ctx, {
    look,
    video: loc ? videoFor(loc.clip.id) : null,
    time: t,
    rank: loc ? loc.clip.rank : null,
    label: loc ? loc.clip.label : '',
    labelSize: loc?.clip.labelSize,
    list: buildList(clips, t),
    caption: captionAt(caps, t)?.text,
  })
}
