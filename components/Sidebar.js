import { authService } from '../services/auth.service.js';
import { store } from '../state/store.js';

const API_URL = 'https://psiclo-back.vercel.app/api';

// Preferência de notificação — cookie simples (não sensível, só UI)
export function getNotifPref() {
  return document.cookie.split('; ').find(r => r.startsWith('notif='))?.split('=')[1] !== 'off';
}
function setNotifPref(enabled) {
  document.cookie = `notif=${enabled ? 'on' : 'off'};path=/;max-age=31536000;SameSite=Lax`;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',   href: 'dashboard.html',  icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
  { id: 'leads',     label: 'Leads',        href: 'leads.html',      icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'clients',   label: 'Clientes',     href: 'clients.html',    icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
  { id: 'schedule',  label: 'Agenda',       href: 'schedule.html',   icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { id: 'financial', label: 'Financeiro',   href: 'financial.html',  icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
  { id: 'balance',   label: 'Balanço',      href: 'balance.html',    icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
];

export function renderSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const prof = store.get('professional');
  const initials = prof?.name ? prof.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  const avatarContent = prof?.avatar_url
    ? `<img src="${prof.avatar_url}" alt="foto" />`
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
          <div class="sidebar__profile-name" id="sidebar-profile-name">${prof?.name || '—'}</div>
          <div class="sidebar__profile-role">Psicólogo(a)</div>
        </div>
      </div>
      <div class="sidebar__notif">
        <label class="sidebar__notif-label" for="notif-toggle">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Notificações
        </label>
        <input type="checkbox" id="notif-toggle" ${getNotifPref() ? 'checked' : ''} />
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

  // Avatar upload — envia para o backend, que salva no Supabase Storage
  document.getElementById('sidebar-profile').addEventListener('click', () => {
    document.getElementById('avatar-input').click();
  });
  document.getElementById('avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch(`${API_URL}/auth/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // Atualiza o avatar na sidebar sem recarregar
      document.getElementById('sidebar-avatar').innerHTML = `<img src="${json.avatar_url}" alt="foto" />`;
      // Atualiza o store
      const prof = store.get('professional');
      if (prof) store.set('professional', { ...prof, avatar_url: json.avatar_url });
    } catch (err) {
      alert('Erro ao salvar foto: ' + err.message);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => authService.logout());
  document.getElementById('change-pass-btn').addEventListener('click', showChangePasswordModal);

  // Toggle de notificações — inicializa AudioContext na interação do usuário
  document.getElementById('notif-toggle').addEventListener('change', (e) => {
    setNotifPref(e.target.checked);
    if (e.target.checked) getAudioCtx();
  });

  // Inicializa AudioContext no primeiro clique em qualquer lugar da página
  const initAudioOnce = () => { getAudioCtx(); document.removeEventListener('click', initAudioOnce); };
  document.addEventListener('click', initAudioOnce);

  // Polling global de agendamentos — funciona em qualquer página
  startGlobalPolling();

  // Atualiza nome/avatar na sidebar quando o store for populado
  store.subscribe('professional', (prof) => {
    if (!prof) return;
    const nameEl = document.getElementById('sidebar-profile-name');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (nameEl) nameEl.textContent = prof.name || '—';
    if (avatarEl) {
      if (prof.avatar_url) {
        avatarEl.innerHTML = `<img src="${prof.avatar_url}" alt="foto" />`;
      } else {
        avatarEl.textContent = prof.name ? prof.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : '?';
      }
    }
  });
}

let _globalPollingTimer = null;

function startGlobalPolling() {
  if (_globalPollingTimer) return;

  const API = 'https://psiclo-back.vercel.app/api';
  // Começa com 60s atrás para pegar eventos recentes ao abrir
  let lastEventAt = new Date(Date.now() - 60000).toISOString();

  async function check() {
    try {
      // POST nunca é cacheado por CDN/proxy — solução definitiva para o 304
      const res = await fetch(`${API}/notifications/check`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since: lastEventAt }),
      });

      if (!res.ok) return;
      const { appointments, leads, serverTime } = await res.json();

      // Atualiza o timestamp para o próximo check
      lastEventAt = serverTime;

      if (!getNotifPref()) return;

      // Novo agendamento
      if (appointments?.length > 0) {
        const a = appointments[0];
        const clientName = escHtml(a.clients?.name || '');
        const time = a.scheduled_at
          ? new Date(a.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
          : '';
        showGlobalToast(`📅 Novo agendamento — ${clientName}`, time ? `Hoje às ${time}` : '');
      }

      // Novo lead
      if (leads?.length > 0) {
        const l = leads[0];
        showGlobalToast(`🔔 Novo lead — ${escHtml(l.name || '')}`, escHtml(l.source || ''));
      }

    } catch (e) {
      console.warn('[psiclo notifications]', e.message);
    }
  }

  // Primeira checagem após 3s (aguarda interação do usuário para AudioContext)
  setTimeout(check, 3000);
  _globalPollingTimer = setInterval(check, 10000); // 10s
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// AudioContext criado na primeira interação do usuário
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playPlin() {
  try {
    const ctx = getAudioCtx();
    // Nota 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046, ctx.currentTime);
    gain1.gain.setValueAtTime(0.35, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.3);
    // Nota 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.55);
  } catch (_) {}
}

function showGlobalToast(title, subtitle = '') {
  playPlin();

  const el = document.createElement('div');
  el.className = 'appt-toast';
  el.innerHTML = `
    <div class="appt-toast__icon">📅</div>
    <div class="appt-toast__body">
      <div class="appt-toast__title">${title}</div>
      ${subtitle ? `<div class="appt-toast__sub">${subtitle}</div>` : ''}
    </div>
    <button class="appt-toast__close" aria-label="Fechar">×</button>
  `;
  el.querySelector('.appt-toast__close').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('appt-toast--hide'); setTimeout(() => el.remove(), 400); }, 8000);
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
      body: JSON.stringify({ new_password: newPass }),
    });
    const json = await res.json();
    btn.disabled = false; btn.textContent = 'Salvar';
    if (!res.ok) { errEl.textContent = json.error; return; }
    overlay.remove();
    alert('Senha alterada com sucesso!');
  });
}
