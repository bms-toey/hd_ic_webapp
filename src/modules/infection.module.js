import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect, h, hd, jsArg } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

const BC_MAP = { Positive: 'badge-pos', Negative: 'badge-neg', Pending: 'badge-pend', Contamination: 'badge-gray' };

export function openInfModal() {
  clearInfForm();
  fillSelect('inf-pt', DB.getPatients());
  set('inf-date', todayStr());
  document.getElementById('inf-modal-title').textContent = 'บันทึก Infection Event';
  setContext('Infection Event ใหม่', 'ระบุประเภท infection, organism, blood culture, antibiotic และ outcome ให้ครบเท่าที่มีข้อมูล');
  setDeleteVisible(false);
  openModal('inf-modal');
}

export function closeInfModal() {
  closeModal('inf-modal');
  clearInfForm();
}

export function saveInfection() {
  const ptId = v('inf-pt');
  const date = v('inf-date');
  if (!ptId || !date) {
    showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error');
    return;
  }

  const eid = v('inf-id');
  const record = {
    id: eid || uid(),
    ptId,
    date,
    type: v('inf-type'),
    org: v('inf-org'),
    bc: v('inf-bc'),
    hosp: v('inf-hosp'),
    access: v('inf-access'),
    abx: v('inf-abx'),
    abxDur: v('inf-abx-dur'),
    outcome: v('inf-outcome'),
    note: v('inf-note'),
  };

  if (eid) DB.updateInfection(eid, record);
  else DB.addInfection(record);

  renderInfTable();
  updateBadges();
  closeInfModal();
  showToast(eid ? 'แก้ไข Infection Event เรียบร้อย' : 'บันทึก Infection Event เรียบร้อย', 'ok');
}

export function editInfection(id) {
  const inf = DB.getInfections().find(x => x.id === id);
  if (!inf) return;
  fillSelect('inf-pt', DB.getPatients());
  set('inf-id', inf.id);
  set('inf-pt', inf.ptId);
  set('inf-date', inf.date || '');
  set('inf-type', inf.type || '');
  set('inf-org', inf.org || '');
  set('inf-bc', inf.bc || '');
  set('inf-hosp', inf.hosp || '');
  set('inf-access', inf.access || '');
  set('inf-abx', inf.abx || '');
  set('inf-abx-dur', inf.abxDur || '');
  set('inf-outcome', inf.outcome || '');
  set('inf-note', inf.note || '');
  document.getElementById('inf-modal-title').textContent = 'แก้ไข Infection Event';
  const p = DB.getPatients().find(x => x.id === inf.ptId) || { hn: '?', name: '?' };
  setContext(`${p.hn} - ${p.name}`, `${inf.type || 'Infection Event'} | ${inf.org || 'ไม่ระบุ organism'} | ${thDate(inf.date)}`);
  setDeleteVisible(true);
  openModal('inf-modal');
}

export function renderInfTable() {
  const q = (v('inf-search') || '').toLowerCase();
  const flt = v('inf-filter') || '';
  const patients = DB.getPatients();

  let rows = DB.getInfections().map(a => {
    const p = patients.find(x => x.id === a.ptId) || { hn: '?', name: '?' };
    return { ...a, hn: p.hn, pname: p.name };
  });

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname + (r.org || '')).toLowerCase().includes(q)) return false;
    if (flt && !String(r.type || '').includes(flt)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('inf-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Infection Event');
    return;
  }

  document.getElementById('inf-table').innerHTML = `<div class="record-card-list">
    ${rows.map(renderInfectionCard).join('')}
  </div>`;
}

function renderInfectionCard(r) {
  const state = r.bc === 'Positive' || criticalOrganism(r.org) ? 'danger'
    : r.bc === 'Pending' || isAdmit(r.hosp) ? 'warning'
    : 'info';
  const admit = isAdmit(r.hosp) ? '<span class="badge badge-pos">Admit</span>' : '<span class="badge badge-neg">OPD</span>';

  return `<article class="record-card is-${state} clickable-row" tabindex="0"
      role="button" aria-label="Open infection ${h(r.hn || '')}"
      onclick="editInfection(${jsArg(r.id)})" onkeydown="if(event.key==='Enter') editInfection(${jsArg(r.id)})">
    <div class="record-card-top">
      <div class="record-icon" aria-hidden="true">I</div>
      <div class="record-title">
        <strong>${h(r.pname || '-')}</strong>
        <span>${h(r.hn || '-')} | Event ${thDate(r.date)} | ${hd(r.type)}</span>
      </div>
      <div class="record-meta">
        ${r.bc ? `<span class="badge ${BC_MAP[r.bc] || 'badge-gray'}">Blood Cx ${h(r.bc)}</span>` : ''}
        ${admit}
      </div>
    </div>
    <div class="record-card-bottom">
      <section class="record-info-block">
        <span class="record-label">Infection Type</span>
        <strong>${hd(r.type)}</strong>
        <small>Access: ${hd(r.access)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Organism</span>
        ${organismBadge(r.org)}
        <small>Blood culture: ${hd(r.bc)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Care Level</span>
        <strong>${admit}</strong>
        <small>Recorded: ${thDate(r.date)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Antibiotic</span>
        <strong>${hd(r.abx)}</strong>
        <small>Duration: ${hd(r.abxDur)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Outcome / Notes</span>
        <strong>${hd(r.outcome)}</strong>
        <small class="record-note">${hd(r.note)}</small>
      </section>
    </div>
  </article>`;
}

function criticalOrganism(value = '') {
  return /MRSA|ESBL|CRE|PSEUDOMONAS/i.test(value);
}

function isAdmit(value = '') {
  return value === 'ใช่' || value === 'เนเธเน' || /admit|yes/i.test(value);
}

function organismBadge(value) {
  if (!value) return '<span class="culture-badge culture-info">Unknown</span>';
  const cls = criticalOrganism(value) ? 'culture-danger'
    : /MSSA|KLEBSIELLA|E\. COLI|AUREUS/i.test(value) ? 'culture-warn'
    : 'culture-info';
  return `<span class="culture-badge ${cls}">${h(value)}</span>`;
}

function clearInfForm() {
  ['inf-id', 'inf-pt', 'inf-date', 'inf-type', 'inf-org', 'inf-bc', 'inf-hosp',
   'inf-access', 'inf-abx', 'inf-abx-dur', 'inf-outcome', 'inf-note'].forEach(id => set(id, ''));
  setDeleteVisible(false);
}

function setDeleteVisible(show) {
  const btn = document.getElementById('inf-delete-btn');
  if (btn) btn.hidden = !show;
}

function setContext(title, detail) {
  const el = document.getElementById('inf-context');
  if (!el) return;
  el.innerHTML = `<strong>${h(title)}</strong><span>${h(detail)}</span>`;
}

export function confirmDeleteInf(id) {
  confirmDelete('infections', id, () => {
    closeInfModal();
    renderInfTable();
    updateBadges();
  });
}

let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
