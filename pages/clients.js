import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { store } from '../state/store.js';

const API = 'https://psiclo-back.vercel.app/api';

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
  renderSidebar('clients');
  renderHeader('Clientes');
  loadClients();

  document.getElementById('btn-new-client').addEventListener('click', openNewClientModal);
}

async function loadClients() {
  const tbody = document.getElementById('clients-body');
  try {
    const data = await apiFetch('/clients');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum cliente cadastrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.birth_date ? new Date(c.birth_date).toLocaleDateString('pt-BR') : '—'}</td>
        <td><span class="badge ${c.active ? 'badge--converted' : 'badge--lost'}">${c.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <button class="btn btn--primary btn--sm" onclick="openClientHistory('${c.id}','${c.name}')">Histórico</button>
          <button class="btn btn--sm btn--ghost" onclick="deleteClient('${c.id}','${c.name}')">Remover</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-error)">Erro ao carregar clientes.</td></tr>`;
  }
}

function openNewClientModal() {
  Modal.open({
    title: 'Novo cliente',
    content: `
      <div class="form-group"><label class="form-label">Nome *</label><input id="c-name" class="form-input" placeholder="Nome completo" /></div>
      <div class="form-group"><label class="form-label">Telefone</label><input id="c-phone" class="form-input" placeholder="(21) 99999-9999" /></div>
      <div class="form-group"><label class="form-label">E-mail</label><input id="c-email" type="email" class="form-input" placeholder="email@exemplo.com" /></div>
      <div class="form-group"><label class="form-label">Data de nascimento</label><input id="c-birth" type="date" class="form-input" /></div>
      <div class="form-group"><label class="form-label">Observações</label><textarea id="c-notes" class="form-input form-textarea" placeholder="Anotações iniciais..."></textarea></div>
    `,
    confirmLabel: 'Criar cliente',
    onConfirm: async () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) { notify('Nome obrigatório.', 'error'); return; }
      try {
        await apiFetch('/clients', {
          method: 'POST',
          body: JSON.stringify({
            name,
            phone: document.getElementById('c-phone').value.trim() || null,
            email: document.getElementById('c-email').value.trim() || null,
            birth_date: document.getElementById('c-birth').value || null,
            notes: document.getElementById('c-notes').value.trim() || null,
          }),
        });
        notify('Cliente criado com sucesso!', 'success');
        loadClients();
      } catch (e) {
        notify('Erro ao criar cliente.', 'error');
      }
    },
  });
}

window.openClientHistory = async (id, name) => {
  let content = `<p style="text-align:center;color:var(--color-text-muted)">Carregando...</p>`;
  Modal.open({ title: `Histórico — ${name}`, content, hideFooter: true });

  try {
    const [appts, payments] = await Promise.all([
      apiFetch(`/clients/${id}/history`).catch(() => ({ appointments: [], payments: [] })),
    ]);
    const data = appts;

    const apptRows = (data.appointments || []).map(a => `
      <tr>
        <td>${new Date(a.scheduled_at).toLocaleDateString('pt-BR')}</td>
        <td>${new Date(a.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${{ scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' }[a.status] || a.status}</td>
      </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Nenhum agendamento.</td></tr>';

    const payRows = (data.payments || []).map(p => `
      <tr>
        <td>${new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
        <td>R$ ${Number(p.amount).toFixed(2).replace('.', ',')}</td>
        <td>${{ paid: 'Pago', pending: 'Pendente', overdue: 'Vencido', cancelled: 'Cancelado' }[p.status] || p.status}</td>
      </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Nenhum pagamento.</td></tr>';

    const newContent = `
      <p style="font-weight:700;margin-bottom:.5rem">Agendamentos</p>
      <div class="table-wrapper" style="margin-bottom:1.5rem">
        <table class="table">
          <thead><tr><th>Data</th><th>Horário</th><th>Status</th></tr></thead>
          <tbody>${apptRows}</tbody>
        </table>
      </div>
      <p style="font-weight:700;margin-bottom:.5rem">Pagamentos</p>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${payRows}</tbody>
        </table>
      </div>`;

    document.querySelector('#psiclo-modal .modal__body').innerHTML = newContent;
    document.querySelector('#psiclo-modal .modal__footer').style.display = 'none';
  } catch {
    document.querySelector('#psiclo-modal .modal__body').innerHTML = '<p style="color:var(--color-error)">Erro ao carregar histórico.</p>';
  }
};
  if (!confirm(`Remover "${name}"?\n\nEsta ação é irreversível (LGPD).`)) return;
  try {
    await apiFetch(`/clients/${id}`, { method: 'DELETE' });
    notify(`"${name}" removido.`, 'success');
    loadClients();
  } catch (e) {
    notify('Erro ao remover cliente.', 'error');
  }
};

init();
