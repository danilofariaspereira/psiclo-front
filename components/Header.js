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
      <div class="header__profile" id="header-profile">
        <div class="header__avatar" id="header-avatar">?</div>
        <div class="header__profile-info">
          <span class="header__profile-name" id="header-user">—</span>
          <span class="header__profile-role">Psicólogo(a)</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.toggle('sidebar--open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', isOpen);
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
