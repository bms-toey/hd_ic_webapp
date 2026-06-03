import { DB } from '../services/db.service.js';
import { CONFIG } from '../config/app.config.js';
import { todayStr, thDate, diffDays } from '../utils/date.util.js';
import { emptyHtml } from '../utils/dom.util.js';

// ── Helpers ───────────────────────────────────────────────────────────────

export function getLatestSero() {
  const map = {};
  DB.getSerology().forEach(s => {
    if (!map[s.ptId] || s.date > map[s.ptId].date) map[s.ptId] = s;
  });
  return Object.values(map);
}

export function isPos(s) {
  return ['Positive', 'Reactive'].includes(s.hbsag)
    || ['Positive', 'Reactive'].includes(s.hcv)
    || ['Positive', 'Reactive'].includes(s.hiv);
}

// ── Renderer ─────────────────────────────────────────────────────────────

export function renderDashboard() {
  const patients   = DB.getPatients();
  const infections = DB.getInfections();
  const today      = todayStr();
  const due        = DB.getSerology().filter(s => s.nextDue && s.nextDue <= today);
  const latestSero = getLatestSero();
  const posArr     = latestSero.filter(isPos);
  const infMonth   = infections.filter(x => x.date?.slice(0, 7) === today.slice(0, 7));
  const active     = patients.filter(p => p.status === 'Active').length;

  _renderAlerts({ due, posArr, infMonth });
  _renderStats({ active, due, posArr, infections, infMonth, access: DB.getAccess() });
  _renderDueList(due, patients, today);
  _renderRecentEvents(infections, patients);
  _renderSeroSummary(latestSero);
}

function _renderAlerts({ due, posArr, infMonth }) {
  let html = '';
  if (due.length)  html += `<div class="alert alert-warn"><span class="alert-icon">⏰</span><div>มีผู้ป่วย <strong>${due.length} ราย</strong> ครบกำหนดตรวจ Serology — กรุณานัดหมายโดยด่วน</div></div>`;
  if (posArr.length) html += `<div class="alert alert-danger"><span class="alert-icon">🔴</span><div>ผู้ป่วย <strong>${posArr.length} ราย</strong> มีผล Serology Positive — ต้องแยกเครื่อง Dialysis</div></div>`;
  if (infMonth.length >= CONFIG.INFECTION_THRESHOLD) html += `<div class="alert alert-danger"><span class="alert-icon">⚠️</span><div>Infection Events เดือนนี้ <strong>${infMonth.length} ราย</strong> — เกิน Threshold ต้องสอบสวนและรายงาน IC!</div></div>`;
  if (!html) html = '<div class="alert alert-ok"><span class="alert-icon">✅</span><div>ไม่มี alert ที่ต้องดำเนินการ — สถานะระบบ IC ปกติ</div></div>';
  document.getElementById('dash-alerts').innerHTML = html;
}

function _renderStats({ active, due, posArr, infections, infMonth, access }) {
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card teal"><div class="num">${active}</div><div class="lbl">ผู้ป่วย Active</div></div>
    <div class="stat-card amber"><div class="num">${due.length}</div><div class="lbl">ครบกำหนด Serology</div></div>
    <div class="stat-card red"><div class="num">${posArr.length}</div><div class="lbl">Serology Positive</div></div>
    <div class="stat-card red"><div class="num">${infections.length}</div><div class="lbl">Infection Events</div></div>
    <div class="stat-card blue"><div class="num">${infMonth.length}</div><div class="lbl">Infections เดือนนี้</div></div>
    <div class="stat-card teal"><div class="num">${access.length}</div><div class="lbl">Access Records</div></div>
  `;
}

function _renderDueList(due, patients, today) {
  const html = due.slice(0, 6).map(s => {
    const p = patients.find(x => x.id === s.ptId) || { hn: '?', name: '?' };
    const d = diffDays(today, s.nextDue);
    const cls = d <= 0 ? 'badge-pos' : 'badge-pend';
    const txt = d <= 0 ? `เกินกำหนด ${Math.abs(d)} วัน` : `ครบใน ${d} วัน`;
    return `<div class="due-item"><span class="hn">${p.hn}</span><span style="flex:1">${p.name}</span><span class="badge ${cls}">${txt}</span></div>`;
  }).join('');
  document.getElementById('dash-due').innerHTML = html || emptyHtml('ไม่มีรายการที่ครบกำหนด');
}

function _renderRecentEvents(infections, patients) {
  const html = [...infections].slice(-5).reverse().map(x => {
    const p = patients.find(pt => pt.id === x.ptId) || { hn: '?', name: '?' };
    return `<div class="due-item">
      <span class="hn">${p.hn}</span>
      <span style="flex:1">${p.name}</span>
      <span class="badge badge-pos" style="font-size:10px;max-width:130px;overflow:hidden;text-overflow:ellipsis">${x.type || 'Infection'}</span>
      <span style="font-size:10px;color:var(--text-hint);margin-left:4px">${thDate(x.date)}</span>
    </div>`;
  }).join('');
  document.getElementById('dash-events').innerHTML = html || emptyHtml('ยังไม่มี Infection Event');
}

function _renderSeroSummary(latestSero) {
  const hbPos  = latestSero.filter(s => s.hbsag === 'Positive').length;
  const hcvPos = latestSero.filter(s => ['Positive','Reactive'].includes(s.hcv)).length;
  const hivPos = latestSero.filter(s => s.hiv === 'Positive').length;
  const vaccOk = latestSero.filter(s => s.vacc?.includes('complete')).length;

  const box = (n, label, bg, color) => `
    <div style="text-align:center;padding:12px;background:${bg};border-radius:var(--radius)">
      <div style="font-size:22px;font-weight:600;color:${color};font-family:'IBM Plex Mono',monospace">${n}</div>
      <div style="font-size:11px;color:var(--text-muted)">${label}</div>
    </div>`;

  document.getElementById('dash-sero-summary').innerHTML = `
    <div class="form-grid-4">
      ${box(hbPos,  'HBsAg Positive',   'var(--red-50)',   'var(--red-600)')}
      ${box(hcvPos, 'Anti-HCV Positive', 'var(--amber-50)', 'var(--amber-400)')}
      ${box(hivPos, 'Anti-HIV Positive', 'var(--blue-50)',  'var(--blue-600)')}
      ${box(vaccOk, 'Vaccinated HBV',    'var(--teal-50)',  'var(--teal-600)')}
    </div>`;
}
