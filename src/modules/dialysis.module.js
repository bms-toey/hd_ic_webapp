import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, h, hd, jsArg } from '../utils/dom.util.js';
import { todayStr, thDate, diffDays } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

const SHIFTS = ['Shift 1 (เช้า)', 'Shift 2 (บ่าย)', 'Shift 3 (เย็น)'];
const ACCESS_TYPES = ['AVF', 'AVG', 'PC', 'DLC', 'TLC'];
const CATHETER_TYPES = ['PC', 'DLC', 'TLC', 'Tunneled CVC (TDC)', 'Non-tunneled CVC'];
const CATHETER_WARN_DAYS = 90;

// ── Calendar state ────────────────────────────────────────────────
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const WEEK_LABELS = ['จ','อ','พ','พฤ','ศ','ส','อา']; // Mon-first
const SHIFT_COLORS = {
  'Shift 1 (เช้า)':  { bg:'#DBEAFE', color:'#1D4ED8', dot:'#60A5FA', cls:'cal-s1', icon:'🌅', short:'S1 เช้า' },
  'Shift 2 (บ่าย)': { bg:'#DCFCE7', color:'#15803D', dot:'#4ADE80', cls:'cal-s2', icon:'☀️',  short:'S2 บ่าย' },
  'Shift 3 (เย็น)': { bg:'#FEF3C7', color:'#92400E', dot:'#FCD34D', cls:'cal-s3', icon:'🌙', short:'S3 เย็น' },
};

let _calView = 'month';
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth() + 1;
let _calSelDate = todayStr();

function _calDateStr(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function _addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function _weekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const patientName = (p) => p ? `${p.hn || '-'} - ${p.name || '-'}` : '-';
const byId = (rows, id) => rows.find(x => x.id === id);
const resourceLabel = (rows, id) => byId(rows, id)?.name || '-';
const isToday = (row) => row.date === todayStr();

function activePatients() {
  return DB.getPatients().filter(p => p.status === 'Active');
}

function latestAccess(ptId) {
  return [...DB.getAccess()]
    .filter(a => a.ptId === ptId && (a.accessStatus || 'Active') !== 'Removed')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
}

function normalizeAccess(type = '') {
  const value = String(type).toUpperCase();
  if (value.includes('AVF')) return 'AVF';
  if (value.includes('AVG')) return 'AVG';
  if (value.includes('PERM') || value.includes('TDC') || value.includes('TUNNELED')) return 'PC';
  if (value.includes('DLC') || value.includes('NON-TUNNELED')) return 'DLC';
  if (value.includes('TLC')) return 'TLC';
  return ACCESS_TYPES.includes(type) ? type : '';
}

function patientAccessType(patient) {
  return normalizeAccess(patient?.vascularType || latestAccess(patient?.id)?.type || '');
}

function fillPatientSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">-- เลือกผู้ป่วย --</option>';
  activePatients().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = patientName(p);
    el.appendChild(opt);
  });
  el.value = current;
}

function fillResourceSelect(id, type) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  const label = type === 'bed' ? 'เตียง' : 'เครื่อง';
  el.innerHTML = `<option value="">-- เลือก${label} --</option>`;
  DB.getResources()
    .filter(r => r.type === type)
    .forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.status || 'พร้อมใช้'})`;
      el.appendChild(opt);
    });
  el.value = current;
}

function fillStockSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '<option value="">-- เลือกเวชภัณฑ์ --</option>';
  DB.getStockItems().forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.name} (${stockBalance(item)} ${item.unit || ''})`;
    el.appendChild(opt);
  });
  el.value = current;
}

function statusBadge(status) {
  const cls = status === 'มาแล้ว' ? 'badge-ok'
    : status === 'ยังไม่มา' ? 'badge-pend'
    : status === 'งดฟอก' || status === 'ยกเลิก' ? 'badge-pos'
    : 'badge-info';
  return `<span class="badge ${cls}">${h(status || '-')}</span>`;
}

function stockBalance(item) {
  return Number(item.qty || 0);
}

function appointmentPatient(appt) {
  return byId(DB.getPatients(), appt.ptId);
}

function attendanceForAppointment(appt) {
  return DB.getAttendance().find(a => a.appointmentId === appt.id)
    || DB.getAttendance().find(a => a.ptId === appt.ptId && a.date === appt.date);
}

function seedDefaultResources() {
  if (DB.getResources().length) return;
  const resources = [];
  for (let i = 1; i <= 12; i += 1) {
    resources.push({ id: uid(), type: 'bed', name: `Bed-${String(i).padStart(2, '0')}`, status: 'พร้อมใช้', zone: 'HD Unit', note: '' });
    resources.push({ id: uid(), type: 'machine', name: `HD-${String(i).padStart(2, '0')}`, status: 'พร้อมใช้', zone: 'HD Unit', note: '' });
  }
  const db = DB.get();
  DB.reset({ ...db, resources });
}

export function renderDailyDashboard() {
  seedDefaultResources();
  renderDashboardOpsStats();
  renderDashboardOpsPanels();
}

