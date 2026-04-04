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
  setTimeout(() => { el.classList.add('appt-toast--hide'); setTimeout(() => el.remove(), 400); }, 6000);
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
  startPolling();
}

// ── Abas ─────────────────────────────────────────────────────
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

    // Gráfico de linha — faturamento diário
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const monthLabel = MONTHS[month - 1];
    const monthData = paymentMap[monthLabel] || { total: 0 };

    // Distribui o total do mês pelos dias (simplificado — sem dados por dia ainda)
    // Busca pagamentos do mês para distribuir por dia
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
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem;padding:1rem">Nenhum atendimento concluído no período.</p>';
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
      <thead><tr><th style="padding:4px 8px;text-align:left;color:var(--color-text-muted)">Hora</th>
      ${DAYS_ORDER.map(d => `<th style="padding:4px 6px;text-align:center;color:var(--color-text-muted);text-transform:uppercase">${d}</th>`).join('')}
      </tr></thead><tbody>`;

    hours.forEach(hour => {
      html += `<tr><td style="padding:3px 8px;color:var(--color-text-muted);white-space:nowrap">${hour}</td>`;
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

    const entries = Object.entries(data);
    if (!entries.length) {
      container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem;padding:1rem">Nenhum pagamento no período.</p>';
      return;
    }

    const total = entries.reduce((s, [, v]) => s + v.total, 0);
    const totalCount = entries.reduce((s, [, v]) => s + v.count, 0);

    container.innerHTML = `
      <div class="card" style="margin-bottom:.75rem">
        <p style="font-size:.82rem;color:var(--color-text-muted)">${totalCount} atendimento(s) · Total: ${currencyUtils.format(total)}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem">
        ${entries.map(([label, v]) => {
          const pct = total > 0 ? ((v.total / total) * 100).toFixed(1) : 0;
          return `
          <div class="card" style="border-left:3px solid #0288d1">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
              <span style="font-weight:700;font-size:.9rem">${esc(label)}</span>
              <span style="font-size:.78rem;color:#0288d1;font-weight:700">${pct}%</span>
            </div>
            <p style="font-size:1.1rem;font-weight:700;color:var(--color-text)">${currencyUtils.format(v.total)}</p>
            <p style="font-size:.75rem;color:var(--color-text-muted)">${v.count} atend.</p>
            <div style="height:4px;background:#e2e8f0;border-radius:2px;margin-top:.5rem">
              <div style="height:4px;background:#0288d1;border-radius:2px;width:${pct}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="text-align:right;margin-top:.75rem">
        <div class="stat-card" style="display:inline-block;padding:.5rem 1rem">
          <span style="font-size:.75rem;color:var(--color-text-muted);font-weight:700;text-transform:uppercase">Total do período</span>
          <p style="font-size:1.2rem;font-weight:700;color:var(--color-text)">${currencyUtils.format(total)}</p>
        </div>
      </div>`;
  } catch (_) {
    container.innerHTML = '<p style="color:var(--color-error);font-size:.85rem">Erro ao carregar mapa de pagamentos.</p>';
  }
}

window.switchPayMonth = (month) => loadPaymentMap(month);

// ── Polling ───────────────────────────────────────────────────
function startPolling() {
  Promise.all([
    apiFetch('/leads?status=new').catch(() => []),
    apiFetch(`/schedule/appointments?date=${todayBR()}`).catch(() => []),
  ]).then(([leads, appts]) => {
    lastLeadCount = leads?.length ?? 0;
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

      if (newLeadCount > lastLeadCount) {
        showNotification('Novo lead recebido!', esc(leads[0]?.name || ''));
        loadStats();
      }
      if (newApptCount > lastApptCount) {
        const newest = todayAppts[todayAppts.length - 1];
        const clientName = newest?.clients?.name || '';
        const time = newest?.scheduled_at
          ? new Date(newest.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
          : '';
        showNotification(`Novo agendamento — ${esc(clientName)}`, time ? `Horário: ${time}` : '');
        loadUpcoming();
        loadStats();
      }
      lastLeadCount = newLeadCount;
      lastApptCount = newApptCount;
    } catch (_) {}
  }, 30000);
}

window.addEventListener('beforeunload', () => { if (pollingInterval) clearInterval(pollingInterval); });

init();
