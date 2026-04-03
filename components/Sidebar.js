import { authService } from '../services/auth.service.js';
import { store } from '../state/store.js';

const API_URL = 'https://psiclo-back.vercel.app/api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',   href: 'dashboard.html',  icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
  { id: 'leads',     label: 'Leads',        href: 'leads.html',      icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'clients',   label: 'Clientes',     href: 'clients.html',    icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  { id: 'schedule',  label: 'Agenda',       href: 'schedule.html',   icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { id: 'financial', label: 'Financeiro',   href: 'financial.html',  icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
];

export function renderSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const prof = store.get('professional');
  const initials = prof?.name ? prof.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  const savedPhoto = localStorage.getItem('psiclo_avatar');
  const avatarContent = savedPhoto
    ? `<img src="${savedPhoto}" alt="foto" />`
    : initials;

  sidebar.innerHTML = `
    <div class="sidebar__logo">
      <img src="../img/logo-psiclo.png" alt="PSICLO" />
      <span class="sidebar__logo-name">${prof?.name || 'PSICLO'}</span>
    </div>
    <nav class="sidebar__nav" aria-label="Menu principal">
      <ul>
        ${NAV_ITEMS.map(item => `
          <li>
            <a href="${item.href}"
               class="sidebar__link ${activePage === item.id ? 'sidebar__link--active' : ''}"
               aria-current="${activePage === item.id ? 'page' : 'false'}">
              <span class="sidebar__icon">${item.icon}</span>
              ${item.label}
            </a>
          </li>
        `).join('')}
      </ul>
    </nav>
    <div class="sidebar__footer">
      <div class="sidebar__profile" id="sidebar-profile" title="Clique para trocar foto">
        <div class="sidebar__avatar" id="sidebar-avatar">${avatarContent}</div>
        <div class="sidebar__profile-info">
          <div class="sidebar__profile-name">${prof?.name || '—'}</div>
          <div class="sidebar__profile-role">Psicólogo(a)</div>
        </div>
      </div>
      <div class="sidebar__footer-actions">
        <button class="sidebar__footer-btn" id="change-pass-btn" title="Alterar senha">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Senha
        </button>
        <button class="sidebar__footer-btn sidebar__footer-btn--danger" id="logout-btn" title="Sair">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>
    </div>
    <input type="file" id="avatar-input" accept="image/*" style="display:none" />
  `;

  // Avatar upload
  document.getElementById('sidebar-profile').addEventListener('click', () => {
    document.getElementById('avatar-input').click();
  });
  document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      localStorage.setItem('psiclo_avatar', ev.target.result);
      document.getElementById('sidebar-avatar').innerHTML = `<img src="${ev.target.result}" alt="foto" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('logout-btn').addEventListener('click', () => authService.logout());
  document.getElementById('change-pass-btn').addEventListener('click', showChangePasswordModal);
}

function showChangePasswordModal() {
  const existing = document.getElementById('change-pass-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'change-pass-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:2rem;width:100%;max-width:380px;box-shadow:0 16px 48px rgba(0,0,0,.25);">
      <h3 style="font-size:1.1rem;font-weight:700;color:#1a237e;margin-bottom:.25rem;">Alterar senha</h3>
      <p style="font-size:.82rem;color:#64748b;margin-bottom:1.2rem;">Mínimo 6 caracteres.</p>
      <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.75rem;">
        <label style="font-size:.8rem;font-weight:600;color:#64748b;">Nova senha</label>
        <input id="cp-new" type="password" placeholder="••••••••" style="padding:9px 12px;border:1.5px solid #dde1e7;border-radius:8px;font-size:.9rem;" />
      </div>
      <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.75rem;">
        <label style="font-size:.8rem;font-weight:600;color:#64748b;">Confirmar senha</label>
        <input id="cp-confirm" type="password" placeholder="••••••••" style="padding:9px 12px;border:1.5px solid #dde1e7;border-radius:8px;font-size:.9rem;" />
      </div>
      <p id="cp-error" style="color:#c62828;font-size:.8rem;min-height:1rem;margin-bottom:.5rem;"></p>
      <div style="display:flex;gap:.5rem;">
        <button id="cp-cancel" style="flex:1;padding:.7rem;border:1.5px solid #dde1e7;border-radius:6px;background:#fff;cursor:pointer;font-weight:600;color:#64748b;">Cancelar</button>
        <button id="cp-save" style="flex:1;padding:.7rem;border:none;border-radius:6px;background:linear-gradient(135deg,#1a237e,#0288d1);color:#fff;cursor:pointer;font-weight:600;">Salvar</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('cp-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('cp-save').addEventListener('click', async () => {
    const newPass = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    const errEl = document.getElementById('cp-error');
    const btn = document.getElementById('cp-save');
    const prof = store.get('professional');

    if (newPass.length < 6) { errEl.textContent = 'Mínimo 6 caracteres.'; return; }
    if (newPass !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    btn.disabled = true; btn.textContent = 'Salvando...';
    const res = await fetch(`${API_URL}/admin/professionals/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: prof?.email, new_password: newPass }),
    });
    const json = await res.json();
    btn.disabled = false; btn.textContent = 'Salvar';
    if (!res.ok) { errEl.textContent = json.error; return; }
    overlay.remove();
    alert('Senha alterada com sucesso!');
  });
}
