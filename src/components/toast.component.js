/** Show a temporary toast notification at the bottom-right of the screen. */
export function showToast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '10px 18px',
    borderRadius: '8px',
    background: type === 'ok' ? 'var(--teal-600)' : 'var(--red-600)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    zIndex: '999',
    boxShadow: '0 4px 12px rgba(0,0,0,.15)',
    fontFamily: 'IBM Plex Sans Thai, sans-serif',
    transition: 'opacity .3s',
    opacity: '0',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = '1'));
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2500);
}
