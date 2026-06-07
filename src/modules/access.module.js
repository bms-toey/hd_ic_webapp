import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect, h, hd, jsArg } from '../utils/dom.util.js';
import { diffDays, thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

const SIGNS_IDS = ['acc-pain', 'acc-swelling', 'acc-discharge', 'acc-fever', 'acc-tunnel'];
const SIGN_LABELS = ['ปวด', 'บวม', 'Discharge', 'ไข้', 'Tunnel'];

export function openAccessModal() {
  clearAccessForm();
  fillSelect('acc-pt', DB.getPatients());
  set('acc-date', todayStr());
  document.getElementById('acc-modal-title').textContent = 'บันทึก Vascular Access & Exit Site';
  setContext('Access และ Exit Site ใหม่', 'บันทึกชนิด access ตำแหน่ง วันที่ใส่/ถอด และสัญญาณติดเชื้อเพื่อใช้ติดตามความเสี่ยง');
  setDeleteVisible(false);
  openModal('acc-modal');
}

export function closeAccessModal() {
  closeModal('acc-modal');
  clearAccessForm();
}

export function saveAccess() {
  const ptId = v('acc-pt');
  const date = v('acc-date');
  if (!ptId || !date) {
    showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error');
    return;
  }

  const signs = SIGNS_IDS
    .map((id, i) => document.getElementById(id)?.checked ? SIGN_LABELS[i] : null)
    .filter(Boolean);

  const eid = v('acc-id');
  const record = {
    id: eid || uid(),
    ptId,
    date,
    type: v('acc-type'),
    site: v('acc-site'),
    insertDate: v('acc-insert'),
    qb: v('acc-qb'),
    removeDate: v('acc-remove'),
    accessStatus: v('acc-status'),
    grade: v('acc-grade'),
    signs,
    culture: v('acc-culture'),
    dressing: v('acc-dressing'),
    staff: v('acc-staff'),
    note: v('acc-note'),
  };

  if (eid) DB.updateAccess(eid, record);
  else DB.addAccess(record);

  renderAccessTable();
  closeAccessModal();
  showToast(eid ? 'แก้ไข Vascular Access เรียบร้อย' : 'บันทึก Vascular Access เรียบร้อย', 'ok');
}

export function editAccess(id) {
  const a = DB.getAccess().find(x => x.id === id);
  if (!a) return;
  fillSelect('acc-pt', DB.getPatients());
  set('acc-id', a.id);
  set('acc-pt', a.ptId);
  set('acc-date', a.date || '');
  set('acc-type', a.type || '');
  set('acc-site', a.site || '');
  set('acc-insert', a.insertDate || '');
  set('acc-qb', a.qb || '');
  set('acc-remove', a.removeDate || '');
  set('acc-status', a.accessStatus || '');
  set('acc-grade', a.grade !== undefined ? String(a.grade) : '');
  set('acc-culture', a.culture || '');
  set('acc-dressing', a.dressing || '');
  set('acc-staff', a.staff || '');
  set('acc-note', a.note || '');
  SIGNS_IDS.forEach((sid, i) => {
    const el = document.getElementById(sid);
    if (el) el.checked = (a.signs || []).includes(SIGN_LABELS[i]);
  });
  document.getElementById('acc-modal-title').textContent = 'แก้ไข Vascular Access & Exit Site';
  const p = DB.getPatients().find(x => x.id === a.ptId) || { hn: '?', name: '?' };
  setContext(`${p.hn} - ${p.name}`, `${a.type || 'Access'} | ${a.site || 'ไม่ระบุตำแหน่ง'} | ประเมิน ${thDate(a.date)}`);
  setDeleteVisible(true);
  openModal('acc-modal');
}

export function renderAccessTable() {
  const q = (v('acc-search') || '').toLowerCase();
  const flt = v('acc-filter') || '';
  const patients = DB.getPatients();

  let rows = DB.getAccess().map(a => {
    const p = patients.find(x => x.id === a.ptId) || { hn: '?', name: '?' };
    return { ...a, hn: p.hn, pname: p.name };
  });

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname).toLowerCase().includes(q)) return false;
    if (flt && r.type !== flt) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('acc-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Vascular Access');
    return;
  }

  document.getElementById('acc-table').innerHTML = `<div class="record-card-list">
    ${rows.map(renderAccessCard).join('')}
  </div>`;
}

