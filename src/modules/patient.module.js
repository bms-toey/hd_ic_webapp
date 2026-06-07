import { DB } from '../services/db.service.js';
import { uid, v, set, emptyHtml, h, hd, jsArg } from '../utils/dom.util.js';
import { diffDays, thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';
import { openModal, closeModal, confirmDelete } from '../components/modal.component.js';

export function openPatientModal() {
  clearPatientForm();
  document.getElementById('pt-modal-title').textContent = 'เพิ่มผู้ป่วยใหม่';
  setContext('ข้อมูลหลักของผู้ป่วย', 'กรอก HN และชื่อให้ครบก่อนบันทึก จากนั้นเพิ่มข้อมูล clinical ในเมนูที่เกี่ยวข้อง');
  setDeleteVisible(false);
  openModal('pt-modal');
}

export function closePtModal() {
  closeModal('pt-modal');
  clearPatientForm();
}

export function savePatient() {
  const hn = document.getElementById('pt-hn').value.trim();
  const name = document.getElementById('pt-name').value.trim();
  if (!hn || !name) {
    showToast('กรุณากรอก HN และชื่อผู้ป่วย', 'error');
    return;
  }

  const eid = v('pt-id');
  const patient = {
    id: eid || uid(),
    hn,
    name,
    dob: v('pt-dob'),
    sex: v('pt-sex'),
    start: v('pt-start'),
    cause: v('pt-cause'),
    shift: v('pt-shift'),
    machine: v('pt-machine'),
    status: v('pt-status') || 'Active',
    note: v('pt-note'),
    created: todayStr(),
  };

  if (eid) DB.updatePatient(eid, patient);
  else DB.addPatient(patient);

  renderPatientTable();
  updateBadges();
  closePtModal();
  showToast('บันทึกผู้ป่วยเรียบร้อย', 'ok');
}

export function editPatient(id) {
  const p = DB.getPatients().find(x => x.id === id);
  if (!p) return;

  set('pt-id', p.id);
  set('pt-hn', p.hn);
  set('pt-name', p.name);
  set('pt-dob', p.dob || '');
  set('pt-sex', p.sex || '');
  set('pt-start', p.start || '');
  set('pt-cause', p.cause || '');
  set('pt-shift', p.shift || '');
  set('pt-machine', p.machine || '');
  set('pt-status', p.status || 'Active');
  set('pt-note', p.note || '');

  document.getElementById('pt-modal-title').textContent = 'แก้ไขข้อมูลผู้ป่วย';
  setContext(`${p.hn || '-'} - ${p.name || '-'}`, `สถานะ: ${p.status || '-'} | เริ่ม HD: ${thDate(p.start)}`);
  setDeleteVisible(true);
  openModal('pt-modal');
}

export function renderPatientTable() {
  const q = (v('pt-search') || '').toLowerCase();
  const flt = v('pt-filter') || '';
  const allAccess = DB.getAccess();
  const allInfections = DB.getInfections();
  const rows = DB.getPatients().filter(p => {
    if (flt && p.status !== flt) return false;
    return !q || `${p.hn || ''}${p.name || ''}`.toLowerCase().includes(q);
  });

  if (!rows.length) {
    document.getElementById('pt-table').innerHTML = emptyHtml('ยังไม่มีข้อมูลผู้ป่วย');
    return;
  }

  document.getElementById('pt-table').innerHTML = `<div class="clinical-patient-list">
    ${rows.map(p => renderClinicalPatientCard(p, allAccess, allInfections)).join('')}
  </div>`;
}

function renderClinicalPatientCard(p, allAccess, allInfections) {
  const access = latestByDate(allAccess.filter(a => a.ptId === p.id), 'date') || {};
  const infection = latestByDate(allInfections.filter(i => i.ptId === p.id), 'date') || {};
  const risk = getPatientRisk(access, infection);
  const statusClass = p.status === 'Active' ? 'badge-ok' : p.status === 'Transfer' ? 'badge-pend' : p.status === 'Deceased' ? 'badge-pos' : 'badge-info';
  const age = yearsSince(p.dob);
  const vintage = yearsSince(p.start);
  const signs = Array.isArray(access.signs) ? access.signs : [];
  const latestDate = latestDateOf(access.date, infection.date);
  const staff = access.staff || '-';
  const trend = getTrend(access, infection);
  const culture = access.culture || infection.org || '';
  const note = p.note || access.note || infection.note || '-';

  return `<article class="clinical-patient-card risk-${risk.key} clickable-row" tabindex="0"
      role="button" aria-label="Open patient ${h(p.hn || '')} ${h(p.name || '')}"
      onclick="editPatient(${jsArg(p.id)})" onkeydown="if(event.key==='Enter') editPatient(${jsArg(p.id)})">
    <div class="clinical-card-top">
      <div class="risk-badge">${risk.label}</div>
      <div class="patient-avatar" aria-hidden="true">${patientInitial(p.name)}</div>
      <div class="patient-main">
        <strong>${h(p.name || '-')}</strong>
        <span>${h(p.hn || '-')} | ${hd(p.sex)} | ${age ? `Age ${age}` : 'Age -'} | ${vintage ? `HD ${vintage} yr` : 'HD -'}</span>
      </div>
      <div class="patient-meta">
        <span class="badge ${statusClass}">${h(p.status || 'Active')}</span>
        <span>${hd(p.machine) || 'Machine -'}</span>
        <span>${hd(p.shift) || 'Shift -'}</span>
      </div>
    </div>
    <div class="clinical-card-bottom">
      <section class="clinical-info-block access-${accessTypeKey(access.type)}">
        <span class="clinical-label">Vascular Access</span>
        <strong>${hd(access.type) || '-'}</strong>
        <small>${hd(access.site) || '-'}</small>
        <small>Inserted: ${thDate(access.insertDate)}</small>
        <em>${access.insertDate ? `${diffDays(access.insertDate, todayStr())} Days` : '-'}</em>
      </section>
      <section class="clinical-info-block">
        <span class="clinical-label">Exit Site</span>
        ${gradeBadge(access.grade)}
        <small>${access.accessStatus || '-'}</small>
      </section>
      <section class="clinical-info-block">
        <span class="clinical-label">Culture Result</span>
        ${cultureBadge(culture)}
        <small>${infection.bc ? `Blood Cx: ${h(infection.bc)}` : '&nbsp;'}</small>
      </section>
      <section class="clinical-info-block">
        <span class="clinical-label">Infection Signs</span>
        <div class="sign-pill-row">${signs.length ? signs.map(s => `<span class="sign-pill sign-danger">${h(s)}</span>`).join('') : '<span class="sign-pill sign-ok">No Symptom</span>'}</div>
      </section>
      <section class="clinical-info-block timeline-block">
        <span class="clinical-label">Last Assessment</span>
        <strong>${thDate(latestDate)}</strong>
        <small>Updated by ${h(staff)}</small>
        <span class="trend trend-${trend.key}">${trend.label}</span>
        <small class="timeline-note">Note: ${h(note)}</small>
      </section>
    </div>
  </article>`;
}

function latestByDate(rows, key) {
  return [...rows].sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')))[0];
}

function latestDateOf(...dates) {
  return dates.filter(Boolean).sort().pop() || '';
}

function yearsSince(dateStr) {
  if (!dateStr) return '';
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return '';
  const today = new Date(todayStr());
  let years = today.getFullYear() - start.getFullYear();
  const passed = today.getMonth() > start.getMonth() || (today.getMonth() === start.getMonth() && today.getDate() >= start.getDate());
  if (!passed) years -= 1;
  return Math.max(years, 0);
}

function patientInitial(name) {
  return h((name || 'HD').trim().slice(0, 1).toUpperCase() || 'HD');
}

function accessTypeKey(type = '') {
  const value = type.toLowerCase();
  if (value.includes('avf')) return 'avf';
  if (value.includes('avg')) return 'avg';
  if (value.includes('perm')) return 'perm';
  if (value.includes('cvc') || value.includes('tdc')) return 'tdc';
  return 'default';
}

function getPatientRisk(access = {}, infection = {}) {
  const grade = Number(access.grade || 0);
  const culture = `${access.culture || ''} ${infection.org || ''}`.toUpperCase();
  const signs = Array.isArray(access.signs) ? access.signs.length : 0;

  if (grade >= 3 || /MRSA|ESBL|CRE/.test(culture) || infection.bc === 'Positive') return { key: 'critical', label: 'CRITICAL' };
  if (grade >= 2 || /MSSA/.test(culture) || signs >= 2) return { key: 'high', label: 'HIGH' };
  if (grade === 1 || signs === 1 || accessTypeKey(access.type) === 'tdc') return { key: 'medium', label: 'MEDIUM' };
  return { key: 'low', label: 'LOW' };
}

function getTrend(access = {}, infection = {}) {
  const grade = Number(access.grade || 0);
  if (grade >= 2 || infection.bc === 'Positive') return { key: 'worsening', label: 'Worsening' };
  if (grade === 0 && !(access.signs || []).length) return { key: 'improving', label: 'Improving' };
  return { key: 'stable', label: 'Stable' };
}

function gradeBadge(grade) {
  if (grade === '' || grade === undefined || grade === null) return '<span class="exit-grade exit-grade-empty">-</span>';
  return `<span class="exit-grade exit-grade-g${h(grade)}">G${h(grade)}</span>`;
}

function cultureBadge(value) {
  if (!value) return '<span class="culture-badge culture-ok">No Growth</span>';
  const upper = String(value).toUpperCase();
  const danger = /MRSA|ESBL|CRE/.test(upper);
  const warn = /MSSA|PSEUDOMONAS|KLEBSIELLA|E\. COLI|AUREUS/.test(upper);
  const ok = /NO\s*GROWTH|NEGATIVE/.test(upper);
  const cls = danger ? 'culture-danger' : warn ? 'culture-warn' : ok ? 'culture-ok' : 'culture-info';
  return `<span class="culture-badge ${cls}">${h(value)}</span>`;
}

function clearPatientForm() {
  ['pt-id', 'pt-hn', 'pt-name', 'pt-dob', 'pt-sex', 'pt-start', 'pt-cause', 'pt-shift', 'pt-machine', 'pt-note'].forEach(id => set(id, ''));
  set('pt-status', 'Active');
  setDeleteVisible(false);
}

function setDeleteVisible(show) {
  const btn = document.getElementById('pt-delete-btn');
  if (btn) btn.hidden = !show;
}

function setContext(title, detail) {
  const el = document.getElementById('pt-context');
  if (!el) return;
  el.innerHTML = `<strong>${h(title)}</strong><span>${h(detail)}</span>`;
}

export function confirmDeletePatient(id) {
  confirmDelete('patient', id, () => {
    closePtModal();
    renderPatientTable();
    updateBadges();
  });
}

let updateBadges = () => {};
export const setUpdateBadges = (fn) => { updateBadges = fn; };
