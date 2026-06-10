import { StorageService } from './storage.service.js';

let _db = {
  patients: [],
  serology: [],
  access: [],
  infections: [],
  appointments: [],
  attendance: [],
  dialysisSessions: [],
  resources: [],
  stockItems: [],
  stockMoves: [],
};

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

  // Daily HD appointments
  getAppointments()          { return _db.appointments || []; },
  addAppointment(row)        { _db.appointments = this.getAppointments(); _db.appointments.push(row); persist(); },
  updateAppointment(id, row) {
    _db.appointments = this.getAppointments();
    const i = _db.appointments.findIndex(x => x.id === id);
    if (i > -1) _db.appointments[i] = row; else _db.appointments.push(row);
    persist();
  },
  deleteAppointment(id)      { _db.appointments = this.getAppointments().filter(x => x.id !== id); persist(); },

  // Daily attendance
  getAttendance()            { return _db.attendance || []; },
  addAttendance(row)         { _db.attendance = this.getAttendance(); _db.attendance.push(row); persist(); },
  updateAttendance(id, row)  {
    _db.attendance = this.getAttendance();
    const i = _db.attendance.findIndex(x => x.id === id);
    if (i > -1) _db.attendance[i] = row; else _db.attendance.push(row);
    persist();
  },
  deleteAttendance(id)       { _db.attendance = this.getAttendance().filter(x => x.id !== id); persist(); },

  // Dialysis treatment session summary
  getDialysisSessions()      { return _db.dialysisSessions || []; },
  addDialysisSession(row)    { _db.dialysisSessions = this.getDialysisSessions(); _db.dialysisSessions.push(row); persist(); },
  updateDialysisSession(id, row) {
    _db.dialysisSessions = this.getDialysisSessions();
    const i = _db.dialysisSessions.findIndex(x => x.id === id);
    if (i > -1) _db.dialysisSessions[i] = row; else _db.dialysisSessions.push(row);
    persist();
  },
  deleteDialysisSession(id)  { _db.dialysisSessions = this.getDialysisSessions().filter(x => x.id !== id); persist(); },

  // Beds and dialysis machines
  getResources()             { return _db.resources || []; },
  addResource(row)           { _db.resources = this.getResources(); _db.resources.push(row); persist(); },
  updateResource(id, row)    {
    _db.resources = this.getResources();
    const i = _db.resources.findIndex(x => x.id === id);
    if (i > -1) _db.resources[i] = row; else _db.resources.push(row);
    persist();
  },
  deleteResource(id)         { _db.resources = this.getResources().filter(x => x.id !== id); persist(); },

  // Medical supply stock
  getStockItems()            { return _db.stockItems || []; },
  addStockItem(row)          { _db.stockItems = this.getStockItems(); _db.stockItems.push(row); persist(); },
  updateStockItem(id, row)   {
    _db.stockItems = this.getStockItems();
    const i = _db.stockItems.findIndex(x => x.id === id);
    if (i > -1) _db.stockItems[i] = row; else _db.stockItems.push(row);
    persist();
  },
  deleteStockItem(id)        { _db.stockItems = this.getStockItems().filter(x => x.id !== id); persist(); },

  getStockMoves()            { return _db.stockMoves || []; },
  addStockMove(row)          { _db.stockMoves = this.getStockMoves(); _db.stockMoves.push(row); persist(); },
  updateStockMove(id, row)   {
    _db.stockMoves = this.getStockMoves();
    const i = _db.stockMoves.findIndex(x => x.id === id);
    if (i > -1) _db.stockMoves[i] = row; else _db.stockMoves.push(row);
    persist();
  },
  deleteStockMove(id)        { _db.stockMoves = this.getStockMoves().filter(x => x.id !== id); persist(); },
};
