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
import { AuthService } from './services/auth.service.js';
import { SettingsService } from './services/settings.service.js';
import { CONFIG } from './config/app.config.js';
import { todayStr } from './utils/date.util.js';
import { emptyHtml, fillSelect, h, jsArg, v, set } from './utils/dom.util.js';
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

const LOGIN_REMEMBER_KEY = `${CONFIG.STORAGE_KEY}_remembered_username`;

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
  report:       'รายงาน / Export',
  settings:     'ตั้งค่า',
};

const SECTION_DESCRIPTIONS = {
  dashboard: 'สรุป KPI, alert และสถานะการเฝ้าระวัง Infection Control',
  patient: 'จัดการทะเบียนผู้ป่วย HD และข้อมูลสถานะล่าสุด',
  serology: 'ติดตามผล HBV / HCV / HIV และกำหนดตรวจครั้งถัดไป',
  access: 'บันทึก Vascular Access, Exit Site และประวัติสาย',
  infection: 'จัดการ Infection Events และผลลัพธ์การรักษา',
  surveillance: 'วิเคราะห์อัตราการติดเชื้อและสัญญาณ outbreak',
  report: 'สร้างรายงาน สรุปรายเดือน ส่งออกข้อมูล และจัดการข้อมูลระบบ',
  settings: 'จัดการตัวเลือกทั้งหมดและ User Login ของระบบ',
};

const BN_INDEX = { dashboard:0, patient:1, serology:2, infection:3, surveillance:4 };

function syncBn(idx) {
  document.querySelectorAll('.bn-item').forEach((b, i) => b.classList.toggle('active', i === idx));
}

