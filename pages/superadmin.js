const API = 'https://psiclo-back.vercel.app/api/admin';
let token = '';
let currentEmail = '';

const $ = (id) => document.getElementById(id);
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: headers(), ...opts });
  const data = await res.json();
  return { ok: res.ok, data };
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  $('saLoginBtn').disabled = false;
  $('saLoginBtn').textContent = 'Entrar';

  if (!res.ok) { err.textContent = data.error || 'Erro ao fazer login.'; return; }

  token = data.token;
  currentEmail = email;

  if (data.first_access) {
    $('saLoginScreen').style.display = 'none';
    $('saFirstAccessModal').style.display = 'flex';
  } else {
    openPanel(data.name);
  }
}

// ── Primeiro acesso ───────────────────────────────────────────
$('saSavePassBtn').addEventListener('click', async () => {
  const newPass = $('saNewPass').value;
  const confirm = $('saConfirmPass').value;
  const err = $('saFirstAccessError');
  if (newPass.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
  if (newPass !== confirm) { err.textContent = 'As senhas não coincidem.'; return; }

  $('saSavePassBtn').disabled = true;
  $('saSavePassBtn').textContent = 'Salvando...';

  const res = await fetch(`${API}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: currentEmail, new_password: newPass }),
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
function openPanel(name) {
  $('saLoginScreen').style.display = 'none';
  $('saFirstAccessModal').style.display = 'none';
  $('saPanel').style.display = 'flex';
  $('saUserName').textContent = name;

  // Avatar com iniciais
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  $('saAvatarSidebar').textContent = initials;

  loadOverview();
}

$('saLogoutBtn').addEventListener('click', () => { token = ''; location.reload(); });

// ── Navegação ─────────────────────────────────────────────────
const pages = { overview: 'pageOverview', professionals: 'pageProfessionals', superadmins: 'pageSuperadmins' };

document.querySelectorAll('.sa-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sa-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    Object.values(pages).forEach(p => $(p).style.display = 'none');
    $(pages[page]).style.display = 'block';
    if (page === 'professionals') loadProfessionals();
    if (page === 'superadmins') loadSuperadmins();
    if (page === 'overview') loadOverview();
  });
});

// ── Visão geral ───────────────────────────────────────────────
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
  $('metricPro').textContent = pro;
}

// ── Profissionais ─────────────────────────────────────────────
async function loadProfessionals() {
  const el = $('saProfList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/professionals');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="sa-empty">Nenhum profissional cadastrado.</p>'; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>CRP</th><th>Plano</th><th>Status</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${data.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${p.crp || '—'}</td>
        <td><span class="sa-badge sa-badge--${p.plan}">${p.plan}</span></td>
        <td><span class="sa-badge ${p.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${p.active ? 'Ativo' : 'Inativo'}</span></td>
        <td style="text-align:center">
          <button class="sa-btn-sm" onclick="toggleProf('${p.id}',${p.active})">${p.active ? 'Desativar' : 'Ativar'}</button>
          <button class="sa-btn-sm sa-btn-warning" onclick="resetProfPass('${p.id}','${p.name}')">Resetar senha</button>
          <button class="sa-btn-sm sa-btn-danger" onclick="deleteProf('${p.id}','${p.name}')">Deletar</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
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
  if (!confirm(`Deletar completamente "${name}"?\n\nTodos os dados serão apagados.`)) return;
  const { ok, data } = await api(`/professionals/${id}`, { method: 'DELETE' });
  if (!ok) { alert(data.error); return; }
  loadProfessionals();
  loadOverview();
};

$('saNewProfBtn').addEventListener('click', () => $('saNewProfModal').style.display = 'flex');
$('saCloseProfModal').addEventListener('click', () => $('saNewProfModal').style.display = 'none');

$('saCreateProfBtn').addEventListener('click', async () => {
  const btn = $('saCreateProfBtn');
  const err = $('profError');
  const name = $('profName').value.trim();
  const email = $('profEmail').value.trim();
  if (!name || !email) { err.textContent = 'Nome e e-mail obrigatórios.'; return; }

  btn.disabled = true; btn.textContent = 'Criando...'; err.textContent = '';
  const { ok, data } = await api('/professionals', {
    method: 'POST',
    body: JSON.stringify({ name, email, crp: $('profCrp').value.trim(), phone: $('profPhone').value.trim(), plan: $('profPlan').value }),
  });
  btn.disabled = false; btn.textContent = 'Criar profissional';
  if (!ok) { err.textContent = data.error; return; }
  $('saNewProfModal').style.display = 'none';
  ['profName','profEmail','profCrp','profPhone'].forEach(id => $(id).value = '');
  loadProfessionals();
  loadOverview();
});

// ── Superadmins ───────────────────────────────────────────────
async function loadSuperadmins() {
  const el = $('saSaList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/superadmins');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Criado em</th><th style="text-align:center">Ações</th></tr></thead>
    <tbody>${data.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${s.email}</td>
        <td><span class="sa-badge ${s.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${s.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>${new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
        <td style="text-align:center">
          <button class="sa-btn-sm sa-btn-warning" onclick="resetSaPass('${s.id}','${s.name}')">Resetar senha</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
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
  const btn = $('saCreateSaBtn');
  const err = $('saNewError');
  const name = $('saNewName').value.trim();
  const email = $('saNewEmail').value.trim();
  if (!name || !email) { err.textContent = 'Nome e e-mail obrigatórios.'; return; }

  btn.disabled = true; btn.textContent = 'Criando...'; err.textContent = '';
  const { ok, data } = await api('/superadmins', { method: 'POST', body: JSON.stringify({ name, email }) });
  btn.disabled = false; btn.textContent = 'Criar superadmin';
  if (!ok) { err.textContent = data.error; return; }
  $('saNewSaModal').style.display = 'none';
  $('saNewName').value = ''; $('saNewEmail').value = '';
  loadSuperadmins();
});
