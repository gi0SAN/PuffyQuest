/* ============================================================
   abilities.js — copy ability definitions + firing logic
   Powers are UNLIMITED (no energy bar). Hold crouch (↓) and tap
   Z to throw the copy ability away.
   ============================================================ */
const ABILITIES = {
  fire:  { name: 'FIRE',  icon: '🔥', color: '#ff6a2b' },
  beam:  { name: 'BEAM',  icon: '⚡', color: '#ffd21e' },
  sword: { name: 'SWORD', icon: '⚔',  color: '#7ad0ff' }
};

/**
 * Fire the held ability. Returns true if it was used.
 * Called from Player when X is pressed.
 */
function useAbility(p, Game) {
  const def = ABILITIES[p.ability];
  if (!def) return false;

  p.actCooldown = 14;
  p.recoil = 6;
  Sfx.ability();

  const dir = p.facing;
  const mx = dir > 0 ? p.x + p.w + 6 : p.x - 6;
  const my = p.y + 12;

  if (p.ability === 'fire') {
    Game.shots.push(new Projectile({
      kind: 'fire', owner: 'player', dmg: 1,
      x: mx, y: my, w: 16, h: 14,
      vx: dir * 7.5, vy: 0, life: 90,
      color: '#ff8c2b', trail: '#ffd98a'
    }));
    for (let i = 0; i < 6; i++)
      Game.burst(mx + dir * i * 5, my + (i % 2 ? -3 : 3), '#ff8c2b',
        { speed: 2, life: 14, grav: -0.03 });

  } else if (p.ability === 'beam') {
    /* ---- laser bolt: fast, pierces everything, pops on walls ---- */
    Game.shots.push(new Projectile({
      kind: 'beam', owner: 'player', dmg: 1, pierce: true,
      x: mx, y: my, w: 52, h: 13,
      vx: dir * 16, vy: 0, life: 64,
      color: '#ffe95c', trail: '#fff7b0'
    }));
    for (let i = 0; i < 8; i++)
      Game.burst(mx + dir * i * 6, my, '#ffe95c', { speed: 3, life: 14 });

  } else if (p.ability === 'sword') {
    /* ---- melee swing (short reach, high rate) ---- */
    p.swordT = 16;
    Game.shots.push(new Projectile({
      kind: 'sword', owner: 'player', dmg: 1, pierce: true,
      x: dir > 0 ? p.x + p.w + 20 : p.x - 20, y: p.y + 14,
      w: 40, h: 28, vx: 0, vy: 0, life: 8, dieOnTile: false
    }));
    /* ---- plus a crescent wave that flies off the blade ---- */
    Game.shots.push(new Projectile({
      kind: 'crescent', owner: 'player', dmg: 1, pierce: true,
      x: mx + dir * 30, y: p.y + 8, w: 46, h: 46,
      vx: dir * 9.5, vy: 0, life: 60,
      color: '#7ad0ff'
    }));
    for (let i = 0; i < 7; i++)
      Game.burst(mx + dir * i * 5, my - 4, '#cfefff', { speed: 3, life: 16 });
  }

  return true;
}
