const API = 'https://psiclo-back.vercel.app/api/admin';
const $ = (id) => document.getElementById(id);

// Todas as chamadas usam credentials: 'include' — cookie httpOnly, sem token exposto
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// ── Tema ─────────────────────────────────────────────────────
function getThemeCookie() {
  return document.cookie.split('; ').find(r => r.startsWith('ui-theme='))?.split('=')[1] || 'light';
}
function setThemeCookie(theme) {
  document.cookie = `ui-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

const savedTheme = getThemeCookie();
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
updateThemeBtn(savedTheme);

$('saThemeToggle').addEventListener('click', () => toggleTheme());

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  setThemeCookie(next);
  updateThemeBtn(next);
  updateThemeBtnPanel(next);
}

function updateThemeBtn(theme) {
  const sun = $('iconSun'), moon = $('iconMoon');
  if (sun) sun.style.display = theme === 'dark' ? 'block' : 'none';
  if (moon) moon.style.display = theme === 'dark' ? 'none' : 'block';
}

function updateThemeBtnPanel(theme) {
  const sun = $('iconSunPanel'), moon = $('iconMoonPanel');
  if (sun) sun.style.display = theme === 'dark' ? 'block' : 'none';
  if (moon) moon.style.display = theme === 'dark' ? 'none' : 'block';
}

// ── Toggle olhinho ────────────────────────────────────────────
window.togglePass = (inputId, btn) => {
  const input = $(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.querySelector('.eye-open').style.display = isPass ? 'none' : 'block';
  btn.querySelector('.eye-closed').style.display = isPass ? 'block' : 'none';
};

// Função de escape para prevenir XSS em templates HTML
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ── Login ─────────────────────────────────────────────────────
$('saLoginBtn').addEventListener('click', doLogin);
$('saPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const email = $('saEmail').value.trim();
  const password = $('saPassword').value;
  const err = $('saLoginError');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Preencha e-mail e senha.'; return; }

  $('saLoginBtn').disabled = true;
  $('saLoginBtn').textContent = 'Entrando...';

  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  $('saLoginBtn').disabled = false;
  $('saLoginBtn').textContent = 'Entrar';

  if (!res.ok) { err.textContent = data.error || 'Erro ao fazer login.'; return; }

  if (data.first_access) {
    // Guarda email só em memória para o fluxo de primeiro acesso
    $('saLoginScreen').style.display = 'none';
    $('saFirstAccessModal').style.display = 'flex';
    $('saFirstAccessModal').dataset.email = data.email;
  } else {
    openPanel(data.name, data.avatar_url);
  }
}

// ── Primeiro acesso ───────────────────────────────────────────
$('saSavePassBtn').addEventListener('click', async () => {
  const newPass = $('saNewPass').value;
  const confirm = $('saConfirmPass').value;
  const err = $('saFirstAccessError');
  const email = $('saFirstAccessModal').dataset.email;

  if (newPass.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
  if (newPass !== confirm) { err.textContent = 'As senhas não coincidem.'; return; }

  $('saSavePassBtn').disabled = true;
  $('saSavePassBtn').textContent = 'Salvando...';

  const res = await fetch(`${API}/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, new_password: newPass }),
  });
  const data = await res.json();
  $('saSavePassBtn').disabled = false;
  $('saSavePassBtn').textContent = 'Salvar senha';

  if (!res.ok) { err.textContent = data.error; return; }

  $('saFirstAccessModal').innerHTML = `
    <div class="sa-modal">
      <h3 class="sa-modal__title">Senha salva!</h3>
      <p class="sa-modal__sub">Faça login com sua nova senha.</p>
      <button class="sa-btn-primary sa-btn-full" onclick="location.reload()">Fazer login</button>
    </div>`;
});

