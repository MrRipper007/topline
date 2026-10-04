export interface FontDef {
  id: string
  family: string
  weight: number
}

/** Five bold display fonts, loaded from Google Fonts in index.html. */
export const FONTS: FontDef[] = [
  { id: 'Archivo', family: 'Archivo Black', weight: 400 },
  { id: 'Rubik', family: 'Rubik', weight: 800 },
  { id: 'Anton', family: 'Anton', weight: 400 },
  { id: 'Bebas', family: 'Bebas Neue', weight: 400 },
  { id: 'Montserrat', family: 'Montserrat', weight: 900 },
]

export function fontCss(id: string, size: number): string {
  const f = FONTS.find((x) => x.id === id) ?? FONTS[0]
  return `${f.weight} ${size}px "${f.family}", Impact, sans-serif`
}

export function preloadFonts() {
  FONTS.forEach((f) => void document.fonts?.load(`${f.weight} 40px "${f.family}"`))
}
