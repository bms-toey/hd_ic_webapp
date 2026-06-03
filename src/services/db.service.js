import { StorageService } from './storage.service.js';

let _db = { patients: [], serology: [], access: [], infections: [] };

const persist = () => StorageService.save(_db);

export const DB = {
  init()       { _db = StorageService.load(); },
  get()        { return _db; },
  reset(data)  { _db = data; persist(); },

  // ── Patients ──
  getPatients()          { return _db.patients; },
  addPatient(p)          { _db.patients.push(p); persist(); },
  updatePatient(id, p)   {
    const i = _db.patients.findIndex(x => x.id === id);
    if (i > -1) _db.patients[i] = p; else _db.patients.push(p);
    persist();
  },
  deletePatient(id)      { _db.patients = _db.patients.filter(x => x.id !== id); persist(); },

  // ── Serology ──
  getSerology()          { return _db.serology; },
  addSerology(s)         { _db.serology.push(s); persist(); },
  updateSerology(id, s)  {
    const i = _db.serology.findIndex(x => x.id === id);
    if (i > -1) _db.serology[i] = s; else _db.serology.push(s);
    persist();
  },
  deleteSerology(id)     { _db.serology = _db.serology.filter(x => x.id !== id); persist(); },

  // ── Vascular Access ──
  getAccess()            { return _db.access; },
  addAccess(a)           { _db.access.push(a); persist(); },
  updateAccess(id, a)    {
    const i = _db.access.findIndex(x => x.id === id);
    if (i > -1) _db.access[i] = a; else _db.access.push(a);
    persist();
  },
  deleteAccess(id)       { _db.access = _db.access.filter(x => x.id !== id); persist(); },

  // ── Infections ──
  getInfections()        { return _db.infections; },
  addInfection(inf)      { _db.infections.push(inf); persist(); },
  updateInfection(id, inf) {
    const i = _db.infections.findIndex(x => x.id === id);
    if (i > -1) _db.infections[i] = inf; else _db.infections.push(inf);
    persist();
  },
  deleteInfection(id)    { _db.infections = _db.infections.filter(x => x.id !== id); persist(); },
};
