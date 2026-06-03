import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

const BC_MAP = { Positive:'badge-pos', Negative:'badge-neg', Pending:'badge-pend', Contamination:'badge-gray' };

// ── Modal ─────────────────────────────────────────────────────────────────

export function openInfModal() {
  clearInfForm();
  fillSelect('inf-pt', DB.getPatients());
  set('inf-date', todayStr());
  document.getElementById('inf-modal-title').textContent = 'บันทึก Infection Event';
  openModal('inf-modal');
}

export function closeInfModal() {
  closeModal('inf-modal');
  clearInfForm();
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function saveInfection() {
  const ptId = v('inf-pt');
  const date = v('inf-date');
  if (!ptId || !date) { showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error'); return; }

  const eid = v('inf-id');
  const record = {
    id: eid || uid(), ptId, date,
    type: v('inf-type'), org: v('inf-org'), bc: v('inf-bc'),
    hosp: v('inf-hosp'), access: v('inf-access'),
    abx: v('inf-abx'), abxDur: v('inf-abx-dur'), outcome: v('inf-outcome'),
    note: v('inf-note'),
  };

  if (eid) DB.updateInfection(eid, record);
  else     DB.addInfection(record);

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
  openModal('inf-modal');
}

// ── Table ─────────────────────────────────────────────────────────────────

export function renderInfTable() {
  const q   = (v('inf-search') || '').toLowerCase();
  const flt = v('inf-filter') || '';
  const patients = DB.getPatients();

  let rows = DB.getInfections().map(a => {
    const p = patients.find(x => x.id === a.ptId) || { hn: '?', name: '?' };
    return { ...a, hn: p.hn, pname: p.name };
  });

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname + (r.org || '')).toLowerCase().includes(q)) return false;
    if (flt && r.type && !r.type.includes(flt)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('inf-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Infection Event');
    return;
  }

  const trs = rows.map(r => `<tr>
    <td data-label="HN" class="td-hn">${r.hn}</td>
    <td data-label="ชื่อ">${r.pname}</td>
    <td data-label="วันที่" class="td-muted">${thDate(r.date)}</td>
    <td data-label="ประเภท" style="font-size:11px">${r.type || '-'}</td>
    <td data-label="Organism" class="td-muted">${r.org || '-'}</td>
    <td data-label="Blood Cx">${r.bc ? `<span class="badge ${BC_MAP[r.bc] || 'badge-gray'}">${r.bc}</span>` : '-'}</td>
    <td data-label="Admit">${r.hosp === 'ใช่' ? '<span class="badge badge-pos">Admit</span>' : '<span class="badge badge-neg">OPD</span>'}</td>
    <td data-label="Antibiotic" class="td-muted" style="font-size:11px">${r.abx || '-'}</td>
    <td data-label="Outcome" class="td-muted" style="font-size:11px">${r.outcome || '-'}</td>
    <td data-label=""><button class="btn btn-outline btn-sm" onclick="editInfection('${r.id}')">แก้ไข</button> <button class="btn btn-danger btn-sm" onclick="confirmDeleteInf('${r.id}')">ลบ</button></td>
  </tr>`).join('');

  document.getElementById('inf-table').innerHTML =
    `<table><thead><tr><th>HN</th><th>ชื่อ</th><th>วันที่</th><th>ประเภท</th><th>Organism</th><th>Blood Cx</th><th>Admit</th><th>Antibiotic</th><th>Outcome</th><th>จัดการ</th></tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Internal ──────────────────────────────────────────────────────────────

function clearInfForm() {
  ['inf-id','inf-pt','inf-date','inf-type','inf-org','inf-bc','inf-hosp',
   'inf-access','inf-abx','inf-abx-dur','inf-outcome','inf-note'].forEach(id => set(id, ''));
}

export function confirmDeleteInf(id) {
  confirmDelete('infections', id, () => { renderInfTable(); updateBadges(); });
}

let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
