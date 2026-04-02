const API = 'https://psiclo-back.vercel.app/api/admin';
let token = '';
let currentEmail = '';

// ── Helpers ───────────────────────────────────────────────────
const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
const $ = (id) => document.getElementById(id);

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

  if (!res.ok) { err.textContent = data.error; return; }

  token = data.token;
  currentEmail = email;

  if (data.first_access) {
    $('saLoginScreen').style.display = 'none';
    $('saFirstAccessModal').style.display = 'flex';
    $('saUserName').textContent = data.name;
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

  // Mostra sucesso e botão de login
  $('saFirstAccessModal').innerHTML = `
    <div class="sa-modal">
      <h3 class="sa-modal__title">Senha salva com sucesso!</h3>
      <p class="sa-modal__sub">Agora faça login com sua nova senha.</p>
      <button class="sa-btn-primary sa-btn-full" onclick="location.reload()">Fazer login</button>
    </div>`;
});

// ── Painel ────────────────────────────────────────────────────
function openPanel(name) {
  $('saLoginScreen').style.display = 'none';
  $('saFirstAccessModal').style.display = 'none';
  $('saPanel').style.display = 'block';
  $('saUserName').textContent = name;
  loadProfessionals();
}

$('saLogoutBtn').addEventListener('click', () => { token = ''; location.reload(); });

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.sa-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sa-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sa-tab-content').forEach(c => c.style.display = 'none');
    tab.classList.add('active');
    $(`tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).style.display = 'block';
    if (tab.dataset.tab === 'superadmins') loadSuperadmins();
  });
});

// ── Profissionais ─────────────────────────────────────────────
async function loadProfessionals() {
  const el = $('saProfList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/professionals');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="sa-empty">Nenhum profissional cadastrado.</p>'; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>CRP</th><th>Plano</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${data.map(p => `
      <tr>
        <td>${p.name}</td><td>${p.email}</td><td>${p.crp || '—'}</td>
        <td><span class="sa-badge sa-badge--${p.plan}">${p.plan}</span></td>
        <td><span class="sa-badge ${p.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${p.active ? 'Ativo' : 'Inativo'}</span></td>
        <td><button class="sa-btn-sm" onclick="toggleProf('${p.id}',${p.active})">${p.active ? 'Desativar' : 'Ativar'}</button></td>
      </tr>`).join('')}
    </tbody></table>`;
}

window.toggleProf = async (id, active) => {
  await api(`/professionals/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
  loadProfessionals();
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
});

// ── Superadmins ───────────────────────────────────────────────
async function loadSuperadmins() {
  const el = $('saSaList');
  el.innerHTML = '<p class="sa-loading">Carregando...</p>';
  const { ok, data } = await api('/superadmins');
  if (!ok) { el.innerHTML = `<p class="sa-error">${data.error}</p>`; return; }

  el.innerHTML = `<table class="sa-table">
    <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Criado em</th></tr></thead>
    <tbody>${data.map(s => `
      <tr>
        <td>${s.name}</td><td>${s.email}</td>
        <td><span class="sa-badge ${s.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${s.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>${new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
      </tr>`).join('')}
    </tbody></table>`;
}

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
