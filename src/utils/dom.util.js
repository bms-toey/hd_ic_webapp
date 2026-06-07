/** Short unique ID (time-based). */
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Get value of a form element by id. */
export const v = (id) => document.getElementById(id)?.value ?? '';

/** Set value of a form element by id. */
export function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

/** Escape user-provided values before inserting into HTML strings. */
export const h = (val) =>
  String(val ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

/** Escape a value, returning a dash when it is blank. */
export const hd = (val) => {
  const text = String(val ?? '').trim();
  return text ? h(text) : '-';
};

/** Encode a value for use as an inline JavaScript string argument. */
export const jsArg = (val) => h(JSON.stringify(String(val ?? '')));

/** Empty-state HTML fragment. */
export const emptyHtml = (msg) =>
  `<div class="empty-state"><div class="empty-icon">📭</div><p>${h(msg)}</p></div>`;

/**
 * Populate a <select> with Active patients.
 * Preserves the current selection when possible.
 */
export function fillSelect(id, patients) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">-- เลือกผู้ป่วย --</option>';
  patients
    .filter(p => p.status === 'Active')
    .forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.hn} — ${p.name}`;
      el.appendChild(o);
    });
  el.value = current;
}

/** Serology result badge HTML. */
export function seroBadge(val) {
  if (!val) return '-';
  if (val === 'Negative') return '<span class="badge badge-neg">Neg</span>';
  if (val === 'Positive' || val === 'Reactive') return `<span class="badge badge-pos">${h(val)}</span>`;
  return h(val);
}
