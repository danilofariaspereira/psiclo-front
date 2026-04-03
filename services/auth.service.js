/**
 * auth.service.js
 * Token em httpOnly cookie gerenciado pelo backend.
 * JavaScript nunca vê o token — 100% seguro contra XSS.
 */

const API = 'https://psiclo-back.vercel.app/api';

export const authService = {
  async login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Envia e recebe cookies
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.');
    return data;
  },

  async logout() {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {}
    window.location.href = '/pages/login.html';
  },

  async getSession() {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const professional = await res.json();
      return { professional };
    } catch (_) {
      return null;
    }
  },
};
