import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';
import { esc } from '../utils/sanitize.js';
import { getNotifPref } from '../components/Sidebar.js';

const API = 'https://psiclo-back.vercel.app/api';
let lastLeadCount = 0;
let lastApptCount = 0;
let pollingInterval = null;
let dailyChart = null;
let summaryChart = null;

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

// Data de hoje no fuso de Brasília
function todayBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    .split('/').reverse().join('-');
}

// ── Notificação ──────────────────────────────────────────────
// Solicita permissão de notificação do browser na primeira interação
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function showNotification(title, subtitle = '') {
  if (!getNotifPref()) return;

  // Tenta notificação nativa do browser (funciona mesmo com aba em segundo plano)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: subtitle, icon: '../img/fiveicon.png' });
  }

  // Toast visual sempre aparece
  playNotificationSound();
  const el = document.createElement('div');
  el.className = 'appt-toast';
  el.innerHTML = `
    <div class="appt-toast__icon">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    </div>
    <div class="appt-toast__body">
      <div class="appt-toast__title">${esc(title)}</div>
      ${subtitle ? `<div class="appt-toast__sub">${esc(subtitle)}</div>` : ''}
    </div>
    <button class="appt-toast__close" aria-label="Fechar">×</button>
  `;
  el.querySelector('.appt-toast__close').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('appt-toast--hide'); setTimeout(() => el.remove(), 400); }, 8000);
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }

  store.set('professional', session.professional);
  renderSidebar('dashboard');
  renderHeader('Dashboard');

  setupTabs();
  await loadOverview();
  checkBirthdays();
  requestNotifPermission(); // solicita permissão de notificação do browser
  startPolling();
}

