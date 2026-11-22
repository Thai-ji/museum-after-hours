// keys.js — the keyboard becomes one intent object per simulation step.
// Nothing here knows about the rules, and the rules never touch the DOM.
export function attachKeys() {
  const down = new Set();
  let wantBuy = null;

  const norm = e => e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();

  addEventListener('keydown', e => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    down.add(norm(e));
    const bought = { '1': 'crowbar', '2': 'flash', '3': 'smoke', '4': 'slippers' }[e.key];
    if (bought) wantBuy = bought;
  });
  addEventListener('keyup', e => down.delete(norm(e)));
  addEventListener('blur', () => down.clear());

  const held = k => down.has(k);
  return {
    read() {
      const mx = (held('d') || held('arrowright') ? 1 : 0) - (held('a') || held('arrowleft') ? 1 : 0);
      const my = (held('s') || held('arrowdown') ? 1 : 0) - (held('w') || held('arrowup') ? 1 : 0);
      const act = { mx, my, dash: held('shift'), buy: wantBuy };
      wantBuy = null;
      return act;
    },
    down: held,
  };
}
