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

// ── Leads do site ─────────────────────────────────────────────
const LEADS_API = 'https://psiclo-back.vercel.app/api';
const LEADS_API_KEY = 'psiclo_lp_2024';

const WA_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.57a.75.75 0 0 0 .916.916l5.718-1.475A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.204-1.443l-.372-.22-3.394.875.893-3.302-.242-.384A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`;

const LEADS_WA_NUMBER = '5521993350228';

const LEADS_WA_MESSAGES = {
  'Comecar agora - Banner': (name) =>
    `Ola, ${name}.\n\nVi que voce clicou em Comecar agora no nosso site.\n\nO PSICLO e um sistema de gestao completo para psicologos: agenda online, financeiro automatico, gestao de leads e landing page propria, tudo em um so lugar.\n\nGostaria de entender melhor como funciona e verificar se faz sentido para a sua clinica?\n\nEstou a disposicao para conversar.`,
  'Quero experimentar - Menu': (name) =>
    `Ola, ${name}.\n\nRecebi seu contato pelo menu do site do PSICLO.\n\nSe tiver alguma duvida sobre o sistema ou quiser saber mais sobre as funcionalidades, estou aqui para ajudar.\n\nQual seria o melhor momento para conversarmos?`,
  'Comecar agora - Preco': (name) =>
    `Ola, ${name}.\n\nVi que voce se interessou pelo plano do PSICLO.\n\nO plano e unico, com tudo incluido por R$ 69,90 por mes: agenda, financeiro, leads, landing page e suporte.\n\nPosso te passar mais detalhes sobre o que esta incluido e como funciona o processo de ativacao?`,
  'Quero ter acesso - Mapas': (name) =>
    `Ola, ${name}.\n\nVi que voce se interessou pelos mapas de calor do PSICLO.\n\nEsse recurso mostra quais horarios e dias concentram mais atendimentos, e quais meses e formas de pagamento sao mais rentaveis para a sua clinica.\n\nGostaria de ver uma demonstracao de como isso funciona na pratica?`,
  'Quero conhecer o PSICLO': (name) =>
    `Ola, ${name}.\n\nRecebi seu contato pelo formulario do site do PSICLO.\n\nEstou aqui para responder suas duvidas e ajudar no que precisar.\n\nComo posso te ajudar?`,
};

function leadsWaMsg(source, name) {
  const fn = LEADS_WA_MESSAGES[source];
  if (fn) return fn(name);
  return `Ola, ${name}.\n\nRecebi seu contato pelo site do PSICLO.\n\nEstou a disposicao para conversar sobre o sistema e entender como podemos ajudar na organizacao da sua clinica.\n\nQual seria o melhor momento para conversarmos?`;
}

let leadsChartConv = null, leadsChartSrc = null;

async function loadLeads() {
  const status = $('leadsFilterStatus')?.value || '';
  const qs = status ? `?status=${status}` : '';

  // Busca via API Key (endpoint publico de criacao, mas listagem requer auth do superadmin)
  // Usa o endpoint admin que ja existe
  const { ok, data } = await api(`/psiclo-leads${qs}`);

  if (!ok) {
    $('saLeadsList').innerHTML = `<p class="sa-error">${data?.error || 'Erro ao carregar leads.'}</p>`;
    return;
  }

  const leads = data || [];

  // Metricas
  $('leadsTotal').textContent     = leads.length;
  $('leadsNew').textContent       = leads.filter(l => l.status === 'new').length;
  $('leadsContacted').textContent = leads.filter(l => l.status === 'contacted').length;
  $('leadsConverted').textContent = leads.filter(l => l.status === 'converted').length;

  // Graficos
  renderLeadsCharts(leads);

  // Tabela
  if (!leads.length) {
    $('saLeadsList').innerHTML = '<p class="sa-empty">Nenhum lead encontrado.</p>';
    return;
  }

  $('saLeadsList').innerHTML = `
    <div class="sa-charts" style="margin-bottom:1rem">
      <div class="sa-chart-card">
        <div class="sa-chart-title">Conversao de leads</div>
        <div class="sa-chart-sub">Proporcao entre pendentes e convertidos</div>
        <div style="position:relative;height:180px"><canvas id="leadsChartConv"></canvas></div>
      </div>
      <div class="sa-chart-card">
        <div class="sa-chart-title">Origem dos leads</div>
        <div class="sa-chart-sub">Qual botao gerou o contato</div>
        <div style="position:relative;height:180px"><canvas id="leadsChartSrc"></canvas></div>
      </div>
    </div>
    <table class="sa-table">
      <thead><tr>
        <th>Nome</th><th>WhatsApp</th><th>E-mail</th>
        <th>Origem</th><th>Data</th><th>Status</th><th style="text-align:center">Acoes</th>
      </tr></thead>
      <tbody>${leads.map(l => {
        const phone = esc(l.phone || '');
        const source = l.source || 'landing_page';
        const waMsg = encodeURIComponent(leadsWaMsg(source, esc(l.name || 'cliente')));
        const waHref = phone ? `https://wa.me/55${l.phone.replace(/\D/g,'')}?text=${waMsg}` : null;
        const statusColor = l.status === 'converted' ? 'green' : l.status === 'lost' ? 'red' : '';
        const statusLabel = { new: 'Novo', contacted: 'Contactado', converted: 'Convertido', lost: 'Perdido' }[l.status] || l.status;
        return `<tr>
          <td>${esc(l.name || '')}</td>
          <td>${phone || '—'}</td>
          <td style="font-size:.78rem">${esc(l.email || '') || '—'}</td>
          <td style="font-size:.78rem">${esc(source)}</td>
          <td style="font-size:.78rem;white-space:nowrap">${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
          <td><span class="sa-badge ${statusColor ? 'sa-badge--' + statusColor : ''}">${statusLabel}</span></td>
          <td style="text-align:center;display:flex;gap:.3rem;justify-content:center">
            ${waHref
              ? `<a href="${waHref}" target="_blank" rel="noopener" class="sa-btn-sm" style="display:inline-flex;align-items:center;gap:.3rem">${WA_SVG} WhatsApp</a>`
              : `<button class="sa-btn-sm" disabled style="opacity:.4">${WA_SVG} WhatsApp</button>`
            }
            <select class="sa-btn-sm" style="padding:3px 6px;font-size:.75rem" onchange="updateLeadStatus('${esc(l.id)}', this.value, this)">
              <option value="new"       ${l.status==='new'       ?'selected':''}>Novo</option>
              <option value="contacted" ${l.status==='contacted' ?'selected':''}>Contactado</option>
              <option value="converted" ${l.status==='converted' ?'selected':''}>Convertido</option>
              <option value="lost"      ${l.status==='lost'      ?'selected':''}>Perdido</option>
            </select>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;

  // Renderiza graficos apos inserir canvas no DOM
  renderLeadsCharts(leads);
}

function renderLeadsCharts(leads) {
  const conv    = leads.filter(l => l.status === 'converted').length;
  const pending = leads.filter(l => l.status === 'new' || l.status === 'contacted').length;
  const lost    = leads.filter(l => l.status === 'lost').length;

  const bySource = {};
  leads.forEach(l => { const s = l.source || 'Outros'; bySource[s] = (bySource[s] || 0) + 1; });

  const convCanvas = document.getElementById('leadsChartConv');
  const srcCanvas  = document.getElementById('leadsChartSrc');
  if (!convCanvas || !srcCanvas) return;

  if (leadsChartConv) leadsChartConv.destroy();
  leadsChartConv = new Chart(convCanvas, {
    type: 'doughnut',
    data: { labels: ['Convertidos','Pendentes','Perdidos'], datasets: [{ data: [conv||.001, pending||.001, lost||.001], backgroundColor: ['#a5f3c0','#fde68a','#fca5a5'], borderWidth: 0 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%', plugins: { legend: { position:'bottom', labels: { color:'rgba(255,255,255,.85)', font:{size:10}, padding:8 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw===.001?0:c.raw}` } } } },
  });

  if (leadsChartSrc) leadsChartSrc.destroy();
  leadsChartSrc = new Chart(srcCanvas, {
    type: 'bar',
    data: { labels: Object.keys(bySource), datasets: [{ data: Object.values(bySource), backgroundColor: 'rgba(2,136,209,0.7)', borderRadius:4, borderWidth:0 }] },
    options: { responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{ legend:{display:false} }, scales: { x:{ ticks:{color:'rgba(255,255,255,.6)',font:{size:9},stepSize:1}, grid:{color:'rgba(255,255,255,.05)'} }, y:{ ticks:{color:'rgba(255,255,255,.8)',font:{size:9}}, grid:{display:false} } } },
  });
}

