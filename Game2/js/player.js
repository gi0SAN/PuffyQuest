/* ============================================================
   player.js — Puffy: movement, jump, float, crouch, slide,
               inhale / spit / swallow and copy abilities
   ============================================================ */

const JUMP_V = -10.6;

class Player {
  constructor(x, y) {
    this.w = 24; this.h = 30;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;

    this.maxHp = 6;
    this.hp = 6;
    this.invuln = 0;

    this.crouch = false;
    this.slideT = 0;
    this.floating = false;
    this.inhaling = false;
    this.inhaleT = 0;
    this.actCooldown = 0;
    this.recoil = 0;
    this.swordT = 0;         // frames left in the sword swing pose
    this.droppedPow = false; // released a power with crouch+Z this frame

    this.stored = null;      // { type:'enemy', cls, copy } | { type:'shot' }
    this.ability = null;     // 'fire' | 'beam' | 'sword'  (unlimited uses)

    this.dead = false;
    this.deathT = 0;
    this.t = 0;
    this.step = 0;
  }

  /* -------------------------------------------------------- */
  hurtBox() { return { x: this.x + 2, y: this.y + 3, w: this.w - 4, h: this.h - 5 }; }

  mouth() {
    return {
      x: this.x + this.w / 2 + this.facing * (this.w / 2 + 2),
      y: this.y + (this.crouch ? 9 : 13)
    };
  }

  cone() {
    const w = 68, h = 42;
    return {
      x: this.facing > 0 ? this.x + this.w - 8 : this.x - w + 8,
      y: this.y - 8,
      w, h
    };
  }

  low() { return this.crouch || this.slideT > 0; }

  setHeight(h, level) {
    if (h === this.h) return;
    this.y += (this.h - h);
    this.h = h;
    if (level && this.h === 30 && Phys.touchesChar({ x: this.x, y: this.y, w: this.w, h: 30 }, level, '#')) {
      this.y -= (30 - 18); this.h = 18;   // no head room, stay down
    }
  }

