import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';

const API = 'https://psiclo-back.vercel.app/api';
let goalChart = null;
let barChart = null;

async function apiFetch(path, options = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API}${path}${options.method && options.method !== 'GET' ? '' : `${sep}_=${Date.now()}`}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export async function mount(container) {
  container.innerHTML = `
<div class="page-header"><h1 class="page-title">Balanço financeiro</h1></div>
<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.5rem">
  <div class="stat-card"><p class="stat-card__label">Faturamento</p><p class="stat-card__value stat-card__value--green" id="b-revenue">—</p></div>
  <div class="stat-card"><p class="stat-card__label">Despesas</p><p class="stat-card__value stat-card__value--red" id="b-expenses">—</p></div>
  <div class="stat-card"><p class="stat-card__label">Lucro estimado</p><p class="stat-card__value" id="b-profit">—</p></div>
  <div class="stat-card"><p class="stat-card__label">Meta mensal</p><p class="stat-card__value" id="b-goal">—</p></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
  <div class="card card--blue"><p class="card__title">Progresso da meta</p><div style="max-width:200px;margin:.5rem auto"><canvas id="chart-goal" height="200"></canvas></div><p id="goal-msg" style="text-align:center;font-size:.82rem;color:rgba(255,255,255,.75);margin-top:.4rem"></p></div>
  <div class="card card--blue"><p class="card__title">Faturamento vs Despesas</p><canvas id="chart-bar" height="160"></canvas></div>
</div>
<div class="card">
  <p class="card__title" style="margin-bottom:.75rem">Pagamentos recebidos no mês</p>
  <div class="table-wrapper"><table class="table"><thead><tr><th>Cliente</th><th>Valor</th><th>Data</th><th>Forma</th></tr></thead><tbody id="balance-payments-body"><tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Carregando...</td></tr></tbody></table></div>
  <div id="balance-payments-total" style="text-align:right;margin-top:.75rem;font-size:.85rem;color:var(--color-text-muted)"></div>
</div>
`;

  loadAll();
}

