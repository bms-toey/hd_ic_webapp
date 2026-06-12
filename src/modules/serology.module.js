import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect, seroBadge, h, hd, jsArg } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

export function openSeroModal() {
  clearSeroForm();
  fillSelect('sero-pt', DB.getPatients());
  set('sero-date', todayStr());
  document.getElementById('sero-modal-title').textContent = 'บันทึกผล Serology';
  setContext('ผลตรวจ Serology ใหม่', 'เลือกผู้ป่วยและวันที่เก็บเลือด ระบบจะใช้วันนัดครั้งต่อไปในการแจ้งเตือนครบกำหนด');
  setDeleteVisible(false);
  openModal('sero-modal');
}

export function closeSeroModal() {
  closeModal('sero-modal');
  clearSeroForm();
}

export function saveSerology() {
  const ptId = v('sero-pt');
  const date = v('sero-date');
  if (!ptId || !date) {
    showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error');
    return;
  }

  const eid = v('sero-id');
  const record = {
    id: eid || uid(),
    ptId,
    date,
    hbsag: v('sero-hbsag'),
    hbsTiter: v('sero-hbs-titer'),
    hbc: v('sero-hbc'),
    hbvDna: v('sero-hbv-dna'),
    hcv: v('sero-hcv'),
    hcvRna: v('sero-hcv-rna'),
    hcvGt: v('sero-hcv-gt'),
    hiv: v('sero-hiv'),
    cd4: v('sero-cd4'),
    hivVl: v('sero-hivvl'),
    vacc: v('sero-vacc'),
    nextDue: v('sero-next'),
    freq: v('sero-freq'),
    action: v('sero-action'),
    note: v('sero-note'),
  };

  if (eid) DB.updateSerology(eid, record);
  else DB.addSerology(record);

  renderSeroTable();
  updateBadges();
  closeSeroModal();
  showToast(eid ? 'แก้ไข Serology เรียบร้อย' : 'บันทึก Serology เรียบร้อย', 'ok');
}

export function editSerology(id) {
  const s = DB.getSerology().find(x => x.id === id);
  if (!s) return;
  fillSelect('sero-pt', DB.getPatients());
  set('sero-id', s.id);
  set('sero-pt', s.ptId);
  set('sero-date', s.date || '');
  set('sero-hbsag', s.hbsag || '');
  set('sero-hbs-titer', s.hbsTiter || '');
  set('sero-hbc', s.hbc || '');
  set('sero-hbv-dna', s.hbvDna || '');
  set('sero-hcv', s.hcv || '');
  set('sero-hcv-rna', s.hcvRna || '');
  set('sero-hcv-gt', s.hcvGt || '');
  set('sero-hiv', s.hiv || '');
  set('sero-cd4', s.cd4 || '');
  set('sero-hivvl', s.hivVl || '');
  set('sero-vacc', s.vacc || '');
  set('sero-next', s.nextDue || '');
  set('sero-freq', s.freq || '');
  set('sero-action', s.action || '');
  set('sero-note', s.note || '');
  document.getElementById('sero-modal-title').textContent = 'แก้ไขผล Serology';
  const p = DB.getPatients().find(x => x.id === s.ptId) || { hn: '?', name: '?' };
  setContext(`${p.hn} - ${p.name}`, `วันที่ตรวจ: ${thDate(s.date)} | Due: ${thDate(s.nextDue)}`);
  setDeleteVisible(true);
  openModal('sero-modal');
}

export function renderSeroTable() {
  const q = (v('sero-search') || '').toLowerCase();
  const flt = v('sero-filter') || '';
  const patients = DB.getPatients();
  const today = todayStr();

  let rows = DB.getSerology().map(s => {
    const p = patients.find(x => x.id === s.ptId) || { hn: '?', name: '?' };
    return { ...s, hn: p.hn, pname: p.name };
  });

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname).toLowerCase().includes(q)) return false;
    if (flt === 'pos' && !isPos(r)) return false;
    if (flt === 'due' && (!r.nextDue || r.nextDue > today)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('sero-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Serology');
    return;
  }

  document.getElementById('sero-table').innerHTML = `<div class="record-card-list">
    ${rows.map(r => renderSeroCard(r, today)).join('')}
  </div>`;
}

