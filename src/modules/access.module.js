import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, fillSelect } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

const GRADE_MAP = { '0':'badge-neg', '1':'badge-pend', '2':'badge-pend', '3':'badge-pos' };
const SIGNS_IDS = ['acc-pain','acc-swelling','acc-discharge','acc-fever','acc-tunnel'];
const SIGN_LABELS = ['ปวด','บวม','Discharge','ไข้','Tunnel'];

// ── Modal ─────────────────────────────────────────────────────────────────

export function openAccessModal() {
  clearAccessForm();
  fillSelect('acc-pt', DB.getPatients());
  set('acc-date', todayStr());
  document.getElementById('acc-modal-title').textContent = 'บันทึก Vascular Access & Exit Site';
  openModal('acc-modal');
}

export function closeAccessModal() {
  closeModal('acc-modal');
  clearAccessForm();
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function saveAccess() {
  const ptId = v('acc-pt');
  const date = v('acc-date');
  if (!ptId || !date) { showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error'); return; }

  const signs = SIGNS_IDS
    .map((id, i) => document.getElementById(id)?.checked ? SIGN_LABELS[i] : null)
    .filter(Boolean);

  const eid = v('acc-id');
  const record = {
    id: eid || uid(), ptId, date,
    type: v('acc-type'), site: v('acc-site'), insertDate: v('acc-insert'), qb: v('acc-qb'),
    removeDate: v('acc-remove'), accessStatus: v('acc-status'),
    grade: v('acc-grade'), signs, culture: v('acc-culture'),
    dressing: v('acc-dressing'), staff: v('acc-staff'), note: v('acc-note'),
  };

  if (eid) DB.updateAccess(eid, record);
  else     DB.addAccess(record);

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
  openModal('acc-modal');
}

// ── Table ─────────────────────────────────────────────────────────────────

export function renderAccessTable() {
  const q   = (v('acc-search') || '').toLowerCase();
  const flt = v('acc-filter') || '';
  const patients = DB.getPatients();

  let rows = DB.getAccess()
    .map(a => ({ ...a, hn: patients.find(x => x.id === a.ptId)?.hn || '?', pname: patients.find(x => x.id === a.ptId)?.name || '?' }));

  rows = rows.filter(r => {
    if (q && !(r.hn + r.pname).toLowerCase().includes(q)) return false;
    if (flt && r.type !== flt) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!rows.length) {
    document.getElementById('acc-table').innerHTML = emptyHtml('ยังไม่มีข้อมูล Vascular Access');
    return;
  }

  const trs = rows.map(r => `<tr>
    <td data-label="HN" class="td-hn">${r.hn}</td>
    <td data-label="ชื่อ">${r.pname}</td>
    <td data-label="วันที่" class="td-muted">${thDate(r.date)}</td>
    <td data-label="ประเภท" class="td-muted" style="font-size:11px">${r.type || '-'}</td>
    <td data-label="ตำแหน่ง" class="td-muted" style="font-size:11px">${r.site || '-'}</td>
    <td data-label="ใส่/สร้าง" class="td-muted" style="font-size:11px">${thDate(r.insertDate)}</td>
    <td data-label="ถอด" class="td-muted" style="font-size:11px">${thDate(r.removeDate)}</td>
    <td data-label="สถานะ" style="font-size:11px">${r.accessStatus ? `<span class="badge ${r.accessStatus === 'Active' ? 'badge-ok' : 'badge-pend'}">${r.accessStatus}</span>` : '-'}</td>
    <td data-label="Exit">${r.grade !== '' && r.grade !== undefined ? `<span class="badge ${GRADE_MAP[r.grade] || 'badge-gray'}">G${r.grade}</span>` : '-'}</td>
    <td data-label="สัญญาณ">${r.signs?.length ? `<span class="badge badge-pos" style="font-size:10px">${r.signs.join(', ')}</span>` : '<span class="badge badge-neg">ปกติ</span>'}</td>
    <td data-label="Culture" class="td-muted" style="font-size:11px">${r.culture || '-'}</td>
    <td data-label=""><button class="btn btn-outline btn-sm" onclick="editAccess('${r.id}')">แก้ไข</button> <button class="btn btn-danger btn-sm" onclick="confirmDeleteAccess('${r.id}')">ลบ</button></td>
  </tr>`).join('');

  document.getElementById('acc-table').innerHTML =
    `<table><thead><tr><th>HN</th><th>ชื่อ</th><th>วันที่</th><th>ประเภท</th><th>ตำแหน่ง</th><th>ใส่</th><th>ถอด</th><th>สถานะ</th><th>Exit Grade</th><th>สัญญาณ</th><th>Culture</th><th>จัดการ</th></tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Internal ──────────────────────────────────────────────────────────────

function clearAccessForm() {
  ['acc-id','acc-pt','acc-date','acc-type','acc-site','acc-insert','acc-qb',
   'acc-remove','acc-status','acc-grade','acc-culture','acc-dressing','acc-staff','acc-note'].forEach(id => set(id, ''));
  SIGNS_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
}

export function confirmDeleteAccess(id) {
  confirmDelete('access', id, () => renderAccessTable());
}
