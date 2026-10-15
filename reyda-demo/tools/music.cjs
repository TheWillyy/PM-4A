// Reyda demo soundtrack — 120 BPM (1 beat = 0.5 s, 1 bar = 2 s), 58 s.
// Rendered offline with Web Audio in headless Chromium, written as WAV, then
// encoded to assets/music.mp3. Every hit below is a cue the composition lands on.
// usage: node tools/music.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

function synth() {
  return (async () => {
    const SR = 48000, DUR = 58, B = 0.5;
    const ctx = new OfflineAudioContext(2, SR * DUR, SR);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.16;
    const master = ctx.createGain(); master.gain.value = 0.72;
    // master fade out 55 → 58
    master.gain.setValueAtTime(0.72, 55.0); master.gain.linearRampToValueAtTime(0.0001, 57.95);
    master.connect(comp).connect(ctx.destination);

    // seeded noise
    let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
    // reverb send
    const verb = ctx.createConvolver();
    { const L = SR * 2.8, ir = ctx.createBuffer(2, L, SR);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < L; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / L, 3.2); }
      verb.buffer = ir; }
    const verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb).connect(master);
    // dotted-8th delay send
    const dly = ctx.createDelay(1); dly.delayTime.value = 0.375; const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlyIn = ctx.createGain(); dlyIn.gain.value = 0.25; const dlyF = ctx.createBiquadFilter(); dlyF.type = 'lowpass'; dlyF.frequency.value = 3500;
    dlyIn.connect(dly); dly.connect(dlyF).connect(fb).connect(dly); dlyF.connect(master); dlyF.connect(verbIn);

    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const out = (node, pan = 0, wet = 0, del = 0) => {
      const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(master);
      if (wet) { const g = ctx.createGain(); g.gain.value = wet; p.connect(g).connect(verbIn); }
      if (del) { const g = ctx.createGain(); g.gain.value = del; p.connect(g).connect(dlyIn); }
    };
    function kick(t, g = 1) {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.95 * g, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(a); out(a); o.start(t); o.stop(t + 0.45);
      noise(t, 0.012, 0.18 * g, 'highpass', 2500);
    }
    function noise(t, dur, g, type, f, q = 0.7, pan = 0, wet = 0) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const a = ctx.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(fl).connect(a); out(a, pan, wet); n.start(t, (t * 7.31) % 1.5); n.stop(t + dur + 0.02);
    }
    function tone(t, f, dur, g, type = 'triangle', cut = 4000, pan = 0, wet = 0, del = 0, att = 0.005) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(150, cut * 0.25), t + dur);
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + att); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl).connect(a); out(a, pan, wet, del); o.start(t); o.stop(t + dur + 0.05);
    }
    function pad(t, dur, notes, g = 0.03, cut = 1500, cutEnd = null) {
      notes.forEach((m, i) => [-7, 7].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); if (cutEnd) fl.frequency.exponentialRampToValueAtTime(cutEnd, t + dur);
        const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + 0.25);
        a.gain.setValueAtTime(g, t + dur - 0.2); a.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
        o.connect(fl).connect(a); out(a, (i % 2 ? 0.35 : -0.35) * (det > 0 ? 1 : -1), 0.6); o.start(t); o.stop(t + dur + 0.2);
      }));
    }
    function riser(t0, t1, g = 0.16) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2.2; fl.frequency.setValueAtTime(300, t0); fl.frequency.exponentialRampToValueAtTime(8000, t1);
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g, t1 - 0.02); a.gain.linearRampToValueAtTime(0, t1);
      n.connect(fl).connect(a); out(a, 0, 0.3); n.start(t0); n.stop(t1 + 0.01);
    }
    function stab(t, notes, g = 1) {
      notes.forEach((m, i) => { tone(t, hz(m + 12), 0.6 * g, 0.07 * g, 'sawtooth', 3600, (i - 1.5) * 0.3, 0.5); tone(t, hz(m + 24), 0.5, 0.03 * g, 'triangle', 6000, (1.5 - i) * 0.3, 0.6); });
      tone(t, hz(29), 0.6 * g, 0.55 * g, 'sine', 300);
      noise(t, 0.4 * g, 0.2 * g, 'lowpass', 6000, 0.7, 0, 0.4);
    }
    const tick = (t, g = 1, pan = 0) => { noise(t, 0.03, 0.22 * g, 'highpass', 3500, 0.7, pan); tone(t, 2100, 0.05, 0.05 * g, 'sine', 6000, pan); };
    const blip = (t, pan = 0) => { tone(t, hz(84), 0.16, 0.12, 'sine', 8000, pan, 0.3); tone(t + 0.07, hz(91), 0.22, 0.10, 'sine', 8000, pan, 0.3); };
    const ding = t => { [88, 95, 100].forEach((m, i) => tone(t + i * 0.06, hz(m), 0.9, 0.07, 'sine', 9000, 0, 0.5)); };
    const whoosh = (t, d = 0.45) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.4; fl.frequency.setValueAtTime(600, t); fl.frequency.exponentialRampToValueAtTime(6000, t + d);
      const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.25, t + d * 0.6); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
      n.connect(fl).connect(a); out(a, 0, 0.3); n.start(t); n.stop(t + d + 0.02); };

    // harmony: one chord per bar (2 s) from the drop at 5.0 s, F – Am – C – G
    const PROG = [[53, 57, 60, 64], [57, 60, 64, 67], [48, 55, 59, 64], [55, 59, 62, 67]];
    const ROOT = [41, 45, 36, 43];
    const DROP = 5.0, END = 51.0;
    const barIdx = t => Math.floor((t - DROP) / 2);
    const chordAt = t => PROG[(barIdx(t) + 400) % 4];
    const rootAt = t => ROOT[(barIdx(t) + 400) % 4];

    // ── 0–5 s HOOK: Am drone opening up, paper landing on 16ths, two slams, riser, gap
    pad(0, 4.75, [45, 52, 57, 60], 0.022, 300, 1800);
    tone(0, hz(33), 4.7, 0.25, 'sine', 200, 0, 0, 0, 0.4);
    for (let i = 0; i < 34; i++) { const t = 0.25 + i * 0.125; if (t > 4.5) break; tick(t, 0.3 + 0.7 * (i / 34), ((i * 37) % 9 - 4) / 6); }
    stab(0.5, [45, 52, 57, 60], 0.9); kick(0.5, 1.1);
    stab(2.0, [45, 52, 57, 60], 0.8); kick(2.0, 1.0);
    kick(3.0, 0.7); kick(3.5, 0.8); kick(4.0, 0.85); kick(4.25, 0.6); kick(4.5, 0.95);
    riser(3.25, 4.75, 0.2);

    // ── groove 5–51 s. 'half' = focused half-time for requirements + draft; pause before "Ready"
    const sec = t => (t >= 22 && t < 33) ? 'half' : 'full';
    const paused = t => t >= 47.5 && t < 48;
    for (let b = 10; b < 102; b++) {
      const t = b * B, s = sec(t);
      if (paused(t)) continue;
      const onBar = (b - 10) % 4 === 0;
      if (s === 'full' || onBar || (b - 10) % 4 === 2) kick(t, onBar ? 1.05 : 0.9);
      noise(t + B / 2, 0.05, s === 'half' ? 0.08 : 0.13, 'highpass', 8500, 0.7, 0.25);
      if (s === 'half' || (t >= 33 && t < 38)) noise(t + B / 4 * 3, 0.03, 0.06, 'highpass', 9000, 0.7, -0.25); // busier 16ths for forms
      if (s === 'full' && b % 2 === 1) { noise(t, 0.14, 0.13, 'bandpass', 1900, 0.8, -0.1, 0.25); noise(t + 0.012, 0.1, 0.07, 'bandpass', 2600, 0.8, 0.1); }
      const r = rootAt(t);
      tone(t, hz(r), 0.24, 0.30, 'triangle', 900);
      tone(t + B / 2, hz(r + 12), 0.18, s === 'half' ? 0.08 : 0.13, 'square', 700);
    }
    for (let t = DROP; t < END; t += 2) {
      if (t >= 47 && t < 49) { pad(47, 1.0, chordAt(47), 0.026, 1500); pad(47.5, 1.5, chordAt(47.5), 0.03, 900, 2600); continue; }
      pad(t, 2, chordAt(t), 0.026, 1500);
    }
    // pluck arp from the Find scene, 8ths
    for (let b = 20; b < 102; b++) { const t = b * B; if (paused(t)) continue;
      const c = chordAt(t), idx = [0, 2, 1, 3, 2, 1, 3, 2][b % 8];
      tone(t, hz(c[idx] + 12), 0.28, 0.055, 'triangle', 5000, (b % 2 ? 0.3 : -0.3), 0.25, 0.6);
      if (sec(t) === 'half') tone(t + B / 2, hz(c[(idx + 1) % 4] + 24), 0.18, 0.025, 'sine', 8000, 0, 0.4, 0.5);
    }

    // ── cues (each one is an on-screen event)
    stab(5.0, [53, 57, 60, 64], 1.35); noise(5.0, 1.2, 0.18, 'lowpass', 9000, 0.7, 0, 0.6);   // DROP: paperwork snaps to a grid
    [72, 76, 79, 84].forEach((m, i) => tone(5.5 + i * 0.06, hz(m), 1.2, 0.05, 'sine', 9000, (i - 1.5) * 0.4, 0.7)); // logo pill
    tone(6.5, hz(79), 0.25, 0.08, 'sine', 9000, 0, 0.4); tone(6.58, hz(86), 0.35, 0.07, 'sine', 9000, 0, 0.5);   // Emma pops in
    tone(7.75, hz(96), 0.08, 0.04, 'sine', 9000); tone(9.0, hz(96), 0.08, 0.04, 'sine', 9000);                 // blinks
    for (const t of [10, 16, 22, 27, 33, 38, 45]) { stab(t, chordAt(t), 0.6); whoosh(t - 0.4, 0.42); }
    // find
    for (let i = 0; i < 6; i++) tick(11 + i * 0.25, 0.7, (i % 2 ? 0.3 : -0.3));
    whoosh(13.5, 0.5); tone(14.0, hz(84), 0.6, 0.06, 'sine', 9000, 0, 0.6); for (let k = 0; k < 3; k++) tick(14.5 + k * 0.25, 1.0);
    // market intelligence
    for (let i = 0; i < 5; i++) tick(16.75 + i * 0.25, 0.5, -0.2 + i * 0.1);
    tick(18.0, 0.6); tick(19.0, 0.6); tick(19.5, 0.6); blip(20.25); blip(20.75, 0.3);
    // requirements
    for (const t of [22.75, 23.25, 23.75, 24.25, 24.75]) tone(t, hz(88), 0.2, 0.06, 'sine', 9000, 0.2, 0.3);
    tone(25.25, hz(76), 0.3, 0.07, 'sine', 6000, -0.2, 0.3);
    // draft
    for (const t of [27.75, 28.75, 29.75, 30.75]) tick(t, 0.5);
    tone(28.25, hz(91), 0.2, 0.04, 'sine', 9000, 0.3, 0.4); tone(29.25, hz(91), 0.2, 0.04, 'sine', 9000, 0.3, 0.4);
    blip(31.75);
    // forms: fields fill on 16ths
    for (let i = 0; i < 20; i++) tick(33.5 + i * 0.125, 0.28, ((i * 5) % 7 - 3) / 6);
    tone(36.25, hz(76), 0.3, 0.07, 'sine', 6000, 0, 0.3);
    // team
    blip(38.5, -0.4); blip(39.5, 0.4); blip(40.5, -0.4); blip(41.5, 0.4);
    tick(42.5, 1.0); [84, 88, 91].forEach((m, i) => tone(42.5 + i * 0.06, hz(m), 0.6, 0.05, 'sine', 9000, 0, 0.5));
    // handoff
    blip(45.75); for (let i = 0; i < 4; i++) tick(46.25 + i * 0.25, 0.6);
    riser(47.5, 48.0, 0.18);
    stab(48.0, [53, 57, 60, 64], 1.4); [84, 88, 91, 96, 100].forEach((m, i) => tone(48 + i * 0.05, hz(m), 1.4, 0.05, 'triangle', 9000, (i - 2) * 0.35, 0.7, 0.4));
    blip(49.0, 0.3);
    // ── 51–58 resolve: Fmaj9, soft tail, no drums
    pad(51, 6.5, [41, 53, 57, 60, 64, 67], 0.03, 2200, 600);
    tone(51, hz(29), 3, 0.5, 'sine', 300, 0, 0, 0, 0.01); noise(51, 1.5, 0.12, 'lowpass', 7000, 0.7, 0, 0.7);
    [77, 81, 84, 88].forEach((m, i) => tone(51 + i * 0.09, hz(m), 2.8, 0.045, 'sine', 9000, (i - 1.5) * 0.4, 0.8, 0.3));
    [81, 84, 88].forEach((m, i) => tone(53 + i * 0.5, hz(m), 1.6, 0.025, 'sine', 9000, (i - 1) * 0.4, 0.8, 0.4));

    const buf = await ctx.startRendering();
    const N = SR * DUR, ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const dv = new DataView(new ArrayBuffer(44 + N * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + N * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true);
    dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, N * 4, true);
    for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) dv.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
    const bytes = new Uint8Array(dv.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  })();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const b64 = await page.evaluate(synth);
  await browser.close();
  const root = path.resolve(__dirname, '..');
  const wav = path.join(root, 'tools', 'music.wav');
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '256k', path.join(root, 'assets', 'music.mp3')]);
  fs.unlinkSync(wav);
  console.log('wrote assets/music.mp3');
})();
