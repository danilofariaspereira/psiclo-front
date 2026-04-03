import { authService } from '../services/auth.service.js';
import { store } from '../state/store.js';

const API_URL = 'https://psiclo-back.vercel.app/api';

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
      <button class="sidebar__change-pass" id="change-pass-btn">
        <span aria-hidden="true">🔑</span> Alterar senha
      </button>
      <button class="sidebar__logout" id="logout-btn">
        <span aria-hidden="true">⎋</span> Sair
      </button>
    </div>
  `;

  document.getElementById('logout-btn')?.addEventListener('click', () => authService.logout());
  document.getElementById('change-pass-btn')?.addEventListener('click', () => showChangePasswordModal());
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
      <p style="font-size:.82rem;color:#64748b;margin-bottom:1.2rem;">Mínimo 8 caracteres.</p>
      <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.85rem;">
        <label style="font-size:.8rem;font-weight:600;color:#64748b;">Nova senha</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input id="cp-new" type="password" placeholder="••••••••" style="width:100%;padding:9px 40px 9px 12px;border:1.5px solid #dde1e7;border-radius:8px;font-size:.9rem;" />
          <button type="button" onclick="toggleCpPass('cp-new',this)" style="position:absolute;right:10px;background:none;border:none;cursor:pointer;color:#94a3b8;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.85rem;">
        <label style="font-size:.8rem;font-weight:600;color:#64748b;">Confirmar senha</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input id="cp-confirm" type="password" placeholder="••••••••" style="width:100%;padding:9px 40px 9px 12px;border:1.5px solid #dde1e7;border-radius:8px;font-size:.9rem;" />
          <button type="button" onclick="toggleCpPass('cp-confirm',this)" style="position:absolute;right:10px;background:none;border:none;cursor:pointer;color:#94a3b8;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
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

    if (newPass.length < 8) { errEl.textContent = 'Mínimo 8 caracteres.'; return; }
    if (newPass !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    btn.disabled = true; btn.textContent = 'Salvando...';

    const res = await fetch(`${API_URL}/admin/professionals/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: prof.email, new_password: newPass }),
    });
    const json = await res.json();
    btn.disabled = false; btn.textContent = 'Salvar';

    if (!res.ok) { errEl.textContent = json.error; return; }
    overlay.remove();
    alert('Senha alterada com sucesso!');
  });
}

window.toggleCpPass = (inputId, btn) => {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
};