function showSection(id, el) {
  if (!AuthService.currentUser()) {
    openLogin();
    return;
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  if (el) el.classList.add('active');

  const title = document.getElementById('topbar-title');
  if (title) title.textContent = SECTION_TITLES[id] || id;
  const desc = document.getElementById('topbar-desc');
  if (desc) desc.textContent = SECTION_DESCRIPTIONS[id] || 'Secure data management workspace';
  const breadcrumb = document.getElementById('topbar-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = `HD-IC / ${SECTION_TITLES[id] || id}`;

  if (BN_INDEX[id] !== undefined) syncBn(BN_INDEX[id]);

  switch (id) {
    case 'dashboard':     renderDashboard(); break;
    case 'patient':       renderPatientTable(); break;
    case 'serology':      fillSelect('sero-pt', DB.getPatients()); renderSeroTable(); break;
    case 'access':        fillSelect('acc-pt',  DB.getPatients()); renderAccessTable(); break;
    case 'infection':     fillSelect('inf-pt',  DB.getPatients()); renderInfTable(); break;
    case 'surveillance':  renderSurveillance(); break;
    case 'report':        initMonthlyReport('report-monthly'); break;
    case 'settings':      renderSettingsPage(); break;
  }

  applyPermissions();
  if (window.innerWidth <= 768) closeSidebar();
}

function refreshActiveSection({ silent = false } = {}) {
  if (!AuthService.currentUser()) return;
  const active = document.querySelector('.section.active')?.id || 'dashboard';
  switch (active) {
    case 'dashboard':     renderDashboard(); break;
    case 'patient':       renderPatientTable(); break;
    case 'serology':      fillSelect('sero-pt', DB.getPatients()); renderSeroTable(); break;
    case 'access':        fillSelect('acc-pt', DB.getPatients()); renderAccessTable(); break;
    case 'infection':     fillSelect('inf-pt', DB.getPatients()); renderInfTable(); break;
    case 'surveillance':  renderSurveillance(); break;
    case 'report': {
      const activeReport = document.querySelector('.settings-tab.active[data-report-tab]')?.dataset.reportTab || 'range';
      if (activeReport === 'monthly') renderMonthlyReport('report-monthly');
      else generateReport();
      break;
    }
    case 'settings':      renderSettingsPage(); break;
  }
  updateBadges();
  applyPermissions();
  if (!silent) showToast('ข้อมูลอัปเดตอัตโนมัติแล้ว', 'ok');
}

function showReportPanel(panel = 'range') {
  const target = panel === 'monthly' ? 'monthly' : 'range';
  document.querySelectorAll('[data-report-tab]').forEach(tab => {
    const isActive = tab.dataset.reportTab === target;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-report-panel]').forEach(el => {
    el.hidden = el.dataset.reportPanel !== target;
  });
  if (target === 'monthly') initMonthlyReport('report-monthly');
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

function toggleSidebarCollapse() {
  document.body.classList.toggle('sidebar-collapsed');
}

// ── Demo data ─────────────────────────────────────────────────────────────

async function loadDemoData() {
  const db = DB.get();
  if (db.patients.length || db.serology.length || db.access.length || db.infections.length) {
    const result = await openSettingsActionModal({
      title: 'ยืนยันโหลด Demo Data',
      message: 'มีข้อมูลอยู่แล้ว ต้องการล้างข้อมูลเดิมและโหลด Demo Data?',
      inputValue: null,
      confirmText: 'โหลด Demo Data',
      danger: true,
    });
    if (!result.confirmed) return;
  }
  DB.reset(DEMO_DB);
  showSection('dashboard', document.querySelector('.nav-item'));
  showToast(`โหลด Demo Data สำเร็จ — ผู้ป่วย ${DEMO_DB.patients.length} ราย`, 'ok');
}

// ── Auth / permissions ───────────────────────────────────────────────────

function openLogin() {
  document.body.classList.add('auth-pending');
  document.getElementById('login-modal')?.classList.add('open');
  clearLoginError();
  setTimeout(() => document.getElementById('login-username')?.focus(), 0);
}

function closeLogin() {
  document.body.classList.remove('auth-pending');
  document.body.classList.add('is-authenticated');
  document.getElementById('login-modal')?.classList.remove('open');
  setLoginLoading(false);
  clearLoginError();
}

function requirePermission(permission, fn) {
  return (...args) => {
    if (!AuthService.currentUser()) {
      openLogin();
      return;
    }
    if (!AuthService.hasPermission(permission)) {
      showToast('ไม่มีสิทธิ์ทำรายการนี้', 'error');
      return;
    }
    return fn(...args);
  };
}

function applyPermissions() {
  document.querySelectorAll('[data-permission]').forEach(el => {
    const isDenied = !AuthService.hasPermission(el.dataset.permission);
    if (el.dataset.settingsPanel) {
      const activePanel = document.querySelector('.settings-tab.active')?.dataset.settingsTab || 'options';
      el.hidden = isDenied || el.dataset.settingsPanel !== activePanel;
      return;
    }
    el.hidden = isDenied;
  });
}

function applySettingsOptions() {
  SettingsService.getGroups().forEach(group => {
    group.targetIds.forEach(id => populateOptionSelect(id, group.values));
  });
}

function populateOptionSelect(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  const first = el.querySelector('option[value=""]')?.textContent || '--';
  el.innerHTML = `<option value="">${h(first)}</option>`;
  const options = [...values];
  if (current && !options.includes(current)) options.push(current);
  options.forEach(value => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = formatOptionLabel(id, value);
    el.appendChild(opt);
  });
  el.value = current;
}

function formatOptionLabel(id, value) {
  if (id === 'acc-grade') return value === '0' ? 'Grade 0 — Normal / No sign' : `Grade ${value}`;
  return value;
}

function renderSettingsPage() {
  renderSettingsGroups();
  renderSettingsOptions();
  renderUserList();
  showSettingsPanel(document.querySelector('.settings-tab.active')?.dataset.settingsTab || 'options');
  applyPermissions();
}

function showSettingsPanel(panel = 'options') {
  const target = panel === 'users' ? 'users' : 'options';
  document.querySelectorAll('[data-settings-tab]').forEach(tab => {
    const isActive = tab.dataset.settingsTab === target;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-settings-panel]').forEach(el => {
    const isDenied = el.dataset.permission && !AuthService.hasPermission(el.dataset.permission);
    el.hidden = isDenied || el.dataset.settingsPanel !== target;
  });
}

