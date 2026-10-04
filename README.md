# Topline

A local, open-source studio for vertical (1080x1920) countdown and ranking videos, running entirely in your browser.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. For a static build: `npm run build` (output in `dist/`).

## Features

- **Layout**: Script & voice / Media / Ranking on the left, Captions / Canvas & title / Templates / Claude in the middle, phone preview on the right, timeline along the bottom.
- **Per-clip audio preview** (Media tab): play, mute, volume, trim and a waveform on every clip.
- **Timeline**: drag to reorder, Split at the playhead (halves share rank and label), Delete, Fit to voiceover, zoom.
- **Ranking**: rank badge, per-clip segment labels (global size/height, or a size override per clip), countdown list (the title of the clip that is playing is highlighted, played titles are normal, upcoming ones dim), and Shuffle that keeps each clip's rank.
- **Hook title**: tap words to highlight them, size/height/outline/colors, and it can stay on screen for the whole video (or fade after N seconds).
- **Five fonts** with live previews: Archivo Black, Rubik, Anton, Bebas Neue, Montserrat (loaded from Google Fonts, so the first run needs internet).
- **Templates**: five built-in looks, plus save/import/export your own as JSON. They change design only, not your toggles or text.
- **Captions**: timed to the script (or your voiceover file's length).
- **Timeline**: a time ruler you can click or drag to seek, a horizontal scrollbar, mouse-wheel scrolling, Ctrl+wheel zoom, and a live timecode.
- **Render**: frame-accurate offline **MP4 (H.264 + AAC, 1080×1920)** via WebCodecs, faster than real time. Presets: Universal 30 fps / 16 Mbps (TikTok, Reels, Shorts, Facebook, Snapchat, X, LinkedIn, Pinterest), Maximum quality 35 Mbps, Smooth 60 fps, Small file 8 Mbps. Real-time WebM stays as a fallback. If a browser has no AAC encoder, MP4 audio falls back to Opus and the dialog says so.
- **Save / Open projects**: 💾 Save writes a small `.topline` file (titles, ranks, trims, look, script, template, voiceover name) with no video inside and no API keys. 📂 Open reads it back; you then choose the same video files and they are matched by name and size. In Chrome/Edge, Save overwrites the same file after the first time (Ctrl+S). A draft is also autosaved in your browser and offered back after a refresh.
- **Claude panel**: chat with Claude and approve the changes it proposes.
- **AI title generator**: Gemini (free tier, default) or Claude looks at frames from each clip and writes a relevant, funny title. See [GUIDE.md](GUIDE.md).

## Claude panel

Paste an Anthropic API key (stored in `localStorage` only) in the Claude tab. Direct browser calls expose the key to the page, so use this locally.
To keep the key out of the browser, run the proxy and set its URL in the panel:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run proxy
```

## Known limits

- MP4 rendering needs a Chromium browser (Chrome or Edge) for WebCodecs. The WebM fallback records in real time and needs the tab in front.
- Output is fixed at 1080×1920 (the canvas size); there is no 4K export.
- Browser speech synthesis cannot be recorded; upload a voiceover file to include voice in the export.

## License

MIT
