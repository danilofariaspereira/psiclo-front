import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';
import { esc } from '../utils/sanitize.js';
import { store } from '../state/store.js';

const API = 'https://psiclo-back.vercel.app/api';

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
  renderSidebar('financial');
  renderHeader('Financeiro');
  loadAll();
  document.getElementById('btn-add-expense').addEventListener('click', openAddExpenseModal);
  document.getElementById('btn-set-goal').addEventListener('click', openSetGoalModal);
  document.getElementById('btn-filter-payments').addEventListener('click', loadPayments);
  // Filtro em tempo real ao digitar nome do cliente
  document.getElementById('filter-client')?.addEventListener('input', loadPayments);
}

async function loadAll() {
  // expenses e goal mudam raramente — usa cache de 5 min
  const cachedExpenses = store.cache.get('expenses');
  const cachedGoal = store.cache.get('financial_goal');

  const [summary, expenses, goalData] = await Promise.all([
    apiFetch('/financial/summary').catch(() => ({ paid: 0 })),
    cachedExpenses ? Promise.resolve(cachedExpenses) : apiFetch('/financial/expenses').catch(() => []),
    cachedGoal ? Promise.resolve(cachedGoal) : apiFetch('/financial/goal').catch(() => ({ monthly_goal: 0 })),
  ]);

  if (!cachedExpenses) store.cache.set('expenses', expenses);
  if (!cachedGoal) store.cache.set('financial_goal', goalData);

  const paid = summary.paid || 0;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const goal = goalData.monthly_goal || 0;
  const remaining = goal > 0 ? Math.max(goal - paid, 0) : null;

  document.getElementById('f-paid').textContent = currencyUtils.format(paid);
  document.getElementById('f-expenses').textContent = currencyUtils.format(totalExpenses);
  document.getElementById('f-goal').textContent = goal ? currencyUtils.format(goal) : 'Não definida';

  const remEl = document.getElementById('f-remaining');
  if (remaining === null) {
    remEl.textContent = '—';
    remEl.className = 'stat-card__value';
  } else if (remaining === 0) {
    remEl.textContent = 'Meta atingida!';
    remEl.className = 'stat-card__value stat-card__value--green';
  } else {
    remEl.textContent = currencyUtils.format(remaining);
    remEl.className = 'stat-card__value stat-card__value--yellow';
  }

  renderExpenseCards(expenses);
  loadPayments();
}

function renderExpenseCards(expenses) {
  const grid = document.getElementById('expenses-grid');
  if (!expenses.length) {
    grid.innerHTML = `<p style="color:var(--color-text-muted);font-size:.85rem;grid-column:1/-1">Nenhuma despesa cadastrada. Clique em "+ Nova despesa" para adicionar.</p>`;
    return;
  }
  grid.innerHTML = expenses.map(e => `
    <div class="expense-card">
      <div class="expense-card__header">
        <span class="expense-card__name">${esc(e.name)}</span>
        <div style="display:flex;gap:.3rem">
          <button class="expense-card__btn" onclick="editExpense('${esc(e.id)}','${esc(e.name)}',${e.amount},'${esc(e.category)}')" title="Editar">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="expense-card__btn expense-card__btn--danger" onclick="deleteExpense('${esc(e.id)}')" title="Remover">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <p class="expense-card__value">${currencyUtils.format(e.amount)}</p>
      <span class="badge badge--scheduled" style="font-size:.68rem">${esc(e.category)}</span>
    </div>
  `).join('');
}

