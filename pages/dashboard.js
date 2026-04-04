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
    const ctx = new AudioContext();
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

function showNotification(title, subtitle = '') {
  playNotificationSound();
  const el = document.createElement('div');
  el.className = 'appt-toast';
  el.innerHTML = `
    <div class="appt-toast__icon">📅</div>
    <div class="appt-toast__body">
      <div class="appt-toast__title">${esc(title)}</div>
      ${subtitle ? `<div class="appt-toast__sub">${esc(subtitle)}</div>` : ''}
    </div>
    <button class="appt-toast__close" aria-label="Fechar">×</button>
  `;
  el.querySelector('.appt-toast__close').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('appt-toast--hide');
    setTimeout(() => el.remove(), 400);
  }, 6000);
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
      const today = new Date().toISOString().split('T')[0];
      const [leads, todayAppts] = await Promise.all([
        apiFetch('/leads?status=new'),
        apiFetch(`/schedule/appointments?date=${today}`),
      ]);
      const newLeadCount = leads?.length ?? 0;
      const newApptCount = todayAppts?.length ?? 0;

      if (newLeadCount > lastLeadCount && lastLeadCount > 0) {
        showNotification('Novo lead recebido!', leads[0]?.name || '');
        loadStats();
      }

      if (newApptCount > lastApptCount && lastApptCount > 0) {
        // Encontra o(s) agendamento(s) novo(s) — os que não estavam antes
        const newest = todayAppts[todayAppts.length - 1];
        const clientName = newest?.clients?.name || '';
        const time = newest?.scheduled_at
          ? new Date(newest.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '';
        showNotification(
          `Novo agendamento — ${clientName}`,
          time ? `Horário: ${time}` : ''
        );
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

init();
