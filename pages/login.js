import { authService } from '../services/auth.service.js';
import { supabase } from '../services/supabase.js';

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const btn = document.getElementById('login-btn');

// Redireciona se já estiver logado
authService.getSession().then((session) => {
  if (session) window.location.href = './dashboard.html';
});

// Toggle senha
document.querySelectorAll('.input-password__toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const data = await authService.login(
      form.email.value.trim(),
      form.password.value
    );

    // Verifica se é primeiro acesso
    const { data: prof } = await supabase
      .from('professionals')
      .select('first_access')
      .eq('user_id', data.user.id)
      .single();

    if (prof?.first_access) {
      showFirstAccessModal(data.user.id);
    } else {
      window.location.href = './dashboard.html';
    }
  } catch (err) {
    errorEl.textContent = 'E-mail ou senha incorretos.';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

// ── Modal primeiro acesso ─────────────────────────────────────
function showFirstAccessModal(userId) {
  const overlay = document.createElement('div');
  overlay.className = 'first-access-overlay';
  overlay.innerHTML = `
    <div class="first-access-modal">
      <h2>Bem-vindo ao PSICLO!</h2>
      <p>Por segurança, crie uma nova senha para sua conta.</p>
      <div class="fa-field">
        <label>Nova senha *</label>
        <input type="password" id="faNewPass" placeholder="Mínimo 8 caracteres" />
      </div>
      <div class="fa-field">
        <label>Confirmar senha *</label>
        <input type="password" id="faConfirmPass" placeholder="Repita a senha" />
      </div>
      <p class="fa-error" id="faError"></p>
      <button class="btn-primary btn-full" id="faSaveBtn">Salvar e entrar</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('faSaveBtn').addEventListener('click', async () => {
    const newPass = document.getElementById('faNewPass').value;
    const confirm = document.getElementById('faConfirmPass').value;
    const errEl = document.getElementById('faError');

    if (newPass.length < 8) { errEl.textContent = 'Mínimo 8 caracteres.'; return; }
    if (newPass !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    const saveBtn = document.getElementById('faSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { errEl.textContent = error.message; saveBtn.disabled = false; saveBtn.textContent = 'Salvar e entrar'; return; }

    // Remove flag first_access
    await supabase.from('professionals').update({ first_access: false }).eq('user_id', userId);

    window.location.href = './dashboard.html';
  });
}