  /* -------------------------------------------------------- */
  update(Game) {
    this.t++;
    if (this.dead) { this.updateDeath(Game); return; }

    const level = Game.level;
    if (this.invuln > 0) this.invuln--;
    if (this.actCooldown > 0) this.actCooldown--;
    if (this.slideT > 0) this.slideT--;
    if (this.recoil > 0) this.recoil--;
    if (this.swordT > 0) this.swordT--;

    const onIce = Phys.footChar(this, level) === 'I';

    /* ---------- swallow (press ↓ with a full mouth) ---------- */
    if (this.stored && Input.downPress() && this.slideT <= 0) this.swallow(Game);

    /* ---------- crouch + Z: throw the copy power away ---------- */
    /* checked before crouch/slide so holding ↓ never turns into a slide */
    this.droppedPow = false;
    if (Input.dropPress() && Input.down() && this.onGround && this.ability &&
        !this.inhaling && this.slideT <= 0) {
      this.dropAbility(Game);
      this.crouch = true;
      this.droppedPow = true;             // don't also jump on this same press
    }

    /* ---------- crouch / slide ---------- */
    if (this.onGround && Input.down() && this.slideT <= 0) {
      if (!this.crouch && Math.abs(this.vx) > 2.2) this.startSlide(Game);
      this.crouch = true;
    } else if (this.crouch && this.canStand(level)) {
      this.crouch = false;
    }
    this.setHeight(this.low() ? 18 : 30, level);

    /* ---------- horizontal ---------- */
    const sliding = this.slideT > 0;
    const wantL = Input.left(), wantR = Input.right();

    if (sliding) {
      this.vx *= onIce ? 0.995 : 0.965;
      if (Math.abs(this.vx) < 0.35) { this.vx = 0; this.slideT = 0; }
    } else if (this.inhaling) {
      this.vx *= 0.62;                                  // rooted while sucking
      if (Math.abs(this.vx) < 0.15) this.vx = 0;
    } else if (this.crouch && this.onGround) {
      this.vx *= 0.6;
    } else {
      const acc = this.onGround ? (onIce ? 0.14 : 0.46) : (onIce ? 0.12 : 0.30);
      const fric = this.onGround ? (onIce ? 0.02 : 0.42) : 0.05;
      if (wantL && !wantR)      { this.vx -= acc; this.facing = -1; }
      else if (wantR && !wantL) { this.vx += acc; this.facing = 1; }
      else { this.vx *= (1 - fric); if (Math.abs(this.vx) < 0.06) this.vx = 0; }
      const max = onIce ? 3.6 : 3.4;
      this.vx = Math.max(-max, Math.min(max, this.vx));
    }

    /* ---------- jump & float ---------- */
    if (Input.jumpPress() && this.onGround && !this.inhaling && this.slideT <= 0 &&
        !this.droppedPow) {
      this.vy = JUMP_V;
      this.onGround = false;
      this.floating = false;
      Sfx.jump();
      for (let i = 0; i < 6; i++)
        Game.burst(this.x + this.w / 2, this.y + this.h, '#ffffff', { speed: 2, life: 14, grav: 0.02 });
    }

    const jumpHeld = Input.jump() && !this.inhaling && this.slideT <= 0;
    if (jumpHeld && !this.onGround && this.vy >= 0 && !this.floating) {
      this.floating = true;
      this.vy = -2.7;                                   // one cheek-puff lift
      Sfx.float();
      for (let i = 0; i < 5; i++)
        Game.burst(this.x + this.w / 2 + (Math.random() - 0.5) * 20,
                   this.y + this.h - 6, '#ffd7ec', { speed: 1.6, life: 20, grav: 0 });
    }
    if (!jumpHeld || this.onGround) this.floating = false;

    if (this.floating) { this.vy += FLOAT_G; this.vy = Math.min(this.vy, FLOAT_MAX); }
    else               { this.vy += GRAVITY; this.vy = Math.min(this.vy, MAX_FALL); }

    /* ---------- move ---------- */
    Phys.move(this, level);
    if (this.onGround) { this.floating = false; this.step += Math.abs(this.vx); }

    /* ---------- action button ---------- */
    if (Input.actPress()) {
      if (this.stored) this.spit(Game);
      else if (this.ability) useAbility(this, Game);
    }

    const wasInhaling = this.inhaling;
    this.inhaling = Input.act() && !this.stored &&
                    this.actCooldown <= 0 && this.slideT <= 0;
    if (this.inhaling && !wasInhaling) Sfx.inhale();

    /* ---------- inhale interaction ---------- */
    this.doInhale(Game);

    /* ---------- hazards, goal, world edges ---------- */
    this.checkHazards(Game);
  }

  /* -------------------------------------------------------- */
  startSlide(Game) {
    this.slideT = 26;
    this.vx = this.facing * Math.max(Math.abs(this.vx), 3.6);
    Sfx.puff();
    Game.shake = Math.max(Game.shake, 3);
    for (let i = 0; i < 8; i++)
      Game.burst(this.x + this.w / 2 - this.facing * 10, this.y + this.h, '#ffffff', { speed: 2.5, life: 16 });
  }

  canStand(level) {
    const box = { x: this.x, y: this.y + this.h - 30, w: this.w, h: 30 };
    return !Phys.touchesChar(box, level, '#') && !Phys.touchesChar(box, level, 'I');
  }

  /* ---------------- inhaling ---------------- */
  doInhale(Game) {
    if (!this.inhaling) { this.inhaleT = 0; this.pullShots(Game, false); return; }
    this.inhaleT++;
    if (this.inhaleT % 9 === 0) Sfx.inhale();

    const cone = this.cone();
    for (const e of Game.enemies) {
      if (e.dead || e.state === 'pull') continue;
      if (Phys.hit(cone, e)) e.beginPull();
    }
    this.pullShots(Game, true);

    // swirling dust
    if (this.inhaleT % 3 === 0) {
      const m = this.mouth();
      Game.parts.push(particle(m.x, m.y + (Math.random() - 0.5) * 30, '#ffffff',
        { vx: -this.facing * 3, vy: 0, life: 14, size: 3, grav: 0 }));
    }
  }

