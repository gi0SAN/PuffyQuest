/* ============================================================
   entities.js — projectiles, pickups and particles
   ============================================================ */

/* ---------------------------------------------------------- */
class Projectile {
  constructor(o) {
    Object.assign(this, {
      kind: 'star', owner: 'player', dmg: 1,
      x: 0, y: 0, w: 14, h: 14, vx: 0, vy: 0,
      life: 120, grav: 0, pierce: false, dieOnTile: true,
      inhaleable: false, color: '#fff', trail: null,
      rot: 0, spin: 0, dead: false, t: 0
    }, o);
    this.x -= this.w / 2;
    this.y -= this.h / 2;
  }

  update(Game) {
    this.t++;

    // being sucked toward Puffy's mouth — the player drives the motion
    if (this.pulled) {
      this.life--;
      if (this.life <= 0) this.dead = true;
      return;
    }

    this.life--;
    if (this.life <= 0) { this.pop(Game); return; }

    if (this.kind === 'shock') {
      const level = Game.level;
      this.x += this.vx;
      const below = Phys.footChar(this, level);
      if (Phys.solid(below)) { this.y = Math.floor((this.y + this.h + 2) / level.ts) * level.ts - this.h; this.vy = 0; }
      else { this.vy = Math.min(this.vy + 0.5, 10); this.y += this.vy; }
      if (this.hitsTile(Game.level)) { this.pop(Game); return; }
    } else {
      this.vy += this.grav;
      this.x += this.vx;
      this.y += this.vy;
      this.rot += this.spin;
      if (this.dieOnTile && this.hitsTile(Game.level)) { this.pop(Game); return; }
    }

    // trailing sparkle
    if (this.trail && this.t % 2 === 0)
      Game.parts.push(particle(this.x + this.w / 2, this.y + this.h / 2,
        this.trail, { vx: 0, vy: 0, life: 12, size: 3 }));

    // ---- vs player ----
    if (this.owner !== 'player' && Game.player && !Game.player.dead) {
      if (Phys.hit(this, Game.player.hurtBox())) {
        Game.player.takeDamage(this.dmg, this.x + this.w / 2, Game);
        this.pop(Game); return;
      }
    }

    // ---- vs enemies / boss ----
    if (this.owner === 'player' && !this.pierce) {
      for (const e of Game.enemies) {
        if (e.dead || e.state === 'pull') continue;
        if (Phys.hit(this, e)) { e.hurt(this.dmg, Game); this.pop(Game); return; }
      }
      const b = Game.boss;
      if (b && !b.dead && b.vulnerable && Phys.hit(this, b)) {
        b.hurt(this.dmg, Game, this.x + this.w / 2);
        this.pop(Game); return;
      }
    } else if (this.owner === 'player' && this.pierce) {
      if (!this.hitSet) this.hitSet = new Set();
      for (const e of Game.enemies) {
        if (e.dead || e.state === 'pull' || this.hitSet.has(e)) continue;
        if (Phys.hit(this, e)) { e.hurt(this.dmg, Game); this.hitSet.add(e); }
      }
      const b = Game.boss;
      if (b && !b.dead && b.vulnerable && !this.hitSet.has(b) && Phys.hit(this, b)) {
        b.hurt(this.dmg, Game, this.x + this.w / 2);
        this.hitSet.add(b);
      }
    }
  }

  hitsTile(level) {
    if (this.kind === 'sword' || this.kind === 'crescent') return false;
    return Phys.touchesChar(this, level, '#') || Phys.touchesChar(this, level, 'I');
  }

