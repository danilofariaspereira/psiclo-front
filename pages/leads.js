import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { supabase } from '../services/supabase.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { dateUtils } from '../utils/date.js';

const API = 'http://localhost:3001/api';

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
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

  renderSidebar('leads');
  renderHeader('Leads');

  loadLeads();

  document.getElementById('filter-status').addEventListener('change', loadLeads);
}

async function loadLeads() {
  const tbody = document.getElementById('leads-body');
  const status = document.getElementById('filter-status').value;
  const qs = status ? `?status=${status}` : '';

  try {
    const leads = await apiFetch(`/leads${qs}`);

    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum lead encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = leads.map((l) => `
      <tr>
        <td>${l.name}</td>
        <td>${l.phone || '—'}</td>
        <td>${l.email || '—'}</td>
        <td>${l.source || '—'}</td>
        <td>
          <select class="form-select" style="padding:4px 8px;font-size:.8rem" data-id="${l.id}" onchange="updateStatus(this)">
            ${['new','contacted','converted','lost'].map((s) =>
              `<option value="${s}" ${l.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td>${dateUtils.format(l.created_at)}</td>
        <td style="display:flex;gap:.4rem">
          <button class="btn btn--primary btn--sm" onclick="convertLead('${l.id}','${l.name}','${l.phone || ''}','${l.email || ''}')">Converter</button>
          <button class="btn btn--danger btn--sm" onclick="deleteLead('${l.id}')">Excluir</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-error)">Erro ao carregar leads.</td></tr>`;
  }
}

window.updateStatus = async (select) => {
  try {
    await apiFetch(`/leads/${select.dataset.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: select.value }),
    });
    notify.success('Status atualizado.');
  } catch {
    notify.error('Erro ao atualizar status.');
  }
};

window.deleteLead = (id) => {
  Modal.open({
    title: 'Excluir lead',
    content: '<p>Tem certeza? Esta ação não pode ser desfeita (LGPD).</p>',
    confirmLabel: 'Excluir',
    onConfirm: async () => {
      try {
        await apiFetch(`/leads/${id}`, { method: 'DELETE' });
        notify.success('Lead excluído.');
        loadLeads();
      } catch {
        notify.error('Erro ao excluir.');
      }
    },
  });
};

window.convertLead = (id, name, phone, email) => {
  Modal.open({
    title: 'Converter em cliente',
    content: `<p>Converter <strong>${name}</strong> em cliente?</p>`,
    confirmLabel: 'Converter',
    onConfirm: async () => {
      try {
        await apiFetch('/clients', {
          method: 'POST',
          body: JSON.stringify({ lead_id: id, name, phone, email }),
        });
        notify.success(`${name} convertido em cliente.`);
        loadLeads();
      } catch {
        notify.error('Erro ao converter.');
      }
    },
  });
};

init();