function renderSettingsGroups() {
  const select = document.getElementById('settings-group');
  if (!select) return;
  const current = select.value;
  const groups = SettingsService.getGroups();
  select.innerHTML = groups.map(group => `<option value="${h(group.id)}">${h(group.label)}</option>`).join('');
  select.value = current && groups.some(group => group.id === current) ? current : groups[0]?.id || '';
}

let settingsActionPending = null;

function openSettingsActionModal({
  title,
  message,
  inputValue = '',
  inputLabel = 'ชื่อตัวเลือก',
  confirmText = 'ตกลง',
  danger = false,
} = {}) {
  const modal = document.getElementById('settings-action-modal');
  const titleEl = document.getElementById('settings-action-title');
  const messageEl = document.getElementById('settings-action-message');
  const inputWrap = document.getElementById('settings-action-input-wrap');
  const inputEl = document.getElementById('settings-action-input');
  const inputLabelEl = document.getElementById('settings-action-input-label');
  const confirmBtn = document.getElementById('settings-action-confirm');
  if (!modal || !confirmBtn) return Promise.resolve({ confirmed: false, value: '' });

  if (titleEl) titleEl.textContent = title || 'ยืนยันรายการ';
  if (messageEl) messageEl.textContent = message || '';
  if (inputLabelEl) inputLabelEl.textContent = inputLabel;
  if (inputWrap) inputWrap.hidden = inputValue === null;
  if (inputEl) inputEl.value = inputValue ?? '';
  confirmBtn.textContent = confirmText;
  confirmBtn.classList.toggle('btn-danger', danger);
  confirmBtn.classList.toggle('btn-primary', !danger);
  modal.classList.add('open');

  requestAnimationFrame(() => {
    const focusTarget = inputValue === null ? confirmBtn : inputEl;
    focusTarget?.focus({ preventScroll: true });
    if (inputEl && inputValue !== null) inputEl.select();
  });

  return new Promise(resolve => {
    settingsActionPending = resolve;
  });
}

function closeSettingsActionModal(confirmed = false, action = confirmed ? 'confirm' : 'cancel') {
  const modal = document.getElementById('settings-action-modal');
  const inputEl = document.getElementById('settings-action-input');
  modal?.classList.remove('open');
  const resolve = settingsActionPending;
  settingsActionPending = null;
  resolve?.({ confirmed, action, value: inputEl?.value ?? '' });
}

function cancelSettingsActionModal() {
  closeSettingsActionModal(false);
}

function confirmSettingsActionModal() {
  closeSettingsActionModal(true, 'confirm');
}

document.getElementById('settings-action-input')?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') confirmSettingsActionModal();
});