  pullShots(Game, on) {
    const cone = this.cone();
    if (on) {
      for (const s of Game.shots) {
        if (s.dead || s.owner !== 'enemy' || !s.inhaleable || s.pulled) continue;
        if (Phys.hit(cone, s)) s.pulled = true;
      }
    }
    for (const s of Game.shots) {
      if (!s.pulled || s.dead) continue;
      if (!on) { s.pulled = false; continue; }
      const m = this.mouth();
      const dx = m.x - (s.x + s.w / 2), dy = m.y - (s.y + s.h / 2);
      const d = Math.hypot(dx, dy) || 1;
      s.x += (dx / d) * 5; s.y += (dy / d) * 5;
      if (d < 22) {
        if (this.stored) { s.pulled = false; continue; }
        this.stored = { type: 'shot' };
        this.actCooldown = 6;
        s.dead = true;
        Sfx.puff();
        Game.tipOnce('shot', 'PRESS X TO SPIT IT BACK!', 2600);
      }
    }
  }

  captureEnemy(e, Game) {
    if (this.stored) return false;
    this.stored = { type: 'enemy', cls: e.cls, copy: e.copy };
    this.actCooldown = 6;
    Sfx.puff();
    const m = this.mouth();
    for (let i = 0; i < 8; i++)
      Game.burst(m.x, m.y, '#ffd7ec', { speed: 2.5, life: 16 });
    if (e.copy) Game.tipOnce('swallow', 'PRESS ↓ TO SWALLOW & LEARN ' + ABILITIES[e.copy].name + '!', 3000);
    else        Game.tipOnce('spit', 'PRESS X TO SPIT IT OUT  ·  ↓ TO SWALLOW', 3000);
    return true;
  }

  swallow(Game) {
    const s = this.stored;
    this.stored = null;
    this.actCooldown = 8;
    this.crouch = true;
    const m = this.mouth();

    if (s.type === 'shot') {
      Sfx.swallow(); Game.addScore(50);
      for (let i = 0; i < 8; i++) Game.burst(m.x, m.y, '#fff', { speed: 2.5, life: 18 });
      return;
    }
    if (s.copy) {
      const first = this.ability !== s.copy;
      this.ability = s.copy;
      Sfx.copy();
      Game.showAbility(s.copy);
      for (let i = 0; i < 16; i++)
        Game.burst(m.x, m.y, ABILITIES[s.copy].color, { speed: 3.5, life: 26, star: i < 5 });
      if (first) Game.tipOnce('use', 'PRESS X TO USE ' + ABILITIES[s.copy].name + '!', 2800);
    } else {
      Sfx.swallow(); Game.addScore(100);
      for (let i = 0; i < 8; i++) Game.burst(m.x, m.y, '#ffe28a', { speed: 2.5, life: 18 });
    }
  }

  dropAbility(Game) {
    const name = this.ability ? ABILITIES[this.ability].name : '';
    if (!name) return;
    this.ability = null;
    this.recoil = 12;
    Sfx.loseAbility();
    Game.pushTip(name + ' THROWN AWAY!', 1400);
    for (let i = 0; i < 10; i++)
      Game.burst(this.x + this.w / 2, this.y + 12, '#ffffff', { speed: 3, life: 20, star: i < 3 });
  }

  spit(Game) {
    const s = this.stored;
    this.stored = null;
    this.actCooldown = 12;
    this.recoil = 8;
    const m = this.mouth();
    Game.shots.push(new Projectile({
      kind: 'star', owner: 'player', dmg: 1,
      x: m.x, y: m.y, w: 17, h: 17,
      vx: this.facing * 11.5, vy: -0.5,
      life: 160, spin: 0.35, color: '#ffffff'
    }));
    Sfx.spit();
    for (let i = 0; i < 7; i++)
      Game.burst(m.x, m.y, '#ffffff', { speed: 3, life: 16 });
    if (s.type === 'enemy') Game.addScore(0);
  }

  /* ---------------- damage / death ---------------- */
  takeDamage(amount, fromX, Game) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= amount;
    this.invuln = 48;
    this.crouch = false;
    this.slideT = 0;
    this.inhaling = false;
    this.floating = false;
    this.vx = (this.x + this.w / 2 < fromX ? -3.4 : 3.4);
    this.vy = -4.6;
    Sfx.hurt();
    UI.hurtFlash();

    if (this.ability) {                       // classic: you lose your copy
      this.ability = null;
      Sfx.loseAbility();
      for (let i = 0; i < 10; i++)
        Game.burst(this.x + this.w / 2, this.y + 12, '#ffffff', { speed: 3, life: 20, star: i < 3 });
    }

