import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { currencyUtils } from '../utils/currency.js';
import { dateUtils } from '../utils/date.js';

const API = 'https://psiclo-back.vercel.app/api';

async function apiFetch(path, options = {}) {
  const token = authService.getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }

  renderSidebar('financial');
  renderHeader('Financeiro');

  loadSummary();
  loadPayments();

  document.getElementById('filter-payment-status').addEventListener('change', loadPayments);
  document.getElementById('btn-new-payment').addEventListener('click', openNewPaymentModal);
}

async function loadSummary() {
  try {
    const s = await apiFetch('/financial/summary');
    document.getElementById('f-paid').textContent    = currencyUtils.format(s.paid);
    document.getElementById('f-pending').textContent = currencyUtils.format(s.pending);
    document.getElementById('f-overdue').textContent = currencyUtils.format(s.overdue);
  } catch { /* silencioso */ }
}

async function loadPayments() {
  const tbody = document.getElementById('payments-body');
  const status = document.getElementById('filter-payment-status').value;
  const qs = status ? `?status=${status}` : '';

  try {
    const payments = await apiFetch(`/financial/payments${qs}`);

    if (!payments.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum pagamento encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map((p) => `
      <tr>
        <td>${p.clients?.name ?? '—'}</td>
        <td>${currencyUtils.format(p.amount)}</td>
        <td>${dateUtils.format(p.due_date + 'T00:00:00')}</td>
        <td><span class="badge badge--${p.status}">${p.status}</span></td>
        <td>
          ${p.status !== 'paid' ? `
            <button class="btn btn--primary btn--sm" onclick="markPaid('${p.id}')">
              ✓ Pago
            </button>
          ` : '—'}
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-error)">Erro ao carregar.</td></tr>`;
  }
}

async function openNewPaymentModal() {
  const clients = await apiFetch('/clients/active');

  const content = `
    <div class="form-group">
      <label class="form-label">Cliente</label>
      <select id="pay-client" class="form-select">
        <option value="">Selecione...</option>
        ${(clients || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Valor (R$)</label>
      <input type="number" id="pay-amount" class="form-input" placeholder="0,00" min="0" step="0.01" />
    </div>
    <div class="form-group">
      <label class="form-label">Vencimento</label>
      <input type="date" id="pay-due" class="form-input" />
    </div>
    <div class="form-group">
      <label class="form-label">Chave PIX (opcional)</label>
      <input type="text" id="pay-pix" class="form-input" placeholder="CPF, e-mail ou telefone" />
    </div>
  `;

  Modal.open({
    title: 'Novo pagamento',
    content,
    confirmLabel: 'Criar',
    onConfirm: async () => {
      const clientId = document.getElementById('pay-client').value;
      const amount   = parseFloat(document.getElementById('pay-amount').value);
      const dueDate  = document.getElementById('pay-due').value;
      const pixKey   = document.getElementById('pay-pix').value;

      if (!clientId || !amount || !dueDate) { notify.warning('Preencha todos os campos.'); return; }

      try {
        await apiFetch('/financial/payments', {
          method: 'POST',
          body: JSON.stringify({ client_id: clientId, amount, due_date: dueDate, pix_key: pixKey }),
        });
        notify.success('Pagamento criado.');
        loadSummary();
        loadPayments();
      } catch {
        notify.error('Erro ao criar pagamento.');
      }
    },
  });
}

window.markPaid = async (id) => {
  try {
    await apiFetch(`/financial/payments/${id}/pay`, { method: 'PATCH' });
    notify.success('Pagamento confirmado.');
    loadSummary();
    loadPayments();
  } catch {
    notify.error('Erro ao confirmar pagamento.');
  }
};

init();
