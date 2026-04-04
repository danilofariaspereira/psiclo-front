import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';
let lastLeadCount = 0;
let lastApptCount = 0;
let pollingInterval = null;

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function showNotification(msg) {
  playNotificationSound();
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:1rem;right:1rem;background:linear-gradient(135deg,#1a237e,#0288d1);color:#fff;padding:.75rem 1.25rem;border-radius:10px;font-size:.88rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);animation:slideIn .3s ease';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }

  store.set('professional', session.professional);
  renderSidebar('dashboard');
  renderHeader('Dashboard');

  await loadStats();
  await loadUpcoming();

  // Polling seguro via backend — sem expor dados ao Realtime público
  startPolling();
}

function startPolling() {
  pollingInterval = setInterval(async () => {
    try {
      const [leads, today] = await Promise.all([
        apiFetch('/leads?status=new'),
        apiFetch(`/schedule/appointments?date=${new Date().toISOString().split('T')[0]}`),
      ]);
      const newLeadCount = leads?.length ?? 0;
      const newApptCount = today?.length ?? 0;

      if (newLeadCount > lastLeadCount && lastLeadCount > 0) {
        showNotification('Novo lead recebido!');
        loadStats();
      }
      if (newApptCount > lastApptCount && lastApptCount > 0) {
        showNotification('Novo agendamento!');
        loadUpcoming();
        loadStats();
      }
      lastLeadCount = newLeadCount;
      lastApptCount = newApptCount;
    } catch (_) {}
  }, 30000);
}

window.addEventListener('beforeunload', () => {
  if (pollingInterval) clearInterval(pollingInterval);
});

async function loadStats() {
  try {
    const [summary, leads, clients, today] = await Promise.all([
      apiFetch('/financial/summary'),
      apiFetch('/leads?status=new'),
      apiFetch('/clients/active'),
      apiFetch(`/schedule/appointments?date=${new Date().toISOString().split('T')[0]}`),
    ]);

    document.getElementById('stat-leads').textContent = leads?.length ?? 0;
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
        <td>${esc(a.clients?.name) || '—'}</td>
        <td>${a.modality === 'online' ? '🌐 Online' : '🏢 Presencial'}</td>
        <td><span class="badge badge--${a.status}">${{ scheduled:'Agendado', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado', no_show:'Não compareceu' }[a.status] || esc(a.status)}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
document.head.appendChild(style);

init();
