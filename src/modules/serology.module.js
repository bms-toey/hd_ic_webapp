import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect, seroBadge } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

// ── Modal ─────────────────────────────────────────────────────────────────

export function openSeroModal() {
  clearSeroForm();
  fillSelect('sero-pt', DB.getPatients());
  set('sero-date', todayStr());
  document.getElementById('sero-modal-title').textContent = 'บันทึกผล Serology';
  openModal('sero-modal');
}

export function closeSeroModal() {
  closeModal('sero-modal');
  clearSeroForm();
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function saveSerology() {
  const ptId = v('sero-pt');
  const date = v('sero-date');
  if (!ptId || !date) { showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error'); return; }

  const eid = v('sero-id');
  const record = {
    id: eid || uid(), ptId, date,
    hbsag: v('sero-hbsag'), hbsTiter: v('sero-hbs-titer'), hbc: v('sero-hbc'), hbvDna: v('sero-hbv-dna'),
    hcv: v('sero-hcv'), hcvRna: v('sero-hcv-rna'), hcvGt: v('sero-hcv-gt'),
    hiv: v('sero-hiv'), cd4: v('sero-cd4'), hivVl: v('sero-hivvl'),
    vacc: v('sero-vacc'), nextDue: v('sero-next'), freq: v('sero-freq'),
    action: v('sero-action'), note: v('sero-note'),
  };

  if (eid) DB.updateSerology(eid, record);
  else     DB.addSerology(record);

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
  openModal('sero-modal');
}

// ── Table ─────────────────────────────────────────────────────────────────

export function renderSeroTable() {
  const q   = (v('sero-search') || '').toLowerCase();
  const flt = v('sero-filter') || '';
  const patients = DB.getPatients();
  const today = todayStr();

  let rows = DB.getSerology().map(s => {
    const p = patients.find(x => x.id === s.ptId) || { hn: '?', name: '?' };
    return { ...s, hn: p.hn, pname: p.name };
  });

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname).toLowerCase().includes(q)) return false;
    if (flt === 'pos' && !_isPos(r)) return false;
    if (flt === 'due' && (!r.nextDue || r.nextDue > today)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('sero-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Serology');
    return;
  }

  const trs = rows.map(r => {
    const dueClass = r.nextDue && r.nextDue <= today ? 'badge-pos' : 'badge-pend';
    return `<tr>
      <td data-label="HN" class="td-hn">${r.hn}</td>
      <td data-label="ชื่อ">${r.pname}</td>
      <td data-label="วันที่" class="td-muted">${thDate(r.date)}</td>
      <td data-label="HBsAg">${seroBadge(r.hbsag)}</td>
      <td data-label="Anti-HBs" class="td-muted">${r.hbsTiter ? r.hbsTiter + ' mIU/mL' : '-'}</td>
      <td data-label="Anti-HCV">${seroBadge(r.hcv)}</td>
      <td data-label="Anti-HIV">${seroBadge(r.hiv)}</td>
      <td data-label="Vaccine" class="td-muted" style="font-size:11px">${r.vacc || '-'}</td>
      <td data-label="Due Date">${r.nextDue ? `<span class="badge ${dueClass}">${thDate(r.nextDue)}</span>` : '-'}</td>
      <td data-label=""><button class="btn btn-outline btn-sm" onclick="editSerology('${r.id}')">แก้ไข</button> <button class="btn btn-danger btn-sm" onclick="confirmDeleteSero('${r.id}')">ลบ</button></td>
    </tr>`;
  }).join('');

  document.getElementById('sero-table').innerHTML =
    `<table><thead><tr><th>HN</th><th>ชื่อ</th><th>วันที่</th><th>HBsAg</th><th>Anti-HBs</th><th>Anti-HCV</th><th>Anti-HIV</th><th>Vaccine HBV</th><th>Due Date</th><th>จัดการ</th></tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Internal ──────────────────────────────────────────────────────────────

function _isPos(s) {
  return ['Positive','Reactive'].includes(s.hbsag)
    || ['Positive','Reactive'].includes(s.hcv)
    || ['Positive','Reactive'].includes(s.hiv);
}

function clearSeroForm() {
  ['sero-id','sero-pt','sero-date','sero-hbsag','sero-hbs-titer','sero-hbc','sero-hbv-dna',
   'sero-hcv','sero-hcv-rna','sero-hcv-gt','sero-hiv','sero-cd4','sero-hivvl',
   'sero-vacc','sero-next','sero-freq','sero-action','sero-note'].forEach(id => set(id, ''));
}

export function confirmDeleteSero(id) {
  confirmDelete('serology', id, () => { renderSeroTable(); updateBadges(); });
}

let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
