/**
 * auth.service.js
 * Token em httpOnly cookie gerenciado pelo backend.
 * JavaScript nunca vê o token — 100% seguro contra XSS.
 * Sessão cacheada no sessionStorage (some ao fechar a aba).
 */

const API = 'https://psiclo-back.vercel.app/api';
const SESSION_CACHE_KEY = '_psiclo_session';

export const authService = {
  async login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.');
    // Limpa cache ao fazer login para garantir dados frescos
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    return data;
  },

  async logout() {
    // Limpa todo o sessionStorage para não deixar resíduo
    sessionStorage.clear();
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {}
    window.location.href = '/';
  },

  async getSession() {
    // Tenta cache primeiro — evita round-trip ao backend em cada navegação
    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        // TTL de 5 minutos
        if (Date.now() - ts < 5 * 60 * 1000) return data;
      }
    } catch (_) {}

    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        sessionStorage.removeItem(SESSION_CACHE_KEY);
        return null;
      }
      const professional = await res.json();
      const session = { professional };
      // Salva no cache
      sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ data: session, ts: Date.now() }));
      return session;
    } catch (_) {
      return null;
    }
  },

  // Invalida o cache (usar após atualizar dados do profissional)
  clearCache() {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  },
};