function renderSettingsOptions() {
  const list = document.getElementById('settings-options-list');
  const groupId = v('settings-group');
  if (!list || !groupId) return;
  const group = SettingsService.getGroup(groupId);
  if (!group) {
    list.innerHTML = emptyHtml('ไม่พบกลุ่มตัวเลือก');
    return;
  }
  const values = group.allValues || group.values;
  list.innerHTML = `<div class="settings-list-head">
      <div>
        <strong>${h(group.label)}</strong>
        <span>${group.values.length} ใช้งาน · ${group.disabledValues.length} ปิดใช้งาน</span>
      </div>
      <span class="badge badge-info">${h(group.id)}</span>
    </div>
    <div class="settings-option-list">
    ${values.map(value => {
      const used = SettingsService.countUsage(group.id, value, DB.get());
      const disabled = group.disabledValues.includes(value);
      const statusClass = disabled ? 'badge-gray' : used ? 'badge-pend' : 'badge-ok';
      const statusText = disabled ? 'ปิดใช้งาน' : used ? 'ใช้งานอยู่' : 'พร้อมลบ';
      return `<article class="settings-option-row ${used ? 'is-locked' : ''} ${disabled ? 'is-disabled' : ''}">
        <div class="settings-row-icon" aria-hidden="true">⚙</div>
        <div class="settings-row-main">
          <div class="settings-row-title">
            <strong>${h(value)}</strong>
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <p>${h(group.label)} · ${used ? `ถูกใช้ในข้อมูล ${used} รายการ` : 'ยังไม่มีข้อมูลใช้งานตัวเลือกนี้'}${disabled ? ' · ไม่แสดงในฟอร์มใหม่' : ''}</p>
        </div>
        <div class="settings-row-usage">
          <span>Usage</span>
          <strong>${used}</strong>
        </div>
        <div class="settings-row-actions">
          <button class="btn btn-outline btn-sm" onclick="editSettingOption(${jsArg(group.id)}, ${jsArg(value)})">แก้ไข</button>
          ${disabled ? `<button class="btn btn-outline btn-sm" onclick="toggleSettingOption(${jsArg(group.id)}, ${jsArg(value)}, false)">เปิดใช้งาน</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteSettingOption(${jsArg(group.id)}, ${jsArg(value)})">ลบ</button>
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

function addSettingOption() {
  try {
    SettingsService.addOption(v('settings-group'), v('settings-option-new'));
    set('settings-option-new', '');
    applySettingsOptions();
    renderSettingsOptions();
    showToast('เพิ่มตัวเลือกเรียบร้อย', 'ok');
  } catch (err) {
    showToast(err.message || 'เพิ่มตัวเลือกไม่สำเร็จ', 'error');
  }
}

async function editSettingOption(groupId, oldValue) {
  const result = await openSettingsActionModal({
    title: 'แก้ไขชื่อตัวเลือก',
    message: `แก้ไขตัวเลือก "${oldValue}" แล้วกด บันทึก เพื่อยืนยัน`,
    inputValue: oldValue,
    inputLabel: 'ชื่อตัวเลือกใหม่',
    confirmText: 'บันทึก',
  });
  if (!result.confirmed) return;
  const cleanNext = String(result.value).trim();
  if (!cleanNext) {
    showToast('กรุณาระบุชื่อตัวเลือก', 'error');
    return;
  }
  if (cleanNext === oldValue) return;
  try {
    SettingsService.updateOption(groupId, oldValue, cleanNext);
    migrateOptionUsage(groupId, oldValue, cleanNext);
    applySettingsOptions();
    renderSettingsOptions();
    showToast('แก้ไขตัวเลือกเรียบร้อย', 'ok');
  } catch (err) {
    showToast(err.message || 'แก้ไขตัวเลือกไม่สำเร็จ', 'error');
  }
}

async function deleteSettingOption(groupId, value) {
  const used = SettingsService.countUsage(groupId, value, DB.get());
  if (used > 0) {
    const result = await openSettingsActionModal({
      title: 'ลบไม่ได้ เพราะมีข้อมูลใช้งานอยู่',
      message: `"${value}" ถูกใช้งานอยู่ ${used} รายการ จึงลบไม่ได้ แต่สามารถปิดใช้งานเพื่อไม่ให้แสดงในฟอร์มใหม่ได้`,
      inputValue: null,
      confirmText: 'ปิดใช้งานแทน',
    });
    if (result.confirmed) {
      SettingsService.setOptionDisabled(groupId, value, true);
      applySettingsOptions();
      renderSettingsOptions();
      showToast('ปิดใช้งานตัวเลือกเรียบร้อย', 'ok');
    }
    return;
  }
  const result = await openSettingsActionModal({
    title: 'ยืนยันการลบตัวเลือก',
    message: `ลบตัวเลือก "${value}"? รายการนี้ยังไม่มีข้อมูลใช้งานและไม่สามารถกู้คืนได้`,
    inputValue: null,
    confirmText: 'ลบ',
    danger: true,
  });
  if (!result.confirmed) return;
  SettingsService.deleteOption(groupId, value);
  applySettingsOptions();
  renderSettingsOptions();
  showToast('ลบตัวเลือกเรียบร้อย', 'ok');
}

async function toggleSettingOption(groupId, value, disabled) {
  const action = disabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน';
  const result = await openSettingsActionModal({
    title: `${action}ตัวเลือก`,
    message: `${action}ตัวเลือก "${value}"?`,
    inputValue: null,
    confirmText: action,
  });
  if (!result.confirmed) return;
  try {
    SettingsService.setOptionDisabled(groupId, value, disabled);
    applySettingsOptions();
    renderSettingsOptions();
    showToast(`${action}ตัวเลือกเรียบร้อย`, 'ok');
  } catch (err) {
    showToast(err.message || `${action}ตัวเลือกไม่สำเร็จ`, 'error');
  }
}

function migrateOptionUsage(groupId, oldValue, newValue) {
  const group = SettingsService.getGroup(groupId);
  if (!group) return;
  const db = DB.get();
  let changed = false;
  group.fields.forEach(field => {
    (db[field.table] || []).forEach(row => {
      const current = row[field.key];
      if (Array.isArray(current)) {
        const next = current.map(item => item === oldValue ? newValue : item);
        if (next.join('\u0001') !== current.join('\u0001')) {
          row[field.key] = next;
          changed = true;
        }
      } else if (current === oldValue) {
        row[field.key] = newValue;
        changed = true;
      }
    });
  });
  if (changed) DB.reset(db);
}

function renderAuthPanel() {
  const user = AuthService.currentUser();
  if (!user) {
    openLogin();
    return;
  }

  closeLogin();
  document.querySelectorAll('[data-auth-user]').forEach(el => {
    el.textContent = user.username;
  });
  document.querySelectorAll('[data-auth-role]').forEach(el => {
    el.textContent = AuthService.getRoleLabel(user.role);
  });
  document.querySelectorAll('[data-auth-initial]').forEach(el => {
    el.textContent = user.username.slice(0, 2).toUpperCase();
  });

  renderUserList();
  applyPermissions();
}

function setLoginLoading(isLoading) {
  const btn = document.getElementById('login-submit');
  if (!btn) return;
  btn.classList.toggle('is-loading', isLoading);
  btn.disabled = isLoading;
  btn.setAttribute('aria-busy', String(isLoading));
}

function showLoginError(message = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') {
  const alert = document.getElementById('login-error');
  if (!alert) return;
  const text = alert.querySelector('span');
  if (text) text.textContent = message;
  alert.hidden = false;
}

function clearLoginError() {
  const alert = document.getElementById('login-error');
  if (alert) alert.hidden = true;
}

function syncRememberedLogin(user) {
  const remember = document.getElementById('login-remember')?.checked;
  if (remember) {
    localStorage.setItem(LOGIN_REMEMBER_KEY, user.username);
  } else {
    localStorage.removeItem(LOGIN_REMEMBER_KEY);
  }
}

function restoreRememberedLogin() {
  const rememberedUsername = localStorage.getItem(LOGIN_REMEMBER_KEY);
  const usernameEl = document.getElementById('login-username');
  const rememberEl = document.getElementById('login-remember');
  if (rememberedUsername && usernameEl) usernameEl.value = rememberedUsername;
  if (rememberEl) rememberEl.checked = Boolean(rememberedUsername);
}

function toggleLoginPassword() {
  const input = document.getElementById('login-password');
  const btn = document.querySelector('.password-toggle');
  if (!input || !btn) return;
  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(showPassword));
  btn.setAttribute('aria-label', showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
  input.focus();
}

async function login() {
  setLoginLoading(true);
  clearLoginError();
  try {
    const user = await AuthService.login(v('login-username'), v('login-password'));
    if (!user) {
      showLoginError();
      showToast('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      document.getElementById('login-password')?.focus();
      return;
    }
    syncRememberedLogin(user);
    set('login-password', '');
    renderAuthPanel();
    renderDashboard();
    updateBadges();
    showToast(`เข้าสู่ระบบ: ${user.username}`, 'ok');
  } finally {
    setLoginLoading(false);
  }
}

function logout() {
  AuthService.logout();
  document.body.classList.remove('is-authenticated');
  openLogin();
}

async function createUser() {
  return saveUserAccount();
}

async function saveUserAccount() {
  try {
    const editId = v('user-edit-id');
    const payload = {
      username: v('user-new-name'),
      password: v('user-new-password'),
      role: v('user-new-role'),
    };
    if (editId) await AuthService.updateUser(editId, payload);
    else await AuthService.createUser(payload);
    clearUserForm();
    renderUserList();
    renderAuthPanel();
    showToast(editId ? 'แก้ไขผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ', 'ok');
  } catch (err) {
    showToast(err.message || 'บันทึกผู้ใช้ไม่สำเร็จ', 'error');
  }
}

function editUserAccount(id) {
  const user = AuthService.getUsers().find(item => item.id === id);
  if (!user) return;
  set('user-edit-id', user.id);
  set('user-new-name', user.username);
  set('user-new-password', '');
  set('user-new-role', user.role);
  document.getElementById('user-new-name')?.focus();
}

async function deleteUserAccount(id) {
  try {
    const user = AuthService.getUsers().find(item => item.id === id);
    if (!user) throw new Error('ไม่พบผู้ใช้');
    const result = await openSettingsActionModal({
      title: 'ยืนยันการลบผู้ใช้',
      message: `ลบผู้ใช้ "${user.username}"? รายการนี้ไม่สามารถกู้คืนได้`,
      inputValue: null,
      confirmText: 'ลบผู้ใช้',
      danger: true,
    });
    if (!result.confirmed) return;
    AuthService.deleteUser(id);
    clearUserForm();
    renderUserList();
    showToast('ลบผู้ใช้เรียบร้อย', 'ok');
  } catch (err) {
    showToast(err.message || 'ลบผู้ใช้ไม่สำเร็จ', 'error');
  }
}

function clearUserForm() {
  set('user-edit-id', '');
  set('user-new-name', '');
  set('user-new-password', '');
  set('user-new-role', 'viewer');
}

function renderUserList() {
  const el = document.getElementById('user-list');
  if (!el) return;
  const users = AuthService.getUsers();
  if (!users.length) {
    el.innerHTML = emptyHtml('ยังไม่มีผู้ใช้ในระบบ');
    return;
  }
  el.innerHTML = `
    <div class="settings-user-list">
      ${users.map(user => `
        <article class="settings-user-row">
          <div class="settings-user-avatar" aria-hidden="true">${h(user.username.slice(0, 2).toUpperCase())}</div>
          <div class="settings-user-main">
            <div class="settings-row-title">
              <strong>${h(user.username)}</strong>
              <span class="badge badge-info">${h(AuthService.getRoleLabel(user.role))}</span>
              <span class="badge badge-ok">Active</span>
            </div>
            <p>Created ${h(new Date(user.createdAt).toLocaleDateString('th-TH'))} · Backoffice User</p>
          </div>
          <div class="settings-row-actions">
            <button class="btn btn-outline btn-sm" onclick="editUserAccount(${jsArg(user.id)})">แก้ไข</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUserAccount(${jsArg(user.id)})">ลบ</button>
          </div>
        </article>
      `).join('')}
    </div>`;
}

// ── Auto refresh ─────────────────────────────────────────────────────────

window.addEventListener('storage', (ev) => {
  if (ev.key !== CONFIG.STORAGE_KEY) return;
  DB.init();
  refreshActiveSection();
});

window.addEventListener('hdic:datachange', () => {
  refreshActiveSection({ silent: true });
});

window.addEventListener('hdic:settingschange', () => {
  applySettingsOptions();
  if (document.querySelector('.section.active')?.id === 'settings') {
    renderSettingsPage();
  }
});

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

document.getElementById('login-password')?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') login();
});
document.getElementById('login-username')?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') document.getElementById('login-password')?.focus();
});
document.querySelectorAll('#login-username, #login-password').forEach(el => {
  el.addEventListener('input', clearLoginError);
});

// ── Expose to global scope (HTML onclick handlers) ────────────────────────

Object.assign(window, {
  // Router
  showSection, toggleSidebar, closeSidebar, toggleSidebarCollapse, refreshActiveSection, syncBn,

  // Patient
  savePatient: requirePermission('patient.write', savePatient),
  editPatient: requirePermission('patient.write', editPatient),
  openPatientModal: requirePermission('patient.write', openPatientModal),
  closePtModal,
  confirmDeletePatient: requirePermission('patient.write', confirmDeletePatient),
  renderTable: (type) => {
    if (type === 'patient')   renderPatientTable();
    if (type === 'serology')  renderSeroTable();
    if (type === 'access')    renderAccessTable();
    if (type === 'infection') renderInfTable();
    applyPermissions();
  },

  // Serology
  saveSerology: requirePermission('clinical.write', saveSerology),
  editSerology: requirePermission('clinical.write', editSerology),
  openSeroModal: requirePermission('clinical.write', openSeroModal),
  closeSeroModal,
  confirmDeleteSero: requirePermission('clinical.write', confirmDeleteSero),

  // Vascular Access
  saveAccess: requirePermission('clinical.write', saveAccess),
  editAccess: requirePermission('clinical.write', editAccess),
  openAccessModal: requirePermission('clinical.write', openAccessModal),
  closeAccessModal,
  confirmDeleteAccess: requirePermission('clinical.write', confirmDeleteAccess),

  // Infection
  saveInfection: requirePermission('clinical.write', saveInfection),
  editInfection: requirePermission('clinical.write', editInfection),
  openInfModal: requirePermission('clinical.write', openInfModal),
  closeInfModal,
  confirmDeleteInf: requirePermission('clinical.write', confirmDeleteInf),

  // Report
  generateReport: requirePermission('report.run', generateReport),
  showReportPanel: requirePermission('report.run', showReportPanel),
  exportJSON: requirePermission('data.export', exportJSON),
  exportCSV: requirePermission('data.export', exportCSV),
  importJSON: requirePermission('data.import', importJSON),
  clearAll: requirePermission('data.admin', clearAll),
  renderMonthlyReport: requirePermission('report.run', renderMonthlyReport),

  // Surveillance
  renderSurveillance,

  // Modal
  closeModal: closeDeleteModal,

  // Demo
  loadDemoData: requirePermission('data.admin', loadDemoData),

  // Dashboard (used by importJSON)
  renderDashboard,

  // Auth
  login, logout,
  toggleLoginPassword,
  createUser: requirePermission('auth.admin', createUser),
  saveUserAccount: requirePermission('auth.admin', saveUserAccount),
  editUserAccount: requirePermission('auth.admin', editUserAccount),
  deleteUserAccount: requirePermission('auth.admin', deleteUserAccount),
  clearUserForm,

  // Settings
  renderSettingsOptions: requirePermission('auth.admin', renderSettingsOptions),
  showSettingsPanel: requirePermission('auth.admin', showSettingsPanel),
  openSettingsActionModal,
  cancelSettingsActionModal,
  confirmSettingsActionModal,
  addSettingOption: requirePermission('auth.admin', addSettingOption),
  editSettingOption: requirePermission('auth.admin', editSettingOption),
  deleteSettingOption: requirePermission('auth.admin', deleteSettingOption),
  toggleSettingOption: requirePermission('auth.admin', toggleSettingOption),

  updateBadges,
});

// ── Initialise ────────────────────────────────────────────────────────────

await AuthService.init();
SettingsService.init();
restoreRememberedLogin();
DB.init();
applySettingsOptions();
renderAuthPanel();
if (AuthService.currentUser()) {
  renderDashboard();
  updateBadges();
}
