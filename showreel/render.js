// Render: 60 fps x 3 subframes (180 samples/s), blended with ffmpeg tmix, audio muxed in.
// usage: node render.js <outDir>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');

const OUT = path.resolve(process.argv[2] || 'out');
const FPS = 60, SUB = 3, DUR = 15, WORKERS = 4;
const page_url = 'file://' + path.resolve(__dirname, 'reyda-showreel.html');
const frames = fs.mkdirSync(path.join(OUT, 'sub'), { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const total = FPS * DUR * SUB;

  // soundtrack
  {
    const p = await browser.newPage();
    await p.goto(page_url);
    await p.addScriptTag({ path: path.resolve(__dirname, 'audio.js') });
    const b64 = await p.evaluate(() => window.renderSoundtrack());
    fs.writeFileSync(path.join(OUT, 'soundtrack.wav'), Buffer.from(b64, 'base64'));
    await p.close();
  }

  const work = async (w) => {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await p.goto(page_url);
    await p.evaluate(() => window.ready);
    for (let n = w; n < total; n += WORKERS) {
      // subframe n: centred around each output frame
      const f = Math.floor(n / SUB), s = n % SUB;
      const t = Math.min(DUR - 1e-4, Math.max(0, (f + (s - (SUB - 1) / 2) / SUB) / FPS));
      await p.evaluate(t => window.seek(t), t);
      await p.screenshot({ path: path.join(OUT, 'sub', String(n).padStart(5, '0') + '.png') });
      if (n % 300 === w) console.log(`subframe ${n}/${total}`);
    }
  };
  await Promise.all([...Array(WORKERS).keys()].map(work));
  await browser.close();

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-framerate', String(FPS * SUB), '-i', path.join(OUT, 'sub', '%05d.png'),
    '-i', path.join(OUT, 'soundtrack.wav'),
    '-vf', `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB,format=yuv420p`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart',
    path.join(OUT, 'reyda-showreel.mp4')], { stdio: 'inherit' });
  console.log('done', path.join(OUT, 'reyda-showreel.mp4'));
})();
