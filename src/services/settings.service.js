import { CONFIG } from '../config/app.config.js';

const SETTINGS_KEY = `${CONFIG.STORAGE_KEY}_settings`;

export const OPTION_GROUPS = [
  { id: 'patient.sex', label: 'เพศ', targetIds: ['pt-sex'], fields: [{ table: 'patients', key: 'sex' }], values: ['ชาย', 'หญิง'] },
  { id: 'patient.cause', label: 'สาเหตุ ESRD', targetIds: ['pt-cause'], fields: [{ table: 'patients', key: 'cause' }], values: ['DM Nephropathy', 'HT Nephropathy', 'Glomerulonephritis', 'PKD', 'SLE Nephritis', 'อื่นๆ'] },
  { id: 'patient.shift', label: 'Shift ฟอกไต', targetIds: ['pt-shift'], fields: [{ table: 'patients', key: 'shift' }], values: ['Shift 1 (เช้า)', 'Shift 2 (บ่าย)', 'Shift 3 (เย็น)'] },
  { id: 'patient.status', label: 'สถานะผู้ป่วย', targetIds: ['pt-status', 'pt-filter'], fields: [{ table: 'patients', key: 'status' }], values: ['Active', 'Transfer', 'Deceased', 'Transplant'] },

  { id: 'serology.result', label: 'ผล Serology', targetIds: ['sero-hbsag', 'sero-hcv', 'sero-hiv'], fields: [{ table: 'serology', key: 'hbsag' }, { table: 'serology', key: 'hcv' }, { table: 'serology', key: 'hiv' }], values: ['Negative', 'Positive', 'Reactive'] },
  { id: 'serology.hbc', label: 'Anti-HBc', targetIds: ['sero-hbc'], fields: [{ table: 'serology', key: 'hbc' }], values: ['Negative', 'Positive'] },
  { id: 'serology.vaccine', label: 'สถานะ Vaccine HBV', targetIds: ['sero-vacc'], fields: [{ table: 'serology', key: 'vacc' }], values: ['Vaccinated (complete)', 'Vaccinated (incomplete)', 'Not vaccinated', 'Non-responder'] },
  { id: 'serology.frequency', label: 'ความถี่ติดตาม', targetIds: ['sero-freq'], fields: [{ table: 'serology', key: 'freq' }], values: ['ทุก 1 เดือน', 'ทุก 3 เดือน', 'ทุก 6 เดือน', 'ทุก 1 ปี'] },

  { id: 'access.type', label: 'ประเภท Access', targetIds: ['acc-type', 'acc-filter'], fields: [{ table: 'access', key: 'type' }], values: ['AVF', 'AVG', 'Tunneled CVC (TDC)', 'Non-tunneled CVC'] },
  { id: 'access.site', label: 'ตำแหน่ง Access', targetIds: ['acc-site'], fields: [{ table: 'access', key: 'site' }], values: ['Right IJV', 'Left IJV', 'Right Subclavian', 'Left Subclavian', 'Right Femoral', 'Left Femoral', 'Left Forearm', 'Right Forearm', 'Left Upper Arm', 'Right Upper Arm'] },
  { id: 'access.status', label: 'สถานะสาย', targetIds: ['acc-status'], fields: [{ table: 'access', key: 'accessStatus' }], values: ['Active', 'Removed'] },
  { id: 'access.grade', label: 'Exit Site Grade', targetIds: ['acc-grade'], fields: [{ table: 'access', key: 'grade' }], values: ['0', '1', '2', '3', '4'] },

  { id: 'infection.type', label: 'ประเภท Infection', targetIds: ['inf-type', 'inf-filter'], fields: [{ table: 'infections', key: 'type' }], values: ['CRBSI (Catheter-related BSI)', 'CLABSI', 'AVF/AVG Infection', 'Exit Site Infection', 'Tunnel Infection', 'Bacteremia (Unknown source)', 'Septicemia', 'HBV Seroconversion', 'HCV Seroconversion', 'Other HAI'] },
  { id: 'infection.bloodCulture', label: 'Blood Culture', targetIds: ['inf-bc'], fields: [{ table: 'infections', key: 'bc' }], values: ['Positive', 'Negative', 'Contamination', 'Pending'] },
  { id: 'infection.hospitalization', label: 'Hospitalization', targetIds: ['inf-hosp'], fields: [{ table: 'infections', key: 'hosp' }], values: ['ใช่', 'ไม่ใช่'] },
  { id: 'infection.access', label: 'Access ที่สัมพันธ์', targetIds: ['inf-access'], fields: [{ table: 'infections', key: 'access' }], values: ['AVF', 'AVG', 'Tunneled CVC', 'Non-tunneled CVC', 'ไม่ทราบ'] },
  { id: 'infection.outcome', label: 'Outcome', targetIds: ['inf-outcome'], fields: [{ table: 'infections', key: 'outcome' }], values: ['หาย / Resolved', 'กำลังรักษา', 'ถอด Catheter', 'เสียชีวิต'] },
];

