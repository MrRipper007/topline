import type { Look } from '../store/project'

export interface Template {
  id: string
  name: string
  look: Look
}

interface Palette {
  bg: string
  font: string
  color: string
  highlight: string
  badge: string
  outline: number
  fit?: 'fill' | 'fit'
  capBox?: boolean
}

const make = (p: Palette): Look => ({
  fit: p.fit ?? 'fill',
  bgColor: p.bg,
  ranking: {
    enabled: true, badge: true, badgeColor: p.badge, segLabel: false, segSize: 44, segHeight: 62,
    list: true, listSize: 44, listHeight: 30,
  },
  title: {
    enabled: true, text: 'Top 5 wildest moments', highlights: [1], font: p.font, size: 82, height: 18,
    hold: 3, forever: true, outline: p.outline, color: p.color, highlight: p.highlight,
  },
  caption: {
    enabled: true, font: p.font, size: 48, height: 80, words: 4, outline: p.outline, color: p.color,
    box: !!p.capBox, boxColor: 'rgba(0,0,0,0.6)',
  },
})

export const TEMPLATES: Template[] = [
  { id: 'topline', name: 'Topline Classic', look: make({ bg: '#000000', font: 'Archivo', color: '#ffffff', highlight: '#2dd4bf', badge: '#ff7a6b', outline: 8 }) },
  { id: 'neon', name: 'Neon Countdown', look: make({ bg: '#0a0a1a', font: 'Anton', color: '#ffffff', highlight: '#00f0ff', badge: '#ff00aa', outline: 8 }) },
  { id: 'tabloid', name: 'Bold Tabloid', look: make({ bg: '#e10600', font: 'Anton', color: '#ffffff', highlight: '#ffe600', badge: '#000000', outline: 8, fit: 'fit' }) },
  { id: 'retro', name: 'Retro', look: make({ bg: '#2b1b4a', font: 'Rubik', color: '#ffd166', highlight: '#ef476f', badge: '#ef476f', outline: 6 }) },
  { id: 'cinema', name: 'Dark Cinema', look: make({ bg: '#000000', font: 'Bebas', color: '#f2f2f2', highlight: '#c9a227', badge: '#c9a227', outline: 6, fit: 'fit', capBox: true }) },
]
