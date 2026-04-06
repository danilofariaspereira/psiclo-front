import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';
let lastLeadCount = 0;
let lastApptCount = 0;
let pollingInterval = null;
let dailyChart = null;
let summaryChart = null;

async function apiFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${sep}_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

function todayBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
}

// ── SPA mount/unmount ─────────────────────────────────────────
export async function mount(container) {
  lastLeadCount = 0; lastApptCount = 0; dailyChart = null; summaryChart = null;

  container.innerHTML = `
    <div class="dash-tabs">
      <button class="dash-tab dash-tab--active" data-tab="overview">Visão geral</button>
      <button class="dash-tab" data-tab="heatmap">Mapa de calor</button>
      <button class="dash-tab" data-tab="payments">Mapa de pagamentos</button>
    </div>
    <div id="tab-overview">
      <div class="stats-grid">
        <div class="stat-card"><p class="stat-card__label">Agendados hoje</p><p class="stat-card__value" id="stat-today">—</p><p class="stat-card__sub">Clientes esperados hoje</p></div>
        <div class="stat-card"><p class="stat-card__label">Concluídos hoje</p><p class="stat-card__value" id="stat-completed">—</p><p class="stat-card__sub">Atendimentos finalizados</p></div>
        <div class="stat-card"><p class="stat-card__label">Faturamento de hoje</p><p class="stat-card__value stat-card__value--green" id="stat-today-revenue">—</p><p class="stat-card__sub">Somente atendimentos concluídos hoje</p></div>
        <div class="stat-card"><p class="stat-card__label">Faturamento do mês</p><p class="stat-card__value stat-card__value--green" id="stat-paid">—</p><p class="stat-card__sub">Somente atendimentos concluídos no mês</p></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="card card--blue"><p class="card__title">Faturamento diário (mês atual)</p><p style="font-size:.75rem;color:rgba(255,255,255,.65);margin-bottom:.75rem">Linha suave mostrando os dias fortes e fracos do mês.</p><div style="position:relative;height:160px"><canvas id="chart-daily"></canvas></div></div>
        <div class="card card--blue"><p class="card__title">Resumo do mês</p><p style="font-size:.75rem;color:rgba(255,255,255,.65);margin-bottom:.75rem">Relação entre faturamento e despesas para calcular o lucro.</p><div style="max-width:160px;margin:0 auto;height:160px"><canvas id="chart-summary"></canvas></div></div>
      </div>
      <div class="card"><p class="card__title">Sessões de hoje</p><div class="table-wrapper"><table class="table"><thead><tr><th>Horário</th><th>Cliente</th><th>Modalidade</th><th>Status</th></tr></thead><tbody id="upcoming-body"><tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Carregando...</td></tr></tbody></table></div></div>
    </div>
    <div id="tab-heatmap" style="display:none">
      <div style="background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:var(--space-lg);box-shadow:var(--shadow-md)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem"><p style="font-size:1rem;font-weight:600;color:#fff;margin:0">Horários mais movimentados</p><div style="display:flex;gap:.4rem;flex-wrap:wrap" id="heatmap-months"></div></div>
        <div id="heatmap-container" style="overflow-x:auto"></div>
      </div>
    </div>
    <div id="tab-payments" style="display:none">
      <div style="background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:var(--space-lg);box-shadow:var(--shadow-md)">
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem" id="paymap-months"></div>
        <div id="paymap-container"></div>
      </div>
    </div>`;

  setupTabs();
  await loadOverview();
  checkBirthdays();
  startPolling();
}

export function unmount() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  if (dailyChart) { dailyChart.destroy(); dailyChart = null; }
  if (summaryChart) { summaryChart.destroy(); summaryChart = null; }
}

// ── Tabs ──────────────────────────────────────────────────────
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
    const [summary, todayAppts] = await Promise.all([
      apiFetch('/financial/summary'),
      apiFetch(`/schedule/appointments?date=${today}`),
    ]);
    const completed = (todayAppts || []).filter(a => a.status === 'completed');
    document.getElementById('stat-today').textContent = todayAppts?.length ?? 0;
    document.getElementById('stat-completed').textContent = completed.length;
    document.getElementById('stat-paid').textContent = currencyUtils.format(summary.paid);
    const payToday = await apiFetch(`/financial/payments?date=${today}`).catch(() => []);
    const todayRevenue = (payToday || []).filter(p => p.paid_at?.startsWith(today)).reduce((s, p) => s + Number(p.amount), 0);
    document.getElementById('stat-today-revenue').textContent = currencyUtils.format(todayRevenue);
  } catch (_) {}
}

async function loadUpcoming() {
  const tbody = document.getElementById('upcoming-body');
  try {
    const data = await apiFetch(`/schedule/appointments?date=${todayBR()}`);
    if (!data.length) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhuma sessão hoje.</td></tr>`; return; }
    const STATUS_PT = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado', no_show:'Não compareceu' };
    tbody.innerHTML = data.map(a => `<tr><td>${dateUtils.formatTime(a.scheduled_at)}</td><td>${esc(a.clients?.name) || '—'}</td><td>${a.modality === 'online' ? 'Online' : 'Presencial'}</td><td><span class="badge badge--${a.status}">${STATUS_PT[a.status] || esc(a.status)}</span></td></tr>`).join('');
  } catch (_) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`; }
}