export function unmount() {
  if (goalChart) { goalChart.destroy(); goalChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}

async function loadAll() {
  const [summary, expenses, goalData] = await Promise.all([
    apiFetch('/financial/summary').catch(() => ({ paid: 0 })),
    apiFetch('/financial/expenses').catch(() => []),
    apiFetch('/financial/goal').catch(() => ({ monthly_goal: 0 })),
  ]);

  const revenue = summary.paid || 0;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - totalExpenses;
  const goal = goalData.monthly_goal || 0;

  document.getElementById('b-revenue').textContent = currencyUtils.format(revenue);
  document.getElementById('b-expenses').textContent = currencyUtils.format(totalExpenses);
  document.getElementById('b-profit').textContent = currencyUtils.format(profit);
  document.getElementById('b-profit').className = `stat-card__value ${profit >= 0 ? 'stat-card__value--green' : 'stat-card__value--red'}`;
  document.getElementById('b-goal').textContent = goal ? currencyUtils.format(goal) : 'Não definida';

  renderGoalChart(revenue, goal);
  renderBarChart(revenue, totalExpenses, goal);
  loadPayments();

  if (goal > 0 && revenue >= goal) showGoalCelebration(revenue, goal);
}

async function loadPayments() {
  const tbody = document.getElementById('balance-payments-body');
  const totalEl = document.getElementById('balance-payments-total');
  try {
    const payments = await apiFetch('/financial/payments?status=paid');

    const now = new Date();
    const brNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const year = brNow.getFullYear();
    const month = brNow.getMonth();

    const thisMonth = (payments || []).filter(p => {
      if (!p.paid_at) return false;
      const d = new Date(new Date(p.paid_at).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      return d.getFullYear() === year && d.getMonth() === month;
    });

    if (!thisMonth.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum pagamento recebido este mês.</td></tr>`;
      totalEl.textContent = '';
      return;
    }

    const METHOD_PT = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', plano_saude: 'Plano de saúde' };

    tbody.innerHTML = thisMonth.map(p => {
      const match = (p.notes || '').match(/^\[([^\]]+)\]/);
      const method = match ? (METHOD_PT[match[1]] || match[1]) : '—';
      const date = new Date(p.paid_at).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
      });
      return `<tr>
        <td>${p.clients?.name || '—'}</td>
        <td>${currencyUtils.format(p.amount)}</td>
        <td>${date}</td>
        <td>${method}</td>
      </tr>`;
    }).join('');

    const total = thisMonth.reduce((s, p) => s + Number(p.amount), 0);
    totalEl.innerHTML = `<strong>Total do mês: ${currencyUtils.format(total)}</strong> (${thisMonth.length} pagamento${thisMonth.length !== 1 ? 's' : ''})`;
  } catch {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

function renderGoalChart(revenue, goal) {
  const ctx = document.getElementById('chart-goal');
  if (goalChart) goalChart.destroy();

  const msgEl = document.getElementById('goal-msg');
  if (!goal) {
    msgEl.textContent = 'Defina uma meta em Financeiro.';
    msgEl.style.color = 'rgba(255,255,255,.7)';
  } else if (revenue >= goal) {
    msgEl.textContent = `Meta atingida! +${currencyUtils.format(revenue - goal)}`;
    msgEl.style.color = '#a5f3c0';
  } else {
    const pctGoal = Math.round((revenue / goal) * 100);
    const color = pctGoal >= 80 ? '#fde68a' : 'rgba(255,255,255,.85)';
    msgEl.textContent = `${pctGoal}% — faltam ${currencyUtils.format(goal - revenue)}`;
    msgEl.style.color = color;
  }

  const pct = goal > 0 ? Math.min(Math.round((revenue / goal) * 100), 100) : 0;

  goalChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: goal > 0 ? [Math.max(revenue, 0), Math.max(goal - revenue, 0)] : [0, 1],
        backgroundColor: [
          revenue >= goal ? '#22c55e' : (goal > 0 && revenue / goal >= 0.8) ? '#f59e0b' : '#fff',
          'rgba(255,255,255,0.15)'
        ],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${currencyUtils.format(c.raw)}` } } },
    },
    plugins: [{
      id: 'center',
      beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.font = 'bold 1rem Inter,sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, width / 2, height / 2);
        ctx.restore();
      },
    }],
  });
}

function renderBarChart(revenue, expenses, goal) {
  const ctx = document.getElementById('chart-bar');
  if (barChart) barChart.destroy();

  const labels = ['Faturamento', 'Despesas'];
  const data = [revenue, expenses];
  if (goal > 0) { labels.push('Meta'); data.push(goal); }

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['rgba(255,255,255,0.85)', 'rgba(252,165,165,0.85)', 'rgba(255,255,255,0.3)'],
        borderRadius: 6,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,.8)', font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { callback: v => `R${v}`, color: 'rgba(255,255,255,.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
      },
    },
  });
}

function showGoalCelebration(revenue, goal) {
  const existing = document.getElementById('goal-celebration');
  if (existing) return;

  const el = document.createElement('div');
  el.id = 'goal-celebration';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
  el.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:2rem;max-width:380px;width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.25)">
      <svg width="48" height="48" fill="none" stroke="#16a34a" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:.75rem">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
      <h2 style="font-size:1.3rem;font-weight:700;color:#1a237e;margin-bottom:.5rem">Parabéns! Meta atingida!</h2>
      <p style="font-size:.9rem;color:#64748b;margin-bottom:1rem">
        Você faturou <strong>${currencyUtils.format(revenue)}</strong> este mês,
        superando sua meta de <strong>${currencyUtils.format(goal)}</strong>.
      </p>
      <button onclick="document.getElementById('goal-celebration').remove()" class="btn btn--primary" style="width:100%;justify-content:center">Fechar</button>
    </div>`;
  document.body.appendChild(el);
}
