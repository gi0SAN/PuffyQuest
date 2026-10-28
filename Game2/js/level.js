/* ============================================================
   level.js — chunk authoring helpers + tile-map parser
   ============================================================ */

const CHUNK_W = 25;   // tiles per chunk  (25 * 32 = 800px = one screen)
const CHUNK_H = 16;   // tiles per chunk  (16 * 32 = 512px)

/**
 * Build one 25x16 chunk from a declarative spec.
 *   mk({ ground:13, gchar:'#', pits:[[8,11]], plat:[[10,4,9]],
 *        ice:[[11,0,6]], spikes:[[10,12]], objs:[['P',12,3]] })
 *
 *  ground  first solid row (default 13) -> rows ground..15 are filled
 *  gchar   '#' normal, 'I' slippery ice
 *  pits    [from,to) columns removed from every ground row
 *  plat    [row,from,to) solid row segment
 *  ice     [row,from,to) icy row segment
 *  spikes  [from,to) hazards resting on top of the ground
 *  objs    [char,row,col] entity markers
 */
function mk(o = {}) {
  const g   = o.ground !== undefined ? o.ground : 13;
  const gc  = o.gchar || '#';
  const row = () => '.'.repeat(CHUNK_W);
  const c   = new Array(CHUNK_H).fill(0).map(row);

  for (let r = g; r < CHUNK_H; r++) c[r] = gc.repeat(CHUNK_W);

  const carve = (list, fn) => (list || []).forEach(a => { fn(a); });

  carve(o.pits, ([a, b]) => {
    for (let r = g; r < CHUNK_H; r++) {
      const s = c[r].split('');
      for (let i = a; i < b; i++) if (i >= 0 && i < CHUNK_W) s[i] = '.';
      c[r] = s.join('');
    }
  });

  carve(o.plat, ([r, a, b]) => {
    const s = c[r].split('');
    for (let i = a; i < b; i++) if (i >= 0 && i < CHUNK_W) s[i] = '#';
    c[r] = s.join('');
  });

  carve(o.ice, ([r, a, b]) => {
    const s = c[r].split('');
    for (let i = a; i < b; i++) if (i >= 0 && i < CHUNK_W) s[i] = 'I';
    c[r] = s.join('');
  });

  carve(o.spikes, ([a, b]) => {
    const r = g - 1;
    const s = c[r].split('');
    for (let i = a; i < b; i++) if (i >= 0 && i < CHUNK_W) s[i] = '^';
    c[r] = s.join('');
  });

  carve(o.objs, ([ch, r, col]) => {
    const s = c[r].split('');
    s[col] = ch;
    c[r] = s.join('');
  });

  return c;
}

/** stitch chunks side by side into full level rows */
function build(chunks) {
  const rows = [];
  for (let y = 0; y < CHUNK_H; y++) rows.push(chunks.map(c => c[y]).join(''));
  return rows;
}

/* ============================================================ */
class Level {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.rows = def.rows;
    this.ts = 32;
    this.h = this.rows.length;
    this.w = this.rows[0].length;
    this.pxW = this.w * this.ts;
    this.pxH = this.h * this.ts;
    this.theme = def.theme;
    this.name = def.name;
    this.label = def.label;

    this.spawn = { x: 64, y: 64 };
    this.arena = def.arena || null;      // { x1, x2 } in TILES
    this.goal = null;
    this.bossStart = null;

    this.parse();
  }

  get(tx, ty) {
    if (tx < 0 || tx >= this.w) return '#';   // side walls
    if (ty < 0) return '.';                   // open sky
    if (ty >= this.h) return '.';             // open pit
    return this.rows[ty][tx];
  }

  parse() {
    const enemies = [], items = [];
    const grid = this.rows.map(r => r.split(''));

    const put = (r, c, ch) => {
      if (r >= 0 && r < this.h && c >= 0 && c < this.w) grid[r][c] = ch;
    };

    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const ch = grid[r][c];
        if (ch === '.' || ch === '#' || ch === 'I' || ch === '^') continue;

        if (ch === 'P') {
          this.spawn = { x: c * this.ts + 4, y: (r + 1) * this.ts - 30 };
          put(r, c, '.');
        } else if (ENEMY_TYPES[ch]) {
          enemies.push({ char: ch, col: c, row: r });
          put(r, c, '.');
        } else if (ch === 'F' || ch === 'C' || ch === 'L') {
          items.push({ kind: { F: 'apple', C: 'cake', L: 'oneup' }[ch], col: c, row: r });
          put(r, c, '.');
        } else if (ch === 'G') {
          this.goal = {
            x: c * this.ts - 8, y: (r + 1) * this.ts - 128,
            w: 48, h: 128, active: true, t: 0
          };
          put(r, c, '.');
        } else if (ch === 'O') {
          this.bossStart = { col: c, row: r };
          put(r, c, '.');
        }
      }
    }

    this.rows = grid.map(r => r.join(''));
    this.enemySpawns = enemies;
    this.itemSpawns = items;
  }

  /** pixel rectangle for camera locking (the boss arena) */
  arenaRect() {
    if (!this.arena) return null;
    return {
      x: this.arena.x1 * this.ts,
      y: 0,
      w: (this.arena.x2 - this.arena.x1) * this.ts,
      h: this.pxH
    };
  }
}
