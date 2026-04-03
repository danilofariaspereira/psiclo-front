import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Calendar } from '../components/Calendar.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { dateUtils } from '../utils/date.js';

const API = 'https://psiclo-back.vercel.app/api';
let scheduleConfig = null;

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

  renderSidebar('schedule');
  renderHeader('Agenda');

  // Carrega config para saber dias de trabalho
  try {
    scheduleConfig = await apiFetch('/schedule/config');
  } catch { scheduleConfig = null; }

  const unavailableDays = scheduleConfig
    ? [0,1,2,3,4,5,6].filter((d) => !scheduleConfig.work_days.includes(d))
    : [];

  const cal = new Calendar(
    document.getElementById('calendar-container'),
    {
      unavailableDays,
      onDateSelect: (date) => loadDay(date),
    }
  );
  cal.render();

  document.getElementById('btn-new-appt').addEventListener('click', openNewApptModal);
}

async function loadDay(date) {
  const dateStr = dateUtils.toInputDate(date.toISOString());
  document.getElementById('slots-title').textContent =
    `Horários — ${date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`;

  // Carrega slots e agendamentos em paralelo
  const [slotsData, appts] = await Promise.all([
    apiFetch(`/schedule/slots?date=${dateStr}`).catch(() => ({ slots: [] })),
    apiFetch(`/schedule/appointments?date=${dateStr}`).catch(() => []),
  ]);

  renderSlots(slotsData.slots || []);
  renderAppts(appts);
}

function renderSlots(slots) {
  const container = document.getElementById('slots-container');
  if (!slots.length) {
    container.innerHTML = `<p style="color:var(--color-text-muted);font-size:.9rem">Nenhum horário configurado.</p>`;
    return;
  }
  container.innerHTML = slots.map((s) => `
    <button
      class="slot ${s.available ? 'slot--free' : 'slot--busy'}"
      ${!s.available ? 'disabled' : ''}
      data-time="${s.time}"
    >
      ${dateUtils.formatTime(s.time)}
    </button>
  `).join('');
}

function renderAppts(appts) {
  const tbody = document.getElementById('appt-body');
  if (!appts.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--color-text-muted)">Nenhum agendamento.</td></tr>`;
    return;
  }
  tbody.innerHTML = appts.map((a) => `
    <tr>
      <td>${dateUtils.formatTime(a.scheduled_at)}</td>
      <td>${a.clients?.name ?? '—'}</td>
      <td>${a.modality === 'online' ? '🌐 Online' : '🏢 Presencial'}</td>
      <td><span class="badge badge--${a.status}">${a.status}</span></td>
      <td>
        <select class="form-select" style="padding:4px 8px;font-size:.8rem" onchange="updateApptStatus('${a.id}', this.value)">
          ${['scheduled','confirmed','completed','cancelled','no_show'].map((s) =>
            `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

async function openNewApptModal() {
  // Busca clientes para o select
  const clients = await apiFetch('/clients/active');

  const content = `
    <div class="form-group">
      <label class="form-label">Cliente</label>
      <select id="appt-client" class="form-select">
        <option value="">Selecione...</option>
        ${(clients || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Data e horário</label>
      <input type="datetime-local" id="appt-datetime" class="form-input" />
    </div>
    <div class="form-group">
      <label class="form-label">Modalidade</label>
      <select id="appt-modality" class="form-select">
        <option value="online">Online</option>
        <option value="presencial">Presencial</option>
      </select>
    </div>
  `;

  Modal.open({
    title: 'Novo agendamento',
    content,
    confirmLabel: 'Agendar',
    onConfirm: async () => {
      const clientId = document.getElementById('appt-client').value;
      const dt = document.getElementById('appt-datetime').value;
      const modality = document.getElementById('appt-modality').value;

      if (!clientId || !dt) { notify.warning('Preencha todos os campos.'); return; }

      try {
        await apiFetch('/schedule/appointments', {
          method: 'POST',
          body: JSON.stringify({
            client_id: clientId,
            scheduled_at: new Date(dt).toISOString(),
            modality,
            duration: scheduleConfig?.session_duration || 50,
          }),
        });
        notify.success('Agendamento criado.');
      } catch (e) {
        notify.error(e.message.includes('409') ? 'Horário já ocupado.' : 'Erro ao agendar.');
      }
    },
  });
}

window.updateApptStatus = async (id, status) => {
  try {
    await apiFetch(`/schedule/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    notify.success('Status atualizado.');
  } catch {
    notify.error('Erro ao atualizar.');
  }
};

init();
