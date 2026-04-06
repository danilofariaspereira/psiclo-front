import { store } from '../state/store.js';

export function renderHeader(title) {
  const header = document.getElementById('app-header');
  if (!header) return;

  header.innerHTML = `
    <img src="img/logo-psiclo.png" alt="PSICLO" class="header__logo-mobile" />
    <span class="app-header__title header__title-desktop">${title}</span>
    <div class="app-header__actions">
      <div class="header__profile header__profile--desktop" id="header-profile">
        <div class="header__avatar" id="header-avatar">?</div>
        <div class="header__profile-info header__profile-info--desktop">
          <span class="header__profile-name" id="header-user">—</span>
          <span class="header__profile-role">Psicólogo(a)</span>
        </div>
      </div>
      <button class="header__menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>
  `;

  const menuBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = sidebar.classList.toggle('sidebar--open');
    menuBtn.setAttribute('aria-expanded', isOpen);
  });

  // Fecha ao clicar fora da sidebar
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('sidebar--open') &&
        !sidebar.contains(e.target) &&
        e.target !== menuBtn) {
      sidebar.classList.remove('sidebar--open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // Fecha ao clicar em link da sidebar
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      sidebar.classList.remove('sidebar--open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  function updateProfile(prof) {
    if (!prof) return;
    const nameEl = document.getElementById('header-user');
    const avatarEl = document.getElementById('header-avatar');
    if (nameEl) nameEl.textContent = prof.name || prof.email;
    if (avatarEl) {
      if (prof.avatar_url) {
        avatarEl.innerHTML = `<img src="${prof.avatar_url}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else {
        avatarEl.textContent = prof.name ? prof.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : '?';
      }
    }
  }

  updateProfile(store.get('professional'));
  store.subscribe('professional', updateProfile);
}
