import { authService } from '../services/auth.service.js';

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
    await authService.login(
      form.email.value.trim(),
      form.password.value
    );
    window.location.href = './dashboard.html';
  } catch (err) {
    errorEl.textContent = 'E-mail ou senha incorretos.';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});