window.updateLeadStatus = async (id, status, selectEl) => {
  selectEl.disabled = true;
  const { ok } = await api(`/psiclo-leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  selectEl.disabled = false;
  if (!ok) { alert('Erro ao atualizar status.'); return; }
  loadLeads();
};

// Registra pagina de leads na navegacao
const _origPages = pages;
_origPages.leads = 'pageLeads';

document.querySelectorAll('.sa-nav-item').forEach(item => {
  if (item.dataset.page === 'leads') {
    item.addEventListener('click', () => {
      // Remove active de todos
      document.querySelectorAll('.sa-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      // Esconde todas as paginas
      Object.values(_origPages).forEach(p => { const el = $(p); if (el) el.style.display = 'none'; });
      $('pageLeads').style.display = 'flex';
      loadLeads();
    });
  }
});

// Filtro de status
document.addEventListener('change', (e) => {
  if (e.target?.id === 'leadsFilterStatus') loadLeads();
});

// ── Notificacao de novo lead em tempo real ────────────────────
let _lastLeadAt = null;
let _leadPollingTimer = null;

function playLeadSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Dois bips curtos — plim plim
    [0, 180].forEach(delay => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay / 1000);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + delay / 1000 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.25);
      osc.start(ctx.currentTime + delay / 1000);
      osc.stop(ctx.currentTime + delay / 1000 + 0.3);
    });
  } catch (_) {}
}

function showLeadToast(lead) {
  const existing = document.getElementById('leadNotifToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'leadNotifToast';
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
    background:linear-gradient(135deg,#0d1b6e,#1565c0);
    color:#fff; border-radius:14px; padding:1rem 1.25rem;
    box-shadow:0 8px 32px rgba(0,0,0,.35);
    display:flex; align-items:center; gap:.85rem;
    min-width:260px; max-width:320px;
    animation:leadToastIn .35s cubic-bezier(.22,1,.36,1);
    border:1px solid rgba(255,255,255,.15);
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes leadToastIn {
      from { opacity:0; transform:translateY(20px) scale(.95); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);

  toast.innerHTML = `
    <div style="width:38px;height:38px;border-radius:10px;background:rgba(0,230,180,.2);
      display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="18" height="18" fill="none" stroke="#00e6b4" stroke-width="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="23" y1="11" x2="17" y2="11"/>
        <line x1="20" y1="8" x2="20" y2="14"/>
      </svg>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.8rem;font-weight:700;color:#00e6b4;margin-bottom:.15rem">Novo lead recebido</div>
      <div style="font-size:.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${esc(lead.name || 'Visitante')}
      </div>
      <div style="font-size:.72rem;opacity:.6;margin-top:.1rem">${esc(lead.source || 'Landing page')}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background:rgba(255,255,255,.1);border:none;color:#fff;
      width:24px;height:24px;border-radius:50%;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.9rem
    ">x</button>
  `;

  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 6000);
}

async function pollNewLeads() {
  try {
    const { ok, data } = await api('/psiclo-leads?limit=1');
    if (!ok || !data?.length) return;

    const latest = data[0];

    // Primeira execucao — apenas registra o timestamp, nao notifica
    if (_lastLeadAt === null) {
      _lastLeadAt = latest.created_at;
      return;
    }

    // Novo lead chegou depois do ultimo registrado
    if (latest.created_at > _lastLeadAt) {
      _lastLeadAt = latest.created_at;
      playLeadSound();
      showLeadToast(latest);

      // Atualiza a tabela se a aba de leads estiver aberta
      if ($('pageLeads')?.style.display !== 'none') {
        loadLeads();
      }
    }
  } catch (_) {}
}

function startLeadPolling() {
  if (_leadPollingTimer) return;
  pollNewLeads(); // executa imediatamente para registrar baseline
  _leadPollingTimer = setInterval(pollNewLeads, 15000); // verifica a cada 15s
}

// Inicia polling assim que o painel abrir
const _origOpenPanel = openPanel;
// Sobrescreve openPanel para iniciar polling apos login
const _openPanelOrig = window._openPanelHooked;
if (!_openPanelOrig) {
  window._openPanelHooked = true;
  const _panelEl = document.getElementById('saPanel');
  const observer = new MutationObserver(() => {
    if (_panelEl.style.display !== 'none') {
      startLeadPolling();
      observer.disconnect();
    }
  });
  observer.observe(_panelEl, { attributes: true, attributeFilter: ['style'] });
}
