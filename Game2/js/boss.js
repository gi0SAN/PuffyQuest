/* ============================================================
   boss.js — KING GRUMBLE, the final boss (3 phases)
   ============================================================ */

class Boss {
  constructor(cx, cy) {
    this.w = 76; this.h = 78;
    this.x = cx + (32 - this.w) / 2;
    this.y = (cy + 1) * 32 - this.h;

    this.hp = 14; this.maxHp = 14;
    this.dir = -1;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.state = 'intro';
    this.timer = 90;
    this.t = 0;
    this.flash = 0;
    this.dead = false;
    this.dying = false;
    this.launched = false;
    this.vulnerable = false;
    this.threw = 0;
    this.hitCd = 0;
  }

  get phase() { return this.hp > 9 ? 1 : this.hp > 4 ? 2 : 3; }

  /* ------------------------------- */
  update(Game) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.hitCd > 0) this.hitCd--;
    if (this.dying) { this.updateDying(Game); return; }

    const p = Game.player;
    const level = Game.level;

    if (this.state === 'intro') {
      this.dir = p.x < this.x ? -1 : 1;
      this.vx = 0; this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      Phys.move(this, level);
      this.timer--;
      if (this.timer <= 0) { this.state = 'idle'; this.timer = 30; this.vulnerable = true; }
      return;
    }

    // face the player when idle / throwing
    if (this.state === 'idle' || this.state === 'throw')
      this.dir = Math.abs(p.x - this.x) < 30 ? this.dir : (p.x < this.x ? -1 : 1);

    switch (this.state) {
      case 'idle': {
        this.vx = 0;
        this.timer--;
        if (this.timer <= 0) this.chooseAction(Game);
        break;
      }
      case 'walk': {
        const spd = [0, 1.7, 2.1, 2.5][this.phase];
        this.vx = this.dir * spd;
        this.timer--;
        if (this.timer <= 0 || (this.onGround && Phys.solid(Phys.frontChar(this, level, this.dir)))) {
          this.state = 'idle'; this.timer = 20 + Math.random() * 25;
        }
        break;
      }
      case 'jump': {
        if (!this.launched) {
          this.launched = true;
          this.vy = -12.5;
          const d = p.x < this.x ? -1 : 1;
          this.vx = d * (2.2 + this.phase * 0.6);
          Sfx.jump();
        }
        this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
        Phys.move(this, level);
        if (this.onGround && this.launched && this.t > 20) { this.slam(Game); }
        return;
      }
      case 'dash': {
        const spd = [0, 5, 5.6, 6.4][this.phase];
        this.vx = this.dir * spd;
        this.timer--;
        if (this.t % 3 === 0) Game.burst(this.x + this.w / 2 - this.dir * 30, this.y + this.h - 8, '#cfe9ff', { speed: 2, life: 16 });
        if (this.timer <= 0) { this.state = 'idle'; this.timer = 24; this.vx = 0; }
        break;
      }
      case 'throw': {
        this.vx = 0;
        this.timer--;
        if (this.timer <= 0) { this.throwProjectiles(Game); this.state = 'idle'; this.timer = 30; }
        break;
      }
    }

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    Phys.move(this, level);

    // contact damage
    if (!p.dead && Phys.hit(this, p.hurtBox()))
      p.takeDamage(2, p.x + p.w / 2 < this.x + this.w / 2 ? this.x : this.x + this.w, Game);

    if (this.y > level.pxH + 200) this.y = level.pxH - this.h;
  }

  chooseAction(Game) {
    const p = Game.player;
    const phase = this.phase;
    const roll = Math.random();
    const dist = Math.abs(p.x - this.x);

    if (phase === 1) {
      if (dist > 220 || roll < 0.45) this.state = 'jump';
      else if (roll < 0.75) this.state = 'walk';
      else this.state = 'throw';
    } else if (phase === 2) {
      if (roll < 0.34) this.state = 'jump';
      else if (roll < 0.62) this.state = 'throw';
      else if (roll < 0.82) this.state = 'walk';
      else this.state = 'dash';
    } else {
      if (roll < 0.36) this.state = 'jump';
      else if (roll < 0.70) this.state = 'throw';
      else this.state = 'dash';
    }

    if (this.state === 'jump') this.launched = false;
    if (this.state === 'walk') this.timer = 45;
    if (this.state === 'throw') this.timer = 26;
    if (this.state === 'dash') { this.timer = 34; Sfx.puff(); }
  }

  slam(Game) {
    this.state = 'idle'; this.timer = 34;
    this.vx = 0; this.vy = 0;
    Game.shake = 12;
    Sfx.bossHit();
    const y = this.y + this.h - 10;
    Game.shots.push(new Projectile({
      kind: 'shock', owner: 'enemy', dmg: 2,
      x: this.x - 10, y, w: 22, h: 22, vx: -4.6, life: 150, color: '#cfe9ff'
    }));
    Game.shots.push(new Projectile({
      kind: 'shock', owner: 'enemy', dmg: 2,
      x: this.x + this.w + 10, y, w: 22, h: 22, vx: 4.6, life: 150, color: '#cfe9ff'
    }));
    for (let i = 0; i < 14; i++)
      Game.burst(this.x + this.w / 2 + (Math.random() - 0.5) * 70, this.y + this.h, '#e8f6ff', { speed: 4, life: 24 });
  }

  throwProjectiles(Game) {
    const n = this.phase === 1 ? 3 : this.phase === 2 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const dir = this.dir;
      Game.shots.push(new Projectile({
        kind: 'icing', owner: 'enemy', dmg: 2, inhaleable: true,
        x: this.x + this.w / 2 + dir * 24, y: this.y + 22,
        w: 20, h: 20,
        vx: dir * (3.4 + i * 0.9),
        vy: -4.2 - i * 0.8,
        grav: 0.16, life: 240, color: '#fff2f8', spin: 0.3
      }));
    }
    Sfx.spit();
    for (let i = 0; i < 8; i++)
      Game.burst(this.x + this.w / 2 + this.dir * 30, this.y + 22, '#ffd7ec', { speed: 3, life: 18 });
  }

  /* ------------------------------- */
  hurt(dmg, Game, hx) {
    if (!this.vulnerable || this.dead) return;
    if (this.hitCd > 0) return;
    this.hitCd = 10;
    this.hp -= dmg;
    this.flash = 8;
    Game.shake = 5;
    Sfx.bossHit();
    for (let i = 0; i < 8; i++)
      Game.burst(hx, this.y + this.h / 2, '#fff', { speed: 3.5, life: 20, star: i < 3 });

    if (this.hp <= 0) {
      this.hp = 0;
      this.vulnerable = false;
      this.dying = true;
      this.timer = 90;
      this.state = 'dying';
      this.vx = 0;
      this.vy = 0;                       // no floating corpse: he drops to the floor
      Game.shake = 14;
      Sfx.bossDie();
      Game.addScore(5000);
    }
  }

  updateDying(Game) {
    this.timer--;
    this.vy = Math.min(this.vy + GRAVITY * 0.4, 5);
    this.y += this.vy;
    if (this.timer % 5 === 0) {
      Game.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h,
        ['#fff', '#ffd93d', '#ff8fc0'][Math.floor(Math.random() * 3)],
        { speed: 4, life: 30, star: Math.random() < 0.5 });
      Sfx.kill();
    }
    if (this.timer <= 0) {
      this.dead = true;
      Game.onBossDefeated(this);
    }
  }

  /* ------------------------------- */
  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const hurt = this.state === 'hurt';
    ctx.save();
    ctx.translate(cx, cy);

    if (this.flash > 0) { ctx.globalAlpha = 0.6 + Math.sin(this.flash * 2) * 0.4; }

    const breathe = Math.sin(this.t * 0.08) * 2;
    const squash = this.state === 'intro' ? 1.1 : 1;

    // ---- cape ----
    ctx.fillStyle = '#c2185b';
    ctx.beginPath();
    ctx.moveTo(-24, -20); ctx.quadraticCurveTo(-46 - breathe, 10, -30, 40);
    ctx.lineTo(24, 40); ctx.quadraticCurveTo(44 + breathe, 6, 24, -20);
    ctx.closePath(); ctx.fill();

    // ---- body (rotund penguin king) ----
    ctx.scale(1 / squash, squash);
    const g = ctx.createRadialGradient(-10, -16, 6, 0, 0, 44);
    g.addColorStop(0, '#6b8fbf'); g.addColorStop(.6, '#33507c'); g.addColorStop(1, '#1e3050');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 2, 34, 37, 0, 0, 7); ctx.fill();

    // belly
    ctx.fillStyle = '#f4f7ff';
    ctx.beginPath(); ctx.ellipse(0, 12, 22, 24, 0, 0, 7); ctx.fill();

    // ---- crown ----
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath();
    ctx.moveTo(-22, -30); ctx.lineTo(-22, -48); ctx.lineTo(-12, -38);
    ctx.lineTo(-4, -54); ctx.lineTo(6, -38); ctx.lineTo(16, -50);
    ctx.lineTo(22, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c9940a'; ctx.lineWidth = 2; ctx.stroke();

    // ---- eyes ----
    const ex = this.dir * 6;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex - 11, -10, 7, 9, 0, 0, 7); ctx.ellipse(ex + 11, -10, 7, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2140';
    const look = this.vulnerable ? this.dir * 2.5 : 0;
    ctx.beginPath(); ctx.arc(ex - 11 + look, -8, 3.6, 0, 7); ctx.arc(ex + 11 + look, -8, 3.6, 0, 7); ctx.fill();

    // angry brows
    ctx.strokeStyle = '#16233b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 19, -22); ctx.lineTo(ex - 5, -16);
    ctx.moveTo(ex + 19, -22); ctx.lineTo(ex + 5, -16);
    ctx.stroke();

    // ---- beak ----
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath();
    ctx.moveTo(ex - 9, 2); ctx.quadraticCurveTo(ex, 14, ex + 9, 2);
    ctx.quadraticCurveTo(ex, -3, ex - 9, 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d97b0a'; ctx.lineWidth = 1.5; ctx.stroke();

    // ---- feet ----
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath();
    ctx.ellipse(-18, 38 + breathe * 0.3, 15, 8, -0.18, 0, 7);
    ctx.ellipse(18, 38 + breathe * 0.3, 15, 8, 0.18, 0, 7);
    ctx.fill();

    // ---- hammer ----
    const swing = this.state === 'jump' ? -0.9 : (this.state === 'dash' ? 0.6 : Math.sin(this.t * 0.07) * 0.15);
    ctx.save();
    ctx.translate(this.dir * 34, -4);
    ctx.rotate(this.dir * swing);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-4, -6, 8, 46);
    ctx.fillStyle = '#c9ccd6';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-22, -26, 44, 22, 5) : ctx.rect(-22, -26, 44, 22);
    ctx.fill();
    ctx.strokeStyle = '#7d8290'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    ctx.restore();

    // ---- HP bar ----
    if (this.vulnerable || this.hp > 0) {
      const bw = 120;
      const bx = cx - bw / 2, by = this.y - 16;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(bx - 3, by - 3, bw + 6, 13);
      ctx.fillStyle = '#3b1024';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = this.hp > 6 ? '#ff4d6d' : '#ffd93d';
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), 7);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(bx - 3, by - 3, bw + 6, 13);
    }
  }
}
