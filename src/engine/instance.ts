import type { Player } from './player'

let current: Player | null = null

export const setPlayer = (p: Player | null) => {
  current = p
}
export const getPlayer = () => current
