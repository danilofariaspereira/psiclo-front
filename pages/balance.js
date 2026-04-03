import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { store } from '../state/store.js';
import { currencyUtils } from '../utils/currency.js';

const API = 'https://psiclo-back.vercel.app/api';
let goalChart = null;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
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

  document.getElementById('btn-add-expense').addEventListener('click', openAddExpenseModal);
  document.getElementById('btn-set-goal').addEventListener('click', openSetGoalModal);
}

async function loadAll() {
  const [summary, expenses, goal] = await Promise.all([
    apiFetch('/financial/summary').catch(() => ({ paid: 0 })),
    apiFetch('/financial/expenses').catch(() => []),
    apiFetch('/financial/goal').catch(() => ({ monthly_goal: 0 })),
  ]);

  const revenue = summary.paid || 0;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const profit = revenue - totalExpenses;
  const monthlyGoal = goal.monthly_goal || 0;

  document.getElementById('b-revenue').textContent = currencyUtils.format(revenue);
  document.getElementById('b-expenses').textContent = currencyUtils.format(totalExpenses);
  document.getElementById('b-profit').textContent = currencyUtils.format(profit);
  document.getElementById('b-profit').className = `stat-card__value ${profit >= 0 ? 'stat-card__value--green' : 'stat-card__value--red'}`;
  document.getElementById('b-goal').textContent = monthlyGoal ? currencyUtils.format(monthlyGoal) : 'Não definida';

  renderGoalChart(profit, monthlyGoal);
  renderExpenses(expenses);
}

function renderGoalChart(profit, goal) {
  const ctx = document.getElementById('chart-goal');
  if (goalChart) goalChart.destroy();

  const reached = Math.min(profit, goal);
  const remaining = Math.max(goal - profit, 0);
  const pct = goal > 0 ? Math.min(Math.round((profit / goal) * 100), 100) : 0;

  const msgEl = document.getElementById('goal-msg');
  if (!goal) {
    msgEl.textContent = 'Defina uma meta para acompanhar seu progresso.';
  } else if (profit >= goal) {
    msgEl.textContent = `🎉 Meta atingida! Você lucrou ${currencyUtils.format(profit - goal)} acima da meta.`;
    msgEl.style.color = 'var(--color-success)';
  } else {
    msgEl.textContent = `Faltam ${currencyUtils.format(remaining)} para atingir sua meta (${pct}% concluído).`;
    msgEl.style.color = 'var(--color-text-muted)';
  }

  goalChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Lucro', 'Falta'],
      datasets: [{
        data: goal > 0 ? [Math.max(reached, 0), remaining] : [0, 1],
        backgroundColor: ['#0288d1', 'rgba(0,0,0,0.08)'],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '75%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => ` ${currencyUtils.format(c.raw)}` },
        },
      },
    },
    plugins: [{
      id: 'centerText',
      beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.font = 'bold 1.4rem Inter, sans-serif';
        ctx.fillStyle = '#1a237e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, width / 2, height / 2);
        ctx.restore();
      },
    }],
  });
}

function renderExpenses(expenses) {
  const tbody = document.getElementById('expenses-body');
  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhuma despesa cadastrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${e.name}</td>
      <td><span class="badge badge--scheduled">${e.category}</span></td>
      <td>${currencyUtils.format(e.amount)}</td>
      <td><button class="btn btn--danger btn--sm" onclick="deleteExpense('${e.id}')">Remover</button></td>
    </tr>
  `).join('');
}

function openAddExpenseModal() {
  Modal.open({
    title: 'Nova despesa fixa',
    confirmLabel: 'Adicionar',
    content: `
      <div class="form-group"><label class="form-label">Nome *</label><input id="exp-name" class="form-input" placeholder="Ex: Aluguel, Internet, Luz..." /></div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select id="exp-cat" class="form-select">
          <option value="aluguel">Aluguel</option>
          <option value="internet">Internet</option>
          <option value="energia">Energia elétrica</option>
          <option value="agua">Água</option>
          <option value="telefone">Telefone</option>
          <option value="software">Software/Assinatura</option>
          <option value="outros">Outros</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Valor mensal (R$) *</label><input type="number" id="exp-amount" class="form-input" placeholder="0,00" min="0" step="0.01" /></div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('exp-name').value.trim();
      const amount = parseFloat(document.getElementById('exp-amount').value);
      const category = document.getElementById('exp-cat').value;
      if (!name || !amount) { notify('Preencha todos os campos.', 'error'); return; }
      try {
        await apiFetch('/financial/expenses', { method: 'POST', body: JSON.stringify({ name, amount, category }) });
        notify('Despesa adicionada!', 'success');
        loadAll();
      } catch { notify('Erro ao adicionar.', 'error'); }
    },
  });
}

function openSetGoalModal() {
  Modal.open({
    title: 'Definir meta mensal',
    confirmLabel: 'Salvar',
    content: `
      <div class="form-group">
        <label class="form-label">Meta de lucro líquido mensal (R$)</label>
        <input type="number" id="goal-input" class="form-input" placeholder="Ex: 5000" min="0" step="100" />
        <p style="font-size:.8rem;color:var(--color-text-muted);margin-top:.3rem">Lucro = Receita recebida − Despesas fixas</p>
      </div>
    `,
    onConfirm: async () => {
      const val = parseFloat(document.getElementById('goal-input').value);
      if (!val || val <= 0) { notify('Informe um valor válido.', 'error'); return; }
      try {
        await apiFetch('/financial/goal', { method: 'PUT', body: JSON.stringify({ monthly_goal: val }) });
        notify('Meta salva!', 'success');
        loadAll();
      } catch { notify('Erro ao salvar meta.', 'error'); }
    },
  });
}

window.deleteExpense = async (id) => {
  try {
    await apiFetch(`/financial/expenses/${id}`, { method: 'DELETE' });
    notify('Despesa removida.', 'success');
    loadAll();
  } catch { notify('Erro ao remover.', 'error'); }
};

init();
