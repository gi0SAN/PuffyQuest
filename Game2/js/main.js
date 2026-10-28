/* ============================================================
   main.js — state machine, world simulation and rendering
   ============================================================ */

const PIX = 0.5;   // canvas backing scale (pixel-art resolution)

/** blend two #rrggbb colours -> rgb() string */
function hexMix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16) + (((pb >> 16) - (pa >> 16)) * k));
  const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k));
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * k));
  return `rgb(${r},${g},${bl})`;
}

const Game = {
  state: 'title',
  levelIndex: 0,
  level: null,
  player: null,
  enemies: [], shots: [], items: [], parts: [],
  boss: null, bossActive: false,
  score: 0, lives: 3, best: 0,
  shake: 0, timer: 0,
  tips: null,
  ctx: null, canvas: null,

  /* ================= boot ================= */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;   // chunky pixels, never blurred
    this.tips = new Set();
    UI.init();
    UI.showScreen('title');
    UI.showHud(false);
    let acc = 0, last = 0;
    const frame = t => {
      requestAnimationFrame(frame);
      if (!last) last = t;
      let d = t - last; last = t;
      if (d > 200) d = 200;
      acc += d;
      let guard = 0;
      while (acc >= 16.667 && guard < 5) { this.update(); acc -= 16.667; guard++; }
      if (guard >= 5) acc = 0;
      this.render();
    };
    requestAnimationFrame(frame);
  },

  /* ================= flow ================= */
  setState(s) {
    this.state = s;
    if (s === 'play') UI.showScreen(null);
    if (s === 'pause') UI.showScreen('pause');
  },

  start() {
    Sfx.unlock(); Sfx.start();
    this.score = 0; this.lives = 3;
    this.tips.clear();
    UI.setScore(0); UI.setLives(3);
    this.loadLevel(0);
  },

  /** title -> tutorial -> game */
  openTutorial() {
    Sfx.unlock(); Sfx.menu();
    this.state = 'tutorial';
    this.level = null; this.player = null; this.boss = null;
    UI.showHud(false);
    UI.showScreen('tutorial');
    UI.setTutorialPage(0);
    UI.hideTip(); UI.hideBanner();
  },

  toTitle() {
    this.state = 'title';
    this.level = null; this.player = null; this.boss = null;
    UI.showScreen('title');
    UI.showHud(false);
    UI.hideTip(); UI.hideBanner();
  },

  loadLevel(i) {
    this.levelIndex = i;
    this.level = new Level(LEVELS[i], i);
    const L = this.level;

    this.player = new Player(L.spawn.x, L.spawn.y);
    this.enemies = L.enemySpawns.map(s => new Enemy(s.char, s.col, s.row));
    this.items = L.itemSpawns.map(s =>
      new Item(s.kind, s.col * 32 + 16, (s.row + 1) * 32));
    this.shots = [];
    this.parts = [];
    this.boss = L.bossStart ? new Boss(L.bossStart.col * 32, L.bossStart.row) : null;
    this.bossActive = false;
    this.shake = 0;
    this.timer = 60;

    Camera.bounds = { x: 0, y: 0, w: L.pxW, h: L.pxH };
    Camera.lock = null;
    Camera.snap(this.player.x + 12, this.player.y + 15);

    UI.showHud(true);
    UI.setLevel(L.label, L.name);
    UI.setHealth(this.player.hp, this.player.maxHp);
    UI.setAbility(null);
    UI.setScore(this.score);
    UI.setLives(this.lives);
    UI.hideTip();
    UI.banner(L.name, L.label + '  ·  WORLD 1', 1700);
    Sfx.menu();

    this.state = 'intro';
    UI.showScreen(null);
    if (i === 0) this.tipOnce('controls', '←→ MOVE · Z JUMP · HOLD Z TO FLOAT · X INHALE · ↓ SWALLOW', 6000);
  },

  levelClear() {
    if (this.state !== 'play') return;
    this.addScore(1000);
    this.state = 'clear';
    this.timer = 130;
    UI.showScreen('clear');
    document.getElementById('clear-score').textContent = 'SCORE ' + String(this.score).padStart(6, '0');
    UI.hideTip();
    Sfx.clear();
    for (let i = 0; i < 30; i++)
      this.burst(this.level.goal.x + this.level.goal.w / 2,
                 this.level.goal.y + this.level.goal.h - 40,
        ['#ffd93d', '#fff', '#ff8fc0'][i % 3], { speed: 5, life: 40, star: i % 3 === 0 });
  },

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.loadLevel(this.levelIndex + 1);
    else this.victory();
  },

  victory() {
    this.state = 'victory';
    this.best = Math.max(this.best, this.score);
    document.getElementById('victory-score').textContent =
      'SCORE ' + String(this.score).padStart(6, '0');
    UI.showScreen('victory');
    Sfx.win();
  },

  onPlayerDeath() {
    this.state = 'dead';
    this.timer = 110;
    UI.hideTip();
    if (this.player.ability) UI.setAbility(null);
  },

  afterDeath() {
    this.lives--;
    UI.setLives(this.lives);
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.best = Math.max(this.best, this.score);
      UI.showScreen('gameover');
      return;
    }
    this.loadLevel(this.levelIndex);
  },

  onBossDefeated(b) {
    this.bossActive = false;
    Camera.lock = null;
    /* Put the capsule on solid ground so it can always be reached,
       no matter where in the air King Grumble finally dropped. */
    const L = this.level;
    const col = Math.floor((b.x + b.w / 2) / 32);
    let floorY = -1;
    for (let d = 0; d <= 4 && floorY < 0; d++) {
      for (const c of d === 0 ? [col] : [col - d, col + d]) {
        for (let r = 0; r < L.h; r++) {
          if (Phys.solid(L.get(c, r))) { floorY = r * 32; break; }
        }
        if (floorY >= 0) break;
      }
    }
    if (floorY < 0) floorY = b.y + b.h;
    this.level.goal = {
      x: b.x + b.w / 2 - 24, y: floorY - 128, w: 48, h: 128, active: true, t: 0
    };
    UI.banner('KING GRUMBLE DEFEATED!', 'GRAB THE CAPSULE', 2200);
    Sfx.clear();
  },

  /* ================= update ================= */
  update() {
    switch (this.state) {
      case 'title':
        if (Input.confirm()) this.openTutorial();
        break;

      case 'tutorial':
        if (Input.leftPress())  UI.setTutorialPage(UI.tutPage - 1);
        if (Input.rightPress()) UI.setTutorialPage(UI.tutPage + 1);
        if (Input.pausePress()) this.toTitle();
        else if (Input.confirm()) this.start();
        break;

      case 'intro':
        this.render_ents_idle();
        this.timer--;
        if (this.timer <= 0 || Input.confirm()) this.setState('play');
        break;

      case 'play':
        if (Input.pausePress()) { this.setState('pause'); break; }
        this.stepWorld();
        break;

      case 'pause':
        if (Input.pausePress() || Input.confirm()) this.setState('play');
        break;

      case 'dead':
        this.stepWorld();
        this.timer--;
        if (this.timer <= 0) this.afterDeath();
        break;

      case 'clear':
        this.stepWorld();
        this.timer--;
        if (this.timer <= 0 || Input.confirm()) this.nextLevel();
        break;

      case 'gameover':
      case 'victory':
        if (Input.confirm()) this.toTitle();
        break;
    }
    Input.clearFrame();
  },

  render_ents_idle() {
    if (!this.player) return;
    this.player.update(this);
    this.updateParts();
    Camera.follow(this.player.x + 12, this.player.y + 15);
  },

  stepWorld() {
    const p = this.player;
    p.update(this);
    for (const e of this.enemies) e.update(this);
    if (this.boss && !this.boss.dead) this.boss.update(this);
    for (const s of this.shots) s.update(this);
    for (const it of this.items) it.update(this);
    this.updateParts();

    /* ---- boss trigger ---- */
    if (!this.bossActive && this.boss && !this.boss.dead && this.level.arena) {
      const a = this.level.arenaRect();
      if (p.x > a.x + 70) {
        this.bossActive = true;
        Camera.lock = a;
        UI.banner('KING GRUMBLE', 'INHALE HIS STARS & SPIT THEM BACK!', 2000);
        Sfx.bossHit();
      }
    }

    /* ---- goal ---- */
    const g = this.level.goal;
    if (g && g.active && this.state === 'play' && !p.dead && Phys.hit(p.hurtBox(), g))
      this.levelClear();

    /* ---- cleanup ---- */
    this.enemies = this.enemies.filter(e => !e.dead);
    this.shots = this.shots.filter(s => !s.dead);
    this.items = this.items.filter(i => !i.dead);
    this.parts = this.parts.filter(pt => !pt.dead);

    if (this.shake > 0.3) this.shake *= 0.86; else this.shake = 0;
    Camera.follow(p.x + p.w / 2, p.y + p.h / 2);

    /* ---- HUD ---- */
    UI.setHealth(p.hp, p.maxHp);
    UI.setAbility(p.ability);
  },

  updateParts() {
    for (const pt of this.parts) {
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vy += pt.grav;
      pt.life--;
      if (pt.life <= 0) pt.dead = true;
    }
  },

  /* ================= helpers ================= */
  addScore(n) { if (!n) return; this.score += n; UI.setScore(this.score); },
  addLife()   { this.lives++; UI.setLives(this.lives); UI.banner('1-UP!', '', 1100); },

  burst(x, y, color, o) { this.parts.push(particle(x, y, color, o || {})); },

  tipOnce(key, text, ms) {
    if (this.tips.has(key)) return;
    this.tips.add(key);
    UI.tip(text, ms);
  },
  pushTip(text, ms) { UI.tip(text, ms); },

  showAbility(copy) {
    const d = ABILITIES[copy];
    UI.banner(d.name + '!', 'PRESS X TO USE IT', 1400);
  },

  /* ================= render ================= */
  render() {
    const ctx = this.ctx;
    /* world is 800x450, canvas is 400x225 -> every game pixel becomes a
       crisp 2x2 block once the browser upscales it nearest-neighbour */
    ctx.setTransform(PIX, 0, 0, PIX, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 800, 450);

    if (!this.level) return;

    this.drawBackground(ctx);

    const sx = this.shake > 0.4 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0.4 ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.translate(Math.round(-Camera.x + sx), Math.round(-Camera.y + sy));

    this.drawTiles(ctx);
    if (this.level.goal && this.level.goal.active) this.drawGoal(ctx, this.level.goal);
    for (const it of this.items) it.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx);
    if (this.player) this.player.draw(ctx);
    for (const s of this.shots) s.draw(ctx);
    this.drawParts(ctx);
    if (this.bossActive && this.level.arena) this.drawBarrier(ctx);

    ctx.restore();
  },

  /* ---------- background ---------- */
  drawBackground(ctx) {
    const t = this.level.theme;

    /* flat horizontal bands instead of a smooth gradient - 8-bit skies
       were built from a handful of solid colours */
    const N = 7, bh = Math.ceil(450 / N);
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = hexMix(t.sky[0], t.sky[1], i / (N - 1));
      ctx.fillRect(0, i * bh, 800, bh);
    }

    const baseY = 450 - Camera.y * 0.12;

    if (t.mode === 'cave') {
      // far crystals
      ctx.fillStyle = t.hillFar;
      this.spikes(ctx, Camera.x * 0.2, baseY, 190, 70);
      // floating motes
      ctx.fillStyle = t.cloud;
      for (let i = 0; i < 14; i++) {
        const x = ((i * 173 - Camera.x * 0.12) % 1000 + 1000) % 1000 - 60;
        const y = (i * 71) % 300 + 30 + Math.sin(this.tick * 0.02 + i) * 8;
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(x, y, 2.5 + (i % 3), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.hillNear;
      this.spikes(ctx, Camera.x * 0.45, baseY, 260, 110);
    } else {
      // clouds
      ctx.fillStyle = t.cloud;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 331 - Camera.x * 0.15) % 1200 + 1200) % 1200 - 150;
        const y = 40 + (i * 53) % 130 - Camera.y * 0.08;
        this.cloud(ctx, x, y, 26 + (i % 3) * 8);
      }
      // hills
      ctx.fillStyle = t.hillFar;
      this.hills(ctx, Camera.x * 0.22, baseY, 320, 105);
      ctx.fillStyle = t.hillNear;
      this.hills(ctx, Camera.x * 0.45, baseY, 230, 68);
    }
  },

  hills(ctx, off, baseY, spacing, height) {
    const start = -(off % spacing) - spacing;
    for (let i = 0; i < 6; i++) {
      const x = start + i * spacing;
      ctx.beginPath();
      ctx.ellipse(x, baseY + 6, spacing * 0.6, height, 0, Math.PI, 0);
      ctx.fill();
    }
  },

  spikes(ctx, off, baseY, spacing, height) {
    const start = -(off % spacing) - spacing;
    for (let i = 0; i < 8; i++) {
      const x = start + i * spacing;
      ctx.beginPath();
      ctx.moveTo(x, baseY + 6);
      ctx.lineTo(x + spacing * 0.35, baseY - height * (0.5 + (i % 3) * 0.25));
      ctx.lineTo(x + spacing * 0.7, baseY + 6);
      ctx.closePath(); ctx.fill();
    }
  },

  cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.55, 0, 7);
    ctx.arc(x + s * 0.5, y - s * 0.2, s * 0.45, 0, 7);
    ctx.arc(x + s, y, s * 0.5, 0, 7);
    ctx.arc(x + s * 0.5, y + s * 0.2, s * 0.5, 0, 7);
    ctx.fill();
  },

  get tick() { return Math.floor(performance.now() / 16.67); },

  /* ---------- tiles ---------- */
  drawTiles(ctx) {
    const L = this.level, t = L.theme, ts = 32;
    const r = Camera.range(ts);
    const x1 = Math.min(r.x1, L.w - 1), y1 = Math.min(r.y1, L.h - 1);

    for (let ty = r.y0; ty <= y1; ty++) {
      for (let tx = r.x0; tx <= x1; tx++) {
        const ch = L.get(tx, ty);
        if (ch === '.' || ch === ' ') continue;
        const x = tx * ts, y = ty * ts;

        if (ch === '^') { this.drawSpike(ctx, x, y); continue; }

        const icy = ch === 'I';
        const exposed = !Phys.solid(L.get(tx, ty - 1));
        const sideL = !Phys.solid(L.get(tx - 1, ty));
        const sideR = !Phys.solid(L.get(tx + 1, ty));

        // body
        ctx.fillStyle = icy ? '#9dcdf2' : t.body;
        ctx.fillRect(x, y, ts, ts);

        // shading
        ctx.fillStyle = 'rgba(0,0,0,.14)';
        if (sideR) ctx.fillRect(x + ts - 5, y, 5, ts);
        if (!exposed) ctx.fillRect(x, y + ts - 5, ts, 5);
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        if (sideL) ctx.fillRect(x, y, 5, ts);

        // speckles
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        const h1 = (tx * 7 + ty * 13) % 5;
        ctx.fillRect(x + 6 + h1 * 4, y + 18, 4, 4);
        ctx.fillRect(x + 18 - h1 * 2, y + 25, 3, 3);

        // cap
        if (exposed) {
          ctx.fillStyle = icy ? '#f4fcff' : t.top;
          ctx.fillRect(x, y, ts, 11);
          ctx.fillStyle = icy ? '#cbe9ff' : t.topEdge;
          ctx.fillRect(x, y + 11, ts, 4);
          // grass tufts
          if (!icy) {
            ctx.fillStyle = t.top;
            const g = (tx * 5) % 7;
            ctx.fillRect(x + 3 + g, y - 4, 3, 5);
            ctx.fillRect(x + 20 - g, y - 3, 3, 4);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,.85)';
            ctx.fillRect(x + 4, y + 2, 8, 3);
          }
        }
      }
    }
  },

  drawSpike(ctx, x, y) {
    ctx.fillStyle = '#c9ccd6';
    ctx.strokeStyle = '#6a6f7d';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const bx = x + i * 16;
      ctx.beginPath();
      ctx.moveTo(bx + 1, y + 32);
      ctx.lineTo(bx + 8, y + 6);
      ctx.lineTo(bx + 15, y + 32);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(x + 6, y + 14, 2, 12);
  },

  /* ---------- goal capsule ---------- */
  drawGoal(ctx, g) {
    g.t = (g.t || 0) + 1;
    const cx = g.x + g.w / 2;
    const bottom = g.y + g.h;
    const bob = Math.sin(g.t * 0.08) * 4;
    ctx.save();
    ctx.translate(cx, bottom - 58 + bob);

    // glow
    const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
    gl.addColorStop(0, 'rgba(255,255,255,.8)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill();

    // pedestal
    ctx.fillStyle = '#4a4470';
    ctx.fillRect(-22, 52, 44, 8);
    ctx.fillStyle = '#5f5890';
    ctx.fillRect(-22, 52, 44, 3);

    // tall capsule
    const cg = ctx.createLinearGradient(-20, 0, 20, 0);
    cg.addColorStop(0, 'rgba(255,255,255,.95)');
    cg.addColorStop(.5, 'rgba(255,255,255,.72)');
    cg.addColorStop(1, 'rgba(255,255,255,.95)');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 52, 0, 0, 7);
    ctx.fill(); ctx.stroke();

    // rotating star
    ctx.save();
    ctx.rotate(g.t * 0.03);
    drawStar(ctx, 0, 0, 15, '#ffd93d', '#e07b00');
    ctx.restore();

    // sparkle ring
    for (let i = 0; i < 6; i++) {
      const a = g.t * 0.05 + i * Math.PI / 3;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 40, Math.sin(a) * 56, 2.6, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  },

  /* ---------- arena barrier ---------- */
  drawBarrier(ctx) {
    const a = this.level.arenaRect();
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const alpha = 0.35 + 0.25 * Math.sin(this.tick * 0.15 + i);
      ctx.strokeStyle = `rgba(120,220,255,${alpha})`;
      ctx.lineWidth = 5 - i;
      ctx.beginPath();
      ctx.moveTo(a.x + 3, 0);
      ctx.lineTo(a.x + 3, a.h);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* ---------- particles ---------- */
  drawParts(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = a;
      if (p.star) {
        drawStar(ctx, p.x, p.y, p.size * 1.4, p.color, null);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.6, 0, 7);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());
