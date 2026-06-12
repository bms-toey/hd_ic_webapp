import { DB } from '../services/db.service.js';
import { showToast } from './toast.component.js';

// ── Generic open / close ──────────────────────────────────────────────────
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  requestAnimationFrame(() => {
    modal.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus({ preventScroll: true });
  });
}

export const closeModal = (id) => document.getElementById(id)?.classList.remove('open');

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const openModals = [...document.querySelectorAll('.modal-overlay.open')];
  const topModal = openModals.at(-1);
  if (!topModal || topModal.classList.contains('auth-login')) return;
  topModal.classList.remove('open');
});

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
    if (t === 'appointments') DB.deleteAppointment(did);
    if (t === 'attendance')   DB.deleteAttendance(did);
    if (t === 'sessions')     DB.deleteDialysisSession(did);
    if (t === 'resources')    DB.deleteResource(did);
    if (t === 'stockItems')   DB.deleteStockItem(did);
    if (t === 'stockMoves')   DB.deleteStockMove(did);

    closeModal('del-modal');
    showToast('ลบรายการแล้ว', 'ok');
    cb?.();
  };
}

export const closeDeleteModal = () => {
  _pending = null;
  closeModal('del-modal');
};
