# Guide: AI titles for your clips (Gemini free tier or Claude)

The AI looks at a few frames from each clip you upload and writes a short title that fits what is happening. The titles show up on the video (segment label and countdown list) and in the Ranking tab.

Gemini is the default because Google's API has a free tier. Claude is also supported and is billed per request.

## One-time setup with Gemini (about 2 minutes)

1. Open **aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key** and copy it (it starts with `AIza`). You do not need a credit card for the free tier.
3. Start the app:
   ```bash
   npm install
   npm run dev
   ```
   and open the address it prints, in Chrome or Edge.
4. Open the **AI** tab in the middle panel. **Gemini (free tier)** is already selected.
5. Paste the key into **Gemini API key**. It is saved only in this browser (localStorage).
6. Click **✓ Check key & list models**. You should see "Key works" and a model dropdown. The default is `gemini-flash-latest`, an alias Google keeps pointing at a current fast model. If a model name ever stops working, the app switches to one your key can use, or you can choose one from the list.

## Making titles

1. **Media tab** (left): upload your clips.
2. **Ranking tab** (left): switch **Ranking** on, with **Segment label** and **Countdown list** on, so titles are drawn.
3. **AI tab** (middle): scroll to **Title generator**.
4. Pick a **tone**: Funny, Sarcastic, Dramatic announcer, Clickbait, Wholesome or Deadpan.
5. Set **Max length**. About 28 characters fits one line on a phone; longer titles wrap.
6. Optional but helpful: in each clip's box write what happens in a few words, e.g. `guy slips off the treadmill`. The AI only sees still frames, not sound.
7. Click **✨ Generate titles for N clips**. It grabs frames from each clip, then makes one request.
8. Each clip shows a proposed title. Edit it if you like, then click **Use** for that clip or **Use all**.
9. Press play. The title shows under the video, and its line in the countdown list is highlighted while that clip plays.

## Saving and reopening your work

A project file keeps all your edits so you can come back later. It does **not** contain the videos, so it stays tiny (a few KB) and safe to share.

**Save**
1. Click **💾 Save** (or press **Ctrl+S**). In Chrome or Edge you choose where to put the `.topline` file the first time; after that, Save overwrites the same file. Other browsers download a new copy each time.
2. **Save as…** (Ctrl+Shift+S) writes a separate file, handy for versions.

**What is saved:** clip order, trims, volume and mute, ranks, titles, context notes, the look (fonts, colours, hook title, ranking, captions), custom templates, the script, and the voiceover's name and volume.
**What is not saved:** the video and audio files themselves, and your API keys.

**Open**
1. Click **📂 Open** and choose your `.topline` file. The app jumps to the **Media** tab.
2. Under **Relink media**, drop or choose the same video files (pick the whole batch at once, plus the voiceover file if you used one). They are matched by file name and size.
3. Clips that matched come back with their trims, titles and ranks. A clip with a ⚠ still needs its file. A warning appears if a file has the same name but a different size, in case it is another version.
4. Rendering and the title generator wait until every clip is linked.

**Tips**
- Keep your source videos in one folder and don't rename them, so relinking is a single multi-select.
- **Autosave:** the app also keeps a draft in this browser. If you refresh or the tab crashes, a banner offers **Restore**. It restores edits, not videos, so you relink the same way.
- A saved project is a plain JSON file, so it is easy to back up or keep in Git.

## Tips

- **Reroll one clip:** **🔄 Reroll this clip** asks for something different from the last title. Other clips stay as they are.
- **Only fill the blanks:** tick **Only clips without a title** to leave titles you already wrote.
- **Split clips** share one title; both halves are shown to the AI.
- **Shuffle** keeps titles with their clips, so generate first and shuffle after.
- **Style the text** (font, size, colour, height) under Ranking > Segment label and Canvas & title.
- Try two or three tones on the same clips and keep your favourite for each.
- **Chat box:** below the title generator, ask for changes like "apply the Neon template and make the hook title bigger". You approve changes before they apply.

## Limits and privacy

- It sees about 4 small stills per clip (512 px). It does not hear audio or read text you haven't shown on screen.
- Those stills are sent to Google (Gemini) or Anthropic (Claude). Do not use footage you are not allowed to share.
- **Gemini free tier:** it has rate limits, and Google's terms for the free tier may allow using your content to improve its products. Check the current terms, and use a paid-tier key or Claude for private footage.
- Titles are suggestions. Read them before rendering.
- Free-tier limits, names and terms change. Check Google AI Studio for what is current.

## Using Claude instead

In the AI tab choose **Claude**, paste an Anthropic API key (`sk-ant-...`) and, if you like, change the model. This is billed per request on your Anthropic account. To keep the key out of the browser, run `ANTHROPIC_API_KEY=sk-ant-... npm run proxy` and put `http://localhost:8787` in **Proxy URL**.

## Troubleshooting

| Message | Fix |
|---|---|
| "Add your API key..." | AI tab > paste the key for the selected provider. |
| `Gemini API 400` ... "API key not valid" | The key was copied wrong or deleted. Create a new one. |
| `Gemini API 404` / model not found | The app now finds a working model by itself and retries. If it still fails, click **Check key & list models**, pick one from the list, and make sure the key came from aistudio.google.com/apikey. |
| `Gemini API 503` / "servers are overloaded" | Google's side, and temporary. The app already retries 3 times and tries other models. Wait a minute and click Generate again; evenings and weekday afternoons in the US are busiest. |
| `Gemini API 429` | Free-tier rate limit. Wait a minute and try again, or do fewer clips at once. |
| `Gemini API 403` | The key lacks access (for example region or API not enabled). Check it in AI Studio. |
| "Gemini returned no text (SAFETY...)" | The model declined the frames. Add context to that clip and retry. |
| Failed to fetch | Check your internet connection, ad blockers or VPN. |
| "The AI did not return any titles" | Click Generate again; shorten **Max length** or add context. |
| "Could not read a clip" | The browser can't decode that file; convert it to MP4 (H.264). |

## The rest of the workflow

Media (upload) > Ranking (numbers, labels) > Canvas & title (hook title, fit, background) > Captions > Templates > Render (MP4, 30 or 60 fps).
