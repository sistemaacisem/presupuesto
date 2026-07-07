/** Modal system — abre, cierra y gestiona modales */

let activeModal = null;

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

/**
 * Crea y abre un modal.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body   - HTML del contenido
 * @param {string} options.footer - HTML del footer (botones)
 * @param {string} options.size   - sm | md | lg | xl
 * @param {Function} options.onClose
 * @returns {HTMLElement} overlay del modal
 */
export function openModal({ title, body, footer = '', size = 'md', onClose } = {}) {
  closeModal(); // Cerrar modal previo si existe

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 class="modal-title">${title || ''}</h2>
        <button class="modal-close" id="modal-close-btn">${CLOSE_ICON}</button>
      </div>
      <div class="modal-body">${body || ''}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  activeModal = overlay;

  const closeFn = () => {
    closeModal();
    onClose?.();
  };

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeFn);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
  document.addEventListener('keydown', escHandler);

  function escHandler(e) {
    if (e.key === 'Escape') {
      closeFn();
      document.removeEventListener('keydown', escHandler);
    }
  }

  return overlay;
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
    document.body.style.overflow = '';
  }
}

/**
 * Modal de confirmación.
 * @returns {Promise<boolean>}
 */
export function confirmModal(message, title = '¿Estás seguro?') {
  return new Promise((resolve) => {
    const overlay = openModal({
      title,
      size: 'sm',
      body: `<p style="color:var(--text-secondary);font-size:14px">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
        <button class="btn btn-danger" id="confirm-ok">Confirmar</button>`,
      onClose: () => resolve(false)
    });
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => { closeModal(); resolve(false); });
    overlay.querySelector('#confirm-ok').addEventListener('click',    () => { closeModal(); resolve(true); });
  });
}
