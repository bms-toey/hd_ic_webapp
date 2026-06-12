/** Show a temporary toast notification at the bottom-right of the screen. */
export function showToast(msg, type = 'ok') {
  const el = document.createElement('div');
  const label = type === 'ok' ? 'สำเร็จ' : type === 'warn' ? 'แจ้งเตือน' : 'ผิดพลาด';
  const icon = type === 'ok' ? '✓' : type === 'warn' ? '!' : '!';
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><strong>${label}</strong><span></span></div>`;
  el.querySelector('span:not(.toast-icon)').textContent = msg;
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    maxWidth: 'min(420px, calc(100vw - 32px))',
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: '600',
    zIndex: '999',
    boxShadow: '0 20px 50px rgba(7,27,51,.18)',
    fontFamily: 'Prompt, Noto Sans Thai, IBM Plex Sans Thai, sans-serif',
    transition: 'opacity .3s, transform .3s',
    opacity: '0',
    transform: 'translateY(8px)',
  });
  Object.assign(el.querySelector('.toast-icon').style, {
    width: '28px',
    height: '28px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: '0',
    borderRadius: '10px',
    background: type === 'ok' ? 'var(--green-50)' : type === 'warn' ? 'var(--amber-50)' : 'var(--red-50)',
    color: type === 'ok' ? 'var(--green-600)' : type === 'warn' ? 'var(--amber-800)' : 'var(--red-600)',
    fontWeight: '900',
  });
  Object.assign(el.querySelector('strong').style, {
    display: 'block',
    color: 'var(--navy-900)',
    marginBottom: '2px',
  });
  Object.assign(el.querySelector('div span').style, {
    display: 'block',
    color: 'var(--text-muted)',
    lineHeight: '1.45',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 2500);
}
