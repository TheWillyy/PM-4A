# Editing the Reyda demo

The video is a HyperFrames project. HyperFrames ships with **Studio**, a browser-based editor with a
timeline, a live preview and a Variables panel. This project is set up so the things you are most
likely to change (copy, font, timing) can be changed there without touching code.

## 1. Open the editor

You need [Node.js 22+](https://nodejs.org) and [FFmpeg](https://ffmpeg.org/download.html) (FFmpeg is
only needed to export MP4s). Then:

```bash
cd reyda-demo
npm run dev
```

Studio opens in your browser. Press space to play. The first run downloads the HyperFrames CLI and a
headless Chrome, so it takes a minute.

## 2. Change text and font: the Variables panel

Every headline and line of copy is a variable, so you edit it in a form rather than in the HTML.

| Variable | What it controls |
|---|---|
| **Headline font** | Wittgenstein (brand) or Inter |
| **Headline weight** | 400–900 (600 is semi-bold) |
| **Headline size** | scales every headline, 0.7× to 1.3× |
| **Accent colour** | the colour of the highlighted words |
| **Hook · line 1 / 2**, **Reveal · line 1 / 2** | the opening lines |
| **Find / Requirements / Draft / Forms / Team · headline** | each scene's headline |
| **Market · headline line 1 / 2** | "See buying history." and "Spot expiring contracts." (the second appears on the second beat) |
| **… · chore line** | the small grey line above each headline that gets struck through |
| **Handoff · line above / headline** | the "Ready for your review" scene |
| **CTA · line 1 / 2 / URL** | the end card |

**Highlighted words:** wrap them in asterisks. `Finds opportunities *that fit your business.*` shows
"that fit your business." in the accent colour.

**Keep it short:** headlines sit in a fixed column. If a longer line wraps onto too many lines, turn
**Headline size** down a step.

## 3. Change timing: the timeline

Each scene is one clip on the timeline (`s-open`, `s-find`, `s-market`, `s-req`, `s-draft`,
`s-forms`, `s-team`, `s-hand`, `s-cta`).

- **Move a scene:** drag its clip. Everything inside the scene (headline, windows, animations) moves
  with it.
- **Shorten or lengthen a scene:** trim the clip's edge. The scene is hidden after its clip ends.
- **Remove a scene:** delete its clip. The rest of the video keeps working. Close the gap by dragging
  the later scenes earlier, then shorten the total duration.

**About the music:** the soundtrack is one audio file with hits placed on the original scene changes,
at 120 BPM (one beat = 0.5 s). Move scenes in steps of 0.5 s to stay on the beat. If you move a scene
a lot, its sound cues stay at the old time; ask me to regenerate the track (`tools/music.cjs`) for the
new timing.

## 4. What still needs code

Things built by the script, rather than written as plain HTML, can't be edited in Studio:
- the contents of the mock UI windows (tender cards, buyer profile, requirement rows, Slack and Teams
  messages)
- Emma's entries on the two tender forms. The pages are real images of TW 01 and TW 02 in
  `assets/forms/`; her entries are listed in `index.html` under `// ── 7 · forms` as
  `[x, y, text]` in PDF points, so changing a value or nudging its position is a one-line edit
- exact positions of the windows

All of them live in `index.html` and are labelled by scene:
- **Window positions and sizes:** in the CSS, under `/* 3 · find */`, `/* 4 · market intelligence */`
  and so on.
- **UI content:** in the script, under `// ── 3 · find`, `// ── 4 · market` and so on, as plain lists
  of text.
- **Animation timing inside a scene:** in the script, under `// ═════ N · SCENE`. Each line ends with
  its time in seconds.

## 5. Export

```bash
npm run check                                                   # lint, layout and contrast checks
npx hyperframes render -q draft -o ../out/reyda-demo-preview.mp4  # quick preview
npx hyperframes render -q high  -o ../out/reyda-demo.mp4          # final
```

Variables can also be overridden at render time without opening Studio:

```bash
npx hyperframes render -q high -o ../out/alt.mp4 --variables '{"t_hook1":"Big tenders."}'
```

## 6. Editing with chat

The free HyperFrames desktop app (https://hyperframes.dev/studio/download) adds an assistant to the
same editor: you describe a change, or draw on a frame to point at something, and it edits the
project. It works on this folder as-is.