// ── Painel ────────────────────────────────────────────────────
function openPanel(name, avatarUrl = null) {
  $('saLoginScreen').style.display = 'none';
  $('saFirstAccessModal').style.display = 'none';
  $('saPanel').style.display = 'flex';
  $('pageOverview').style.display = 'flex';
  $('saUserName').textContent = name;

  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  $('saAvatarSidebar').textContent = initials;

  // Avatar vem do banco — sem localStorage
  if (avatarUrl) $('saAvatarSidebar').innerHTML = `<img src="${avatarUrl}" alt="avatar" />`;

  // Upload de avatar vai para o Supabase Storage via backend
  $('saAvatarSidebar').addEventListener('click', () => $('saAvatarInput').click());
  $('saAvatarInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch('https://psiclo-back.vercel.app/api/admin/auth/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      $('saAvatarSidebar').innerHTML = `<img src="${json.avatar_url}" alt="avatar" />`;
    } catch (err) {
      alert('Erro ao salvar foto: ' + err.message);
    }
  });

  $('saThemeTogglePanel').addEventListener('click', toggleTheme);
  updateThemeBtnPanel(getThemeCookie());

  loadOverview();
}

$('saLogoutBtn').addEventListener('click', async () => {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
  location.reload();
});

// ── Alterar senha do superadmin logado ────────────────────────
$('saChangePassBtn').addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;';
  overlay.innerHTML = `
    <div class="sa-modal" style="max-width:360px;">
      <h3 class="sa-modal__title">Alterar senha</h3>
      <p class="sa-modal__sub">Mínimo 6 caracteres.</p>
      <div class="sa-field">
        <label>Nova senha</label>
        <div class="sa-password-wrap">
          <input type="password" id="saNewPassChange" placeholder="••••••••" />
          <button type="button" class="sa-eye-btn" onclick="togglePass('saNewPassChange',this)" tabindex="-1">
            <svg class="eye-open" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="eye-closed" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>
      <div class="sa-field">
        <label>Confirmar senha</label>
        <div class="sa-password-wrap">
          <input type="password" id="saConfirmPassChange" placeholder="••••••••" />
          <button type="button" class="sa-eye-btn" onclick="togglePass('saConfirmPassChange',this)" tabindex="-1">
            <svg class="eye-open" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="eye-closed" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>
      <p class="sa-error" id="saChangePassError"></p>
      <div style="display:flex;gap:.5rem;margin-top:.5rem;">
        <button class="sa-btn-primary" style="flex:1;justify-content:center;background:rgba(255,255,255,0.15);color:#fff;" id="saChangePassCancel">Cancelar</button>
        <button class="sa-btn-primary" style="flex:1;justify-content:center;" id="saChangePassSave">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('saChangePassCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('saChangePassSave').addEventListener('click', async () => {
    const newPass = document.getElementById('saNewPassChange').value;
    const confirm = document.getElementById('saConfirmPassChange').value;
    const errEl = document.getElementById('saChangePassError');
    const btn = document.getElementById('saChangePassSave');

    if (newPass.length < 6) { errEl.textContent = 'Mínimo 6 caracteres.'; return; }
    if (newPass !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    btn.disabled = true; btn.textContent = 'Salvando...';
    // Usa o endpoint que lê o cookie para identificar o superadmin
    const { ok, data } = await api('/auth/change-password-me', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPass }),
    });
    btn.disabled = false; btn.textContent = 'Salvar';
    if (!ok) { errEl.textContent = data.error; return; }
    overlay.remove();
    alert('Senha alterada com sucesso!');
  });
});

// ── Navegação ─────────────────────────────────────────────────
const pages = { overview: 'pageOverview', professionals: 'pageProfessionals', superadmins: 'pageSuperadmins', financial: 'pageFinancial', audit: 'pageAudit' };

document.querySelectorAll('.sa-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sa-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    Object.values(pages).forEach(p => { $(p).style.display = 'none'; });
    $(pages[page]).style.display = 'flex';
    if (page === 'professionals') loadProfessionals();
    if (page === 'superadmins') loadSuperadmins();
    if (page === 'overview') loadOverview();
    if (page === 'financial') loadFinancial();
    if (page === 'audit') loadAuditLogs();
  });
});

// ── Visão geral ───────────────────────────────────────────────
let chartGrowth = null, chartStatus = null;

async function loadOverview() {
  const { ok, data } = await api('/professionals');
  if (!ok) return;

  const total = data.length;
  const active = data.filter(p => p.active).length;
  const inactive = total - active;
  const pro = data.filter(p => p.plan === 'pro' || p.plan === 'enterprise').length;

  $('metricTotal').textContent = total;
  $('metricActive').textContent = active;
  $('metricInactive').textContent = inactive;
  $('metricRevenue').textContent = (pro * 69.90).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const byMonth = {};
  data.forEach(p => {
    const m = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    byMonth[m] = (byMonth[m] || 0) + 1;
  });

  if (chartGrowth) chartGrowth.destroy();
  chartGrowth = new Chart($('chartGrowth'), {
    type: 'bar',
    data: { labels: Object.keys(byMonth), datasets: [{ label: 'Profissionais', data: Object.values(byMonth), backgroundColor: 'rgba(2,136,209,0.7)', borderColor: '#0288d1', borderWidth: 1, borderRadius: 5, hoverBackgroundColor: '#29b6f6' }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'transparent' } }, y: { ticks: { color: 'rgba(255,255,255,0.45)', stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'transparent' } } } }
  });

  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart($('chartStatus'), {
    type: 'doughnut',
    data: { labels: ['Ativos', 'Inativos'], datasets: [{ data: [active, inactive || 0.001], backgroundColor: ['#0288d1', '#1a237e'], borderColor: ['#0277bd', '#151c6e'], borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: 'rgba(255,255,255,0.65)', font: { size: 11 }, boxWidth: 10, padding: 14 } } }, cutout: '70%' }
  });
}

// ── Profissionais ─────────────────────────────────────────────
let currentProfTab = 'active';

window.switchProfTab = (tab) => {
  currentProfTab = tab;
  $('tabActive').classList.toggle('active', tab === 'active');
  $('tabDeleted').classList.toggle('active', tab === 'deleted');
  tab === 'active' ? loadProfessionals() : loadDeletedProfessionals();
};

async function loadProfessionals() {
  const el = $('saProfList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/professionals');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="sa-empty">Nenhum profissional cadastrado.</p>'; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>CRP</th><th>CPF</th><th>Plano</th><th>Status</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${data.map(p => `<tr>
      <td>${esc(p.name)}</td><td>${esc(p.email)}</td><td>${esc(p.crp) || '—'}</td><td>${esc(p.cpf) || '—'}</td>
      <td><span class="sa-badge sa-badge--${esc(p.plan)}">${esc(p.plan)}</span></td>
      <td><span class="sa-badge ${p.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${p.active ? 'Ativo' : 'Inativo'}</span></td>
      <td style="text-align:center">
        <button class="sa-btn-sm" onclick="editProf('${esc(p.id)}','${esc(p.name)}','${esc(p.email)}')">Editar</button>
        <button class="sa-btn-sm" onclick="toggleProf('${esc(p.id)}',${p.active})">${p.active ? 'Desativar' : 'Ativar'}</button>
        <button class="sa-btn-sm sa-btn-warning" onclick="resetProfPass('${esc(p.id)}','${esc(p.name)}')">Resetar senha</button>
        <button class="sa-btn-sm sa-btn-danger" onclick="deleteProf('${esc(p.id)}','${esc(p.name)}')">Excluir</button>
      </td>
    </tr>`).join('')}</tbody></table>`;
}

