import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';

const API = 'https://psiclo-back.vercel.app/api';

async function apiFetch(path) {
  const token = authService.getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }

  store.set('professional', session.professional);
  renderSidebar('dashboard');
  renderHeader('Dashboard');

  loadStats();
  loadUpcoming();
}

async function loadStats() {
  try {
    const [summary, leads, clients, today] = await Promise.all([
      apiFetch('/financial/summary'),
      apiFetch('/leads?status=new&count=true'),
      apiFetch('/clients/active'),
      apiFetch(`/schedule/appointments?date=${new Date().toISOString().split('T')[0]}`),
    ]);

    document.getElementById('stat-leads').textContent = leads?.total ?? leads?.length ?? 0;
    document.getElementById('stat-clients').textContent = clients?.length ?? 0;
    document.getElementById('stat-today').textContent = today?.length ?? 0;
    document.getElementById('stat-paid').textContent = currencyUtils.format(summary.paid);
    document.getElementById('stat-pending').textContent = currencyUtils.format(summary.pending);
    document.getElementById('stat-overdue').textContent = currencyUtils.format(summary.overdue);
  } catch (e) {
    console.error('Erro ao carregar stats:', e);
  }
}

async function loadUpcoming() {
  const tbody = document.getElementById('upcoming-body');
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiFetch(`/schedule/appointments?date=${today}`);

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhuma sessão hoje.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((a) => `
      <tr>
        <td>${dateUtils.formatTime(a.scheduled_at)}</td>
        <td>${a.clients?.name ?? '—'}</td>
        <td>${a.modality === 'online' ? '🌐 Online' : '🏢 Presencial'}</td>
        <td><span class="badge badge--${a.status}">${a.status}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

init();