  pop(Game) {
    if (this.dead) return;
    this.dead = true;
    const n = this.kind === 'shock' ? 4 : 5;
    for (let i = 0; i < n; i++)
      Game.burst(this.x + this.w / 2, this.y + this.h / 2, this.color, { speed: 2.5, life: 14 });
  }

  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rot);

    if (this.kind === 'star') {
      drawStar(ctx, 0, 0, this.w * 0.55, '#ffffff', '#dcd6ff');
    } else if (this.kind === 'fire') {
      const r = this.w * (0.6 + 0.25 * Math.sin(this.t * 0.7));
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
      g.addColorStop(0, '#fff6b0'); g.addColorStop(.5, '#ff9d2e'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    } else if (this.kind === 'beam') {
      /* laser bolt — bright core, hot glow, stretched along travel */
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff7b0';
      ctx.beginPath(); ctx.ellipse(0, 0, this.w / 2 + 3, this.h / 2 + 3, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-this.w / 2 + 2, -1.5, this.w - 4, 3);
    } else if (this.kind === 'crescent') {
      /* sword wave — a bold crescent whose convex edge leads the travel */
      if (this.vx < 0) ctx.scale(-1, 1);
      const R = this.h / 2, r = R * 0.92, d = R * 0.55;
      const wave = () => {
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, 7);
        ctx.arc(-d, 0, r, 0, 7, true);
        ctx.closePath();
      };
      ctx.fillStyle = this.color;
      wave(); ctx.fill();
      ctx.strokeStyle = '#2b6fb8'; ctx.lineWidth = 2.5;
      wave(); ctx.stroke();                       // navy rim so it reads on sky
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R - 3.5, -1.0, 1.0); ctx.stroke();
    } else if (this.kind === 'sword') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 6, this.w * 0.42, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = this.color; ctx.lineWidth = 9; ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.arc(0, 6, this.w * 0.42, -1.2, 1.2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (this.kind === 'eshot') {
      ctx.fillStyle = '#ffe95c';
      ctx.beginPath(); ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9a200'; ctx.lineWidth = 2; ctx.stroke();
    } else if (this.kind === 'cutter') {
      ctx.rotate(this.t * 0.4);
      ctx.fillStyle = '#cfe9ff';
      ctx.beginPath(); ctx.arc(0, 0, this.w / 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a7fb5'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#7ad0ff';
      ctx.beginPath(); ctx.arc(0, 0, this.w / 5, 0, 7); ctx.fill();
    } else if (this.kind === 'icing') {
      drawStar(ctx, 0, 0, this.w * 0.6, '#fff2f8', '#ff9ecb');
    } else if (this.kind === 'shock') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.moveTo(-this.w / 2, this.h / 2);
      ctx.lineTo(0, -this.h / 2); ctx.lineTo(this.w / 2, this.h / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------------------------------------------------------- */
class Item {
  constructor(kind, x, y) {
    this.kind = kind;                 // 'apple' | 'cake' | 'oneup'
    this.w = 22; this.h = 22;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.t = Math.random() * 60;
    this.baseY = this.y;
  }
  update(Game) {
    this.t++;
    Phys.move(this, Game.level);          // stays put, just bobs visually
    if (Phys.hit(this, Game.player)) {
      this.dead = true;
      Game.player.heal(this.kind === 'cake' ? 3 : 1, Game);
      if (this.kind === 'oneup') Game.addLife();
      Sfx[this.kind === 'oneup' ? 'oneUp' : 'heal']();
      Game.addScore(this.kind === 'oneup' ? 0 : 50);
      for (let i = 0; i < 12; i++)
        Game.burst(this.x + 11, this.y + 11, this.kind === 'oneup' ? '#7dff8a' : '#ff8fb0', { speed: 3, life: 22 });
    }
  }
  draw(ctx) {
    const bx = this.x + this.w / 2;
    const by = this.y + this.h / 2 + Math.sin(this.t * 0.09) * 3;
    ctx.save(); ctx.translate(bx, by);

    if (this.kind === 'apple') {
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.arc(-4, 2, 8, 0, 7); ctx.arc(4, 2, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b3f1d'; ctx.fillRect(-1, -10, 3, 7);
      ctx.fillStyle = '#57c442';
      ctx.beginPath(); ctx.ellipse(6, -7, 6, 3.5, -0.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(-5, -1, 2.4, 0, 7); ctx.fill();
    } else if (this.kind === 'cake') {
      ctx.fillStyle = '#f7e3c2';
      ctx.beginPath(); ctx.moveTo(-11, 9); ctx.lineTo(11, 9); ctx.lineTo(8, -3); ctx.lineTo(-8, -3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff9ecb';
      ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.lineTo(6, -9); ctx.lineTo(-6, -9);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.arc(0, -12, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#57c442';
      ctx.beginPath(); ctx.ellipse(4, -14, 4, 2, -0.6, 0, 7); ctx.fill();
    } else { // 1-UP
      const s = 1 + Math.sin(this.t * 0.15) * 0.08;
      ctx.scale(s, s);
      drawStar(ctx, 0, 0, 13, '#8dff9b', '#28b34a');
      ctx.fillStyle = '#2b2140';
      ctx.beginPath(); ctx.arc(-4, -1, 2, 0, 7); ctx.arc(4, -1, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 3, 3.4, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------------------------------------------------------- */
function particle(x, y, color, o = {}) {
  const p = Object.assign({
    x, y, color,
    vx: (Math.random() - 0.5) * 3,
    vy: (Math.random() - 0.5) * 3,
    life: 24, size: 4, grav: 0.06, dead: false, star: false
  }, o);
  p.max = p.life;
  return p;
}

function drawStar(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke(); }
}
