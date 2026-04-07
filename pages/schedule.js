import { Calendar } from '../components/Calendar.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { dateUtils } from '../utils/date.js';
import { store } from '../state/store.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';
let scheduleConfig = null;
let lastApptCount = 0;
let schedulePolling = null;

async function apiFetch(path, options = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API}${path}${options.method && options.method !== 'GET' ? '' : `${sep}_=${Date.now()}`}`;
  const res = await fetch(url, { ...options, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function todayBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
}

export async function mount(container) {
  scheduleConfig = null; lastApptCount = 0;

  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Agenda</h1>
  <div style="display:flex;gap:.5rem;">
    <button class="btn btn--ghost" id="btn-block-day" style="display:none;">Bloquear dia</button>
    <button class="btn btn--ghost" id="btn-config">Configurar horários</button>
    <button class="btn btn--primary" id="btn-new-appt">+ Novo agendamento</button>
  </div>
</div>
<div class="schedule-layout">
  <div class="card"><div id="calendar-container"></div></div>
  <div class="card"><p class="card__title" id="slots-title">Selecione uma data</p><div id="slots-container" class="slots-grid"></div></div>
</div>
<div id="appts-section" style="margin-top:1.5rem;display:none">
  <div class="card"><p class="card__title" id="appts-day-title">Agendamentos do dia</p><div id="appt-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;margin-top:1rem"></div></div>
</div>`;

  try {
    scheduleConfig = store.cache.get('schedule_config');
    if (!scheduleConfig) {
      scheduleConfig = await apiFetch('/schedule/config');
      if (scheduleConfig) store.cache.set('schedule_config', scheduleConfig);
    }
  } catch { scheduleConfig = null; }

  const unavailableDays = scheduleConfig ? [0,1,2,3,4,5,6].filter(d => !scheduleConfig.work_days.includes(d)) : [];
  const cal = new Calendar(document.getElementById('calendar-container'), { unavailableDays, onDateSelect: (date) => loadDay(date) });
  cal.render();

  document.getElementById('btn-new-appt').addEventListener('click', openNewApptModal);
  document.getElementById('btn-config').addEventListener('click', openConfigModal);

  try {
    const initial = await apiFetch(`/schedule/appointments?date=${todayBR()}`).catch(() => []);
    lastApptCount = initial?.length ?? 0;
  } catch (_) {}

  schedulePolling = setInterval(async () => {
    try {
      const today = todayBR();
      const appts = await apiFetch(`/schedule/appointments?date=${today}`);
      const count = appts?.length ?? 0;
      if (count > lastApptCount) {
        const blockBtn = document.getElementById('btn-block-day');
        if (blockBtn && blockBtn.dataset.date === today) loadDay(new Date(today + 'T12:00:00'));
      }
      lastApptCount = count;
    } catch (_) {}
  }, 30000);

  document.getElementById('btn-block-day').addEventListener('click', async () => {
    const btn = document.getElementById('btn-block-day');
    const date = btn.dataset.date;
    if (!date) return;
    const isBlocked = btn.dataset.blocked === 'true';
    const action = isBlocked ? 'desbloquear' : 'bloquear';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} o dia ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}?`)) return;
    try {
      await apiFetch('/schedule/block', { method: isBlocked ? 'DELETE' : 'POST', body: JSON.stringify({ date, reason: 'Folga' }) });
      notify.success(`Dia ${action}ado com sucesso!`);
      loadDay(new Date(date + 'T12:00:00'));
    } catch { notify.error(`Erro ao ${action} dia.`); }
  });
}

export function unmount() {
  if (schedulePolling) { clearInterval(schedulePolling); schedulePolling = null; }
}

async function openConfigModal() {
  let config = { work_days: [1,2,3,4,5], start_time: '08:00', end_time: '18:00', session_duration: 50, break_between: 10 };
  try { config = await apiFetch('/schedule/config') || config; } catch {}
  const days = [{ label:'Dom',value:0 },{ label:'Seg',value:1 },{ label:'Ter',value:2 },{ label:'Qua',value:3 },{ label:'Qui',value:4 },{ label:'Sex',value:5 },{ label:'Sáb',value:6 }];
  Modal.open({
    title: 'Configurar horários de atendimento', confirmLabel: 'Salvar',
    content: `
      <div class="form-group"><label class="form-label">Dias de atendimento</label>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.25rem;">
          ${days.map(d => `<label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.9rem;"><input type="checkbox" value="${d.value}" ${config.work_days?.includes(d.value) ? 'checked' : ''} class="day-check" />${d.label}</label>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
        <div class="form-group"><label class="form-label">Início</label><input type="time" id="cfg-start" class="form-input" value="${config.start_time || '08:00'}" /></div>
        <div class="form-group"><label class="form-label">Fim</label><input type="time" id="cfg-end" class="form-input" value="${config.end_time || '18:00'}" /></div>
        <div class="form-group"><label class="form-label">Duração da sessão (min)</label><input type="number" id="cfg-duration" class="form-input" value="${config.session_duration || 50}" min="15" max="120" /></div>
        <div class="form-group"><label class="form-label">Intervalo entre sessões (min)</label><input type="number" id="cfg-break" class="form-input" value="${config.break_between || 10}" min="0" max="60" /></div>
      </div>`,
    onConfirm: async () => {
      const work_days = [...document.querySelectorAll('.day-check:checked')].map(c => parseInt(c.value));
      if (!work_days.length) { notify.error('Selecione ao menos um dia.'); return; }
      try {
        scheduleConfig = await apiFetch('/schedule/config', { method: 'PUT', body: JSON.stringify({ work_days, start_time: document.getElementById('cfg-start').value, end_time: document.getElementById('cfg-end').value, session_duration: parseInt(document.getElementById('cfg-duration').value), break_between: parseInt(document.getElementById('cfg-break').value) }) });
        store.cache.del('schedule_config');
        notify.success('Horários salvos!');
      } catch { notify.error('Erro ao salvar.'); }
    },
  });
}

