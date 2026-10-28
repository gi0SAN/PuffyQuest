/* ============================================================
   physics.js — gravity, AABB tile collision, hazards, helpers
   ============================================================ */
const GRAVITY    = 0.5;
const MAX_FALL   = 12;
const FLOAT_G    = 0.1;   // gravity while holding jump = floating
const FLOAT_MAX  = 2.0;   // terminal velocity while floating

const Phys = {

  solid(ch) { return ch === '#' || ch === 'I'; },

  /** move entity by vx/vy, resolving against solid tiles on each axis */
  move(e, level) {
    e.x += e.vx;
    this.resolve(e, level, 'x');
    const wasAir = !e.onGround;
    e.onGround = false;
    e.y += e.vy;
    this.resolve(e, level, 'y');
    if (wasAir && e.onGround && e.onLand) e.onLand();
  },

  resolve(e, level, axis) {
    const t = level.ts;
    for (let guard = 0; guard < 16; guard++) {
      const x0 = Math.floor(e.x / t);
      const x1 = Math.floor((e.x + e.w - 1) / t);
      const y0 = Math.floor(e.y / t);
      const y1 = Math.floor((e.y + e.h - 1) / t);
      let hit = false;

      for (let ty = y0; ty <= y1 && !hit; ty++) {
        for (let tx = x0; tx <= x1 && !hit; tx++) {
          if (!this.solid(level.get(tx, ty))) continue;
          if (axis === 'x') {
            if (e.vx > 0)      e.x = tx * t - e.w;
            else if (e.vx < 0) e.x = (tx + 1) * t;
            else continue;
            e.vx = 0;
          } else {
            if (e.vy > 0)      { e.y = ty * t - e.h; e.onGround = true; e.vy = 0; }
            else if (e.vy < 0)  e.y = (ty + 1) * t;
            else continue;
            if (e.vy !== 0) e.vy = 0;
          }
          hit = true;
        }
      }
      if (!hit) break;
    }
  },

  /** does this rect overlap a specific tile char? */
  touchesChar(e, level, ch) {
    const t = level.ts;
    const x0 = Math.floor(e.x / t), x1 = Math.floor((e.x + e.w - 1) / t);
    const y0 = Math.floor(e.y / t), y1 = Math.floor((e.y + e.h - 1) / t);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (level.get(tx, ty) === ch) return true;
    return false;
  },

  /** the tile directly under the entity's feet */
  footChar(e, level) {
    const t = level.ts;
    const y = Math.floor((e.y + e.h + 2) / t);
    const cx = Math.floor((e.x + e.w / 2) / t);
    return level.get(cx, y);
  },

  /** tile in front of the entity (for ledge / wall turning) */
  frontChar(e, level, dir) {
    const t = level.ts;
    const x = Math.floor((dir > 0 ? e.x + e.w + 3 : e.x - 3) / t);
    const cy = Math.floor((e.y + e.h / 2) / t);
    return level.get(x, cy);
  },

  belowFront(e, level, dir) {
    const t = level.ts;
    const x = Math.floor((dir > 0 ? e.x + e.w + 4 : e.x - 4) / t);
    const y = Math.floor((e.y + e.h + 4) / t);
    return level.get(x, y);
  },

  hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  center(e) { return { x: e.x + e.w / 2, y: e.y + e.h / 2 }; }
};