function renderSeroCard(r, today) {
  const state = isPos(r) ? 'danger' : r.nextDue && r.nextDue <= today ? 'warning' : 'ok';
  const dueClass = r.nextDue && r.nextDue <= today ? 'badge-pos' : 'badge-pend';
  const hbsTiter = r.hbsTiter ? `${h(r.hbsTiter)} mIU/mL` : '-';

  return `<article class="record-card is-${state} clickable-row" tabindex="0"
      role="button" aria-label="Open serology ${h(r.hn || '')}"
      onclick="editSerology(${jsArg(r.id)})" onkeydown="if(event.key==='Enter') editSerology(${jsArg(r.id)})">
    <div class="record-card-top">
      <div class="record-icon" aria-hidden="true">S</div>
      <div class="record-title">
        <strong>${h(r.pname || '-')}</strong>
        <span>${h(r.hn || '-')} | ตรวจ ${thDate(r.date)} | Due ${thDate(r.nextDue)}</span>
      </div>
      <div class="record-meta">
        ${isPos(r) ? '<span class="badge badge-pos">Positive / Reactive</span>' : '<span class="badge badge-ok">Negative</span>'}
        ${r.nextDue ? `<span class="badge ${dueClass}">${thDate(r.nextDue)}</span>` : ''}
      </div>
    </div>
    <div class="record-card-bottom">
      <section class="record-info-block">
        <span class="record-label">HBV Panel</span>
        <strong>HBsAg ${seroBadge(r.hbsag)}</strong>
        <small>Anti-HBs: ${hbsTiter}</small>
        <small>Anti-HBc: ${hd(r.hbc)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">HCV Panel</span>
        <strong>${seroBadge(r.hcv)}</strong>
        <small>RNA: ${hd(r.hcvRna)}</small>
        <small>Genotype: ${hd(r.hcvGt)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">HIV Panel</span>
        <strong>${seroBadge(r.hiv)}</strong>
        <small>CD4: ${hd(r.cd4)}</small>
        <small>VL: ${hd(r.hivVl)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Vaccine</span>
        <strong>${hd(r.vacc)}</strong>
        <small>Follow-up: ${hd(r.freq)}</small>
      </section>
      <section class="record-info-block">
        <span class="record-label">Action / Notes</span>
        <strong>${hd(r.action)}</strong>
        <small class="record-note">${hd(r.note)}</small>
      </section>
    </div>
  </article>`;
}

function isPos(s) {
  return ['Positive', 'Reactive'].includes(s.hbsag)
    || ['Positive', 'Reactive'].includes(s.hcv)
    || ['Positive', 'Reactive'].includes(s.hiv);
}

function clearSeroForm() {
  ['sero-id', 'sero-pt', 'sero-date', 'sero-hbsag', 'sero-hbs-titer', 'sero-hbc', 'sero-hbv-dna',
   'sero-hcv', 'sero-hcv-rna', 'sero-hcv-gt', 'sero-hiv', 'sero-cd4', 'sero-hivvl',
   'sero-vacc', 'sero-next', 'sero-freq', 'sero-action', 'sero-note'].forEach(id => set(id, ''));
  setDeleteVisible(false);
}

function setDeleteVisible(show) {
  const btn = document.getElementById('sero-delete-btn');
  if (btn) btn.hidden = !show;
}

function setContext(title, detail) {
  const el = document.getElementById('sero-context');
  if (!el) return;
  el.innerHTML = `<strong>${h(title)}</strong><span>${h(detail)}</span>`;
}

export function confirmDeleteSero(id) {
  confirmDelete('serology', id, () => {
    closeSeroModal();
    renderSeroTable();
    updateBadges();
  });
}

let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
