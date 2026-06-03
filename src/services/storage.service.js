import { CONFIG } from '../config/app.config.js';

const EMPTY_DB = () => ({ patients: [], serology: [], access: [], infections: [] });

export const StorageService = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      return raw ? JSON.parse(raw) : EMPTY_DB();
    } catch {
      return EMPTY_DB();
    }
  },

  save(db) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(db));
    } catch {
      alert('ไม่สามารถบันทึกได้ กรุณาตรวจสอบ Local Storage');
    }
  },

  exportJSON(db) {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hd_ic_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  },

  exportCSV(rows) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hd_infections_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  },
};
