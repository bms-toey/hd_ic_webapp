import { DB } from '../services/db.service.js';
import { StorageService } from '../services/storage.service.js';
import { v, h, hd } from '../utils/dom.util.js';
import { thDate, todayStr } from '../utils/date.util.js';
import { showToast } from '../components/toast.component.js';

// ── Date-range report ─────────────────────────────────────────────────────

export function generateReport() {
  const from = v('rpt-from') || '2000-01-01';
  const to   = v('rpt-to')   || todayStr();
  const patients   = DB.getPatients();
  const infs  = DB.getInfections().filter(x => x.date >= from && x.date <= to);
  const seros = DB.getSerology().filter(x => x.date >= from && x.date <= to);
  const accs  = DB.getAccess().filter(x => x.date >= from && x.date <= to);

  let html = `<div class="card">
    <div class="card-title"><span class="dot"></span>รายงาน IC สรุป: ${thDate(from)} — ${thDate(to)}</div>
    <div class="stat-grid">
      <div class="stat-card teal"><div class="num">${infs.length}</div><div class="lbl">Infection Events</div></div>
      <div class="stat-card blue"><div class="num">${seros.length}</div><div class="lbl">Serology Tests</div></div>
      <div class="stat-card teal"><div class="num">${accs.length}</div><div class="lbl">Access Assessments</div></div>
      <div class="stat-card amber"><div class="num">${infs.filter(x => isAdmit(x.hosp)).length}</div><div class="lbl">Hospitalizations</div></div>
    </div>`;

  html += reportTable({
    title: 'Infection Events',
    empty: 'ไม่พบ Infection Event ในช่วงเวลานี้',
    headers: ['วันที่','HN','ชื่อ','ประเภท','Organism','Outcome'],
    rows: infs.map(x => {
      const p = patients.find(pt => pt.id === x.ptId) || { hn: '?', name: '?' };
      return [thDate(x.date), h(p.hn), h(p.name), hd(x.type), hd(x.org), hd(x.outcome)];
    }),
  });

  html += reportTable({
    title: 'Serology Tests',
    empty: 'ไม่พบผล Serology ในช่วงเวลานี้',
    headers: ['วันที่','HN','ชื่อ','HBsAg','Anti-HCV','Anti-HIV','Due Date'],
    rows: seros.map(x => {
      const p = patients.find(pt => pt.id === x.ptId) || { hn: '?', name: '?' };
      return [thDate(x.date), h(p.hn), h(p.name), hd(x.hbsag), hd(x.hcv), hd(x.hiv), x.nextDue ? thDate(x.nextDue) : '-'];
    }),
  });

  html += reportTable({
    title: 'Access Assessments',
    empty: 'ไม่พบข้อมูล Vascular Access ในช่วงเวลานี้',
    headers: ['วันที่','HN','ชื่อ','Access Type','Exit Site','Status'],
    rows: accs.map(x => {
      const p = patients.find(pt => pt.id === x.ptId) || { hn: '?', name: '?' };
      return [thDate(x.date), h(p.hn), h(p.name), hd(x.type), x.grade !== '' && x.grade !== undefined ? `G${h(x.grade)}` : '-', hd(x.accessStatus)];
    }),
  });

  html += '</div>';
  document.getElementById('rpt-output').innerHTML = html;
}

function reportTable({ title, empty, headers, rows }) {
  if (!rows.length) {
    return `<div class="report-section">
      <div class="section-label mt-10">${h(title)}</div>
      ${emptyReportState(empty)}
    </div>`;
  }
  return `<div class="report-section">
    <div class="section-label mt-10">${h(title)}</div>
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>${headers.map(head => `<th>${h(head)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map((val, idx) => reportCell(headers[idx], val)).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function reportCell(header, value) {
  const cell = value === undefined || value === null || value === '' ? '-' : value;
  return `<td data-label="${h(header || '')}">${cell}</td>`;
}

function emptyReportState(message) {
  return `<div class="empty-state"><div class="empty-icon">📄</div><p>${h(message)}</p></div>`;
}

function isAdmit(value = '') {
  return value === 'ใช่' || value === 'เนเธเน' || /admit|yes/i.test(value);
}

// ── Export / Import / Clear ───────────────────────────────────────────────

export function exportJSON() {
  StorageService.exportJSON(DB.get());
}

export function exportCSV() {
  const patients = DB.getPatients();
  const header = ['Date','HN','Name','Type','Organism','BloodCx','Hospitalized','Antibiotic','Outcome'];
  const rows = DB.getInfections().map(x => {
    const p = patients.find(pt => pt.id === x.ptId) || { hn: '', name: '' };
    return [x.date, p.hn, p.name, x.type||'', x.org||'', x.bc||'', x.hosp||'', x.abx||'', x.outcome||''];
  });
  StorageService.exportCSV([header, ...rows]);
}

export function importJSON() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = (e) => {
    const fr = new FileReader();
    fr.onload = (ev) => {
      try {
        const data = normalizeImportedDB(JSON.parse(ev.target.result));
        DB.reset(data);
        showToast('นำเข้าข้อมูลสำเร็จ', 'ok');
        window.renderDashboard?.();
      } catch {
        showToast('ไฟล์ไม่ถูกต้อง', 'error');
      }
    };
    fr.readAsText(e.target.files[0]);
  };
  inp.click();
}

function normalizeImportedDB(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid database file');
  }

  const keys = ['patients', 'serology', 'access', 'infections'];
  if (!keys.every(key => Array.isArray(data[key]))) {
    throw new Error('Invalid database schema');
  }

  return {
    patients: data.patients.map(normalizeRecord),
    serology: data.serology.map(normalizeRecord),
    access: data.access.map(normalizeRecord),
    infections: data.infections.map(normalizeRecord),
  };
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Invalid record');
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, val]) => {
      if (Array.isArray(val)) return [key, val.map(item => String(item ?? ''))];
      if (val === null || val === undefined) return [key, ''];
      if (typeof val === 'object') return [key, JSON.stringify(val)];
      return [key, String(val)];
    })
  );
}

