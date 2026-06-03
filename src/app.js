/**
 * app.js — Entry point.
 *
 * Responsibilities:
 *  1. Initialise the database from localStorage.
 *  2. Wire up the router (section navigation).
 *  3. Expose public functions to the global scope so that
 *     HTML onclick handlers can call them.
 */

import { DB } from './services/db.service.js';
import { todayStr } from './utils/date.util.js';
import { fillSelect } from './utils/dom.util.js';
import { showToast } from './components/toast.component.js';
import { closeDeleteModal } from './components/modal.component.js';

import { renderDashboard } from './modules/dashboard.module.js';
import {
  savePatient, editPatient, renderPatientTable,
  openPatientModal, closePtModal, confirmDeletePatient,
  setUpdateBadges as ptSetBadges,
} from './modules/patient.module.js';
import {
  saveSerology, editSerology, renderSeroTable,
  openSeroModal, closeSeroModal, confirmDeleteSero,
  setUpdateBadges as seroSetBadges,
} from './modules/serology.module.js';
import {
  saveAccess, editAccess, renderAccessTable,
  openAccessModal, closeAccessModal, confirmDeleteAccess,
} from './modules/access.module.js';
import {
  saveInfection, editInfection, renderInfTable,
  openInfModal, closeInfModal, confirmDeleteInf,
  setUpdateBadges as infSetBadges,
} from './modules/infection.module.js';
import { renderSurveillance } from './modules/surveillance.module.js';
import {
  generateReport, exportJSON, exportCSV, importJSON, clearAll,
  initMonthlyReport, renderMonthlyReport,
} from './modules/report.module.js';
import { DEMO_DB } from './data/demo.data.js';

// ── Inject updateBadges into modules that need it ─────────────────────────

function updateBadges() {
  const due = DB.getSerology().filter(s => s.nextDue && s.nextDue <= todayStr()).length;

  const badgeEl  = document.getElementById('badge-due');
  const alertTxt = document.getElementById('topbar-alert-txt');
  const alertBtn = document.getElementById('topbar-alerts');
  const bnBadge  = document.getElementById('bn-sero-badge');

  if (badgeEl)  { badgeEl.textContent = due; badgeEl.style.display = due > 0 ? 'inline' : 'none'; }
  if (bnBadge)  { bnBadge.textContent = due; bnBadge.style.display = due > 0 ? '' : 'none'; }

  const total = due + DB.getInfections().filter(x => x.date?.slice(0, 7) === todayStr().slice(0, 7)).length;
  if (alertTxt) alertTxt.textContent = total > 0 ? `${total} รายการ` : 'ระบบปกติ';
  if (alertBtn) {
    alertBtn.style.background = total > 0 ? 'var(--red-50)'  : 'var(--teal-50)';
    alertBtn.style.color      = total > 0 ? 'var(--red-600)' : 'var(--teal-600)';
  }
}

ptSetBadges(updateBadges);
seroSetBadges(updateBadges);
infSetBadges(updateBadges);

// ── Router ────────────────────────────────────────────────────────────────

const SECTION_TITLES = {
  dashboard:    'ภาพรวม (Dashboard)',
  patient:      'ทะเบียนผู้ป่วย',
  serology:     'Serology HBV/HCV/HIV',
  access:       'Vascular Access',
  infection:    'Infection Events',
  surveillance: 'Surveillance',
  monthlyreport:'สรุปข้อมูลรายเดือน',
  report:       'รายงาน / Export',
};

const BN_INDEX = { dashboard:0, patient:1, serology:2, infection:3, surveillance:4 };

function syncBn(idx) {
  document.querySelectorAll('.bn-item').forEach((b, i) => b.classList.toggle('active', i === idx));
}

function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  if (el) el.classList.add('active');

  const title = document.getElementById('topbar-title');
  if (title) title.textContent = SECTION_TITLES[id] || id;

  if (BN_INDEX[id] !== undefined) syncBn(BN_INDEX[id]);

  switch (id) {
    case 'dashboard':     renderDashboard(); break;
    case 'patient':       renderPatientTable(); break;
    case 'serology':      fillSelect('sero-pt', DB.getPatients()); renderSeroTable(); break;
    case 'access':        fillSelect('acc-pt',  DB.getPatients()); renderAccessTable(); break;
    case 'infection':     fillSelect('inf-pt',  DB.getPatients()); renderInfTable(); break;
    case 'surveillance':  renderSurveillance(); break;
    case 'monthlyreport': initMonthlyReport(); break;
  }

  if (window.innerWidth <= 768) closeSidebar();
}

// ── Sidebar ───────────────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('overlay')?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('open');
}

// ── Demo data ─────────────────────────────────────────────────────────────

function loadDemoData() {
  const db = DB.get();
  if (db.patients.length || db.serology.length || db.access.length || db.infections.length) {
    if (!confirm('มีข้อมูลอยู่แล้ว ต้องการล้างและโหลด Demo Data?')) return;
  }
  DB.reset(DEMO_DB);
  showSection('dashboard', document.querySelector('.nav-item'));
  showToast(`โหลด Demo Data สำเร็จ — ผู้ป่วย ${DEMO_DB.patients.length} ราย`, 'ok');
}

// ── Date display ──────────────────────────────────────────────────────────

(function initDateDisplay() {
  const now  = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
  const topDate  = document.getElementById('topbar-date');
  const sideDate = document.getElementById('sidebar-today');
  if (topDate)  topDate.textContent  = now.toLocaleDateString('th-TH', opts);
  if (sideDate) sideDate.textContent = now.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
})();

// ── PWA: register service worker ──────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./service-worker.js').catch(() => {})
  );
}

// ── Expose to global scope (HTML onclick handlers) ────────────────────────

Object.assign(window, {
  // Router
  showSection, toggleSidebar, closeSidebar, syncBn,

  // Patient
  savePatient, editPatient, openPatientModal, closePtModal,
  confirmDeletePatient,
  renderTable: (type) => {
    if (type === 'patient')   renderPatientTable();
    if (type === 'serology')  renderSeroTable();
    if (type === 'access')    renderAccessTable();
    if (type === 'infection') renderInfTable();
  },

  // Serology
  saveSerology, editSerology, openSeroModal, closeSeroModal, confirmDeleteSero,

  // Vascular Access
  saveAccess, editAccess, openAccessModal, closeAccessModal, confirmDeleteAccess,

  // Infection
  saveInfection, editInfection, openInfModal, closeInfModal, confirmDeleteInf,

  // Report
  generateReport, exportJSON, exportCSV, importJSON, clearAll,
  renderMonthlyReport,

  // Surveillance
  renderSurveillance,

  // Modal
  closeModal: closeDeleteModal,

  // Demo
  loadDemoData,

  // Dashboard (used by importJSON)
  renderDashboard,

  updateBadges,
});

// ── Initialise ────────────────────────────────────────────────────────────

DB.init();
renderDashboard();
updateBadges();
