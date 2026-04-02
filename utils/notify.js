/**
 * Sistema de notificações visuais com fallback de som.
 * Usa Web Speech API opcionalmente.
 */
export const notify = {
  show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container') || createContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type]}</span>
      <span class="toast__message">${message}</span>
      <button class="toast__close" aria-label="Fechar">×</button>
    `;

    toast.querySelector('.toast__close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    // Animação de entrada
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success: (msg) => notify.show(msg, 'success'),
  error: (msg) => notify.show(msg, 'error'),
  warning: (msg) => notify.show(msg, 'warning'),
  info: (msg) => notify.show(msg, 'info'),
};

function createContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};