function renderAccessCard(r) {
  const state = riskState(r);
  const signs = Array.isArray(r.signs) ? r.signs : [];
  const age = r.insertDate ? `${diffDays(r.insertDate, todayStr())} Days` : '-';

  return `<article class="record-card is-${state} clickable-row" tabindex="0"
      role="button" aria-label="Open access ${h(r.hn || '')}"
      onclick="editAccess(${jsArg(r.id)})" onkeydown="if(event.key==='Enter') editAccess(${jsArg(r.id)})">
    <div class="record-card-top">
      <div class="record-icon" aria-hidden="true">A</div>
      <div class="record-title">
        <strong>${h(r.pname || '-')}</strong>
        <span>${h(r.hn || '-')} | Assessment ${thDate(r.date)} | ${hd(r.type)}</span>
      </div>
      <div class="record-meta">
        ${gradeBadge(r.grade)}
        ${r.accessStatus ? `<span class="badge ${r.accessStatus === 'Active' ? 'badge-ok' : 'badge-pend'}">${h(r.accessStatus)}</span>` : ''}
      </div>
    </div>
    <div class="record-card-bottom">
      <section class="record-info-block access-${accessTypeKey(r.type)}">
        <span class="record-label">Vascular Access</span>
        <strong>${hd(r.type)}</strong>
        <small>${hd(r.site)}</small>
        <small>Inserted: ${thDate(r.insertDate)}</small>
        <small>Age: ${h(age)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Exit Site</span>
        <strong>${gradeBadge(r.grade)}</strong>
        <small>Removed: ${thDate(r.removeDate)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Culture</span>
        ${cultureBadge(r.culture)}
        <small>Dressing: ${hd(r.dressing)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Infection Signs</span>
        <div class="sign-pill-row">${signs.length ? signs.map(s => `<span class="sign-pill sign-danger">${h(s)}</span>`).join('') : '<span class="sign-pill sign-ok">No Symptom</span>'}</div>
      </section>
      <section class="record-info-block">
        <span class="record-label">Assessment / Notes</span>
        <strong>${hd(r.staff)}</strong>
        <small>QB: ${hd(r.qb)}</small>
        <small class="record-note">${hd(r.note)}</small>
      </section>
    </div>
  </article>`;
}

function riskState(r) {
  const grade = Number(r.grade || 0);
  const culture = String(r.culture || '').toUpperCase();
  const signs = Array.isArray(r.signs) ? r.signs.length : 0;
  if (grade >= 3 || /MRSA|ESBL|CRE/.test(culture)) return 'danger';
  if (grade >= 2 || /MSSA/.test(culture) || signs >= 2) return 'warning';
  if (grade === 1 || signs === 1) return 'info';
  return 'ok';
}

function accessTypeKey(type = '') {
  const value = type.toLowerCase();
  if (value.includes('avf')) return 'avf';
  if (value.includes('avg')) return 'avg';
  if (value.includes('perm')) return 'perm';
  if (value.includes('cvc') || value.includes('tdc')) return 'tdc';
  return 'default';
}

function gradeBadge(grade) {
  if (grade === '' || grade === undefined || grade === null) return '<span class="exit-grade exit-grade-empty">-</span>';
  return `<span class="exit-grade exit-grade-g${h(grade)}">G${h(grade)}</span>`;
}

function cultureBadge(value) {
  if (!value) return '<span class="culture-badge culture-ok">No Growth</span>';
  const upper = String(value).toUpperCase();
  const cls = /MRSA|ESBL|CRE/.test(upper) ? 'culture-danger'
    : /MSSA|PSEUDOMONAS|KLEBSIELLA|E\. COLI|AUREUS/.test(upper) ? 'culture-warn'
    : /NO\s*GROWTH|NEGATIVE/.test(upper) ? 'culture-ok'
    : 'culture-info';
  return `<span class="culture-badge ${cls}">${h(value)}</span>`;
}

function clearAccessForm() {
  ['acc-id', 'acc-pt', 'acc-date', 'acc-type', 'acc-site', 'acc-insert', 'acc-qb',
   'acc-remove', 'acc-status', 'acc-grade', 'acc-culture', 'acc-dressing', 'acc-staff', 'acc-note'].forEach(id => set(id, ''));
  SIGNS_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
  setDeleteVisible(false);
}

function setDeleteVisible(show) {
  const btn = document.getElementById('acc-delete-btn');
  if (btn) btn.hidden = !show;
}

function setContext(title, detail) {
  const el = document.getElementById('acc-context');
  if (!el) return;
  el.innerHTML = `<strong>${h(title)}</strong><span>${h(detail)}</span>`;
}

export function confirmDeleteAccess(id) {
  confirmDelete('access', id, () => {
    closeAccessModal();
    renderAccessTable();
  });
}
