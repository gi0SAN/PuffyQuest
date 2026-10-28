/* ============================================================
   ui.js — HUD, screens, banners, tips, responsive scaling
   ============================================================ */
const UI = {
  shell: null, hud: null, health: null, pips: [],
  livesEl: null, abilityEl: null, abIcon: null, abBar: null, abName: null,
  scoreEl: null, lvEl: null, bannerEl: null, bannerT: null,
  bannerTitle: null, bannerSub: null, tipEl: null, tipT: null,
  tPages: [], tDots: [], tutPage: 0,

  init() {
    const $ = id => document.getElementById(id);
    this.shell = $('shell');
    this.hud = $('hud');
    this.health = $('health');
    this.livesEl = $('lives');
    this.abilityEl = $('ability');
    this.abIcon = $('ab-icon');
    this.abName = $('ab-name');
    this.scoreEl = $('score');
    this.lvEl = $('lvlabel');
    this.bannerEl = $('banner');
    this.bannerTitle = $('banner-title');
    this.bannerSub = $('banner-sub');
    this.tipEl = $('tip');
    this.tPages = Array.from(document.querySelectorAll('#tutorial .tpage'));
    this.tDots  = Array.from(document.querySelectorAll('#tutorial .t-dots i'));
    this.tutPage = 0;

    // health pips
    this.health.innerHTML = '';
    this.pips = [];
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      d.className = 'pip';
      this.health.appendChild(d);
      this.pips.push(d);
    }

    // screen buttons
    document.querySelectorAll('.panel button').forEach(b => {
      b.addEventListener('click', () => {
        Sfx.unlock(); Sfx.menu();
        if (b.dataset.act === 'resume') Game.setState('play');
        else if (b.dataset.act === 'start') Game.start();
        else Game.toTitle();
      });
    });
    $('title').addEventListener('click', () => { Sfx.unlock(); Game.openTutorial(); });

    window.addEventListener('resize', () => this.fit());
    this.fit();
  },

  /* ---------------- tutorial ---------------- */
  setTutorialPage(i) {
    const n = this.tPages.length || 3;            // CONTROLS / ENEMIES / POWERS
    this.tutPage = ((i % n) + n) % n;
    this.tPages.forEach((el, k) => el.classList.toggle('hidden', k !== this.tutPage));
    this.tDots.forEach((el, k) => el.classList.toggle('on', k === this.tutPage));
    Sfx.menu();
  },

  fit() {
    const s = Math.min(window.innerWidth / 800, window.innerHeight / 450) * 0.97;
    this.shell.style.transform = `translate(-50%,-50%) scale(${s})`;
  },

  /* ---------------- HUD ---------------- */
  setHealth(h, max) {
    if (h === this._hp) return;
    this._hp = h;
    for (let i = 0; i < this.pips.length; i++) {
      const on = i < h;
      const el = this.pips[i];
      const wasOff = el.classList.contains('off');
      el.classList.toggle('off', !on);
      if (on && wasOff) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    }
  },

  setLives(n) { this.livesEl.textContent = '×' + Math.max(0, n); },

  setAbility(ability) {
    if (ability === this._ab) return;
    this._ab = ability;
    if (!ability) { this.abilityEl.classList.add('hidden'); return; }
    const d = ABILITIES[ability];
    this.abilityEl.classList.remove('hidden');
    this.abIcon.style.background = d.color;
    this.abIcon.style.color = d.color;
    this.abIcon.textContent = d.icon;
    this.abName.textContent = d.name;
  },

  setScore(n) { this.scoreEl.textContent = String(Math.floor(n)).padStart(6, '0'); },
  setLevel(label, name) { this.lvEl.textContent = label + ' ' + name; },
  showHud(on) { this.hud.classList.toggle('hidden', !on); },

  /* ---------------- screens ---------------- */
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (id) document.getElementById(id).classList.remove('hidden');
  },

  /* ---------------- banners & tips ---------------- */
  banner(title, sub, ms = 1600) {
    clearTimeout(this.bannerT);
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.classList.remove('hidden');
    this.bannerEl.style.animation = 'none'; void this.bannerEl.offsetWidth;
    this.bannerEl.style.animation = '';
    this.bannerT = setTimeout(() => this.bannerEl.classList.add('hidden'), ms);
  },

  tip(text, ms = 2400) {
    clearTimeout(this.tipT);
    this.tipEl.textContent = text;
    this.tipEl.classList.remove('hidden');
    this.tipEl.style.animation = 'none'; void this.tipEl.offsetWidth;
    this.tipEl.style.animation = '';
    this.tipT = setTimeout(() => this.tipEl.classList.add('hidden'), ms);
  },

  hideTip() { clearTimeout(this.tipT); this.tipEl.classList.add('hidden'); },
  hideBanner() { clearTimeout(this.bannerT); this.bannerEl.classList.add('hidden'); },

  hurtFlash() {
    this.shell.classList.remove('hurt'); void this.shell.offsetWidth;
    this.shell.classList.add('hurt');
  }
};
