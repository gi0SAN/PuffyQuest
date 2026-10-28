/* ============================================================
   levels.js — the three stages of PUFFY Quest
   ============================================================ */

const THEMES = {
  meadow: {
    mode: 'sky',
    sky: ['#5cbcff', '#c9efff'],
    hillFar: '#a5e393', hillNear: '#6fcf5a',
    top: '#6bdc4c', topEdge: '#49b135',
    body: '#8b5a2b', bodyDark: '#6a4220',
    cloud: '#ffffff'
  },
  cave: {
    mode: 'cave',
    sky: ['#1e1640', '#39296b'],
    hillFar: '#453473', hillNear: '#33265a',
    top: '#63e6ea', topEdge: '#2fa8b8',
    body: '#3d3668', bodyDark: '#2b2550',
    cloud: '#7a6bc4'
  },
  frost: {
    sky: ['#7db8f5', '#e8f5ff'],
    hillFar: '#d4e9ff', hillNear: '#a9cdf2',
    top: '#f2fbff', topEdge: '#bcdcf5',
    body: '#6f8fbf', bodyDark: '#4e6a96',
    cloud: '#ffffff'
  }
};

/* ---------------------------------------------------------------
   LEVEL 1 — GREEN MEADOWS : flat intro, learn to inhale & copy
   --------------------------------------------------------------- */
const LEVEL_1 = {
  name: 'GREEN MEADOWS',
  label: '1-1',
  theme: THEMES.meadow,
  rows: build([
    mk({ objs: [['P', 12, 3]] }),
    mk({ plat: [[10, 8, 13]], objs: [['E', 12, 6], ['F', 12, 20]] }),
    mk({ pits: [[8, 11]], objs: [['E', 12, 18]] }),
    mk({ plat: [[10, 14, 20]], objs: [['D', 12, 5], ['E', 12, 22]] }),
    mk({ spikes: [[10, 12]], plat: [[10, 2, 6]], objs: [['B', 9, 16], ['E', 12, 21]] }),
    mk({ pits: [[6, 9]], plat: [[9, 11, 15]], objs: [['K', 12, 14], ['D', 12, 21]] }),
    mk({ objs: [['G', 12, 14], ['C', 12, 4]] })
  ])
};

/* ---------------------------------------------------------------
   LEVEL 2 — CRYSTAL CAVES : platforms, pits, climbing
   --------------------------------------------------------------- */
const LEVEL_2 = {
  name: 'CRYSTAL CAVES',
  label: '1-2',
  theme: THEMES.cave,
  rows: build([
    mk({ objs: [['P', 12, 3]] }),
    mk({ plat: [[10, 5, 9], [7, 15, 20]], objs: [['D', 12, 7], ['E', 12, 21]] }),
    mk({ pits: [[9, 12]], objs: [['B', 8, 5], ['F', 12, 3]] }),
    mk({ plat: [[11, 3, 7], [9, 11, 16]], objs: [['K', 12, 13], ['E', 12, 20]] }),
    mk({ ground: 11, objs: [['E', 10, 8], ['F', 10, 18]] }),
    mk({ ground: 11, spikes: [[7, 9]], objs: [['D', 10, 15], ['B', 7, 5]] }),
    mk({ ground: 9, pits: [[14, 17]], objs: [['K', 8, 7], ['C', 8, 20]] }),
    mk({ ground: 9, plat: [[8, 4, 7]], objs: [['G', 8, 12], ['L', 7, 5], ['E', 8, 20]] })
  ])
};

/* ---------------------------------------------------------------
   LEVEL 3 — FROST PEAK : ice physics, gauntlet, then the boss
   --------------------------------------------------------------- */
const BOSS_ARENA_START = 9 * CHUNK_W;          // tile where the arena begins
const BOSS_ARENA_END   = 10 * CHUNK_W;         // tile where it ends

const LEVEL_3 = {
  name: 'FROST PEAK',
  label: '1-3',
  theme: THEMES.frost,
  arena: { x1: BOSS_ARENA_START, x2: BOSS_ARENA_END },
  rows: build([
    mk({ objs: [['P', 12, 3]] }),
    mk({ gchar: 'I', objs: [['E', 12, 8], ['F', 12, 20]] }),
    mk({ gchar: 'I', pits: [[7, 10]], plat: [[9, 14, 19]], objs: [['B', 8, 4]] }),
    mk({ gchar: 'I', spikes: [[12, 15]], objs: [['K', 12, 4], ['D', 12, 20]] }),
    mk({ gchar: 'I', ground: 11, objs: [['E', 10, 9], ['B', 7, 16]] }),
    mk({ gchar: 'I', ground: 11, pits: [[8, 11]], objs: [['K', 10, 17], ['F', 10, 3]] }),
    mk({ gchar: 'I', ground: 9, objs: [['D', 8, 8], ['E', 8, 18]] }),
    mk({ ground: 9, spikes: [[4, 7]], pits: [[14, 17]], objs: [['B', 6, 10], ['C', 8, 9]] }),
    mk({ ground: 9, objs: [['E', 8, 5], ['L', 6, 14]] }),
    mk({ ground: 9, objs: [['O', 8, 12]] })
  ])
};

const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];
