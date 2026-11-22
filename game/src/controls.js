// controls.js — keyboard to intent. The rules layer never touches the DOM.
export function attachControls() {
  const keys = new Set();
  let queueBuy = null;

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key === '1') queueBuy = 'pick';
    if (e.key === '2') queueBuy = 'emp';
    if (e.key === '3') queueBuy = 'smoke';
    if (e.key === '4') queueBuy = 'glass';
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  return {
    // one intent per logic step
    poll() {
      const dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      const intent = { dx, dy, sprint: keys.has('shift'), buy: queueBuy };
      queueBuy = null;
      return intent;
    },
    pressed: key => keys.has(key),
  };
}
