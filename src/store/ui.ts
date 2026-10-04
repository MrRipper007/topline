import { create } from 'zustand'

/** Transient playback/export state shared between the player, preview, timeline and header. */
export const useUi = create<{
  playing: boolean
  time: number
  exporting: boolean
  progress: number
  error: string
}>(() => ({ playing: false, time: 0, exporting: false, progress: 0, error: '' }))