    if (this.hp <= 0) { this.hp = 0; this.die(Game); }
    else for (let i = 0; i < 10; i++)
      Game.burst(this.x + this.w / 2, this.y + 12, '#ff5c7a', { speed: 3, life: 20 });
  }

  heal(amount, Game) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp > before;
  }

  die(Game) {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
    this.stored = null;
    this.ability = null;
    this.inhaling = false;
    this.vx = 0; this.vy = -9.5;
    Sfx.die();
    Game.onPlayerDeath();
  }

  updateDeath(Game) {
    this.deathT++;
    this.vy += 0.42;
    this.y += this.vy;
    this.facing = this.deathT % 20 < 10 ? 1 : -1;
  }

  /* ---------------- world interaction ---------------- */
  checkHazards(Game) {
    const level = Game.level;

    // spikes
    const box = this.hurtBox();
    if (Phys.touchesChar(box, level, '^')) this.takeDamage(3, this.x + this.w / 2 + (this.vx || 1), Game);

      // fell out of the world (bottomless pit)
    if (this.y + this.h > level.pxH + 4) { this.hp = 0; this.die(Game); }

    // boss arena lock
    if (Game.bossActive) {
      const a = level.arenaRect();
      if (a && this.x < a.x + 4) { this.x = a.x + 4; if (this.vx < 0) this.vx = 0; }
    }
  }

  /* ---------------- drawing ---------------- */
  draw(ctx) {
    if (this.invuln > 0 && !this.dead && Math.floor(this.t / 3) % 2 === 0) return;

    const cx = this.x + this.w / 2;
    const bottom = this.y + this.h;
    ctx.save();
    ctx.translate(cx, bottom);

    if (this.dead) ctx.rotate(Math.sin(this.deathT * 0.12) * 0.5);
    if (this.facing < 0) ctx.scale(-1, 1);

    // squash & stretch
    let sx = 1, sy = 1;
    if (!this.onGround && !this.dead) {
      if (this.floating) { sx = 1.12; sy = 0.94; }
      else if (this.vy < 0) { sx = 0.9; sy = 1.14; }
      else { sx = 1.06; sy = 0.97; }
    }
    if (this.low()) { sy = 0.6; sx = 1.18; }
    if (this.recoil > 0) { sx += 0.14; sy -= 0.06; }
    if (this.inhaling) { sx = 1 + Math.sin(this.inhaleT * 0.6) * 0.05; sy = 1.02; }
    ctx.scale(sx, sy);

    const H = this.low() ? 18 : 30;   // un-scaled reference height

    // ---- feet ----
    const run = this.onGround && Math.abs(this.vx) > 0.4 ? Math.sin(this.step * 0.18) : 0;
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.ellipse(-6 + run * 4, -1, 8, 5, -0.2, 0, 7);
    ctx.ellipse(7 - run * 4, -1, 8, 5, 0.2, 0, 7);
    ctx.fill();

    // ---- arms ----
    ctx.fillStyle = '#ff8fc0';
    const armY = -H * 0.55;
    const armA = this.floating ? -0.9 : (this.inhaling ? 0.2 : Math.sin(this.t * 0.12) * 0.2);
    ctx.save(); ctx.translate(-13, armY); ctx.rotate(armA + 2.6);
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(13, armY); ctx.rotate(-armA - 2.6);
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, 7); ctx.fill(); ctx.restore();

    // ---- body: flat two-tone shading, the way sprite art does it ----
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, -H * 0.5, 14, H * 0.5, 0, 0, 7); ctx.clip();
    ctx.fillStyle = '#ff9ecb';
    ctx.fillRect(-16, -H - 2, 32, H + 4);
    ctx.fillStyle = '#ffcbe6';                      // highlight
    ctx.beginPath(); ctx.ellipse(-5, -H * 0.7, 10, H * 0.27, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f87cb2';                      // shadow band
    ctx.fillRect(-16, -H * 0.22, 32, H * 0.22 + 2);
    ctx.restore();

    const eyeY = -H * 0.68;
    const openMouth = this.inhaling || this.recoil > 0 || (this.stored && this.stored.type === 'shot');

    if (this.dead) {
      // X_X eyes
      ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      [-6, 6].forEach(ex => {
        ctx.beginPath();
        ctx.moveTo(ex - 3, eyeY - 3); ctx.lineTo(ex + 3, eyeY + 3);
        ctx.moveTo(ex + 3, eyeY - 3); ctx.lineTo(ex - 3, eyeY + 3);
        ctx.stroke();
      });
    } else {
      // eyes
      [-6, 6].forEach(ex => {
        ctx.fillStyle = '#2b2140';
        ctx.beginPath(); ctx.ellipse(ex, eyeY, 3.4, this.low() ? 4 : 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#4aa8ff';
        ctx.beginPath(); ctx.ellipse(ex, eyeY + 2.2, 3, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex - 1.2, eyeY - 2, 1.4, 0, 7); ctx.fill();
      });
    }

    // ---- mouth / cheeks ----
    const mouthY = -H * 0.33;
    if (this.inhaling) {
      ctx.fillStyle = '#6e1a3f';
      ctx.beginPath(); ctx.ellipse(11, mouthY, 9, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath(); ctx.ellipse(9, mouthY + 4, 5, 5, 0, 0, 7); ctx.fill();
    } else if (this.stored) {
      // puffed cheeks!
      ctx.fillStyle = '#ffb9d8';
      ctx.beginPath();
      ctx.ellipse(-13, mouthY - 2, 7, 7, 0, 0, 7);
      ctx.ellipse(13, mouthY - 2, 7, 7, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#e8629b'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(-13, mouthY - 2, 7, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(13, mouthY - 2, 7, 0, 7); ctx.stroke();
      ctx.fillStyle = '#6e1a3f';
      ctx.beginPath(); ctx.ellipse(4, mouthY, 3.4, 3.4, 0, 0, 7); ctx.fill();
    } else if (openMouth) {
      ctx.fillStyle = '#6e1a3f';
      ctx.beginPath(); ctx.ellipse(6, mouthY, 5, 5.5, 0, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = '#a83e6c'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(4, mouthY - 1, 4, 0.25, Math.PI - 0.45); ctx.stroke();
    }

    // ---- blush ----
    ctx.fillStyle = 'rgba(255,92,150,.55)';
    ctx.beginPath();
    ctx.ellipse(-10, mouthY - 6, 4.5, 2.8, 0, 0, 7);
    ctx.ellipse(12, mouthY - 6, 4.5, 2.8, 0, 0, 7);
    ctx.fill();

    // ---- copy sword: Puffy actually pulls out a blade ----
    if (this.ability === 'sword' && !this.dead) this.drawSword(ctx, H);

    ctx.restore();

    /* ---- inhale wind ---- */
    if (this.inhaling) this.drawInhale(ctx);

    /* ---- copy ability aura ---- */
    if (this.ability) {
      const def = ABILITIES[this.ability];
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 0.2) * 0.15;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, this.y + this.h / 2, 24 + Math.sin(this.t * 0.2) * 3, 0, 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* the SWORD copy: a real blade in Puffy's hand (local space, +x = facing) */
  drawSword(ctx, H) {
    // snap between "ready" and "swung" poses - chunky, on purpose
    const ang = this.swordT > 9 ? 1.5 : (this.swordT > 0 ? 1.1 : 0.52);
    ctx.save();
    ctx.translate(14, -H * 0.6);
    ctx.rotate(ang);

    // grip
    ctx.fillStyle = '#6b3f1c';
    ctx.fillRect(-2.5, -2, 5, 14);
    // pommel
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(-3.5, 11, 7, 4);
    // guard
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(-7.5, -6, 15, 5);
    ctx.fillStyle = '#e0a800';
    ctx.fillRect(-7.5, -2, 15, 2);
    // blade
    ctx.fillStyle = '#eaf7ff';
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, -40);
    ctx.lineTo(0, -48);
    ctx.lineTo(-4, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5b8fb5'; ctx.lineWidth = 1.2;
    ctx.stroke();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(-1.5, -39, 1.8, 32);
    ctx.restore();
  }

  drawInhale(ctx) {
    const m = this.mouth();
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(this.facing, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const off = ((this.inhaleT * 7 + i * 22) % 66);
      const a = 1 - off / 66;
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = 2 + i * 0.4;
      ctx.beginPath();
      const y = (i - 1.5) * 11;
      ctx.arc(64 - off, y * (1 - off / 200), 10, -1.1, 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }
}
