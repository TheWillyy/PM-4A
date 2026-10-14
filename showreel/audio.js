// Soundtrack: 120 BPM, 15 s. Rendered in-page with OfflineAudioContext, returned as WAV (base64).
// Kick on every beat, offbeat hats, Am–F–C–G bass + stabs, a hit on each scene change,
// the biggest at b20, and ticks on cursor clicks.
window.renderSoundtrack = async function () {
  const SR = 48000, DUR = 15.6, BEAT = 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  master.connect(comp).connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
  { const d = noiseBuf.getChannelData(0); let s = 1234567; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; } }

  function kick(t, g = 1) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(1.0 * g, t + 0.004);
    a.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(a).connect(master); o.start(t); o.stop(t + 0.4);
  }
  function noise(t, dur, g, type, f, q = 0.7, pan = 0) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const a = ctx.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    n.connect(fl).connect(a).connect(p).connect(master); n.start(t, (t * 7.31) % 1.5); n.stop(t + dur + 0.02);
  }
  function tone(t, f, dur, g, type = 'sawtooth', cut = 1800, pan = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.15), t + dur);
    const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(fl).connect(a).connect(p).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // Am F C G — one chord per bar (4 beats)
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ROOT = [45, 41, 48, 43];

  for (let b = 0; b < 30; b++) {
    const t = b * BEAT;
    kick(t, b === 20 ? 1.15 : 1);
    if (b >= 2) noise(t + BEAT / 2, 0.05, 0.16, 'highpass', 8000, 0.7, 0.2);   // offbeat hat
    if (b >= 4 && b % 2 === 1) noise(t, 0.12, 0.12, 'bandpass', 2400, 0.9, -0.15); // clap-ish on 2 & 4
    const bar = Math.floor(b / 4) % 4;
    if (b >= 4 && b < 26) { // bass, 8ths
      tone(t, hz(ROOT[bar] - 12), 0.22, 0.32, 'square', 600);
      tone(t + BEAT / 2, hz(ROOT[bar]), 0.18, 0.16, 'square', 700);
    }
  }
  // scene-change hits: chord stab + noise sweep
  const HITS = [[2, 0.7], [4, 0.9], [10, 0.9], [16, 0.9], [20, 1.5], [26, 1.1]];
  for (const [b, g] of HITS) {
    const t = b * BEAT, bar = Math.floor(b / 4) % 4;
    CH[bar].forEach((m, i) => { tone(t, hz(m), 0.55 * g, 0.09 * g, 'sawtooth', 3200, (i - 1) * 0.4); tone(t, hz(m + 12), 0.4 * g, 0.04 * g, 'triangle', 5000, (1 - i) * 0.4); });
    noise(t, 0.35 * g, 0.22 * g, 'lowpass', 5000);
    tone(t, hz(33), 0.5 * g, 0.5 * g, 'sine', 300);
  }
  // riser into the biggest beat
  { const t0 = 18 * BEAT, t1 = 20 * BEAT; const n = ctx.createBufferSource(); n.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(400, t0); fl.frequency.exponentialRampToValueAtTime(7000, t1);
    const a = ctx.createGain(); a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(0.18, t1 - 0.01); a.gain.linearRampToValueAtTime(0, t1);
    n.connect(fl).connect(a).connect(master); n.start(t0); n.stop(t1); }
  // end-card ring: tonic chord tail
  CH[0].forEach((m, i) => tone(26 * BEAT, hz(m), 2.4, 0.06, 'triangle', 2500, (i - 1) * 0.3));
  // cursor clicks
  for (const b of [8.5, 14.0, 23.75, 29.0]) { noise(b * BEAT, 0.03, 0.35, 'highpass', 3000); tone(b * BEAT, 1900, 0.04, 0.08, 'sine', 4000); }

  const buf = await ctx.startRendering();
  // trim to 15.0 s with a short fade, encode 16-bit WAV
  const N = Math.round(SR * 15.0), ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const fade = Math.round(SR * 0.25);
  const out = new DataView(new ArrayBuffer(44 + N * 4));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + N * 4, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true);
  out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, N * 4, true);
  for (let i = 0; i < N; i++) {
    const g = i > N - fade ? (N - i) / fade : 1;
    for (let c = 0; c < 2; c++) out.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i] * g)) * 32767, true);
  }
  const bytes = new Uint8Array(out.buffer); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
