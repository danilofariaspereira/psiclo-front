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

const SVG_PHONE = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const SVG_EMAIL = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const SVG_BDAY = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><line x1="12" y1="14" x2="12" y2="17"/></svg>`;

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
        ${c.phone ? `<span style="display:inline-flex;align-items:center;gap:.3rem">${SVG_PHONE} ${esc(c.phone)}</span>` : ''}
        ${c.email ? `<span style="display:inline-flex;align-items:center;gap:.3rem">${SVG_EMAIL} ${esc(c.email)}</span>` : ''}
        ${c.birth_date ? `<span style="display:inline-flex;align-items:center;gap:.3rem">${SVG_BDAY} ${new Date(c.birth_date).toLocaleDateString('pt-BR')}</span>` : ''}
      </div>
      <div class="client-card__actions" style="justify-content:flex-end">
        <button class="btn btn--primary btn--sm" onclick="openClientHistory('${esc(c.id)}','${esc(c.name)}')">Histórico</button>
        <button class="btn btn--ghost btn--sm" onclick="editClient('${esc(c.id)}')">Editar</button>
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

    const rows = appts.map((a, i) => `
      <div class="history-item">
        <div class="history-item__header">
          <span class="history-item__date">
            ${new Date(a.scheduled_at).toLocaleDateString('pt-BR')} às ${new Date(a.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span class="badge badge--${a.status === 'completed' ? 'converted' : a.status === 'cancelled' ? 'lost' : 'scheduled'}">${STATUS_PT[a.status] || a.status}</span>
        </div>
        ${a.notes ? `
          <button class="btn btn--ghost btn--sm history-item__obs-btn" data-note-idx="${i}">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver observação
          </button>
        ` : '<span style="font-size:.78rem;color:var(--color-text-muted);font-style:italic">Sem observação registrada.</span>'}
      </div>
    `).join('');

    const body = document.querySelector('#psiclo-modal .modal__body');
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:.75rem">${rows}</div>`;
    document.querySelector('#psiclo-modal .modal__footer').style.display = 'none';

    // Vincula os botões de observação usando índice — evita problemas com escaping inline
    body.querySelectorAll('.history-item__obs-btn').forEach(btn => {
      const idx = parseInt(btn.dataset.noteIdx);
      btn.addEventListener('click', () => viewHistoryNote(appts[idx].notes));
    });
  } catch {
    document.querySelector('#psiclo-modal .modal__body').innerHTML = '<p style="color:var(--color-error)">Erro ao carregar histórico.</p>';
  }
};

window.viewHistoryNote = (notes) => {
  // Remove overlay anterior se existir
  document.getElementById('note-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'note-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.45);
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.5rem;max-width:480px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2);position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <strong style="font-size:1rem">Observação da sessão</strong>
        <button id="note-overlay-close" style="background:none;border:none;font-size:1.4rem;cursor:pointer;line-height:1;color:#666">×</button>
      </div>
      <p style="white-space:pre-wrap;line-height:1.6;font-size:.9rem;color:#333">${notes}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#note-overlay-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
};

window.editClient = async (id) => {
  // Busca dados atuais do cliente
  const client = allClients.find(c => c.id === id);
  if (!client) return;

  Modal.open({
    title: `Editar — ${esc(client.name)}`,
    confirmLabel: 'Salvar',
    content: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
        <div class="form-group" style="margin:0"><label class="form-label">Nome *</label><input id="ec-name" class="form-input" value="${esc(client.name)}" /></div>
        <div class="form-group" style="margin:0"><label class="form-label">Telefone</label><input id="ec-phone" class="form-input" value="${esc(client.phone||'')}" placeholder="(21) 99999-9999" /></div>
        <div class="form-group" style="margin:0;grid-column:1/-1"><label class="form-label">E-mail</label><input id="ec-email" type="email" class="form-input" value="${esc(client.email||'')}" /></div>
        <div class="form-group" style="margin:0"><label class="form-label">Data de nascimento *</label><input id="ec-birth" type="text" class="form-input" value="${client.birth_date ? new Date(client.birth_date+'T12:00:00').toLocaleDateString('pt-BR') : ''}" placeholder="DD/MM/AAAA" maxlength="10" inputmode="numeric" /></div>
        <div class="form-group" style="margin:0"><label class="form-label">CPF (opcional)</label><input id="ec-cpf" class="form-input" value="${esc(client.cpf||'')}" placeholder="000.000.000-00" maxlength="14" /></div>
      </div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('ec-name').value.trim();
      const birthRaw = document.getElementById('ec-birth').value.trim();
      if (!name) { notify.error('Nome obrigatório.'); return; }
      if (!birthRaw) { notify.error('Data de nascimento obrigatória.'); return; }

      // Converte DD/MM/AAAA → YYYY-MM-DD
      let birth_date = birthRaw;
      if (birthRaw.includes('/')) {
        const [d, m, y] = birthRaw.split('/');
        birth_date = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) { notify.error('Data inválida. Use DD/MM/AAAA.'); return; }

      try {
        await apiFetch(`/clients/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            phone: document.getElementById('ec-phone').value.trim() || null,
            email: document.getElementById('ec-email').value.trim() || null,
            birth_date,
            cpf: document.getElementById('ec-cpf').value.trim() || null,
          }),
        });
        notify.success('Cliente atualizado!');
        loadClients();
      } catch { notify.error('Erro ao atualizar cliente.'); }
    },
  });

  // Máscara DD/MM/AAAA no campo de data
  setTimeout(() => {
    const input = document.getElementById('ec-birth');
    if (!input) return;
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g,'').slice(0,8);
      if (v.length >= 5) v = v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
      else if (v.length >= 3) v = v.slice(0,2)+'/'+v.slice(2);
      input.value = v;
    });
  }, 50);
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
