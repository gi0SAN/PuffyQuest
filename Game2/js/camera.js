/* ============================================================
   camera.js — smoothed follow camera with bounds / arena lock
   ============================================================ */
const Camera = {
  x: 0, y: 0,
  W: 800, H: 450,
  bounds: null,   // { x, y, w, h }
  lock: null,     // arena rectangle, overrides bounds

  reset(x, y) {
    this.x = x; this.y = y;
    this.lock = null;
    this.clamp();
  },

  follow(px, py) {
    const t = this.lock || this.bounds;
    if (!t) return;
    const tx = px - this.W / 2;
    const ty = py - this.H / 2 - 20;
    this.x += (tx - this.x) * 0.14;
    this.y += (ty - this.y) * 0.11;
    this.clamp();
  },

  clamp() {
    const b = this.lock || this.bounds;
    if (!b) return;
    if (b.w <= this.W) {
      const tx = b.x - (this.W - b.w) / 2;   // ease toward arena centre
      this.x += (tx - this.x) * 0.15;
      if (Math.abs(tx - this.x) < 0.5) this.x = tx;
    } else {
      this.x = Math.max(b.x, Math.min(this.x, b.x + b.w - this.W));
    }

    if (b.h <= this.H) {
      const ty = b.y - (this.H - b.h) / 2;
      this.y += (ty - this.y) * 0.15;
      if (Math.abs(ty - this.y) < 0.5) this.y = ty;
    } else {
      this.y = Math.max(b.y, Math.min(this.y, b.y + b.h - this.H));
    }
  },

  snap(px, py) {
    const b = this.lock || this.bounds;
    if (!b) return;
    this.x = px - this.W / 2;
    this.y = py - this.H / 2 - 20;
    this.clamp();
  },

  // tile range currently visible
  range(ts) {
    return {
      x0: Math.max(0, Math.floor(this.x / ts) - 1),
      y0: Math.max(0, Math.floor(this.y / ts) - 1),
      x1: Math.ceil((this.x + this.W) / ts),
      y1: Math.ceil((this.y + this.H) / ts)
    };
  }
};