async function loadDay(date) {
  const dateStr = dateUtils.toInputDate(date.toISOString());
  document.getElementById('slots-title').textContent = `Horários — ${date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`;
  const blockBtn = document.getElementById('btn-block-day');
  blockBtn.style.display = 'inline-flex';
  blockBtn.dataset.date = dateStr;
  const [slotsData, appts] = await Promise.all([
    apiFetch(`/schedule/slots?date=${dateStr}`).catch(() => ({ slots: [] })),
    apiFetch(`/schedule/appointments?date=${dateStr}`).catch(() => []),
  ]);

  // Verifica se o dia está bloqueado
  const isBlocked = slotsData.available === false && slotsData.reason === 'blocked_day';
  blockBtn.dataset.blocked = isBlocked ? 'true' : 'false';
  blockBtn.textContent = isBlocked ? 'Desbloquear dia' : 'Bloquear dia';

  if (isBlocked) {
    document.getElementById('slots-container').innerHTML = `<p style="color:var(--color-error);font-size:.9rem;font-weight:600">Dia bloqueado — nenhum horario disponivel.</p>`;
  } else {
    renderSlots(slotsData.slots || []);
  }
  renderAppts(appts, dateStr);
}

function renderSlots(slots) {
  const container = document.getElementById('slots-container');
  if (!slots.length) { container.innerHTML = `<p style="color:var(--color-text-muted);font-size:.9rem">Nenhum horário configurado.</p>`; return; }
  container.innerHTML = slots.map(s => `<button class="slot ${s.available ? 'slot--free' : 'slot--busy'}" ${!s.available ? 'disabled' : ''} data-time="${s.time}">${dateUtils.formatTime(s.time)}</button>`).join('');
}

