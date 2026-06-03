import { DB } from '../services/db.service.js';
import { StorageService } from '../services/storage.service.js';
import { v } from '../utils/dom.util.js';
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
      <div class="stat-card amber"><div class="num">${infs.filter(x => x.hosp === 'ใช่').length}</div><div class="lbl">Hospitalizations</div></div>
    </div>`;

  if (infs.length) {
    const rows = infs.map(x => {
      const p = patients.find(pt => pt.id === x.ptId) || { hn: '?', name: '?' };
      return `<tr><td>${thDate(x.date)}</td><td class="td-hn">${p.hn}</td><td>${p.name}</td><td style="font-size:11px">${x.type || '-'}</td><td>${x.org || '-'}</td><td>${x.outcome || '-'}</td></tr>`;
    }).join('');
    html += `<div class="section-label" style="margin-top:10px">Infection Events</div>
      <div class="table-wrap"><table><thead><tr><th>วันที่</th><th>HN</th><th>ชื่อ</th><th>ประเภท</th><th>Organism</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  html += '</div>';
  document.getElementById('rpt-output').innerHTML = html;
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
        DB.reset(JSON.parse(ev.target.result));
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

export function clearAll() {
  if (!confirm('ลบข้อมูลทั้งหมด? ไม่สามารถกู้คืนได้')) return;
  DB.reset({ patients: [], serology: [], access: [], infections: [] });
  showToast('ล้างข้อมูลเรียบร้อย', 'ok');
  window.renderDashboard?.();
}

// ── Monthly report ────────────────────────────────────────────────────────

export function initMonthlyReport() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = n => String(n).padStart(2, '0');
  const v2 = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  v2('monthly-from', `${y}-${pad(m)}`);
  v2('monthly-to',   `${y}-${pad(m + 1)}`);
}

export function renderMonthlyReport() {
  const fromStr = v('monthly-from');
  const toStr   = v('monthly-to');
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
    <div class="table-wrap"><table><thead><tr>${rows[0].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = 1; i < rows.length; i++) {
    html += `<tr>${rows[i].map((val, idx) => `<td ${idx===0?'class="td-muted" style="font-family:IBM Plex Mono;font-size:11px"':''}>${val}</td>`).join('')}</tr>`;
  }
  html += '</tbody></table></div></div>';
  document.getElementById('monthly-output').innerHTML = html;
}
