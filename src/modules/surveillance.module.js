import { DB } from '../services/db.service.js';
import { CONFIG } from '../config/app.config.js';
import { todayStr } from '../utils/date.util.js';
import { getLatestSero } from './dashboard.module.js';

export function renderSurveillance() {
  const patients   = DB.getPatients();
  const infections = DB.getInfections();
  const today      = todayStr();
  const active     = patients.filter(p => p.status === 'Active').length;
  const latestSero = getLatestSero();

  _renderSurvStats({ active, infections });
  _renderMonthlyBars(infections);
  _renderSeroCoverage({ latestSero, active, today });
  _renderOutbreak(infections, today);
  _renderOrganismChart(infections);
}

function _renderSurvStats({ active, infections }) {
  document.getElementById('surv-stats').innerHTML = `
    <div class="stat-card teal"><div class="num">${active}</div><div class="lbl">Active Patients</div></div>
    <div class="stat-card red"><div class="num">${infections.length}</div><div class="lbl">Total Infections</div></div>
    <div class="stat-card amber"><div class="num">${infections.filter(x => x.hosp === 'ใช่').length}</div><div class="lbl">Hospitalizations</div></div>
    <div class="stat-card blue"><div class="num">${infections.filter(x => x.bc === 'Positive').length}</div><div class="lbl">Bacteremia (Cx+)</div></div>
  `;
}

function _renderMonthlyBars(infections) {
  const monthly = {};
  infections.forEach(x => { const m = x.date?.slice(0, 7); if (m) monthly[m] = (monthly[m] || 0) + 1; });
  const keys = Object.keys(monthly).sort().slice(-6);
  const maxVal = Math.max(...keys.map(k => monthly[k]), 1);

  const html = keys.length
    ? keys.map(k => {
        const n = monthly[k];
        const pct = Math.round((n / maxVal) * 100);
        const cls = n >= 3 ? 'danger' : n >= 2 ? 'warn' : '';
        const tag = n >= 3 ? '<span class="badge badge-pos">⚠️ Outbreak</span>' : n >= 2 ? '<span class="badge badge-pend">ติดตาม</span>' : '<span class="badge badge-neg">ปกติ</span>';
        return `<div class="surv-bar-row"><span style="min-width:60px;font-family:'IBM Plex Mono',monospace;font-size:11px">${k}</span><div class="surv-bar"><div class="surv-bar-fill ${cls}" style="width:${pct}%"></div></div><span style="min-width:20px;text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500">${n}</span>${tag}</div>`;
      }).join('')
    : '<div style="font-size:12px;color:var(--text-hint);padding:12px 0">ยังไม่มีข้อมูล</div>';

  document.getElementById('surv-monthly').innerHTML = html;
}

function _renderSeroCoverage({ latestSero, active, today }) {
  const total  = latestSero.length;
  const vaccOk = latestSero.filter(s => s.vacc?.includes('complete')).length;
  const tiOk   = latestSero.filter(s => parseFloat(s.hbsTiter) >= 10).length;
  const due    = DB.getSerology().filter(s => s.nextDue && s.nextDue <= today).length;

  const bar = (n, t, cls) => {
    const pct = t ? Math.round((n / t) * 100) : 0;
    return `<div class="surv-bar-row"><span style="flex:1;font-size:12px">${n} / ${t}</span><div class="surv-bar" style="width:120px"><div class="surv-bar-fill ${cls}" style="width:${pct}%"></div></div><span style="min-width:36px;text-align:right;font-size:11px;font-family:'IBM Plex Mono',monospace">${pct}%</span></div>`;
  };

  document.getElementById('surv-sero').innerHTML = `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">ผู้ป่วยที่มีประวัติ Serology</div>${bar(total, active, '')}
    <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px">Vaccinated HBV (complete)</div>${bar(vaccOk, total, '')}
    <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px">Anti-HBs ≥ 10 mIU/mL</div>${bar(tiOk, total, '')}
    <div style="font-size:11px;color:var(--text-muted);margin:8px 0 4px">ครบกำหนดตรวจ (Overdue)</div>${bar(due, total, 'warn')}
  `;
}

function _renderOutbreak(infections, today) {
  const n = infections.filter(x => x.date?.slice(0, 7) === today.slice(0, 7)).length;
  document.getElementById('surv-outbreak').innerHTML = n >= CONFIG.INFECTION_THRESHOLD
    ? `<div class="alert alert-danger"><span class="alert-icon">🚨</span><div>เดือนนี้มี Infection Events <strong>${n} ราย</strong> — เกิน Threshold (≥${CONFIG.INFECTION_THRESHOLD}) ต้องดำเนินการสอบสวน Outbreak ทันที</div></div>`
    : `<div class="alert alert-ok"><span class="alert-icon">✅</span><div>เดือนนี้มี Infection Events <strong>${n} ราย</strong> — อยู่ในเกณฑ์ปกติ (Threshold: ≥${CONFIG.INFECTION_THRESHOLD} ราย/เดือน)</div></div>`;
}

function _renderOrganismChart(infections) {
  const orgMap = {};
  infections.forEach(x => { if (x.org) { const k = x.org.trim(); orgMap[k] = (orgMap[k] || 0) + 1; } });
  const arr = Object.entries(orgMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = arr.length ? arr[0][1] : 1;

  document.getElementById('surv-organism').innerHTML = arr.length
    ? arr.map(([k, n]) => `<div class="surv-bar-row"><span style="min-width:120px;font-size:12px">${k}</span><div class="surv-bar"><div class="surv-bar-fill" style="width:${Math.round((n/max)*100)}%"></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;min-width:24px;text-align:right">${n}</span></div>`).join('')
    : '<div style="font-size:12px;color:var(--text-hint)">ยังไม่มีข้อมูล</div>';
}