const STATUS_PT = { scheduled:'Agendado', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado', no_show:'Não compareceu' };
const STATUS_COLOR = { scheduled:'#0288d1', confirmed:'#7c3aed', completed:'#16a34a', cancelled:'#dc2626', no_show:'#9ca3af' };

function renderAppts(appts, dateStr) {
  const section = document.getElementById('appts-section');
  const container = document.getElementById('appt-cards');
  section.style.display = 'block';
  document.getElementById('appts-day-title').textContent = `Agendamentos — ${new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`;
  if (!appts.length) { container.innerHTML = `<p style="color:var(--color-text-muted);font-size:.9rem;grid-column:1/-1">Nenhum agendamento neste dia.</p>`; return; }
  container.innerHTML = appts.map(a => `
    <div class="appt-card appt-card--${a.status}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="appt-card__time">${dateUtils.formatTime(a.scheduled_at)}</span>
        <span class="appt-card__status" style="background:${STATUS_COLOR[a.status]}22;color:${STATUS_COLOR[a.status]}">${STATUS_PT[a.status] || esc(a.status)}</span>
      </div>
      <div class="appt-card__client">${esc(a.clients?.name) || '—'}</div>
      <div class="appt-card__modality">${a.modality === 'online' ? '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Online' : '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Presencial'}</div>
      ${a.notes ? `<button class="btn btn--ghost btn--sm" style="font-size:.72rem;padding:3px 8px;margin-top:2px" onclick="viewApptNotes('${esc(a.id)}','${esc(a.clients?.name ?? '')}','${esc(a.notes)}')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Ver observação</button>` : `<span style="font-size:.72rem;color:var(--color-text-muted);font-style:italic">Sem observação.</span>`}
      <div class="appt-card__actions">
        ${a.status !== 'completed' && a.status !== 'cancelled' ? `<button class="btn btn--primary btn--sm" onclick="openCompleteModal('${esc(a.id)}','${esc(a.clients?.name ?? '')}')">Concluir</button><button class="btn btn--ghost btn--sm" onclick="cancelAppt('${esc(a.id)}')">Cancelar</button>` : a.status === 'completed' ? `<button class="btn btn--ghost btn--sm" onclick="openEditCompletedModal('${esc(a.id)}','${esc(a.clients?.name ?? '')}')"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>` : ''}
        <button class="btn btn--danger btn--sm" onclick="deleteAppt('${esc(a.id)}')">Excluir</button>
      </div>
    </div>`).join('');
}

async function openNewApptModal() {
  let clients = [];
  try { clients = await apiFetch('/clients/active') || []; } catch {}

  // Remove duplicatas por nome (mantém o mais recente)
  const seen = new Set();
  const uniqueClients = clients.filter(c => {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  Modal.open({
    title: 'Novo agendamento', confirmLabel: 'Agendar',
    content: `
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <div style="position:relative">
          <input type="text" id="appt-client-search" class="form-input" placeholder="Digite o nome do cliente..." autocomplete="off" />
          <input type="hidden" id="appt-client" />
          <div id="appt-client-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:100;max-height:200px;overflow-y:auto;margin-top:2px"></div>
        </div>
      </div>
      <div class="form-group" id="appt-client-info" style="display:none;background:#f8fafc;border-radius:8px;padding:.75rem;border:1px solid #e2e8f0;font-size:.85rem;color:#475569">
        <div id="appt-client-details"></div>
      </div>
      <div class="form-group"><label class="form-label">Data e horário</label><input type="datetime-local" id="appt-datetime" class="form-input" /></div>
      <div class="form-group"><label class="form-label">Modalidade</label><select id="appt-modality" class="form-select"><option value="online">Online</option><option value="presencial">Presencial</option></select></div>`,
    onConfirm: async () => {
      const clientId = document.getElementById('appt-client').value;
      const dt = document.getElementById('appt-datetime').value;
      const modality = document.getElementById('appt-modality').value;
      if (!clientId || !dt) { notify.warning('Selecione um cliente e preencha a data.'); return; }
      try {
        await apiFetch('/schedule/appointments', { method: 'POST', body: JSON.stringify({ client_id: clientId, scheduled_at: new Date(dt).toISOString(), modality, duration: scheduleConfig?.session_duration || 50 }) });
        notify.success('Agendamento criado.');
      } catch (e) { notify.error(e.message.includes('409') ? 'Horário já ocupado.' : 'Erro ao agendar.'); }
    },
  });

  // Autocomplete
  const searchInput = document.getElementById('appt-client-search');
  const hiddenInput = document.getElementById('appt-client');
  const dropdown    = document.getElementById('appt-client-dropdown');
  const infoBox     = document.getElementById('appt-client-info');
  const infoDetails = document.getElementById('appt-client-details');

  function showDropdown(filtered) {
    if (!filtered.length) { dropdown.style.display = 'none'; return; }
    dropdown.style.display = 'block';
    dropdown.innerHTML = filtered.map(c => `
      <div data-id="${esc(c.id)}" data-name="${esc(c.name)}" data-phone="${esc(c.phone||'')}" data-email="${esc(c.email||'')}" data-birth="${esc(c.birth_date||'')}"
        style="padding:.6rem 1rem;cursor:pointer;font-size:.88rem;color:#1e293b;border-bottom:1px solid #f1f5f9"
        onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
        ${esc(c.name)}${c.phone ? `<span style="color:#94a3b8;font-size:.78rem;margin-left:.5rem">${esc(c.phone)}</span>` : ''}
      </div>`).join('');

    dropdown.querySelectorAll('[data-id]').forEach(item => {
      item.addEventListener('click', () => {
        hiddenInput.value = item.dataset.id;
        searchInput.value = item.dataset.name;
        dropdown.style.display = 'none';
        // Mostra dados do cliente
        const parts = [];
        if (item.dataset.phone) parts.push(`Telefone: ${item.dataset.phone}`);
        if (item.dataset.email) parts.push(`E-mail: ${item.dataset.email}`);
        if (item.dataset.birth) parts.push(`Nascimento: ${new Date(item.dataset.birth + 'T12:00:00').toLocaleDateString('pt-BR')}`);
        if (parts.length) {
          infoDetails.innerHTML = parts.join(' &nbsp;·&nbsp; ');
          infoBox.style.display = 'block';
        }
      });
    });
  }

  searchInput.addEventListener('input', () => {
    hiddenInput.value = '';
    infoBox.style.display = 'none';
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    showDropdown(uniqueClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8));
  });

  searchInput.addEventListener('focus', () => {
    if (!hiddenInput.value && searchInput.value.trim()) {
      const q = searchInput.value.trim().toLowerCase();
      showDropdown(uniqueClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8));
    }
  });

  document.addEventListener('click', function closeDD(e) {
    if (!e.target.closest('#appt-client-search') && !e.target.closest('#appt-client-dropdown')) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', closeDD);
    }
  });
}

window.viewApptNotes = (id, clientName, notes) => {
  Modal.open({ title: `Observação — ${clientName}`, content: `<p style="white-space:pre-wrap;line-height:1.6">${esc(notes)}</p>`, hideFooter: true });
};

window.openEditCompletedModal = async (id, clientName) => {
  let currentAmount = '', currentNotes = '', paymentId = null;
  try {
    const payments = await apiFetch('/financial/payments?status=paid');
    const linked = (payments || []).find(p => p.appointment_id === id);
    if (linked) { paymentId = linked.id; currentAmount = linked.amount; currentNotes = (linked.notes || '').replace(/^\[[^\]]+\]\s*/, ''); }
  } catch (_) {}
  Modal.open({
    title: `Editar sessão — ${clientName}`, confirmLabel: 'Salvar alterações',
    content: `<div class="form-group"><label class="form-label">Valor da sessão (R$)</label><input type="number" id="edit-amount" class="form-input" value="${currentAmount}" min="0" step="0.01" /></div><div class="form-group"><label class="form-label">Observações da sessão</label><textarea id="edit-notes" class="form-input form-textarea" placeholder="Anotações sobre a sessão...">${esc(currentNotes)}</textarea></div>`,
    onConfirm: async () => {
      const amount = document.getElementById('edit-amount').value;
      const notes = document.getElementById('edit-notes').value.trim();
      try {
        await apiFetch(`/schedule/appointments/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes: notes || null }) });
        if (paymentId && amount) await apiFetch(`/financial/payments/${paymentId}`, { method: 'PATCH', body: JSON.stringify({ amount: Number(amount) }) });
        notify.success('Sessão atualizada!');
        const blockBtn = document.getElementById('btn-block-day');
        if (blockBtn?.dataset.date) loadDay(new Date(blockBtn.dataset.date + 'T12:00:00'));
      } catch { notify.error('Erro ao atualizar sessão.'); }
    },
  });
};

