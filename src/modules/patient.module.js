import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

// ── Modal ─────────────────────────────────────────────────────────────────

export function openPatientModal() {
  clearPatientForm();
  document.getElementById('pt-modal-title').textContent = 'เพิ่มผู้ป่วยใหม่';
  openModal('pt-modal');
}

export function closePtModal() {
  closeModal('pt-modal');
  clearPatientForm();
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function savePatient() {
  const hn   = document.getElementById('pt-hn').value.trim();
  const name = document.getElementById('pt-name').value.trim();
  if (!hn || !name) { showToast('กรุณากรอก HN และชื่อ', 'error'); return; }

  const eid = v('pt-id');
  const patient = {
    id: eid || uid(), hn, name,
    dob: v('pt-dob'), sex: v('pt-sex'), start: v('pt-start'),
    cause: v('pt-cause'), shift: v('pt-shift'), machine: v('pt-machine'),
    status: v('pt-status') || 'Active', note: v('pt-note'),
    created: todayStr(),
  };

  if (eid) DB.updatePatient(eid, patient);
  else     DB.addPatient(patient);

  renderPatientTable();
  updateBadges();
  closePtModal();
  showToast('บันทึกผู้ป่วยเรียบร้อย', 'ok');
}

export function editPatient(id) {
  const p = DB.getPatients().find(x => x.id === id);
  if (!p) return;
  set('pt-id', p.id); set('pt-hn', p.hn); set('pt-name', p.name);
  set('pt-dob', p.dob || ''); set('pt-sex', p.sex || '');
  set('pt-start', p.start || ''); set('pt-cause', p.cause || '');
  set('pt-shift', p.shift || ''); set('pt-machine', p.machine || '');
  set('pt-status', p.status || 'Active'); set('pt-note', p.note || '');
  document.getElementById('pt-modal-title').textContent = 'แก้ไขข้อมูลผู้ป่วย';
  openModal('pt-modal');
}

// ── Table ─────────────────────────────────────────────────────────────────

export function renderPatientTable() {
  const q   = (v('pt-search') || '').toLowerCase();
  const flt = v('pt-filter') || '';
  const rows = DB.getPatients().filter(p => {
    if (flt && p.status !== flt) return false;
    return !q || (p.hn + p.name).toLowerCase().includes(q);
  });

  if (!rows.length) {
    document.getElementById('pt-table').innerHTML = emptyHtml('ยังไม่มีข้อมูลผู้ป่วย');
    return;
  }

  const statusMap = { Active:'badge-ok', Transfer:'badge-pend', Deceased:'badge-pos', Transplant:'badge-info' };
  const trs = rows.map(p => `<tr>
    <td data-label="HN" class="td-hn">${p.hn}</td>
    <td data-label="ชื่อ">${p.name}</td>
    <td data-label="เพศ" class="td-muted">${p.sex || '-'}</td>
    <td data-label="ESRD" class="td-muted">${p.cause || '-'}</td>
    <td data-label="Shift" class="td-muted">${p.shift || '-'}</td>
    <td data-label="Machine" class="td-muted">${p.machine || '-'}</td>
    <td data-label="เริ่ม HD" class="td-muted">${thDate(p.start)}</td>
    <td data-label="สถานะ"><span class="badge ${statusMap[p.status] || 'badge-gray'}">${p.status}</span></td>
    <td data-label=""><button class="btn btn-outline btn-sm" onclick="editPatient('${p.id}')">แก้ไข</button> <button class="btn btn-danger btn-sm" onclick="confirmDeletePatient('${p.id}')">ลบ</button></td>
  </tr>`).join('');

  document.getElementById('pt-table').innerHTML =
    `<table><thead><tr><th>HN</th><th>ชื่อ-นามสกุล</th><th>เพศ</th><th>สาเหตุ ESRD</th><th>Shift</th><th>Machine</th><th>เริ่ม HD</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Internal ──────────────────────────────────────────────────────────────

function clearPatientForm() {
  ['pt-id','pt-hn','pt-name','pt-dob','pt-sex','pt-start',
   'pt-cause','pt-shift','pt-machine','pt-note'].forEach(id => set(id, ''));
  set('pt-status', 'Active');
}

// Called from global scope (HTML onclick)
export function confirmDeletePatient(id) {
  confirmDelete('patient', id, () => { renderPatientTable(); updateBadges(); });
}

// Forward-declared; filled by app.js to avoid circular dep
let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
