/**
 * Saving and opening project files. Chrome/Edge can write straight back to the file you picked
 * (so "Save" overwrites it); other browsers download a new copy each time.
 */
interface Writable {
  write(data: string): Promise<void>
  close(): Promise<void>
}
interface FileHandle {
  name: string
  createWritable(): Promise<Writable>
  getFile(): Promise<File>
}
interface PickerWindow {
  showSaveFilePicker?: (o: unknown) => Promise<FileHandle>
  showOpenFilePicker?: (o: unknown) => Promise<FileHandle[]>
}

const types = [{ description: 'Topline project', accept: { 'application/json': ['.topline'] } }]
let handle: FileHandle | null = null

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export const canWriteInPlace = () => !!(window as unknown as PickerWindow).showSaveFilePicker
export const hasOpenFile = () => handle !== null

export function forgetFile() {
  handle = null
}

/** Returns the saved file name, or null if the user cancelled. */
export async function saveProjectFile(json: string, suggestedName: string, saveAs = false): Promise<string | null> {
  const w = window as unknown as PickerWindow
  if (w.showSaveFilePicker) {
    try {
      if (!handle || saveAs) handle = await w.showSaveFilePicker({ suggestedName, types })
      const out = await handle.createWritable()
      await out.write(json)
      await out.close()
      return handle.name
    } catch (e) {
      if (isAbort(e)) return null
      handle = null // fall back to a normal download below
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = suggestedName
  a.click()
  return suggestedName
}

/** Returns the file's text, or null if the user cancelled. */
export async function openProjectFile(): Promise<{ text: string; name: string } | null> {
  const w = window as unknown as PickerWindow
  if (w.showOpenFilePicker) {
    try {
      const [h] = await w.showOpenFilePicker({ types, multiple: false })
      handle = h
      const file = await h.getFile()
      return { text: await file.text(), name: file.name }
    } catch (e) {
      if (isAbort(e)) return null
      throw e
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.topline,.json,application/json'
    input.onchange = async () => {
      const f = input.files?.[0]
      handle = null
      resolve(f ? { text: await f.text(), name: f.name } : null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
