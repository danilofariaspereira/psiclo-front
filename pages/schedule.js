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
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
  document.getElementById('btn-config').addEventListener('click', openConfigModal);

  // Botão bloquear dia — aparece quando uma data está selecionada
  document.getElementById('btn-block-day').addEventListener('click', async () => {
    const btn = document.getElementById('btn-block-day');
    const date = btn.dataset.date;
    if (!date) return;
    const isBlocked = btn.dataset.blocked === 'true';
    const action = isBlocked ? 'desbloquear' : 'bloquear';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} o dia ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}?`)) return;
    try {
      await apiFetch('/schedule/block', {
        method: isBlocked ? 'DELETE' : 'POST',
        body: JSON.stringify({ date, reason: 'Folga' }),
      });
      notify(`Dia ${action}ado com sucesso!`, 'success');
      loadDay(new Date(date + 'T12:00:00'));
    } catch { notify(`Erro ao ${action} dia.`, 'error'); }
  });
}

async function openConfigModal() {
  let config = { work_days: [1,2,3,4,5], start_time: '08:00', end_time: '18:00', session_duration: 50, break_between: 10 };
  try { config = await apiFetch('/schedule/config') || config; } catch {}

  const days = [
    { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 }, { label: 'Sáb', value: 6 },
  ];

  Modal.open({
    title: 'Configurar horários de atendimento',
    confirmLabel: 'Salvar',
    content: `
      <div class="form-group">
        <label class="form-label">Dias de atendimento</label>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.25rem;">
          ${days.map(d => `
            <label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.9rem;">
              <input type="checkbox" value="${d.value}" ${config.work_days?.includes(d.value) ? 'checked' : ''} class="day-check" />
              ${d.label}
            </label>
          `).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
        <div class="form-group"><label class="form-label">Início</label><input type="time" id="cfg-start" class="form-input" value="${config.start_time || '08:00'}" /></div>
        <div class="form-group"><label class="form-label">Fim</label><input type="time" id="cfg-end" class="form-input" value="${config.end_time || '18:00'}" /></div>
        <div class="form-group"><label class="form-label">Duração da sessão (min)</label><input type="number" id="cfg-duration" class="form-input" value="${config.session_duration || 50}" min="15" max="120" /></div>
        <div class="form-group"><label class="form-label">Intervalo entre sessões (min)</label><input type="number" id="cfg-break" class="form-input" value="${config.break_between || 10}" min="0" max="60" /></div>
      </div>
    `,
    onConfirm: async () => {
      const work_days = [...document.querySelectorAll('.day-check:checked')].map(c => parseInt(c.value));
      if (!work_days.length) { notify('Selecione ao menos um dia.', 'error'); return; }
      try {
        scheduleConfig = await apiFetch('/schedule/config', {
          method: 'PUT',
          body: JSON.stringify({
            work_days,
            start_time: document.getElementById('cfg-start').value,
            end_time: document.getElementById('cfg-end').value,
            session_duration: parseInt(document.getElementById('cfg-duration').value),
            break_between: parseInt(document.getElementById('cfg-break').value),
          }),
        });
        notify('Horários salvos!', 'success');
      } catch { notify('Erro ao salvar.', 'error'); }
    },
  });
}

async function loadDay(date) {
  const dateStr = dateUtils.toInputDate(date.toISOString());
  document.getElementById('slots-title').textContent =
    `Horários — ${date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`;

  // Mostra botão de bloquear dia
  const blockBtn = document.getElementById('btn-block-day');
  blockBtn.style.display = 'inline-flex';
  blockBtn.dataset.date = dateStr;

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

const STATUS_PT = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

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
      <td><span class="badge badge--${a.status}">${STATUS_PT[a.status] || a.status}</span></td>
      <td>
        <select class="form-select" style="padding:4px 8px;font-size:.8rem" onchange="updateApptStatus('${a.id}', this.value)">
          ${Object.entries(STATUS_PT).map(([val, label]) =>
            `<option value="${val}" ${a.status === val ? 'selected' : ''}>${label}</option>`
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