async function loadCharts() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const [summary, expenses, payments] = await Promise.all([
      apiFetch('/financial/summary'),
      apiFetch('/financial/expenses'),
      apiFetch('/financial/payments').catch(() => []),
    ]);
    const dailyTotals = Array(daysInMonth).fill(0);
    (payments || []).forEach(p => {
      if (!p.paid_at) return;
      const d = new Date(p.paid_at);
      if (d.getMonth() + 1 === month && d.getFullYear() === year) dailyTotals[d.getDate() - 1] += Number(p.amount);
    });
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(document.getElementById('chart-daily'), {
      type: 'line',
      data: { labels: Array.from({ length: daysInMonth }, (_, i) => i + 1), datasets: [{ data: dailyTotals, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.12)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: 'rgba(255,255,255,.7)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } }, y: { ticks: { callback: v => `R${v}`, font: { size: 10 } } } } },
    });
    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const revenue = summary.paid || 0;
    const profit = Math.max(revenue - totalExpenses, 0);
    const pct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    if (summaryChart) summaryChart.destroy();
    summaryChart = new Chart(document.getElementById('chart-summary'), {
      type: 'doughnut',
      data: { labels: ['Lucro', 'Despesas'], datasets: [{ data: [profit || 0.001, totalExpenses || 0.001], backgroundColor: ['#22c55e', 'rgba(255,255,255,0.15)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${currencyUtils.format(c.raw)}` } } } },
      plugins: [{ id: 'center', beforeDraw(chart) { const { ctx, width, height } = chart; ctx.save(); ctx.font = 'bold 1.2rem Inter,sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${pct}%`, width / 2, height / 2); ctx.restore(); } }],
    });
  } catch (_) {}
}

// ── Aniversariantes ───────────────────────────────────────────
async function checkBirthdays() {
  try {
    const clients = await apiFetch('/clients');
    const today = new Date();
    const birthdayClients = (clients || []).filter(c => {
      if (!c.birth_date) return false;
      const d = new Date(c.birth_date + 'T12:00:00');
      return d.getDate() === today.getDate() && (d.getMonth() + 1) === (today.getMonth() + 1);
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
        <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1rem">
          ${birthdayClients.map(c => {
            const phone = c.phone ? c.phone.replace(/\D/g,'') : '';
            const msg = encodeURIComponent(`Olá, ${c.name}! Tudo bem?\n\nAqui é ${profName}. Neste dia tão especial, quero te desejar um feliz aniversário!\n\nQue este novo ciclo seja repleto de saúde, leveza e muito autoconhecimento. É uma honra caminhar ao seu lado nessa jornada.\n\nConte sempre comigo. Um abraço!`);
            const waHref = phone ? `https://wa.me/55${phone}?text=${msg}` : null;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
              <div><p style="font-weight:600;font-size:.9rem;color:#1e293b">${esc(c.name)}</p><p style="font-size:.75rem;color:#64748b">${esc(c.phone) || '—'}</p></div>
              ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn btn--primary btn--sm" style="text-decoration:none">Parabenizar</a>` : ''}
            </div>`;
          }).join('')}
        </div>
        <button onclick="this.closest('[style]').remove()" class="btn btn--ghost" style="width:100%;justify-content:center">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);
  } catch (_) {}
}

// ── Mapa de calor ─────────────────────────────────────────────
const MONTHS_LABELS = ['Todos','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS_ORDER = ['seg.','ter.','qua.','qui.','sex.','sáb.','dom.'];

async function loadHeatmap(month = null) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">Carregando...</p>';
  document.getElementById('heatmap-months').innerHTML = MONTHS_LABELS.map((m, i) => `<button class="dash-filter-btn ${(!month && i === 0) || month === i ? 'dash-filter-btn--active' : ''}" onclick="switchHeatmapMonth(${i === 0 ? 'null' : i})">${m}</button>`).join('');
  try {
    const year = new Date().getFullYear();
    const data = await apiFetch(`/financial/heatmap${month ? `?year=${year}&month=${month}` : `?year=${year}`}`);
    const hours = [...new Set(Object.keys(data).map(k => k.split('|')[1]))].sort();
    if (!hours.length) { container.innerHTML = '<p style="color:rgba(255,255,255,.65);font-size:.85rem;padding:1rem">Nenhum atendimento concluído no período.</p>'; return; }
    const maxVal = Math.max(...Object.values(data), 1);
    const heatColor = v => { if (!v) return '#f0f4f8'; const p = v/maxVal; return p < 0.2 ? '#c8e6c9' : p < 0.4 ? '#81c784' : p < 0.7 ? '#ffa726' : '#ef5350'; };
    let html = `<table style="border-collapse:collapse;width:100%;font-size:.75rem"><thead><tr><th style="padding:4px 8px;text-align:left;color:rgba(255,255,255,.65)">Hora</th>${DAYS_ORDER.map(d => `<th style="padding:4px 6px;text-align:center;color:rgba(255,255,255,.65);text-transform:uppercase">${d}</th>`).join('')}</tr></thead><tbody>`;
    hours.forEach(hour => {
      html += `<tr><td style="padding:3px 8px;color:rgba(255,255,255,.75);white-space:nowrap">${hour}</td>`;
      DAYS_ORDER.forEach(day => { const val = data[`${day}|${hour}`] || 0; html += `<td style="padding:3px 4px;text-align:center"><div title="${val} atendimento(s)" style="width:100%;height:22px;border-radius:4px;background:${heatColor(val)};display:flex;align-items:center;justify-content:center;font-size:.68rem;color:${val ? '#333' : 'transparent'}">${val || ''}</div></td>`; });
      html += '</tr>';
    });
    container.innerHTML = html + '</tbody></table>';
  } catch (_) { container.innerHTML = '<p style="color:var(--color-error);font-size:.85rem">Erro ao carregar.</p>'; }
}
window.switchHeatmapMonth = (month) => loadHeatmap(month);

// ── Mapa de pagamentos ────────────────────────────────────────
async function loadPaymentMap(month = null) {
  const container = document.getElementById('paymap-container');
  container.innerHTML = '<p style="color:var(--color-text-muted);font-size:.85rem">Carregando...</p>';
  document.getElementById('paymap-months').innerHTML = MONTHS_LABELS.map((m, i) => `<button class="dash-filter-btn ${(!month && i === 0) || month === i ? 'dash-filter-btn--active' : ''}" onclick="switchPayMonth(${i === 0 ? 'null' : i})">${m}</button>`).join('');
  try {
    const year = new Date().getFullYear();
    const data = await apiFetch(`/financial/payment-map${month ? `?year=${year}&month=${month}` : `?year=${year}`}`);
    const total = Object.values(data.byMonth || {}).reduce((s, v) => s + v.total, 0);
    const totalCount = Object.values(data.byMonth || {}).reduce((s, v) => s + v.count, 0);
    const byMethod = data.byMethod || { pix:{total:0,count:0}, dinheiro:{total:0,count:0}, cartao:{total:0,count:0} };
    const METHODS = [
      { key:'pix', label:'PIX', color:'#f59e0b' },
      { key:'dinheiro', label:'Dinheiro', color:'#10b981' },
      { key:'cartao', label:'Cartão', color:'#3b82f6' },
    ];
    container.innerHTML = `
      ${total > 0 ? `<div class="card" style="margin-bottom:.75rem"><p style="font-size:.82rem;color:var(--color-text-muted)">${totalCount} atendimento(s) · Total: ${currencyUtils.format(total)}</p></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:.75rem">
        ${METHODS.map(m => { const v = byMethod[m.key] || {total:0,count:0}; const pct = total > 0 ? ((v.total/total)*100).toFixed(1) : 0; return `<div style="background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:var(--space-md);box-shadow:var(--shadow-md)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><span style="color:${m.color};font-weight:700">${m.label}</span><span style="font-size:.78rem;color:${m.color};font-weight:700">${pct}%</span></div><p style="font-size:1.1rem;font-weight:700;color:#fff">${currencyUtils.format(v.total)}</p><p style="font-size:.75rem;color:rgba(255,255,255,.65)">${v.count} atend.</p><div style="height:4px;background:rgba(255,255,255,.2);border-radius:2px"><div style="height:4px;background:${m.color};border-radius:2px;width:${pct}%"></div></div></div>`; }).join('')}
      </div>
      <div style="text-align:right"><div style="display:inline-block;background:linear-gradient(135deg,#1a237e 0%,#1565c0 60%,#0288d1 100%);border-radius:var(--radius-md);padding:.5rem 1rem;box-shadow:var(--shadow-md)"><span style="font-size:.7rem;color:rgba(255,255,255,.75);font-weight:700;text-transform:uppercase;display:block">Total do período</span><p style="font-size:1.1rem;font-weight:700;color:#fff">${currencyUtils.format(total)}</p></div></div>`;
  } catch (_) { container.innerHTML = '<p style="color:var(--color-error);font-size:.85rem">Erro ao carregar.</p>'; }
}
window.switchPayMonth = (month) => loadPaymentMap(month);

// ── Polling ───────────────────────────────────────────────────
function startPolling() {
  pollingInterval = setInterval(async () => {
    try {
      const today = todayBR();
      const [leads, todayAppts] = await Promise.all([apiFetch('/leads?status=new'), apiFetch(`/schedule/appointments?date=${today}`)]);
      const newLeadCount = leads?.length ?? 0;
      const newApptCount = todayAppts?.length ?? 0;
      if (newLeadCount > lastLeadCount || newApptCount > lastApptCount) loadStats();
      if (newApptCount > lastApptCount) loadUpcoming();
      lastLeadCount = newLeadCount;
      lastApptCount = newApptCount;
    } catch (err) { console.warn('[dashboard polling]', err.message); }
  }, 30000);
}