export async function clearAll() {
  const result = await window.openSettingsActionModal?.({
    title: 'ยืนยันลบข้อมูลทั้งหมด',
    message: 'ลบข้อมูลทั้งหมด? รายการนี้ไม่สามารถกู้คืนได้',
    inputValue: null,
    confirmText: 'ลบข้อมูลทั้งหมด',
    danger: true,
  });
  if (!result?.confirmed) return;
  DB.reset({ patients: [], serology: [], access: [], infections: [] });
  showToast('ล้างข้อมูลเรียบร้อย', 'ok');
  window.renderDashboard?.();
}

// ── Monthly report ────────────────────────────────────────────────────────

export function initMonthlyReport(prefix = 'monthly') {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = n => String(n).padStart(2, '0');
  const v2 = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = val;
  };
  v2(`${prefix}-from`, `${y}-${pad(m)}`);
  v2(`${prefix}-to`,   `${y}-${pad(m + 1)}`);
}

export function renderMonthlyReport(prefix = 'monthly') {
  const fromStr = v(`${prefix}-from`);
  const toStr   = v(`${prefix}-to`);
  if (!fromStr || !toStr) { showToast('กรุณาเลือกช่วงเดือน', 'error'); return; }

  const from = new Date(fromStr + '-01');
  const to   = new Date(toStr + '-01');
  if (from > to) { showToast('เดือนที่ 1 ต้องน้อยกว่า เดือนที่ 2', 'error'); return; }

  const months = [];
  const cur = new Date(from);
  while (cur <= to) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }

  const rows = [['เดือน','DLC','PC','AVF','AVG','AVF/AVG','จำนวนวันสาย DLC/PC','CRBSI']];

  months.forEach(ms => {
    const [year, mon] = ms.split('-').map(Number);
    const mStart = new Date(year, mon - 1, 1);
    const mEnd   = new Date(year, mon, 0);
    const msStr  = `${ms}-01`;
    const meStr  = `${ms}-${String(mEnd.getDate()).padStart(2,'0')}`;

    const dlc = new Set(), pc = new Set(), avf = new Set(), avg = new Set();
    let catDays = 0;

    DB.getAccess().forEach(acc => {
      if (acc.date >= msStr && acc.date <= meStr) {
        if (acc.type === 'Non-tunneled CVC')    dlc.add(acc.ptId);
        if (acc.type === 'Tunneled CVC (TDC)')  pc.add(acc.ptId);
        if (acc.type === 'AVF') avf.add(acc.ptId);
        if (acc.type === 'AVG') avg.add(acc.ptId);
      }
      if ((acc.type === 'Non-tunneled CVC' || acc.type === 'Tunneled CVC (TDC)') && acc.insertDate) {
        const ins = new Date(acc.insertDate);
        const rem = acc.removeDate ? new Date(acc.removeDate) : mEnd;
        const s   = new Date(Math.max(ins, mStart));
        const e   = new Date(Math.min(rem, mEnd));
        if (s <= e) catDays += Math.floor((e - s) / 86400000) + 1;
      }
    });

    const crbsi = DB.getInfections().filter(x => x.type === 'CRBSI (Catheter-related BSI)' && x.date >= msStr && x.date <= meStr).length;
    rows.push([ms, dlc.size, pc.size, avf.size, avg.size, avf.size + avg.size, catDays, crbsi]);
  });

  let html = `<div class="card"><div class="card-title"><span class="dot"></span>สรุปข้อมูล: ${thDate(fromStr+'-01')} ถึง ${thDate(toStr+'-01')}</div>
    `;
  html += reportTable({
    title: 'Access mix and CRBSI summary',
    empty: 'ไม่พบข้อมูลสรุปรายเดือนในช่วงเวลานี้',
    headers: rows[0],
    rows: rows.slice(1).map(row => row.map(value => h(value))),
  });
  html += '</div>';
  const output = document.getElementById(`${prefix}-output`);
  if (output) output.innerHTML = html;
}
