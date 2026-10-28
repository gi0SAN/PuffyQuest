/* ============================================================
   audio.js — tiny WebAudio beeper for retro SFX (no assets)
   ============================================================ */
const Sfx = (() => {
  let ctx = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.05, slide = null, delay = 0) {
    const c = ac();
    if (!c) return;
    try {
      const t0 = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }

  function noise(dur, vol = 0.05) {
    const c = ac();
    if (!c) return;
    try {
      const n = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain(); g.gain.value = vol;
      src.connect(g); g.connect(c.destination); src.start();
    } catch (e) {}
  }

  return {
    unlock()      { ac(); },
    start()       { tone(523, .1, 'square', .05); tone(784, .12, 'square', .05, null, .1); tone(1046, .2, 'square', .05, null, .2); },
    jump()        { tone(430, .13, 'square', .045, 760); },
    float()       { tone(600, .1, 'sine', .03, 720); },
    inhale()      { tone(150, .22, 'sawtooth', .025, 430); },
    swallow()     { tone(300, .1, 'square', .05, 180); tone(500, .1, 'square', .04, 700, .1); },
    spit()        { tone(760, .12, 'square', .05, 240); noise(.05, .03); },
    puff()        { tone(240, .08, 'triangle', .04, 160); },
    hurt()        { tone(300, .22, 'sawtooth', .05, 90); },
    die()         { tone(500, .18, 'square', .05, 340); tone(340, .5, 'square', .05, 90, .2); },
    kill()        { noise(.12, .05); tone(700, .1, 'square', .04, 240); },
    heal()        { tone(660, .09, 'square', .05); tone(880, .09, 'square', .05, null, .09); tone(1170, .16, 'square', .05, null, .18); },
    copy()        { tone(523, .09, 'square', .05); tone(659, .09, 'square', .05, null, .08);
                    tone(784, .09, 'square', .05, null, .16); tone(1046, .22, 'square', .05, null, .24); },
    ability()     { tone(880, .1, 'sawtooth', .04, 380); },
    loseAbility(){ tone(400, .15, 'square', .04, 180); },
    bossHit()    { noise(.1, .06); tone(200, .12, 'square', .05, 120); },
    bossDie()    { noise(.5, .07); tone(400, .7, 'sawtooth', .06, 60); },
    oneUp()      { [660, 880, 990, 1320].forEach((f, i) => tone(f, .12, 'square', .05, null, i * .1)); },
    clear()      { [523, 659, 784, 1046, 784, 1046, 1319].forEach((f, i) => tone(f, .14, 'square', .05, null, i * .11)); },
    win()        { [523, 659, 784, 1046, 784, 1046, 1319, 1568].forEach((f, i) => tone(f, .16, 'square', .05, null, i * .13)); },
    menu()       { tone(700, .07, 'square', .04, 900); }
  };
})();