function renderDashboardOpsStats() {
  const el = document.getElementById('dash-ops-stats');
  if (!el) return;
  const today = todayStr();
  const appts = DB.getAppointments().filter(a => a.date === today);
  const attendance = DB.getAttendance().filter(a => a.date === today);
  const present = attendance.filter(a => a.status === 'มาแล้ว').length;
  const absent = Math.max(appts.length - present, 0);
  const resources = DB.getResources();
  const beds = resources.filter(r => r.type === 'bed');
  const machines = resources.filter(r => r.type === 'machine');
  const usedBeds = new Set(appts.map(a => a.bedId).filter(Boolean)).size;
  const usedMachines = new Set(appts.map(a => a.machineId).filter(Boolean)).size;
  const freeBeds = beds.filter(r => r.status === 'พร้อมใช้').length;
  const freeMachines = machines.filter(r => r.status === 'พร้อมใช้').length;
  const repairMachines = machines.filter(r => r.status === 'ซ่อม').length;
  const lowStock = DB.getStockItems().filter(item => stockBalance(item) <= Number(item.minQty || 0)).length;
  const dlcDue = getCatheterAlerts().length;
  const allPatients = activePatients();

  const card = (color, icon, num, label, sub, section) => `
    <div class="dash-stat-card dsc-${color}${section ? ' clickable-row' : ''}" ${section ? `onclick="showSection('${section}',document.querySelector('[data-nav-section=${section}]'))"` : ''}>
      <div class="dash-stat-card-glow"></div>
      <div class="dash-stat-icon">${icon}</div>
      <div class="dash-stat-num">${num}</div>
      <div class="dash-stat-label">${label}</div>
      ${sub ? `<div class="dash-stat-sub">${sub}</div>` : ''}
    </div>`;

  el.innerHTML =
    card('blue',   '👥', allPatients.length,   'ผู้ป่วยทั้งหมด', 'สถานะ Active', 'patient') +
    card('green',  '✅', present,              'มาใช้บริการวันนี้', `จากนัด ${appts.length} ราย`, 'attendance') +
    card('amber',  '⏳', absent,               'ยังไม่มา / รอเช็ค', 'วันนี้', 'attendance') +
    card('sky',    '🛏', beds.length,          'เตียงทั้งหมด', `ว่าง ${freeBeds} เตียง`, 'resources') +
    card('teal',   '⚙️', machines.length,      'เครื่องไตเทียม', `พร้อม ${freeMachines} | ซ่อม ${repairMachines}`, 'resources') +
    card('red',    '⚠️', dlcDue,               'DLC/PC/TLC เกินกำหนด', '≥ 90 วัน', 'dlc-alert') +
    card('violet', '📦', lowStock,             'สต็อกต่ำกว่าขั้นต่ำ', 'ต้องสั่งซื้อ', 'stock') +
    card('pink',   '📅', appts.length,         'นัดฟอกวันนี้', `Shift 1-3`, 'schedule');
}

function renderDashboardOpsPanels() {
  const todayList = document.getElementById('dash-today-appointments');
  const vascular = document.getElementById('dash-vascular-summary');
  if (todayList) {
    const resources = DB.getResources();
    const rows = DB.getAppointments()
      .filter(isToday)
      .sort((a, b) => `${a.shift}${a.bedId}`.localeCompare(`${b.shift}${b.bedId}`));
    todayList.innerHTML = rows.length ? `<div class="today-appt-list">${rows.map(a => {
      const p = appointmentPatient(a);
      const attend = attendanceForAppointment(a);
      return `<div class="today-appt-item">
        <span class="today-appt-hn">${h(p?.hn || '-')}</span>
        <span class="today-appt-name">${h(p?.name || '-')}</span>
        <span style="font-size:11.5px;color:var(--text-muted)">${h(a.shift?.replace('Shift ','S').replace(' (เช้า)','🌅').replace(' (บ่าย)','☀️').replace(' (เย็น)','🌙') || '-')}</span>
        ${statusBadge(attend?.status || a.status || 'นัดแล้ว')}
      </div>`;
    }).join('')}</div>` : emptyHtml('ยังไม่มีนัดฟอกเลือดวันนี้');
  }
  if (vascular) {
    const counts = Object.fromEntries(ACCESS_TYPES.map(type => [type, 0]));
    activePatients().forEach(p => {
      const type = patientAccessType(p);
      if (counts[type] !== undefined) counts[type] += 1;
    });
    const colorMap = { AVF: 'vt-avf', AVG: 'vt-avg', PC: 'vt-pc', DLC: 'vt-dlc', TLC: 'vt-tlc' };
    vascular.innerHTML = `<div class="vascular-grid">
      ${ACCESS_TYPES.map(type => `<div class="vascular-tile ${colorMap[type] || ''}">
        <div class="vascular-tile-num">${counts[type]}</div>
        <div class="vascular-tile-label">${type}</div>
      </div>`).join('')}
    </div>`;
  }
}

export function renderSchedulePage() {
  seedDefaultResources();
  const el = document.getElementById('cal-body');
  if (!el) return;
  _updateCalTitle();
  _updateCalViewBtns();
  if (_calView === 'month')     _renderMonthView(el);
  else if (_calView === 'week') _renderWeekView(el);
  else                          _renderDayView(el);
}

