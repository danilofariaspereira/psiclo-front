import { store } from '../state/store.js';

export function renderHeader(title) {
  const header = document.getElementById('app-header');
  if (!header) return;

  header.innerHTML = `
    <button class="header__menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false">
      ☰
    </button>
    <span class="app-header__title">${title}</span>
    <div class="app-header__actions">
      <span class="header__user" id="header-user">—</span>
    </div>
  `;

  // Mobile: toggle sidebar
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.toggle('sidebar--open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', isOpen);
  });

  // Preenche nome do usuário
  const user = store.get('professional');
  if (user) {
    document.getElementById('header-user').textContent = user.name || user.email;
  }

  store.subscribe('professional', (prof) => {
    if (prof) document.getElementById('header-user').textContent = prof.name || prof.email;
  });
}
