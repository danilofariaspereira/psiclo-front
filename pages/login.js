import { authService } from '../services/auth.service.js';

const API_URL = 'https://psiclo-back.vercel.app/api';
const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const btn = document.getElementById('login-btn');

// ── Tema ─────────────────────────────────────────────────────
function getThemeCookie() {
  return document.cookie.split('; ').find(r => r.startsWith('ui-theme='))?.split('=')[1] || 'light';
}
function setThemeCookie(theme) {
  document.cookie = `ui-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

const savedTheme = getThemeCookie();
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
updateLoginThemeBtn(savedTheme);

document.getElementById('loginThemeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  setThemeCookie(next);
  updateLoginThemeBtn(next);
});

function updateLoginThemeBtn(theme) {
  const sun = document.getElementById('loginIconSun');
  const moon = document.getElementById('loginIconMoon');
  if (!sun || !moon) return;
  sun.style.display = theme === 'dark' ? 'block' : 'none';
  moon.style.display = theme === 'dark' ? 'none' : 'block';
}

// Redireciona se já estiver logado
authService.getSession().then((session) => {
  if (session) window.location.href = './dashboard.html';
});

// Toggle senha
document.querySelectorAll('.input-password__toggle').forEach((toggleBtn) => {
  toggleBtn.addEventListener('click', () => {
    const input = document.getElementById(toggleBtn.dataset.target);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    toggleBtn.querySelector('.eye-open').style.display = isPass ? 'none' : 'block';
    toggleBtn.querySelector('.eye-closed').style.display = isPass ? 'block' : 'none';
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const data = await authService.login(form.email.value.trim(), form.password.value);

    if (data.first_access) {
      showFirstAccessModal(data.professional.email);
    } else {
      window.location.href = './dashboard.html';
    }
  } catch (err) {
    errorEl.textContent = err.message || 'E-mail ou senha incorretos.';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

function showFirstAccessModal(userEmail) {
  const overlay = document.createElement('div');
  overlay.className = 'first-access-overlay';
  overlay.innerHTML = `
    <div class="first-access-modal">
      <h2>Bem-vindo ao PSICLO!</h2>
      <p>Por segurança, crie uma nova senha para sua conta.</p>
      <div class="fa-field">
        <label>Nova senha *</label>
        <input type="password" id="faNewPass" placeholder="Mínimo 6 caracteres" />
      </div>
      <div class="fa-field">
        <label>Confirmar senha *</label>
        <input type="password" id="faConfirmPass" placeholder="Repita a senha" />
      </div>
      <p class="fa-error" id="faError"></p>
      <button class="btn btn--primary btn--full" id="faSaveBtn">Salvar e entrar</button>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('faSaveBtn').addEventListener('click', async () => {
    const newPass = document.getElementById('faNewPass').value;
    const confirm = document.getElementById('faConfirmPass').value;
    const errEl = document.getElementById('faError');
    const saveBtn = document.getElementById('faSaveBtn');

    if (newPass.length < 6) { errEl.textContent = 'Mínimo 6 caracteres.'; return; }
    if (newPass !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';

    try {
      const res = await fetch(`${API_URL}/admin/professionals/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || 'Erro ao salvar senha.'; saveBtn.disabled = false; saveBtn.textContent = 'Salvar e entrar'; return; }
      window.location.href = './dashboard.html';
    } catch (_) {
      errEl.textContent = 'Erro de conexão.';
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar e entrar';
    }
  });
}
