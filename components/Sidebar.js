import { authService } from '../services/auth.service.js';
import { store } from '../state/store.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',   icon: '◈', href: 'dashboard.html' },
  { id: 'leads',     label: 'Leads',        icon: '◎', href: 'leads.html' },
  { id: 'clients',   label: 'Clientes',     icon: '◉', href: 'clients.html' },
  { id: 'schedule',  label: 'Agenda',       icon: '◷', href: 'schedule.html' },
  { id: 'financial', label: 'Financeiro',   icon: '◈', href: 'financial.html' },
];

export function renderSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar__logo">
      <img src="../img/logo-psiclo.png" alt="PSICLO" height="36" />
    </div>
    <nav class="sidebar__nav" aria-label="Menu principal">
      <ul>
        ${NAV_ITEMS.map((item) => `
          <li>
            <a
              href="${item.href}"
              class="sidebar__link ${activePage === item.id ? 'sidebar__link--active' : ''}"
              aria-current="${activePage === item.id ? 'page' : 'false'}"
            >
              <span class="sidebar__icon" aria-hidden="true">${item.icon}</span>
              ${item.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
    <div class="sidebar__footer">
      <button class="sidebar__logout" id="logout-btn">
        <span aria-hidden="true">⎋</span> Sair
      </button>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    authService.logout();
  });
}