window.cancelAppt = async (id) => {
  if (!confirm('Cancelar este agendamento?')) return;
  try {
    await apiFetch(`/schedule/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    notify.success('Agendamento cancelado.');
    const blockBtn = document.getElementById('btn-block-day');
    if (blockBtn?.dataset.date) loadDay(new Date(blockBtn.dataset.date + 'T12:00:00'));
  } catch { notify.error('Erro ao cancelar.'); }
};

window.deleteAppt = async (id) => {
  if (!confirm('Excluir este agendamento permanentemente? Esta ação não pode ser desfeita.')) return;
  try {
    await apiFetch(`/schedule/appointments/${id}`, { method: 'DELETE' });
    notify.success('Agendamento excluído.');
    const blockBtn = document.getElementById('btn-block-day');
    if (blockBtn?.dataset.date) loadDay(new Date(blockBtn.dataset.date + 'T12:00:00'));
  } catch { notify.error('Erro ao excluir.'); }
};

window.openCompleteModal = (id, clientName) => {
  Modal.open({
    title: `Concluir — ${clientName}`, confirmLabel: 'Concluir e salvar',
    content: `
      <div class="form-group"><label class="form-label">Forma de pagamento</label><select id="complete-payment-method" class="form-select"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="plano_saude">Plano de saúde</option></select></div>
      <div class="form-group"><label class="form-label">Valor da sessão (R$)</label><input type="number" id="complete-amount" class="form-input" placeholder="Ex: 150.00" min="0" step="0.01" /></div>
      <div class="form-group"><label class="form-label">Observações da sessão (opcional)</label><textarea id="complete-notes" class="form-input form-textarea" placeholder="Anotações sobre a sessão..."></textarea></div>`,
    onConfirm: async () => {
      const amount = document.getElementById('complete-amount').value;
      const notes = document.getElementById('complete-notes').value.trim();
      const payment_method = document.getElementById('complete-payment-method').value;
      try {
        await apiFetch(`/schedule/appointments/${id}/complete`, { method: 'POST', body: JSON.stringify({ amount: amount ? Number(amount) : null, notes: notes || null, payment_method }) });
        notify.success('Sessão concluída! Pagamento criado no financeiro.');
        const blockBtn = document.getElementById('btn-block-day');
        if (blockBtn?.dataset.date) loadDay(new Date(blockBtn.dataset.date + 'T12:00:00'));
      } catch { notify.error('Erro ao concluir sessão.'); }
    },
  });
};
