import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
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

async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }
  store.set('professional', session.professional);
  renderSidebar('balance');
  renderHeader('Balanço financeiro');
  loadAll();
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

  renderGoalChart(profit, goal);
  renderBarChart(revenue, totalExpenses, goal);

  // Celebração se meta atingida
  if (goal > 0 && revenue >= goal) showGoalCelebration(revenue, goal);
}

function renderGoalChart(profit, goal) {
  const ctx = document.getElementById('chart-goal');
  if (goalChart) goalChart.destroy();

  const pct = goal > 0 ? Math.min(Math.round((profit / goal) * 100), 100) : 0;
  const remaining = Math.max(goal - profit, 0);

  const msgEl = document.getElementById('goal-msg');
  if (!goal) {
    msgEl.textContent = 'Defina uma meta em Financeiro.';
    msgEl.style.color = 'rgba(255,255,255,.7)';
  } else if (profit >= goal) {
    msgEl.textContent = `Meta atingida! +${currencyUtils.format(profit - goal)}`;
    msgEl.style.color = '#a5f3c0';
  } else {
    msgEl.textContent = `${pct}% — faltam ${currencyUtils.format(remaining)}`;
    msgEl.style.color = 'rgba(255,255,255,.85)';
  }

  goalChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: goal > 0 ? [Math.max(profit, 0), remaining] : [0, 1],
        backgroundColor: ['#fff', 'rgba(255,255,255,0.15)'],
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
        y: { ticks: { callback: v => `R$${v}`, color: 'rgba(255,255,255,.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
      },
    },
  });
}


function showGoalCelebration(revenue, goal) {
  const existing = document.getElementById('goal-celebration');
  if (existing) return; // só mostra uma vez

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

init();
