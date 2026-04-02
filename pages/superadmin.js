import { superadminService } from '../services/superadmin.service.js';

let secret = '';

// ── Login ────────────────────────────────────────────────────
document.getElementById('saLoginBtn').addEventListener('click', async () => {
  const input = document.getElementById('saSecretInput').value.trim();
  const err = document.getElementById('saLoginError');

  if (!input) { err.textContent = 'Digite a senha.'; return; }

  // Testa o secret fazendo uma chamada real à API
  const ok = await superadminService.testSecret(input);
  if (!ok) { err.textContent = 'Senha incorreta.'; return; }

  secret = input;
  superadminService.setSecret(secret);
  document.getElementById('saLoginScreen').style.display = 'none';
  document.getElementById('saPanel').style.display = 'block';
  loadProfessionals();
});

document.getElementById('saSecretInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('saLoginBtn').click();
});

document.getElementById('saLogoutBtn').addEventListener('click', () => {
  secret = '';
  location.reload();
});

// ── Lista profissionais ───────────────────────────────────────
async function loadProfessionals() {
  const container = document.getElementById('saProfList');
  container.innerHTML = '<p class="sa-loading">Carregando...</p>';

  const { data, error } = await superadminService.listProfessionals();
  if (error) { container.innerHTML = `<p class="sa-error">${error}</p>`; return; }

  if (!data.length) {
    container.innerHTML = '<p class="sa-empty">Nenhum profissional cadastrado ainda.</p>';
    return;
  }

  container.innerHTML = `
    <table class="sa-table">
      <thead>
        <tr>
          <th>Nome</th><th>E-mail</th><th>CRP</th><th>Plano</th><th>Status</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.email}</td>
            <td>${p.crp || '—'}</td>
            <td><span class="sa-badge sa-badge--${p.plan}">${p.plan}</span></td>
            <td><span class="sa-badge ${p.active ? 'sa-badge--active' : 'sa-badge--inactive'}">${p.active ? 'Ativo' : 'Inativo'}</span></td>
            <td>
              <button class="sa-btn-sm" onclick="toggleActive('${p.id}', ${p.active})">${p.active ? 'Desativar' : 'Ativar'}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

window.toggleActive = async (id, currentActive) => {
  await superadminService.updateProfessional(id, { active: !currentActive });
  loadProfessionals();
};

// ── Modal novo profissional ───────────────────────────────────
document.getElementById('saNewProfBtn').addEventListener('click', () => {
  document.getElementById('saNewProfModal').style.display = 'flex';
});

document.getElementById('saModalClose').addEventListener('click', closeModal);
document.getElementById('saNewProfModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('saNewProfModal')) closeModal();
});

function closeModal() {
  document.getElementById('saNewProfModal').style.display = 'none';
  document.getElementById('saModalError').textContent = '';
  ['saName','saEmail','saCrp','saPhone'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('saPlan').value = 'free';
}

document.getElementById('saCreateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saCreateBtn');
  const err = document.getElementById('saModalError');

  const name  = document.getElementById('saName').value.trim();
  const email = document.getElementById('saEmail').value.trim();
  const crp   = document.getElementById('saCrp').value.trim();
  const phone = document.getElementById('saPhone').value.trim();
  const plan  = document.getElementById('saPlan').value;

  if (!name || !email) { err.textContent = 'Nome e e-mail são obrigatórios.'; return; }

  btn.disabled = true;
  btn.textContent = 'Criando...';
  err.textContent = '';

  const { error } = await superadminService.createProfessional({ name, email, crp, phone, plan });

  btn.disabled = false;
  btn.textContent = 'Criar profissional';

  if (error) { err.textContent = error; return; }

  closeModal();
  loadProfessionals();
});
