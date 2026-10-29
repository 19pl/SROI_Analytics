/**
 * Accessible Modal & Dialog Component
 */

let activeModal = null;

export function openModal({ title, body, footer = '', size = '', onClose = null }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="modal-content ${size === 'lg' ? 'modal-content modal-lg' : ''}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="btn-icon" data-modal-close aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  const doClose = () => {
    if (onClose) onClose();
    overlay.remove();
    activeModal = null;
    document.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') doClose();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-modal-close]')) {
      doClose();
    }
  });

  document.addEventListener('keydown', handleKey);
  document.body.appendChild(overlay);
  activeModal = { overlay, close: doClose };

  return activeModal;
}

export function closeModal() {
  if (activeModal) {
    activeModal.close();
  }
}

export function confirmModal({ title = 'Confirm Action', message, confirmText = 'Confirm', onConfirm }) {
  const footer = `
    <button class="btn btn-secondary" data-modal-close>Cancel</button>
    <button class="btn btn-danger" id="modalConfirmBtn">${confirmText}</button>
  `;

  openModal({
    title,
    body: `<p style="margin: 0; color: var(--on-background); line-height: 1.5;">${message}</p>`,
    footer,
  });

  document.getElementById('modalConfirmBtn')?.addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
