import { DB } from '../services/db.service.js';
import { showToast } from './toast.component.js';

// ── Generic open / close ──────────────────────────────────────────────────
export const openModal  = (id) => document.getElementById(id)?.classList.add('open');
export const closeModal = (id) => document.getElementById(id)?.classList.remove('open');

// ── Delete confirmation ───────────────────────────────────────────────────
let _pending = null;

export function confirmDelete(type, id, onDeleted) {
  _pending = { type, id, onDeleted };
  openModal('del-modal');

  document.getElementById('del-confirm').onclick = () => {
    if (!_pending) return;
    const { type: t, id: did, onDeleted: cb } = _pending;
    _pending = null;

    if (t === 'patient')    DB.deletePatient(did);
    if (t === 'serology')   DB.deleteSerology(did);
    if (t === 'access')     DB.deleteAccess(did);
    if (t === 'infections') DB.deleteInfection(did);

    closeModal('del-modal');
    showToast('ลบรายการแล้ว', 'ok');
    cb?.();
  };
}

export const closeDeleteModal = () => {
  _pending = null;
  closeModal('del-modal');
};