function _updateCalTitle() {
  const t = document.getElementById('cal-nav-title');
  if (!t) return;
  if (_calView === 'month') {
    t.textContent = `${THAI_MONTHS[_calMonth - 1]} ${_calYear}`;
  } else if (_calView === 'week') {
    const ws = _weekStart(_calSelDate);
    const we = _addDays(ws, 6);
    const s = new Date(ws + 'T12:00:00'), e = new Date(we + 'T12:00:00');
    if (s.getMonth() === e.getMonth()) {
      t.textContent = `${s.getDate()}–${e.getDate()} ${THAI_MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    } else {
      t.textContent = `${s.getDate()} ${THAI_MONTHS[s.getMonth()]} – ${e.getDate()} ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    }
  } else {
    const d = new Date(_calSelDate + 'T12:00:00');
    t.textContent = `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function _updateCalViewBtns() {
  ['month','week','day'].forEach(v => {
    const btn = document.getElementById(`cal-btn-${v}`);
    if (btn) btn.classList.toggle('active', _calView === v);
  });
}

// ── Month view ────────────────────────────────────────────────────
function _renderMonthView(el) {
  const appts   = DB.getAppointments();
  const today   = todayStr();
  const firstJS = new Date(_calYear, _calMonth - 1, 1).getDay(); // 0=Sun
  const offset  = firstJS === 0 ? 6 : firstJS - 1;              // Mon-first offset
  const daysInMonth = new Date(_calYear, _calMonth, 0).getDate();
  const totalCells  = Math.ceil((daysInMonth + offset) / 7) * 7;

  const hdrs = WEEK_LABELS.map(l => `<div class="cal-month-hdr">${l}</div>`).join('');
  let cells = '';

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells += `<div class="cal-cell cal-cell-empty"></div>`;
      continue;
    }
    const ds = _calDateStr(_calYear, _calMonth, dayNum);
    const dayAppts = appts.filter(a => a.date === ds);
    const isToday  = ds === today;
    const isSel    = ds === _calSelDate;

    const chips = SHIFTS.map(s => {
      const cnt = dayAppts.filter(a => a.shift === s).length;
      if (!cnt) return '';
      const sc = SHIFT_COLORS[s];
      return `<div class="cal-chip" style="background:${sc.bg};color:${sc.color}">${sc.short} · ${cnt}</div>`;
    }).join('');

    cells += `<div class="cal-cell${isToday ? ' cal-today' : ''}${isSel ? ' cal-selected' : ''}" onclick="calSelectDate(${h(JSON.stringify(ds))})">
      <div class="cal-cell-num${isToday ? ' cal-today-num' : ''}">${dayNum}</div>
      <div class="cal-cell-chips">${chips}</div>
    </div>`;
  }

  el.innerHTML = `<div class="cal-month-wrap"><div class="cal-month-grid">${hdrs}${cells}</div></div>`;
}

// ── Week view ─────────────────────────────────────────────────────
function _renderWeekView(el) {
  const ws      = _weekStart(_calSelDate);
  const today   = todayStr();
  const appts   = DB.getAppointments();

  const cols = Array.from({length: 7}, (_, i) => {
    const ds = _addDays(ws, i);
    const d  = new Date(ds + 'T12:00:00');
    const dayAppts = appts.filter(a => a.date === ds)
      .sort((a, b) => SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift));
    const isToday = ds === today;
    const isSel   = ds === _calSelDate;

    const cards = dayAppts.map(a => {
      const p  = appointmentPatient(a);
      const sc = SHIFT_COLORS[a.shift] || { dot:'#94A3B8' };
      const attend = attendanceForAppointment(a);
      const shiftShort = h(a.shift?.replace('Shift 1 (เช้า)','🌅 S1').replace('Shift 2 (บ่าย)','☀️ S2').replace('Shift 3 (เย็น)','🌙 S3') || '');
      return `<div class="cal-week-card" style="border-left-color:${sc.dot}" onclick="calSelectDate(${h(JSON.stringify(ds))})">
        <div class="cal-week-card-hn">${h(p?.hn || '-')}</div>
        <div class="cal-week-card-name">${h(p?.name || '-')}</div>
        <div class="cal-week-card-meta">${shiftShort} ${statusBadge(attend?.status || a.status || 'นัดแล้ว')}</div>
      </div>`;
    }).join('') || `<div class="cal-week-empty">ไม่มีนัด</div>`;

    return `<div class="cal-week-col${isToday ? ' cal-today-col' : ''}${isSel ? ' cal-sel-col' : ''}">
      <div class="cal-week-col-head" onclick="calSelectDate(${h(JSON.stringify(ds))})">
        <div class="cal-week-day-name">${WEEK_LABELS[i]}</div>
        <div class="cal-week-day-num${isToday ? ' cal-today-num' : ''}">${d.getDate()}</div>
        ${dayAppts.length ? `<div class="cal-week-count">${dayAppts.length}</div>` : ''}
      </div>
      <div class="cal-week-col-body">${cards}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="cal-week-wrap"><div class="cal-week-grid">${cols}</div></div>`;
}

// ── Day view ──────────────────────────────────────────────────────
function _renderDayView(el) {
  const resources = DB.getResources();
  const appts = DB.getAppointments()
    .filter(a => a.date === _calSelDate)
    .sort((a, b) => SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift));

  const d = new Date(_calSelDate + 'T12:00:00');
  const dayHeader = `วัน${THAI_DAY_NAMES[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const cols = SHIFTS.map(shift => {
    const sc = SHIFT_COLORS[shift];
    const shiftAppts = appts.filter(a => a.shift === shift);
    const cards = shiftAppts.map(a => {
      const p      = appointmentPatient(a);
      const attend = attendanceForAppointment(a);
      const status = attend?.status || a.status || 'นัดแล้ว';
      const vType  = patientAccessType(p);
      const bedName = resourceLabel(resources, a.bedId);
      const machName = resourceLabel(resources, a.machineId);
      return `<div class="cal-day-card">
        <div class="cal-day-card-top">
          <span class="cal-day-hn">${h(p?.hn || '-')}</span>
          ${statusBadge(status)}
        </div>
        <div class="cal-day-name">${h(p?.name || '-')}</div>
        <div class="cal-day-meta">
          ${vType ? `<span class="badge badge-info" style="font-size:10px">${h(vType)}</span>` : ''}
          ${bedName !== '-' ? `<span>🛏 ${h(bedName)}</span>` : ''}
          ${machName !== '-' ? `<span>⚙️ ${h(machName)}</span>` : ''}
          <span style="margin-left:auto">${hd(p?.coverage)}</span>
        </div>
        <div class="cal-day-actions">
          <button class="btn btn-primary btn-sm" onclick="openAttendanceModal(${jsArg(a.id)})">✓ เช็คชื่อ</button>
          <button class="btn btn-outline btn-sm" onclick="editAppointment(${jsArg(a.id)})">แก้ไข</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteAppointment(${jsArg(a.id)})">ลบ</button>
        </div>
      </div>`;
    }).join('') || `<div class="cal-day-empty">${emptyHtml('ไม่มีนัดในรอบนี้')}</div>`;

    return `<div class="cal-shift-col ${sc.cls}">
      <div class="cal-shift-col-head">
        <span>${sc.icon}</span>
        <span>${shift}</span>
        <span class="cal-shift-count">${shiftAppts.length} ราย</span>
      </div>
      <div class="cal-shift-col-body">${cards}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cal-day-banner">
      <span class="cal-day-banner-title">${dayHeader}</span>
      <span class="cal-day-total">นัดทั้งหมด ${appts.length} ราย</span>
    </div>
    <div class="cal-day-grid">${cols}</div>`;
}

// ── Calendar navigation exports ───────────────────────────────────
export function setCalView(view) {
  _calView = view;
  const d = new Date(_calSelDate + 'T12:00:00');
  _calYear = d.getFullYear();
  _calMonth = d.getMonth() + 1;
  renderSchedulePage();
}

export function calPrev() {
  if (_calView === 'month') {
    _calMonth--;
    if (_calMonth < 1) { _calMonth = 12; _calYear--; }
  } else if (_calView === 'week') {
    _calSelDate = _addDays(_calSelDate, -7);
    const d = new Date(_calSelDate + 'T12:00:00');
    _calYear = d.getFullYear(); _calMonth = d.getMonth() + 1;
  } else {
    _calSelDate = _addDays(_calSelDate, -1);
    const d = new Date(_calSelDate + 'T12:00:00');
    _calYear = d.getFullYear(); _calMonth = d.getMonth() + 1;
  }
  renderSchedulePage();
}

export function calNext() {
  if (_calView === 'month') {
    _calMonth++;
    if (_calMonth > 12) { _calMonth = 1; _calYear++; }
  } else if (_calView === 'week') {
    _calSelDate = _addDays(_calSelDate, 7);
    const d = new Date(_calSelDate + 'T12:00:00');
    _calYear = d.getFullYear(); _calMonth = d.getMonth() + 1;
  } else {
    _calSelDate = _addDays(_calSelDate, 1);
    const d = new Date(_calSelDate + 'T12:00:00');
    _calYear = d.getFullYear(); _calMonth = d.getMonth() + 1;
  }
  renderSchedulePage();
}

export function calToday() {
  _calSelDate = todayStr();
  const d = new Date(_calSelDate + 'T12:00:00');
  _calYear = d.getFullYear();
  _calMonth = d.getMonth() + 1;
  renderSchedulePage();
}

export function calSelectDate(dateStr) {
  _calSelDate = dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  _calYear = d.getFullYear();
  _calMonth = d.getMonth() + 1;
  _calView = 'day';
  renderSchedulePage();
}

export function openAppointmentModal() {
  ['appt-id', 'appt-pt', 'appt-bed', 'appt-machine', 'appt-note'].forEach(id => set(id, ''));
  set('appt-date', _calSelDate || todayStr());
  set('appt-shift', SHIFTS[0]);
  set('appt-status', 'นัดแล้ว');
  fillPatientSelect('appt-pt');
  fillResourceSelect('appt-bed', 'bed');
  fillResourceSelect('appt-machine', 'machine');
  openModal('appt-modal');
}

export function editAppointment(id) {
  const a = DB.getAppointments().find(x => x.id === id);
  if (!a) return;
  fillPatientSelect('appt-pt');
  fillResourceSelect('appt-bed', 'bed');
  fillResourceSelect('appt-machine', 'machine');
  set('appt-id', a.id);
  set('appt-date', a.date || todayStr());
  set('appt-shift', a.shift || SHIFTS[0]);
  set('appt-pt', a.ptId || '');
  set('appt-bed', a.bedId || '');
  set('appt-machine', a.machineId || '');
  set('appt-status', a.status || 'นัดแล้ว');
  set('appt-note', a.note || '');
  openModal('appt-modal');
}

export function closeAppointmentModal() {
  closeModal('appt-modal');
}

export function saveAppointment() {
  const ptId = v('appt-pt');
  const date = v('appt-date');
  const shift = v('appt-shift');
  if (!ptId || !date || !shift) {
    showToast('กรุณาเลือกผู้ป่วย วันที่ และรอบฟอก', 'error');
    return;
  }
  const row = {
    id: v('appt-id') || uid(),
    date,
    shift,
    ptId,
    bedId: v('appt-bed'),
    machineId: v('appt-machine'),
    status: v('appt-status') || 'นัดแล้ว',
    note: v('appt-note'),
  };
  const conflict = DB.getAppointments().find(a =>
    a.id !== row.id && a.date === row.date && a.shift === row.shift
    && ((row.bedId && a.bedId === row.bedId) || (row.machineId && a.machineId === row.machineId))
  );
  if (conflict) {
    showToast('เตียงหรือเครื่องนี้ถูกจองในรอบเดียวกันแล้ว', 'error');
    return;
  }
  if (v('appt-id')) DB.updateAppointment(row.id, row);
  else DB.addAppointment(row);
  closeAppointmentModal();
  renderSchedulePage();
  renderDailyDashboard();
  showToast('บันทึกตารางนัดแล้ว', 'ok');
}

export function confirmDeleteAppointment(id) {
  confirmDelete('appointments', id, () => {
    renderSchedulePage();
    renderDailyDashboard();
  });
}

export function renderAttendancePage() {
  const date = v('att-date') || todayStr();
  set('att-date', date);
  const q = (v('att-search') || '').toLowerCase();
  const shiftFilter = v('att-shift-filter') || '';
  const statusFilter = v('att-status-filter') || '';
  const vascularFilter = v('att-vascular-filter') || '';

  const resources = DB.getResources();
  const appts = DB.getAppointments().filter(a => a.date === date);
  let rows = appts.map(a => ({ appointment: a, attendance: attendanceForAppointment(a) }));

  rows = rows.filter(({ appointment: a, attendance }) => {
    const p = appointmentPatient(a);
    if (shiftFilter && a.shift !== shiftFilter) return false;
    const status = attendance?.status || 'ยังไม่มา';
    if (statusFilter && status !== statusFilter) return false;
    const vType = patientAccessType(p);
    if (vascularFilter && vType !== vascularFilter) return false;
    if (q) {
      const text = `${p?.hn || ''} ${p?.name || ''} ${a.shift || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const el = document.getElementById('attendance-table');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = emptyHtml('ไม่พบข้อมูลตามเงื่อนไขที่เลือก');
    return;
  }

  const ageCalc = (dob) => {
    if (!dob) return '-';
    const diff = new Date(todayStr()) - new Date(dob);
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  el.innerHTML = `<div class="att-list">
    ${rows.map(({ appointment: a, attendance }) => {
      const p = appointmentPatient(a);
      const status = attendance?.status || 'ยังไม่มา';
      const vType = patientAccessType(p);
      const vBadge = { AVF: 'badge-ok', AVG: 'badge-info', PC: 'badge-pend', DLC: 'badge-pos', TLC: 'badge-pend' };
      const shiftShort = (a.shift || '')
        .replace('Shift 1 (เช้า)', 'S1 เช้า')
        .replace('Shift 2 (บ่าย)', 'S2 บ่าย')
        .replace('Shift 3 (เย็น)', 'S3 เย็น');
      const rowCls = { 'มาแล้ว': 'att-ok', 'ยังไม่มา': 'att-pending', 'งดฟอก': 'att-skip', 'เลื่อนนัด': 'att-delay' }[status] || 'att-pending';
      const age = ageCalc(p?.dob);
      return `<div class="att-row ${rowCls}">
        <div class="att-row-body">
          <div class="att-row-top">
            <span class="att-row-name">${h(p?.name || '-')}</span>
            <span class="att-row-hn">${h(p?.hn || '-')}</span>
          </div>
          <div class="att-row-tags">
            ${vType ? `<span class="badge ${vBadge[vType] || 'badge-gray'}">${h(vType)}</span>` : ''}
            ${shiftShort ? `<span class="att-tag">${shiftShort}</span>` : ''}
            ${p?.dryWeight ? `<span class="att-tag">DW ${h(p.dryWeight)} kg</span>` : ''}
            ${attendance?.time ? `<span class="att-tag">${h(attendance.time)}</span>` : ''}
            ${age !== '-' ? `<span class="att-tag att-tag-muted">อายุ ${age} ปี</span>` : ''}
            ${p?.coverage ? `<span class="att-tag att-tag-muted">${hd(p.coverage)}</span>` : ''}
          </div>
          <div class="att-row-status">${statusBadge(status)}</div>
        </div>
        <button class="btn ${status === 'มาแล้ว' ? 'btn-outline' : 'btn-primary'} btn-sm att-action-btn"
          onclick="openAttendanceModal(${jsArg(a.id)})">
          ${status === 'มาแล้ว' ? 'แก้ไข' : 'เช็ค'}
        </button>
      </div>`;
    }).join('')}
  </div>`;
}

export function exportAttendancePDF() {
  window.print();
}

export function openAttendanceModal(appointmentId = '') {
  const appt = DB.getAppointments().find(a => a.id === appointmentId);
  const existing = appt ? attendanceForAppointment(appt) : null;
  ['att-id', 'att-appt', 'att-pt', 'att-time', 'att-staff', 'att-pre-weight', 'att-post-weight', 'att-bp-pre', 'att-bp-post', 'att-uf-goal', 'att-uf-actual', 'att-complication', 'att-note'].forEach(id => set(id, ''));
  fillPatientSelect('att-pt');
  set('att-id', existing?.id || '');
  set('att-appt', appointmentId || existing?.appointmentId || '');
  set('att-date-form', appt?.date || existing?.date || v('att-date') || todayStr());
  set('att-pt', appt?.ptId || existing?.ptId || '');
  set('att-status', existing?.status || 'มาแล้ว');
  set('att-time', existing?.time || new Date().toTimeString().slice(0, 5));
  set('att-staff', existing?.staff || '');
  set('att-pre-weight', existing?.preWeight || '');
  set('att-post-weight', existing?.postWeight || '');
  set('att-bp-pre', existing?.bpPre || '');
  set('att-bp-post', existing?.bpPost || '');
  set('att-uf-goal', existing?.ufGoal || '');
  set('att-uf-actual', existing?.ufActual || '');
  set('att-complication', existing?.complication || '');
  set('att-note', existing?.note || '');
  openModal('att-modal');
}

export function closeAttendanceModal() {
  closeModal('att-modal');
}

export function saveAttendance() {
  const ptId = v('att-pt');
  const date = v('att-date-form');
  if (!ptId || !date) {
    showToast('กรุณาเลือกผู้ป่วยและวันที่', 'error');
    return;
  }
  const row = {
    id: v('att-id') || uid(),
    appointmentId: v('att-appt'),
    ptId,
    date,
    status: v('att-status') || 'มาแล้ว',
    time: v('att-time'),
    staff: v('att-staff'),
    preWeight: v('att-pre-weight'),
    postWeight: v('att-post-weight'),
    bpPre: v('att-bp-pre'),
    bpPost: v('att-bp-post'),
    ufGoal: v('att-uf-goal'),
    ufActual: v('att-uf-actual'),
    complication: v('att-complication'),
    note: v('att-note'),
  };
  if (v('att-id')) DB.updateAttendance(row.id, row);
  else DB.addAttendance(row);
  if (row.appointmentId) {
    const appt = DB.getAppointments().find(a => a.id === row.appointmentId);
    if (appt) DB.updateAppointment(appt.id, { ...appt, status: row.status });
  }
  closeAttendanceModal();
  renderAttendancePage();
  renderSchedulePage();
  renderDailyDashboard();
  showToast('บันทึกเช็คชื่อแล้ว', 'ok');
}

export function renderResourcePage() {
  seedDefaultResources();
  const el = document.getElementById('resource-table');
  if (!el) return;
  const todayAppts = DB.getAppointments().filter(isToday);
  const rows = DB.getResources().sort((a, b) => `${a.type}${a.name}`.localeCompare(`${b.type}${b.name}`));
  el.innerHTML = rows.length ? `<div class="form-grid-4">
    ${rows.map(r => {
      const used = todayAppts.some(a => a.bedId === r.id || a.machineId === r.id);
      return `<article class="resource-tile">
        <span class="badge ${r.type === 'bed' ? 'badge-info' : 'badge-ok'}">${r.type === 'bed' ? 'เตียง' : 'เครื่อง'}</span>
        <strong>${h(r.name)}</strong>
        <small>${h(r.zone || '-')}</small>
        <span>${statusBadge(used ? 'ใช้งานวันนี้' : (r.status || 'พร้อมใช้'))}</span>
        <button class="btn btn-outline btn-sm" onclick="editResource(${jsArg(r.id)})">แก้ไข</button>
      </article>`;
    }).join('')}
  </div>` : emptyHtml('ยังไม่มีทะเบียนเตียง/เครื่อง');
}

export function openResourceModal() {
  ['res-id', 'res-name', 'res-zone', 'res-note'].forEach(id => set(id, ''));
  set('res-type', 'bed');
  set('res-status', 'พร้อมใช้');
  openModal('res-modal');
}

export function editResource(id) {
  const r = DB.getResources().find(x => x.id === id);
  if (!r) return;
  set('res-id', r.id);
  set('res-type', r.type || 'bed');
  set('res-name', r.name || '');
  set('res-status', r.status || 'พร้อมใช้');
  set('res-zone', r.zone || '');
  set('res-note', r.note || '');
  openModal('res-modal');
}

export function saveResource() {
  const row = {
    id: v('res-id') || uid(),
    type: v('res-type') || 'bed',
    name: v('res-name').trim(),
    status: v('res-status') || 'พร้อมใช้',
    zone: v('res-zone'),
    note: v('res-note'),
  };
  if (!row.name) {
    showToast('กรุณาระบุชื่อเตียงหรือเครื่อง', 'error');
    return;
  }
  if (v('res-id')) DB.updateResource(row.id, row);
  else DB.addResource(row);
  closeModal('res-modal');
  renderResourcePage();
  renderDailyDashboard();
  showToast('บันทึกเตียง/เครื่องแล้ว', 'ok');
}

export function closeResourceModal() {
  closeModal('res-modal');
}

export function renderStockPage() {
  const items = DB.getStockItems();
  const el = document.getElementById('stock-table');
  const moves = document.getElementById('stock-moves');
  if (el) {
    el.innerHTML = items.length ? `<div class="record-card-list">
      ${items.map(item => {
        const balance = stockBalance(item);
        const low = balance <= Number(item.minQty || 0);
        return `<article class="record-card ${low ? 'is-danger' : 'is-ok'}">
          <div class="record-card-top">
            <div class="record-icon">ST</div>
            <div class="record-title"><strong>${h(item.name)}</strong><span>${h(item.category || 'เวชภัณฑ์')} | ${h(item.unit || '-')}</span></div>
            <div class="record-meta"><span class="badge ${low ? 'badge-pos' : 'badge-ok'}">${low ? 'ต่ำกว่าขั้นต่ำ' : 'ปกติ'}</span></div>
          </div>
          <div class="record-card-bottom">
            <section class="record-info-block"><span class="record-label">คงเหลือ</span><strong>${balance}</strong><small>${h(item.unit || '')}</small></section>
            <section class="record-info-block"><span class="record-label">ขั้นต่ำ</span><strong>${h(item.minQty || 0)}</strong><small>แจ้งเตือน</small></section>
            <section class="record-info-block"><span class="record-label">หมดอายุ</span><strong>${thDate(item.expire)}</strong><small>${item.expire ? `${diffDays(todayStr(), item.expire)} วัน` : '-'}</small></section>
            <section class="record-info-block"><span class="record-label">Lot</span><strong>${hd(item.lot)}</strong><small>${hd(item.supplier)}</small></section>
            <section class="record-info-block"><span class="record-label">จัดการ</span><button class="btn btn-outline btn-sm" onclick="editStockItem(${jsArg(item.id)})">แก้ไข</button></section>
          </div>
        </article>`;
      }).join('')}
    </div>` : emptyHtml('ยังไม่มีรายการเวชภัณฑ์');
  }
  if (moves) {
    const list = [...DB.getStockMoves()].slice(-10).reverse();
    moves.innerHTML = list.length ? `<div class="stock-move-list">${list.map(m => {
      const item = byId(items, m.itemId);
      const isIn = m.type === 'รับเข้า';
      return `<div class="stock-move-row">
        <span class="stock-move-type ${isIn ? 'smt-in' : 'smt-out'}">${h(m.type || '-')}</span>
        <span class="stock-move-name">${h(item?.name || '-')}</span>
        <span class="stock-move-qty">${h(m.qty || 0)} ${h(item?.unit || '')}</span>
        <span class="stock-move-meta">${thDate(m.date)} · ${h(m.staff || '-')}</span>
      </div>`;
    }).join('')}</div>` : emptyHtml('ยังไม่มีประวัติรับเข้า/เบิกใช้');
  }
  fillStockSelect('move-item');
}

export function openStockItemModal() {
  ['stock-id', 'stock-name', 'stock-category', 'stock-unit', 'stock-qty', 'stock-min', 'stock-lot', 'stock-expire', 'stock-supplier'].forEach(id => set(id, ''));
  openModal('stock-item-modal');
}

export function editStockItem(id) {
  const item = DB.getStockItems().find(x => x.id === id);
  if (!item) return;
  set('stock-id', item.id);
  set('stock-name', item.name || '');
  set('stock-category', item.category || '');
  set('stock-unit', item.unit || '');
  set('stock-qty', item.qty || 0);
  set('stock-min', item.minQty || 0);
  set('stock-lot', item.lot || '');
  set('stock-expire', item.expire || '');
  set('stock-supplier', item.supplier || '');
  openModal('stock-item-modal');
}

export function saveStockItem() {
  const row = {
    id: v('stock-id') || uid(),
    name: v('stock-name').trim(),
    category: v('stock-category'),
    unit: v('stock-unit'),
    qty: Number(v('stock-qty') || 0),
    minQty: Number(v('stock-min') || 0),
    lot: v('stock-lot'),
    expire: v('stock-expire'),
    supplier: v('stock-supplier'),
  };
  if (!row.name) {
    showToast('กรุณาระบุชื่อเวชภัณฑ์', 'error');
    return;
  }
  if (v('stock-id')) DB.updateStockItem(row.id, row);
  else DB.addStockItem(row);
  closeModal('stock-item-modal');
  renderStockPage();
  renderDailyDashboard();
  showToast('บันทึกเวชภัณฑ์แล้ว', 'ok');
}

export function closeStockItemModal() {
  closeModal('stock-item-modal');
}

export function openStockMoveModal(type = 'เบิกใช้') {
  ['move-id', 'move-item', 'move-qty', 'move-staff', 'move-note'].forEach(id => set(id, ''));
  set('move-date', todayStr());
  set('move-type', type);
  fillStockSelect('move-item');
  openModal('stock-move-modal');
}

export function saveStockMove() {
  const item = DB.getStockItems().find(x => x.id === v('move-item'));
  const qty = Number(v('move-qty') || 0);
  if (!item || qty <= 0) {
    showToast('กรุณาเลือกเวชภัณฑ์และจำนวนให้ถูกต้อง', 'error');
    return;
  }
  const type = v('move-type') || 'เบิกใช้';
  const nextQty = type === 'รับเข้า' ? stockBalance(item) + qty : stockBalance(item) - qty;
  if (nextQty < 0) {
    showToast('จำนวนคงเหลือไม่พอสำหรับเบิกใช้', 'error');
    return;
  }
  DB.updateStockItem(item.id, { ...item, qty: nextQty });
  DB.addStockMove({
    id: uid(),
    itemId: item.id,
    date: v('move-date') || todayStr(),
    type,
    qty,
    staff: v('move-staff'),
    note: v('move-note'),
  });
  closeModal('stock-move-modal');
  renderStockPage();
  renderDailyDashboard();
  showToast('บันทึกสต็อกแล้ว', 'ok');
}

export function closeStockMoveModal() {
  closeModal('stock-move-modal');
}

const DLC_WARN_START = 60;   // เริ่มเตือน 60 วัน

export function getCatheterAlerts() {
  return activePatients().map(p => {
    const access = latestAccess(p.id);
    const type = normalizeAccess(p.vascularType || access?.type || '');
    if (!CATHETER_TYPES.some(t => normalizeAccess(t) === type)) return null;
    const start = access?.insertDate || p.start;
    if (!start) return null;
    const days = diffDays(start, todayStr());
    if (days < DLC_WARN_START) return null;
    const dlcStatus = days >= CATHETER_WARN_DAYS ? 'overdue' : 'warning';
    return { patient: p, access, type, days, dlcStatus };
  }).filter(Boolean).sort((a, b) => b.days - a.days);
}

export function renderDlcAlertPage() {
  const el = document.getElementById('dlc-alert-table');
  const summaryEl = document.getElementById('dlc-summary-stats');
  const filterVal = v('dlc-filter') || '';

  const allRows = getCatheterAlerts();
  const overdueRows = allRows.filter(r => r.dlcStatus === 'overdue');
  const warningRows = allRows.filter(r => r.dlcStatus === 'warning');

  if (summaryEl) {
    const normalCount = activePatients().filter(p => {
      const acc = latestAccess(p.id);
      const type = normalizeAccess(p.vascularType || acc?.type || '');
      const start = acc?.insertDate || p.start;
      if (!CATHETER_TYPES.some(t => normalizeAccess(t) === type) || !start) return false;
      return diffDays(start, todayStr()) < DLC_WARN_START;
    }).length;
    summaryEl.innerHTML = `<div class="dlc-summary-row">
      <div class="dlc-summary-card dlc-sc-overdue">
        <div class="dlc-summary-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="dlc-summary-body">
          <strong>${overdueRows.length}</strong>
          <span>เกินกำหนด (≥ 90 วัน)</span>
        </div>
      </div>
      <div class="dlc-summary-card dlc-sc-warning">
        <div class="dlc-summary-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="dlc-summary-body">
          <strong>${warningRows.length}</strong>
          <span>ใกล้ครบกำหนด (60–89 วัน)</span>
        </div>
      </div>
      <div class="dlc-summary-card dlc-sc-normal">
        <div class="dlc-summary-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="dlc-summary-body">
          <strong>${normalCount}</strong>
          <span>ปกติ (&lt; 60 วัน)</span>
        </div>
      </div>
    </div>`;
  }

  if (!el) return;

  let rows = filterVal === 'overdue' ? overdueRows
    : filterVal === 'warning' ? warningRows
    : filterVal === 'normal' ? []  // normal patients not tracked here
    : allRows;

  if (!rows.length) {
    el.innerHTML = emptyHtml(filterVal === 'overdue'
      ? 'ไม่มี DLC/PC/TLC ที่เกินกำหนด 90 วัน'
      : filterVal === 'warning'
      ? 'ไม่มี DLC/PC/TLC ที่ใกล้ครบกำหนด'
      : 'ยังไม่มีข้อมูล Catheter ที่ต้องติดตาม');
    return;
  }

  const dlcStatusBadge = (status) => {
    if (status === 'overdue') return `<span class="dlc-status-badge dlc-status-overdue">เกินกำหนด</span>`;
    return `<span class="dlc-status-badge dlc-status-warning">ใกล้ครบ</span>`;
  };

  el.innerHTML = `<div class="dlc-card-list">
    ${rows.map(row => {
      const isOverdue = row.dlcStatus === 'overdue';
      return `<div class="dlc-card ${isOverdue ? 'dlc-card-overdue' : 'dlc-card-warning'}">
        <div class="dlc-days-box">
          <strong>${row.days}</strong>
          <span>วัน</span>
        </div>
        <div class="dlc-card-body">
          <div class="dlc-card-name">${h(row.patient.name || '-')}</div>
          <div class="dlc-card-meta">
            <span class="att-row-hn">${h(row.patient.hn || '-')}</span>
            <span class="badge ${isOverdue ? 'badge-pos' : 'badge-pend'}">${h(row.type)}</span>
            ${row.access?.site ? `<span class="att-tag att-tag-muted">${hd(row.access.site)}</span>` : ''}
          </div>
          <div class="dlc-card-sub">
            ${dlcStatusBadge(row.dlcStatus)}
            <span class="att-tag att-tag-muted">ใส่ ${thDate(row.access?.insertDate || row.patient.start)}</span>
            ${row.patient.coverage ? `<span class="att-tag att-tag-muted">${hd(row.patient.coverage)}</span>` : ''}
            ${row.patient.phone ? `<span class="att-tag att-tag-muted">${hd(row.patient.phone)}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-outline btn-sm dlc-view-btn"
          onclick="showSection('access',document.querySelector('[data-nav-section=access]'))" title="ดูหน้า Access">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ดู
        </button>
      </div>`;
    }).join('')}
  </div>`;
}