async function loadPayments() {
  const tbody = document.getElementById('payments-body');
  const totalEl = document.getElementById('payments-total');
  const clientFilter = document.getElementById('filter-client')?.value.trim().toLowerCase() || '';
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';

  try {
    const payments = await apiFetch('/financial/payments?status=paid');
    if (!payments.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum pagamento recebido.</td></tr>`;
      totalEl.textContent = '';
      return;
    }

    const METHOD_PT = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', plano_saude: 'Plano de saúde' };

    // Aplica filtros no frontend
    let filtered = payments.filter(p => {
      const name = (p.clients?.name || '').toLowerCase();
      const paidDate = p.paid_at ? p.paid_at.split('T')[0] : '';
      const matchClient = !clientFilter || name.includes(clientFilter);
      const matchFrom = !dateFrom || paidDate >= dateFrom;
      const matchTo = !dateTo || paidDate <= dateTo;
      return matchClient && matchFrom && matchTo;
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum resultado para os filtros aplicados.</td></tr>`;
      totalEl.textContent = '';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      let method = '—';
      const match = (p.notes || '').match(/^\[([^\]]+)\]/);
      if (match) method = match[1];
      const displayDate = p.paid_at
        ? new Date(p.paid_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
        : (p.due_date ? dateUtils.format(p.due_date + 'T00:00:00') : '—');
      return `<tr>
        <td>${esc(p.clients?.name) || '—'}</td>
        <td>${currencyUtils.format(p.amount)}</td>
        <td>${displayDate}</td>
        <td>${METHOD_PT[method] || esc(method)}</td>
      </tr>`;
    }).join('');

    // Total dos resultados filtrados
    const total = filtered.reduce((s, p) => s + Number(p.amount), 0);
    const clientLabel = clientFilter
      ? `Total de ${clientFilter}: `
      : 'Total do período: ';
    totalEl.innerHTML = `<strong>${clientLabel}${currencyUtils.format(total)}</strong> (${filtered.length} pagamento${filtered.length !== 1 ? 's' : ''})`;
  } catch {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

function openAddExpenseModal() {
  Modal.open({
    title: 'Nova despesa',
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
      if (!name || !amount) { notify.error('Preencha todos os campos.'); return; }
      try {
        await apiFetch('/financial/expenses', { method: 'POST', body: JSON.stringify({ name, amount, category }) });
        store.cache.del('expenses');
        notify.success('Despesa adicionada!');
        loadAll();
      } catch { notify.error('Erro ao adicionar.'); }
    },
  });
}

function openSetGoalModal() {
  Modal.open({
    title: 'Definir meta mensal',
    confirmLabel: 'Salvar',
    content: `
      <div class="form-group">
        <label class="form-label">Meta de faturamento mensal (R$)</label>
        <input type="number" id="goal-input" class="form-input" placeholder="Ex: 5000" min="0" step="100" />
        <p style="font-size:.8rem;color:var(--color-text-muted);margin-top:.3rem">Quanto você quer receber este mês?</p>
      </div>`,
    onConfirm: async () => {
      const val = parseFloat(document.getElementById('goal-input').value);
      if (!val || val <= 0) { notify.error('Informe um valor válido.'); return; }
      try {
        await apiFetch('/financial/goal', { method: 'PUT', body: JSON.stringify({ monthly_goal: val }) });
        store.cache.del('financial_goal');
        notify.success('Meta salva!');
        loadAll();
      } catch { notify.error('Erro ao salvar meta.'); }
    },
  });
}

window.deleteExpense = async (id) => {
  if (!confirm('Remover esta despesa?')) return;
  try {
    await apiFetch(`/financial/expenses/${id}`, { method: 'DELETE' });
    store.cache.del('expenses');
    notify.success('Despesa removida.');
    loadAll();
  } catch { notify.error('Erro ao remover.'); }
};

window.editExpense = (id, name, amount, category) => {
  Modal.open({
    title: 'Editar despesa',
    confirmLabel: 'Salvar',
    content: `
      <div class="form-group"><label class="form-label">Nome *</label><input id="exp-edit-name" class="form-input" value="${esc(name)}" /></div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select id="exp-edit-cat" class="form-select">
          <option value="aluguel" ${category==='aluguel'?'selected':''}>Aluguel</option>
          <option value="internet" ${category==='internet'?'selected':''}>Internet</option>
          <option value="energia" ${category==='energia'?'selected':''}>Energia elétrica</option>
          <option value="agua" ${category==='agua'?'selected':''}>Água</option>
          <option value="telefone" ${category==='telefone'?'selected':''}>Telefone</option>
          <option value="software" ${category==='software'?'selected':''}>Software/Assinatura</option>
          <option value="outros" ${category==='outros'?'selected':''}>Outros</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Valor (R$) *</label><input type="number" id="exp-edit-amount" class="form-input" value="${amount}" min="0" step="0.01" /></div>
    `,
    onConfirm: async () => {
      const newName = document.getElementById('exp-edit-name').value.trim();
      const newAmount = parseFloat(document.getElementById('exp-edit-amount').value);
      const newCat = document.getElementById('exp-edit-cat').value;
      if (!newName || !newAmount) { notify.error('Preencha todos os campos.'); return; }
      try {
        // Deleta e recria (API não tem PATCH para expenses)
        await apiFetch(`/financial/expenses/${id}`, { method: 'DELETE' });
        await apiFetch('/financial/expenses', { method: 'POST', body: JSON.stringify({ name: newName, amount: newAmount, category: newCat }) });
        store.cache.del('expenses');
        notify.success('Despesa atualizada!');
        loadAll();
      } catch { notify.error('Erro ao atualizar.'); }
    },
  });
};

init();
