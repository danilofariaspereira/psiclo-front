/**
 * Componente Toast — notificações visuais
 * Injetado via notify.js, mas pode ser usado diretamente.
 */
export function createToast({ message, type = 'info' }) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span class="toast__message">${message}</span>
    <button class="toast__close" aria-label="Fechar notificação">×</button>
  `;
  return el;
}
