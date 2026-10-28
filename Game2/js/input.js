/* ============================================================
   input.js — keyboard state with edge detection
   ============================================================ */
const Input = (() => {
  const keys = Object.create(null);
  const hit  = Object.create(null);
  const BLOCK = new Set([
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',
    'KeyZ','KeyX','Enter','Escape'
  ]);

  window.addEventListener('keydown', e => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!keys[e.code]) hit[e.code] = true;   // rising edge only
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  return {
    left:        () => !!(keys.ArrowLeft  || keys.KeyA),
    right:       () => !!(keys.ArrowRight || keys.KeyD),
    down:        () => !!(keys.ArrowDown  || keys.KeyS),
    jump:        () => !!(keys.Space || keys.KeyZ || keys.ArrowUp || keys.KeyW),
    jumpPress:   () => !!(hit.Space || hit.KeyZ || hit.ArrowUp || hit.KeyW),
    dropPress:   () => !!(hit.KeyZ || hit.Space),   // throw the copy power away
    act:         () => !!keys.KeyX,
    actPress:    () => !!hit.KeyX,
    downPress:   () => !!(hit.ArrowDown || hit.KeyS),
    leftPress:   () => !!(hit.ArrowLeft || hit.KeyA),
    rightPress:  () => !!(hit.ArrowRight || hit.KeyD),
    confirm:     () => !!(hit.Enter || hit.Space || hit.KeyZ),
    pausePress:  () => !!hit.Escape,
    clearFrame:  () => { for (const k in hit) delete hit[k]; }
  };
})();
