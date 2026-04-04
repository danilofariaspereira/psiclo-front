import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { store } from '../state/store.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';
let allClients = [];

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
  await loadClients();

  document.getElementById('btn-new-client').addEventListener('click', openNewClientModal);
  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.getElementById('filter-active').addEventListener('change', applyFilters);
}

async function loadClients() {
  const grid = document.getElementById('clients-grid');
  try {
    allClients = await apiFetch('/clients');
    renderCards(allClients);
  } catch {
    grid.innerHTML = `<p style="color:var(--color-error);grid-column:1/-1;text-align:center">Erro ao carregar clientes.</p>`;
  }
}

function applyFilters() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const activeFilter = document.getElementById('filter-active').value;
  const filtered = allClients.filter(c => {
    const matchName = c.name.toLowerCase().includes(search);
    const matchActive = activeFilter === '' ? true : String(c.active) === activeFilter;
    return matchName && matchActive;
  });
  renderCards(filtered);
}

function renderCards(clients) {
  const grid = document.getElementById('clients-grid');
  if (!clients.length) {
    grid.innerHTML = `<p style="color:var(--color-text-muted);grid-column:1/-1;text-align:center;padding:2rem">Nenhum cliente encontrado.</p>`;
    return;
  }
  grid.innerHTML = clients.map(c => `
    <div class="client-card">
      <div class="client-card__header">
        <div class="client-card__avatar">${esc(c.name).split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</div>
        <div>
          <div class="client-card__name">${esc(c.name)}</div>
          <span class="badge ${c.active ? 'badge--converted' : 'badge--lost'}">${c.active ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
      <div class="client-card__info">
        ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
        ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
        ${c.birth_date ? `<span>🎂 ${new Date(c.birth_date).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>
      <div class="client-card__actions">
        <button class="btn btn--primary btn--sm" onclick="openClientHistory('${esc(c.id)}','${esc(c.name)}')">Histórico</button>
        <button class="btn btn--ghost btn--sm" onclick="deleteClient('${esc(c.id)}','${esc(c.name)}')">Remover</button>
      </div>
    </div>
  `).join('');
}

function openNewClientModal() {
  Modal.open({
    title: 'Novo cliente',
    content: `
      <div class="form-group"><label class="form-label">Nome *</label><input id="c-name" class="form-input" placeholder="Nome completo" /></div>
      <div class="form-group"><label class="form-label">Telefone</label><input id="c-phone" class="form-input" placeholder="(21) 99999-9999" /></div>
      <div class="form-group"><label class="form-label">E-mail</label><input id="c-email" type="email" class="form-input" placeholder="email@exemplo.com" /></div>
      <div class="form-group"><label class="form-label">Data de nascimento</label><input id="c-birth" type="date" class="form-input" /></div>
      <div class="form-group"><label class="form-label">Observações iniciais</label><textarea id="c-notes" class="form-input form-textarea" placeholder="Anotações iniciais..."></textarea></div>
    `,
    confirmLabel: 'Criar cliente',
    onConfirm: async () => {
      const name = document.getElementById('c-name').value.trim();
      if (!name) { notify.error('Nome obrigatório.'); return; }
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
        notify.success('Cliente criado com sucesso!');
        loadClients();
      } catch { notify.error('Erro ao criar cliente.'); }
    },
  });
}

window.openClientHistory = async (id, name) => {
  Modal.open({ title: `Histórico — ${name}`, content: `<p style="text-align:center;color:var(--color-text-muted)">Carregando...</p>`, hideFooter: true });

  try {
    const data = await apiFetch(`/clients/${id}/history`);
    const appts = data.appointments || [];

    if (!appts.length) {
      document.querySelector('#psiclo-modal .modal__body').innerHTML =
        '<p style="text-align:center;color:var(--color-text-muted)">Nenhum atendimento registrado.</p>';
      return;
    }

    const STATUS_PT = { scheduled: 'Agendado', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', no_show: 'Não compareceu' };

    const rows = appts.map(a => `
      <div class="history-item">
        <div class="history-item__header">
          <span class="history-item__date">
            ${new Date(a.scheduled_at).toLocaleDateString('pt-BR')} às ${new Date(a.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span class="badge badge--${a.status === 'completed' ? 'converted' : a.status === 'cancelled' ? 'lost' : 'scheduled'}">${STATUS_PT[a.status] || a.status}</span>
        </div>
        ${a.notes ? `
          <button class="btn btn--ghost btn--sm history-item__obs-btn" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.textContent=this.textContent==='▼ Ver observação'?'▲ Ocultar':'▼ Ver observação'">▼ Ver observação</button>
          <div class="history-item__obs" style="display:none">${esc(a.notes)}</div>
        ` : '<span style="font-size:.78rem;color:var(--color-text-muted);font-style:italic">Sem observação registrada.</span>'}
      </div>
    `).join('');

    document.querySelector('#psiclo-modal .modal__body').innerHTML = `<div style="display:flex;flex-direction:column;gap:.75rem">${rows}</div>`;
    document.querySelector('#psiclo-modal .modal__footer').style.display = 'none';
  } catch {
    document.querySelector('#psiclo-modal .modal__body').innerHTML = '<p style="color:var(--color-error)">Erro ao carregar histórico.</p>';
  }
};

window.deleteClient = async (id, name) => {
  if (!confirm(`Remover "${name}"?\n\nEsta ação é irreversível (LGPD).`)) return;
  try {
    await apiFetch(`/clients/${id}`, { method: 'DELETE' });
    notify.success(`"${name}" removido.`);
    loadClients();
  } catch { notify.error('Erro ao remover cliente.'); }
};

init();
