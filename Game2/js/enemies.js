/* ============================================================
   enemies.js — enemy roster, AI and rendering
   ============================================================ */

const ENEMY_TYPES = {
  E: { cls: 'waddleDee', w: 24, h: 26, speed: 1.0, hp: 1, copy: null,     score: 100 },
  D: { cls: 'waddleDoo', w: 24, h: 26, speed: 1.1, hp: 1, copy: 'beam',   score: 200 },
  B: { cls: 'bronto',    w: 28, h: 24, speed: 1.4, hp: 1, copy: 'fire',   score: 200 },
  K: { cls: 'kibble',    w: 26, h: 28, speed: 0.9, hp: 1, copy: 'sword',  score: 200 }
};

class Enemy {
  constructor(char, cx, cy) {
    const d = ENEMY_TYPES[char];
    Object.assign(this, d);
    this.char = char;
    this.x = cx * 32 + (32 - this.w) / 2;
    this.y = (cy + 1) * 32 - this.h;
    if (char === 'B') this.y = cy * 32 + 4;

    this.vx = 0; this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.onGround = false;
    this.state = 'walk';        // walk | pull | dead
    this.dead = false;
    this.t = Math.floor(Math.random() * 90);
    this.timer = 40 + Math.floor(Math.random() * 70);
    this.baseY = this.y;
    this.hp = this.hp;
    this.pullT = 0;
    /* patrol zone: every enemy paces back and forth inside it,
       no matter where Puffy is standing */
    this.patrolL = this.x - 96;
    this.patrolR = this.x + 96;
  }

  get box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  /* ---------------- per-frame ---------------- */
  update(Game) {
    this.t++;

    if (this.state === 'pull') { this.updatePull(Game); return; }

    if (this.cls === 'bronto') this.fly(Game);
    else this.walk(Game);

    if (this.dead) return;

    // contact damage
    const p = Game.player;
    if (!p.dead && Phys.hit(this, p.hurtBox()))
      p.takeDamage(2, this.x + this.w / 2, Game);

    if (this.y > Game.level.pxH + 80) this.dead = true;
  }

  walk(Game) {
    const level = Game.level;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);

    // shooters / hoppers get extra behaviour
    if (this.cls === 'waddleDoo') this.shoot(Game);
    if (this.cls === 'kibble')     this.hop(Game);

    this.vx = this.dir * this.speed;
    Phys.move(this, level);