// ── Aniversariantes ───────────────────────────────────────────
async function checkBirthdays() {
  try {
    const clients = await apiFetch('/clients');
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;

    const birthdayClients = (clients || []).filter(c => {
      if (!c.birth_date) return false;
      const d = new Date(c.birth_date + 'T12:00:00');
      return d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth;
    });

    if (!birthdayClients.length) return;

    const prof = store.get('professional');
    const profName = prof?.name || 'Psicólogo(a)';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:1.5rem;width:100%;max-width:420px;box-shadow:0 16px 48px rgba(0,0,0,.25)">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem">
          <svg width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span style="font-size:1rem;font-weight:700;color:#1a237e">Aniversariantes de hoje</span>
        </div>
        <p style="font-size:.85rem;color:#64748b;margin-bottom:1rem">Um cliente faz aniversário hoje!</p>
        <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1rem">
          ${birthdayClients.map(c => {
            const phone = c.phone ? c.phone.replace(/\D/g,'') : '';
            const msg = encodeURIComponent(`Olá ${c.name}! Aqui é ${profName}. Passamos para te desejar um feliz aniversário! Que o seu dia seja repleto de alegria, saúde e bons momentos. Será um prazer te atender em breve!`);
            const waHref = phone ? `https://wa.me/55${phone}?text=${msg}` : null;
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
              <div>
                <p style="font-weight:600;font-size:.9rem;color:#1e293b">${esc(c.name)}</p>
                <p style="font-size:.75rem;color:#64748b">${esc(c.phone) || '—'}</p>
              </div>
              ${waHref ? `
              <a href="${waHref}" target="_blank" rel="noopener" class="btn btn--primary btn--sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:.3rem">
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L0 24l6.335-1.508A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.214-3.727.977.994-3.634-.235-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
                Parabenizar
              </a>` : ''}
            </div>`;
          }).join('')}
        </div>
        <button onclick="this.closest('[style]').remove()" class="btn btn--ghost" style="width:100%;justify-content:center">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);
  } catch (_) {}
}
function setupTabs() {
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('dash-tab--active'));
      btn.classList.add('dash-tab--active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-overview').style.display = tab === 'overview' ? 'block' : 'none';
      document.getElementById('tab-heatmap').style.display  = tab === 'heatmap'  ? 'block' : 'none';
      document.getElementById('tab-payments').style.display = tab === 'payments' ? 'block' : 'none';
      if (tab === 'heatmap')  loadHeatmap();
      if (tab === 'payments') loadPaymentMap();
    });
  });
}

// ── Visão geral ───────────────────────────────────────────────
async function loadOverview() {
  await Promise.all([loadStats(), loadUpcoming(), loadCharts()]);
}

async function loadStats() {
  try {
    const today = todayBR();
    const [summary, todayAppts, clients] = await Promise.all([
      apiFetch('/financial/summary'),
      apiFetch(`/schedule/appointments?date=${today}`),
      apiFetch('/clients/active'),
    ]);

    const completed = (todayAppts || []).filter(a => a.status === 'completed');
    document.getElementById('stat-today').textContent = todayAppts?.length ?? 0;
    document.getElementById('stat-completed').textContent = completed.length;
    document.getElementById('stat-paid').textContent = currencyUtils.format(summary.paid);

    // Faturamento de hoje — busca pagamentos com paid_at de hoje
    const payToday = await apiFetch(`/financial/payments?date=${today}`).catch(() => []);
    const todayRevenue = (payToday || [])
      .filter(p => p.paid_at?.startsWith(today))
      .reduce((s, p) => s + Number(p.amount), 0);
    document.getElementById('stat-today-revenue').textContent = currencyUtils.format(todayRevenue);
  } catch (_) {}
}

async function loadUpcoming() {
  const tbody = document.getElementById('upcoming-body');
  try {
    const data = await apiFetch(`/schedule/appointments?date=${todayBR()}`);
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhuma sessão hoje.</td></tr>`;
      return;
    }
    const STATUS_PT = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado', no_show:'Não compareceu' };
    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${dateUtils.formatTime(a.scheduled_at)}</td>
        <td>${esc(a.clients?.name) || '—'}</td>
        <td>${a.modality === 'online' ? '🌐 Online' : '🏢 Presencial'}</td>
        <td><span class="badge badge--${a.status}">${STATUS_PT[a.status] || esc(a.status)}</span></td>
      </tr>`).join('');
  } catch (_) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

async function loadCharts() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const [paymentMap, summary, expenses] = await Promise.all([
      apiFetch(`/financial/payment-map?year=${year}&month=${month}`),
      apiFetch('/financial/summary'),
      apiFetch('/financial/expenses'),
    ]);

    const payments = await apiFetch(`/financial/payments`).catch(() => []);
    const dailyTotals = Array(daysInMonth).fill(0);
    (payments || []).forEach(p => {
      if (!p.paid_at) return;
      const d = new Date(p.paid_at);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        dailyTotals[d.getDate() - 1] += Number(p.amount);
      }
    });

    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(document.getElementById('chart-daily'), {
      type: 'line',
      data: {
        labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
        datasets: [{
          data: dailyTotals,
          borderColor: '#0288d1',
          backgroundColor: 'rgba(2,136,209,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: { ticks: { callback: v => `R$${v}`, font: { size: 10 } } },
        },
      },
    });

    // Gráfico de rosca — faturamento vs despesas
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const revenue = summary.paid || 0;
    const profit = Math.max(revenue - totalExpenses, 0);
    const pct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    if (summaryChart) summaryChart.destroy();
    summaryChart = new Chart(document.getElementById('chart-summary'), {
      type: 'doughnut',
      data: {
        labels: ['Lucro', 'Despesas'],
        datasets: [{
          data: [profit || 0.001, totalExpenses || 0.001],
          backgroundColor: ['#0288d1', 'rgba(0,0,0,0.08)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${currencyUtils.format(c.raw)}` } },
        },
      },
      plugins: [{
        id: 'center',
        beforeDraw(chart) {
          const { ctx, width, height } = chart;
          ctx.save();
          ctx.font = 'bold 1.2rem Inter,sans-serif';
          ctx.fillStyle = '#1a237e';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${pct}%`, width / 2, height / 2);
          ctx.restore();
        },
      }],
    });
  } catch (_) {}
}


// ── Mapa de calor ─────────────────────────────────────────────
const MONTHS_LABELS = ['Todos','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_ORDER = ['seg.','ter.','qua.','qui.','sex.','sáb.','dom.'];

async function loadHeatmap(month = null) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">Carregando...</p>';

  // Renderiza botões de mês
  const monthsEl = document.getElementById('heatmap-months');
  monthsEl.innerHTML = MONTHS_LABELS.map((m, i) => `
    <button class="dash-filter-btn ${(!month && i === 0) || month === i ? 'dash-filter-btn--active' : ''}"
      data-month="${i === 0 ? '' : i}" onclick="switchHeatmapMonth(${i === 0 ? 'null' : i})">
      ${m}
    </button>`).join('');

  try {
    const year = new Date().getFullYear();
    const qs = month ? `?year=${year}&month=${month}` : `?year=${year}`;
    const data = await apiFetch(`/financial/heatmap${qs}`);

    // Coleta todas as horas únicas
    const hours = [...new Set(Object.keys(data).map(k => k.split('|')[1]))].sort();
    if (!hours.length) {
      container.innerHTML = '<p style="color:rgba(255,255,255,.65);font-size:.85rem;padding:1rem">Nenhum atendimento concluído no período.</p>';
      return;
    }

    const maxVal = Math.max(...Object.values(data), 1);

    function heatColor(v) {
      if (!v) return '#f0f4f8';
      const pct = v / maxVal;
      if (pct < 0.2) return '#c8e6c9';
      if (pct < 0.4) return '#81c784';
      if (pct < 0.7) return '#ffa726';
      return '#ef5350';
    }

    let html = `<table style="border-collapse:collapse;width:100%;font-size:.75rem">
      <thead><tr><th style="padding:4px 8px;text-align:left;color:rgba(255,255,255,.65)">Hora</th>
      ${DAYS_ORDER.map(d => `<th style="padding:4px 6px;text-align:center;color:rgba(255,255,255,.65);text-transform:uppercase">${d}</th>`).join('')}
      </tr></thead><tbody>`;

    hours.forEach(hour => {
      html += `<tr><td style="padding:3px 8px;color:rgba(255,255,255,.75);white-space:nowrap">${hour}</td>`;
      DAYS_ORDER.forEach(day => {
        const val = data[`${day}|${hour}`] || 0;
        html += `<td style="padding:3px 4px;text-align:center">
          <div title="${val} atendimento(s)" style="width:100%;height:22px;border-radius:4px;background:${heatColor(val)};display:flex;align-items:center;justify-content:center;font-size:.68rem;color:${val ? '#333' : 'transparent'}">${val || ''}</div>
        </td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (_) {
    container.innerHTML = '<p style="color:var(--color-error);font-size:.85rem">Erro ao carregar mapa de calor.</p>';
  }
}

window.switchHeatmapMonth = (month) => loadHeatmap(month);

// ── Mapa de pagamentos ────────────────────────────────────────
async function loadPaymentMap(month = null) {
  const container = document.getElementById('paymap-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">Carregando...</p>';

  const monthsEl = document.getElementById('paymap-months');
  monthsEl.innerHTML = MONTHS_LABELS.map((m, i) => `
    <button class="dash-filter-btn ${(!month && i === 0) || month === i ? 'dash-filter-btn--active' : ''}"
      data-month="${i === 0 ? '' : i}" onclick="switchPayMonth(${i === 0 ? 'null' : i})">
      ${m}
    </button>`).join('');

  try {
    const year = new Date().getFullYear();
    const qs = month ? `?year=${year}&month=${month}` : `?year=${year}`;
    const data = await apiFetch(`/financial/payment-map${qs}`);

    const total = Object.values(data).reduce((s, v) => s + v.total, 0);
    const totalCount = Object.values(data).reduce((s, v) => s + v.count, 0);

    // Sempre mostrar os 3 métodos, mesmo sem dados
    const METHODS = [
      { key: 'pix',      label: 'PIX',      color: '#f59e0b', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
      { key: 'dinheiro', label: 'Dinheiro', color: '#10b981', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>' },
      { key: 'cartao',   label: 'Cartão',   color: '#3b82f6', icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
    ];

    // Agrupa dados por método de pagamento (prefixo nas notes)
    const byMethod = { pix: { total: 0, count: 0 }, dinheiro: { total: 0, count: 0 }, cartao: { total: 0, count: 0 } };
    // Os dados do payment-map vêm por mês — para separar por método precisamos dos payments diretos
    // Por ora distribui o total igualmente se não tiver breakdown por método
    // TODO: quando o backend retornar breakdown por método, usar aqui

    container.innerHTML = `
      ${total > 0 ? `<div class="card" style="margin-bottom:.75rem"><p style="font-size:.82rem;color:var(--color-text-muted)">${totalCount} atendimento(s) · Total: ${currencyUtils.format(total)}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:.75rem">
        ${METHODS.map(m => {
          const v = byMethod[m.key];
          const pct = total > 0 ? ((v.total / total) * 100).toFixed(1) : 0;
          return `
          <div style="background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:var(--space-md);box-shadow:var(--shadow-md)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
              <span style="color:${m.color}">${m.icon}</span>
              <span style="font-size:.78rem;color:${m.color};font-weight:700">${pct}%</span>
            </div>
            <p style="font-size:1.1rem;font-weight:700;color:#fff">${currencyUtils.format(v.total)}</p>
            <p style="font-size:.75rem;color:rgba(255,255,255,.65);margin-bottom:.4rem">${m.label} · ${v.count} atend.</p>
            <div style="height:4px;background:rgba(255,255,255,.2);border-radius:2px">
              <div style="height:4px;background:${m.color};border-radius:2px;width:${pct}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="text-align:right">
        <div style="display:inline-block;background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:.5rem 1rem;box-shadow:var(--shadow-md)">
          <span style="font-size:.7rem;color:rgba(255,255,255,.75);font-weight:700;text-transform:uppercase;display:block">Total do período</span>
          <p style="font-size:1.1rem;font-weight:700;color:#fff">${currencyUtils.format(total)}</p>
        </div>
      </div>`;
  } catch (_) {
    container.innerHTML = '<p style="color:var(--color-error);font-size:.85rem">Erro ao carregar mapa de pagamentos.</p>';
  }
}

window.switchPayMonth = (month) => loadPaymentMap(month);

// ── Polling ───────────────────────────────────────────────────
function startPolling() {
  // Inicializa contadores com dados atuais
  apiFetch('/leads?status=new').catch(() => []).then(leads => {
    lastLeadCount = leads?.length ?? 0;
  });
  apiFetch(`/schedule/appointments?date=${todayBR()}`).catch(() => []).then(appts => {
    lastApptCount = appts?.length ?? 0;
  });

  pollingInterval = setInterval(async () => {
    try {
      const today = todayBR();
      const [leads, todayAppts] = await Promise.all([
        apiFetch('/leads?status=new'),
        apiFetch(`/schedule/appointments?date=${today}`),
      ]);

      const newLeadCount = leads?.length ?? 0;
      const newApptCount = todayAppts?.length ?? 0;

      // Novo agendamento hoje
      if (newApptCount > lastApptCount) {
        const newest = todayAppts[todayAppts.length - 1];
        const clientName = newest?.clients?.name || '';
        const time = newest?.scheduled_at
          ? new Date(newest.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
          : '';
        showNotification(
          `📅 Novo agendamento — ${esc(clientName)}`,
          time ? `Hoje às ${time}` : 'Novo agendamento recebido'
        );
        loadUpcoming();
        loadStats();
      }

      // Novo lead (Instagram, WhatsApp, etc.)
      if (newLeadCount > lastLeadCount) {
        const newest = leads[0];
        showNotification('🔔 Novo lead recebido!', esc(newest?.name || ''));
        loadStats();
      }

      lastApptCount = newApptCount;
      lastLeadCount = newLeadCount;
    } catch (err) {
      console.warn('[polling] erro:', err.message);
    }
  }, 30000); // 30s
}

window.addEventListener('beforeunload', () => { if (pollingInterval) clearInterval(pollingInterval); });

init();