function defaultSettings() {
  return {
    options: Object.fromEntries(OPTION_GROUPS.map(group => [group.id, [...group.values]])),
    disabledOptions: Object.fromEntries(OPTION_GROUPS.map(group => [group.id, []])),
  };
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    const defaults = defaultSettings();
    return {
      options: {
        ...defaults.options,
        ...(parsed?.options || {}),
      },
      disabledOptions: {
        ...defaults.disabledOptions,
        ...(parsed?.disabledOptions || {}),
      },
    };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('hdic:settingschange'));
}

function cleanValue(value) {
  return String(value ?? '').trim();
}

function uniqueValues(values) {
  return [...new Set(values.map(cleanValue).filter(Boolean))];
}

export const SettingsService = {
  init() {
    saveSettings(loadSettings());
  },

  getGroups() {
    const settings = loadSettings();
    return OPTION_GROUPS.map(group => {
      const values = uniqueValues(settings.options[group.id] || []);
      const disabledValues = uniqueValues(settings.disabledOptions[group.id] || []);
      return {
        ...group,
        values,
        disabledValues,
        allValues: uniqueValues([...values, ...disabledValues]),
      };
    });
  },

  getGroup(groupId) {
    return this.getGroups().find(group => group.id === groupId);
  },

  getOptions(groupId) {
    return this.getGroup(groupId)?.values || [];
  },

  addOption(groupId, value) {
    const clean = cleanValue(value);
    if (!clean) throw new Error('กรุณาระบุค่าตัวเลือก');
    const settings = loadSettings();
    const current = settings.options[groupId] || [];
    const disabled = settings.disabledOptions[groupId] || [];
    if ([...current, ...disabled].some(item => item.toLowerCase() === clean.toLowerCase())) {
      throw new Error('มีตัวเลือกนี้อยู่แล้ว');
    }
    settings.options[groupId] = [...current, clean];
    saveSettings(settings);
  },

  updateOption(groupId, oldValue, newValue) {
    const cleanOld = cleanValue(oldValue);
    const cleanNew = cleanValue(newValue);
    if (!cleanOld || !cleanNew) throw new Error('ข้อมูลตัวเลือกไม่ครบ');
    const settings = loadSettings();
    const current = settings.options[groupId] || [];
    const disabled = settings.disabledOptions[groupId] || [];
    if ([...current, ...disabled].some(item => item.toLowerCase() === cleanNew.toLowerCase() && item !== cleanOld)) {
      throw new Error('มีตัวเลือกนี้อยู่แล้ว');
    }
    settings.options[groupId] = current.map(item => item === cleanOld ? cleanNew : item);
    settings.disabledOptions[groupId] = disabled.map(item => item === cleanOld ? cleanNew : item);
    saveSettings(settings);
  },

  deleteOption(groupId, value) {
    const clean = cleanValue(value);
    const settings = loadSettings();
    settings.options[groupId] = (settings.options[groupId] || []).filter(item => item !== clean);
    settings.disabledOptions[groupId] = (settings.disabledOptions[groupId] || []).filter(item => item !== clean);
    saveSettings(settings);
  },

  setOptionDisabled(groupId, value, disabled) {
    const clean = cleanValue(value);
    if (!clean) throw new Error('ข้อมูลตัวเลือกไม่ครบ');
    const settings = loadSettings();
    const active = settings.options[groupId] || [];
    const inactive = settings.disabledOptions[groupId] || [];
    if (disabled) {
      settings.options[groupId] = active.filter(item => item !== clean);
      settings.disabledOptions[groupId] = uniqueValues([...inactive, clean]);
    } else {
      settings.disabledOptions[groupId] = inactive.filter(item => item !== clean);
      settings.options[groupId] = uniqueValues([...active, clean]);
    }
    saveSettings(settings);
  },

  countUsage(groupId, value, db) {
    const group = OPTION_GROUPS.find(item => item.id === groupId);
    if (!group) return 0;
    const clean = cleanValue(value);
    return group.fields.reduce((count, field) => {
      const rows = db?.[field.table] || [];
      return count + rows.filter(row => {
        const data = row?.[field.key];
        return Array.isArray(data) ? data.includes(clean) : data === clean;
      }).length;
    }, 0);
  },
};