    // turn at walls or ledges, otherwise pace inside its patrol zone
    if (Phys.solid(Phys.frontChar(this, level, this.dir))) this.dir *= -1;
    else if (this.onGround && !Phys.solid(Phys.belowFront(this, level, this.dir))) this.dir *= -1;
    else this.patrolTurn();
  }

  /** reverse at the edges of the patrol zone, so enemies always keep pacing */
  patrolTurn() {
    if (this.x < this.patrolL) this.dir = 1;
    else if (this.x > this.patrolR) this.dir = -1;
  }

  fly(Game) {
    const level = Game.level;
    /* Flyers pace back and forth over their territory instead of beelining
       for Puffy - no more jittering when he stands underneath them. */
    this.vx = this.dir * (this.speed * 1.15);
    const targetY = this.baseY + Math.sin(this.t * 0.055) * 40;
    this.vy = Math.max(-2.4, Math.min(2.4, (targetY - this.y) * 0.07));
    Phys.move(this, level);

    if (Phys.solid(Phys.frontChar(this, level, this.dir))) { this.dir *= -1; this.vx = 0; }
    this.patrolTurn();
    if (this.y < 8) this.y = 8;
    if (this.y + this.h > level.pxH - 4) this.y = level.pxH - 4 - this.h;
  }

  shoot(Game) {
    this.timer--;
    const p = Game.player;
    if (this.timer > 0) return;
    const dx = p.x - this.x, dy = Math.abs((p.y + 15) - (this.y + 13));
    if (Math.abs(dx) > 260 || dy > 46 || p.dead) { this.timer = 30; return; }

    const dir = dx < 0 ? -1 : 1;
    this.dir = dir;
    Game.shots.push(new Projectile({
      kind: 'eshot', owner: 'enemy', dmg: 2,
      x: this.x + this.w / 2 + dir * 14, y: this.y + 13,
      w: 18, h: 12, vx: dir * 4.6, vy: 0, life: 110,
      color: '#ffe95c', dieOnTile: true
    }));
    this.timer = 110;
    Sfx.puff();
  }

  hop(Game) {
    this.timer--;
    const p = Game.player;
    if (this.timer <= 0 && this.onGround) {
      this.vy = -7.5;
      this.timer = 70;
      if (Math.abs(p.x - this.x) < 300 && !p.dead) {
        const dir = p.x < this.x ? -1 : 1;
        this.dir = dir;
        Game.shots.push(new Projectile({
          kind: 'cutter', owner: 'enemy', dmg: 2,
          x: this.x + this.w / 2 + dir * 14, y: this.y + 4,
          w: 18, h: 18, vx: dir * 4.2, vy: -2.4, life: 130,
          grav: 0.14, color: '#cfe9ff', spin: 0.25
        }));
        Sfx.spit();
      }
    }
  }

  /* ---------------- inhale interaction ---------------- */
  beginPull()  { if (this.state === 'walk') { this.state = 'pull'; this.pullT = 0; } }

  updatePull(Game) {
    const p = Game.player;
    const m = p.mouth();
    this.pullT++;
    /* Puffy let go (or got hurt): drop back to the ground and resume patrolling
       right away instead of hanging in the air. */
    if (!p.inhaling || p.dead) {
      this.state = 'walk';
      this.vx = this.dir * this.speed;
      this.vy = 0;
      this.pullT = 0;
      return;
    }
    const dx = m.x - (this.x + this.w / 2);
    const dy = m.y - (this.y + this.h / 2);
    const d = Math.hypot(dx, dy) || 1;
    const spd = 4.4;
    this.x += (dx / d) * spd;
    this.y += (dy / d) * spd;
    this.vx = 0; this.vy = 0;
    // silly spin while being sucked in
    this.t += 3;

    if (d < 24) {
      const ok = p.captureEnemy(this, Game);
      if (ok) this.dead = true;
      else { this.state = 'walk'; this.pullT = 0; }
    }
    if (this.pullT > 160) { this.state = 'walk'; this.pullT = 0; }
  }

  hurt(dmg, Game) {
    if (this.dead || this.state === 'pull') return;
    this.hp -= dmg;
    if (this.hp <= 0) this.die(Game);
  }

  die(Game) {
    this.dead = true;
    Game.addScore(this.score);
    Sfx.kill();
    for (let i = 0; i < 12; i++)
      Game.burst(this.x + this.w / 2, this.y + this.h / 2,
        this.copy ? '#fff' : '#ffe28a', { speed: 3.5, life: 26, star: i < 4 });
  }

  /* ---------------- drawing ---------------- */
  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const pulled = this.state === 'pull';
    const squash = pulled ? 1 + Math.sin(this.t * 0.5) * 0.18 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    if (pulled) ctx.rotate(Math.sin(this.t * 0.4) * 0.35);
    ctx.scale(1 / squash, squash);

    if (this.cls === 'waddleDee') this.drawDee(ctx);
    else if (this.cls === 'waddleDoo') this.drawDoo(ctx);
    else if (this.cls === 'bronto') this.drawBronto(ctx);
    else this.drawKibble(ctx);

    ctx.restore();
  }

  drawDee(ctx) {
    const bob = this.onGround ? Math.sin(this.t * 0.2) * 1.4 : 0;
    ctx.fillStyle = '#f0a13c';
    ctx.beginPath(); ctx.ellipse(0, bob, 12, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.ellipse(-6, 12, 6, 4, -.3, 0, 7); ctx.ellipse(6, 12, 6, 4, .3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -2 + bob, 3, 4.5, 0, 0, 7); ctx.ellipse(4, -2 + bob, 3, 4.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2140';
    ctx.beginPath(); ctx.arc(-4, -1 + bob, 1.7, 0, 7); ctx.arc(4, -1 + bob, 1.7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a35a12'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 4 + bob, 3.4, 0.25, Math.PI - 0.25); ctx.stroke();
  }

  drawDoo(ctx) {
    ctx.fillStyle = '#f0a13c';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 12, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c47a12'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(6, -20, 2, -24); ctx.stroke();
    ctx.fillStyle = '#ffe95c';
    ctx.beginPath(); ctx.arc(2, -25, 4, 0, 7); ctx.fill();
    // one big eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, -2, 7, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2140';
    ctx.beginPath(); ctx.arc(this.dir * 2, -1, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(this.dir * 1 - 1, -3, 1.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.ellipse(-7, 12, 6, 4, -.3, 0, 7); ctx.ellipse(7, 12, 6, 4, .3, 0, 7); ctx.fill();
  }

  drawBronto(ctx) {
    const flap = Math.sin(this.t * 0.35) * 8;
    ctx.save();
    if (this.dir < 0) ctx.scale(-1, 1);
    // wings
    ctx.fillStyle = '#3fa845';
    ctx.beginPath(); ctx.ellipse(-4, -2, 13, 5, -0.5 - flap * 0.05, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = '#57c442';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 11, 0, 0, 7); ctx.fill();
    // belly
    ctx.fillStyle = '#d9f7a8';
    ctx.beginPath(); ctx.ellipse(2, 4, 8, 6, 0, 0, 7); ctx.fill();
    // beak
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(20, 1); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6, -4, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2140'; ctx.beginPath(); ctx.arc(7, -4, 2, 0, 7); ctx.fill();
    ctx.restore();
  }

  drawKibble(ctx) {
    const bob = this.onGround ? 0 : -2;
    ctx.fillStyle = '#6fb7e8';
    ctx.beginPath(); ctx.ellipse(0, bob, 12, 12, 0, 0, 7); ctx.fill();
    // helmet
    ctx.fillStyle = '#bfe3ff';
    ctx.beginPath(); ctx.arc(0, -4 + bob, 13, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#4a7fb5';
    ctx.fillRect(-13, -5 + bob, 26, 4);
    // visor / eye
    ctx.fillStyle = '#2b2140';
    ctx.beginPath(); ctx.ellipse(this.dir * 3, 2 + bob, 4.5, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.dir * 4, 0 + bob, 1.6, 0, 7); ctx.fill();
    // feet
    ctx.fillStyle = '#e63946';
    ctx.beginPath(); ctx.ellipse(-6, 13, 6, 4, -.2, 0, 7); ctx.ellipse(6, 13, 6, 4, .2, 0, 7); ctx.fill();
  }
}