async function loadDeletedProfessionals() {
  const el = $('saProfList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/professionals/deleted');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="sa-empty">Nenhum profissional excluído.</p>'; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>CRP</th><th>CPF</th><th>Plano</th><th>Excluído em</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${data.map(p => `<tr>
      <td>${esc(p.name)}</td><td>${esc(p.email)}</td><td>${esc(p.crp) || '—'}</td><td>${esc(p.cpf) || '—'}</td>
      <td><span class="sa-badge sa-badge--${esc(p.plan)}">${esc(p.plan)}</span></td>
      <td>${new Date(p.deleted_at).toLocaleDateString('pt-BR')}</td>
      <td style="text-align:center"><button class="sa-btn-sm sa-btn-success" onclick="restoreProf('${esc(p.id)}','${esc(p.name)}')">Restaurar</button></td>
    </tr>`).join('')}</tbody></table>`;
}

window.toggleProf = async (id, active) => {
  await api(`/professionals/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
  loadProfessionals();
};

window.resetProfPass = async (id, name) => {
  if (!confirm(`Resetar a senha de "${name}" para 123456?`)) return;
  const { ok, data } = await api(`/professionals/${id}/reset-password`, { method: 'POST' });
  if (!ok) { alert(data.error); return; }
  alert(`Senha de "${name}" resetada para 123456.`);
};

window.deleteProf = async (id, name) => {
  if (!confirm(`Excluir "${name}"?\n\nOs dados serão mantidos e podem ser restaurados depois.`)) return;
  const { ok, data } = await api(`/professionals/${id}`, { method: 'DELETE' });
  if (!ok) { alert(data.error); return; }
  loadProfessionals(); loadOverview();
};

window.restoreProf = async (id, name) => {
  if (!confirm(`Restaurar "${name}"?\n\nA senha será resetada para 123456.`)) return;
  const { ok, data } = await api(`/professionals/${id}/restore`, { method: 'POST' });
  if (!ok) { alert(data.error); return; }
  alert(`"${name}" restaurado. Senha: 123456.`);
  loadDeletedProfessionals(); loadOverview();
};

window.editProf = (id, name, email) => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';
  overlay.innerHTML = `
    <div class="sa-modal" style="max-width:400px;">
      <h3 class="sa-modal__title">Editar — ${name}</h3>
      <p class="sa-modal__sub">Deixe em branco o que não quiser alterar.</p>
      <div class="sa-field"><label>Novo e-mail</label><input type="email" id="editEmail" value="${email}" /></div>
      <div class="sa-field"><label>Nova senha</label>
        <div class="sa-password-wrap">
          <input type="password" id="editPass" placeholder="Deixe em branco para não alterar" />
          <button type="button" class="sa-eye-btn" onclick="togglePass('editPass',this)" tabindex="-1">
            <svg class="eye-open" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="eye-closed" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>
      <p class="sa-error" id="editError"></p>
      <div style="display:flex;gap:.5rem;margin-top:.5rem;">
        <button class="sa-btn-primary" style="flex:1;justify-content:center;background:rgba(255,255,255,0.15);" id="editCancel">Cancelar</button>
        <button class="sa-btn-primary" style="flex:1;justify-content:center;" id="editSave">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('editCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('editSave').addEventListener('click', async () => {
    const newEmail = document.getElementById('editEmail').value.trim();
    const newPass = document.getElementById('editPass').value;
    const errEl = document.getElementById('editError');
    const btn = document.getElementById('editSave');
    const body = {};
    if (newEmail && newEmail !== email) body.email = newEmail;
    if (newPass) { if (newPass.length < 6) { errEl.textContent = 'Senha mínima de 6 caracteres.'; return; } body.new_password = newPass; }
    if (!Object.keys(body).length) { errEl.textContent = 'Nenhuma alteração detectada.'; return; }
    btn.disabled = true; btn.textContent = 'Salvando...';
    const { ok, data } = await api(`/professionals/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    btn.disabled = false; btn.textContent = 'Salvar';
    if (!ok) { errEl.textContent = data.error; return; }
    overlay.remove(); loadProfessionals();
  });
};

// ── Novo profissional ─────────────────────────────────────────
$('saNewProfBtn').addEventListener('click', () => $('saNewProfModal').style.display = 'flex');
$('saCloseProfModal').addEventListener('click', () => $('saNewProfModal').style.display = 'none');

$('saCreateProfBtn').addEventListener('click', async () => {
  const btn = $('saCreateProfBtn'), err = $('profError');
  const name = $('profName').value.trim(), email = $('profEmail').value.trim();
  if (!name || !email) { err.textContent = 'Nome e e-mail obrigatórios.'; return; }
  btn.disabled = true; btn.textContent = 'Criando...'; err.textContent = '';
  const { ok, data } = await api('/professionals', {
    method: 'POST',
    body: JSON.stringify({ name, email, crp: $('profCrp').value.trim(), cpf: $('profCpf').value.trim(), phone: $('profPhone').value.trim(), plan: $('profPlan').value }),
  });
  btn.disabled = false; btn.textContent = 'Criar profissional';
  if (!ok) { err.textContent = data.error; return; }
  $('saNewProfModal').style.display = 'none';
  ['profName','profEmail','profCrp','profCpf','profPhone'].forEach(id => $(id).value = '');
  loadProfessionals(); loadOverview();
});

// ── Financeiro ────────────────────────────────────────────────
let chartRevenue = null;
const DEFAULT_PRICE = 69.90;

async function loadFinancial() {
  const { ok, data } = await api('/professionals');
  if (!ok) return;

  // Conta TODOS os ativos — plano único R$ 69,90
  const activeProfs = data.filter(p => p.active);
  const active = activeProfs.length;
  const monthly = activeProfs.reduce((s, p) => s + (p.monthly_price || DEFAULT_PRICE), 0);

  $('finActive').textContent = active;
  $('finRevenue').textContent = monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  $('finAnnual').textContent = (monthly * 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Gráfico — acumulado por mês de cadastro
  const byMonth = {};
  activeProfs.forEach(p => {
    const m = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    byMonth[m] = (byMonth[m] || 0) + (p.monthly_price || DEFAULT_PRICE);
  });

  if (chartRevenue) chartRevenue.destroy();
  chartRevenue = new Chart($('chartRevenue'), {
    type: 'line',
    data: {
      labels: Object.keys(byMonth).length ? Object.keys(byMonth) : ['Sem dados'],
      datasets: [{ label: 'Receita (R$)', data: Object.values(byMonth).length ? Object.values(byMonth) : [0], borderColor: '#0288d1', backgroundColor: 'rgba(2,136,209,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#29b6f6', pointBorderColor: '#0288d1', pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 }],
    },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'transparent' } }, y: { ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, callback: v => `R$ ${v.toFixed(0)}` }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'transparent' } } } },
  });

  // Tabela de clientes ativos
  const tableEl = $('finClientsList');
  if (!tableEl) return;
  if (!activeProfs.length) { tableEl.innerHTML = '<p class="sa-empty">Nenhum cliente ativo.</p>'; return; }
  tableEl.innerHTML = `<table class="sa-table" style="margin-top:1rem">
    <thead><tr><th>Nome</th><th>E-mail</th><th>Mensalidade</th><th>Desde</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${activeProfs.map(p => `<tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.email)}</td>
      <td>${(p.monthly_price || DEFAULT_PRICE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td>${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
      <td style="text-align:center">
        <button class="sa-btn-sm" onclick="editClientPrice('${esc(p.id)}','${esc(p.name)}',${p.monthly_price || DEFAULT_PRICE})">Editar preço</button>
        <button class="sa-btn-sm sa-btn-danger" onclick="deleteProf('${esc(p.id)}','${esc(p.name)}')">Excluir</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

window.editClientPrice = (id, name, currentPrice) => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem;';
  overlay.innerHTML = `
    <div class="sa-modal" style="max-width:340px;">
      <h3 class="sa-modal__title">Editar preço — ${esc(name)}</h3>
      <div class="sa-field">
        <label>Mensalidade (R$)</label>
        <input type="number" id="newPrice" value="${currentPrice}" min="0" step="0.01" />
      </div>
      <p class="sa-error" id="priceError"></p>
      <div style="display:flex;gap:.5rem;margin-top:.5rem;">
        <button class="sa-btn-primary" style="flex:1;justify-content:center;background:rgba(255,255,255,0.15);" id="priceCancel">Cancelar</button>
        <button class="sa-btn-primary" style="flex:1;justify-content:center;" id="priceSave">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('priceCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('priceSave').addEventListener('click', async () => {
    const val = parseFloat(document.getElementById('newPrice').value);
    if (!val || val <= 0) { document.getElementById('priceError').textContent = 'Valor inválido.'; return; }
    const { ok, data } = await api(`/professionals/${id}`, { method: 'PATCH', body: JSON.stringify({ monthly_price: val }) });
    if (!ok) { document.getElementById('priceError').textContent = data.error; return; }
    overlay.remove();
    loadFinancial();
  });
};

// ── Superadmins ───────────────────────────────────────────────
async function loadSuperadmins() {
  const el = $('saSaList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/superadmins');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }
  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Criado em</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${data.map(s => `<tr>
      <td>${esc(s.name)}</td><td>${esc(s.email)}</td>
      <td><span class="sa-badge ${s.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${s.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>${new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
      <td style="text-align:center"><button class="sa-btn-sm sa-btn-warning" onclick="resetSaPass('${esc(s.id)}','${esc(s.name)}')">Resetar senha</button></td>
    </tr>`).join('')}</tbody></table>`;
}

window.resetSaPass = async (id, name) => {
  if (!confirm(`Resetar a senha de "${name}" para 123456?`)) return;
  const { ok, data } = await api(`/superadmins/${id}/reset-password`, { method: 'POST' });
  if (!ok) { alert(data.error); return; }
  alert(`Senha de "${name}" resetada para 123456.`);
};

$('saNewSaBtn').addEventListener('click', () => $('saNewSaModal').style.display = 'flex');
$('saCloseSaModal').addEventListener('click', () => $('saNewSaModal').style.display = 'none');

$('saCreateSaBtn').addEventListener('click', async () => {
  const btn = $('saCreateSaBtn'), err = $('saNewError');
  const name = $('saNewName').value.trim(), email = $('saNewEmail').value.trim();
  if (!name || !email) { err.textContent = 'Nome e e-mail obrigatórios.'; return; }
  btn.disabled = true; btn.textContent = 'Criando...'; err.textContent = '';
  const { ok, data } = await api('/superadmins', { method: 'POST', body: JSON.stringify({ name, email }) });
  btn.disabled = false; btn.textContent = 'Criar superadmin';
  if (!ok) { err.textContent = data.error; return; }
  $('saNewSaModal').style.display = 'none';
  $('saNewName').value = ''; $('saNewEmail').value = '';
  loadSuperadmins();
});

// ── Auditoria LGPD ────────────────────────────────────────────
const ACTION_LABELS = {
  LOGIN: '🔐 Login',
  LOGOUT: '🚪 Logout',
  COMPLETE_APPOINTMENT: '✅ Sessão concluída',
  VIEW_CLIENTS: '👁 Visualizou clientes',
  DELETE_CLIENT: '🗑 Removeu cliente',
  DELETE_LEAD: '🗑 Removeu lead',
};

async function loadAuditLogs() {
  const el = $('saAuditList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const action = $('auditFilterAction')?.value.trim() || '';
  const qs = action ? `?action=${encodeURIComponent(action)}&limit=200` : '?limit=200';
  const { ok, data } = await api(`/audit-logs${qs}`);
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error || 'Erro ao carregar.'}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="sa-empty">Nenhum registro de auditoria encontrado.</p>'; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr>
      <th>Data/Hora</th>
      <th>Profissional</th>
      <th>Usuário</th>
      <th>Ação</th>
      <th>Recurso</th>
      <th>IP</th>
    </tr></thead>
    <tbody>${data.map(l => `<tr>
      <td style="white-space:nowrap;font-size:.78rem">${new Date(l.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
      <td>${esc(l.professionals?.name || '—')}</td>
      <td style="font-size:.78rem">${esc(l.actor_email || '—')}</td>
      <td><span style="font-size:.78rem">${ACTION_LABELS[l.action] || esc(l.action)}</span></td>
      <td style="font-size:.75rem;color:rgba(255,255,255,.55)">${esc(l.resource || '—')}${l.resource_id ? ` <span style="opacity:.4">#${esc(l.resource_id.slice(0,8))}</span>` : ''}</td>
      <td style="font-size:.75rem;color:rgba(255,255,255,.55)">${esc(l.ip_address || '—')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// Filtro de auditoria
document.addEventListener('click', (e) => {
  if (e.target?.id === 'auditFilterBtn') loadAuditLogs();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement?.id === 'auditFilterAction') loadAuditLogs();
});
