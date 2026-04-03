const API = 'https://psiclo-back.vercel.app/api';

function getToken() {
  return localStorage.getItem('psiclo_token');
}

function setToken(token) {
  localStorage.setItem('psiclo_token', token);
}

function clearToken() {
  localStorage.removeItem('psiclo_token');
  localStorage.removeItem('psiclo_professional');
}

export const authService = {
  async login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.');
    setToken(data.token);
    localStorage.setItem('psiclo_professional', JSON.stringify(data.professional));
    return data;
  },

  async logout() {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (_) {}
    }
    clearToken();
    window.location.href = '/pages/login.html';
  },

  async getSession() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { clearToken(); return null; }
      const prof = await res.json();
      localStorage.setItem('psiclo_professional', JSON.stringify(prof));
      return { token, professional: prof };
    } catch (_) {
      clearToken();
      return null;
    }
  },

  getProfessional() {
    try {
      return JSON.parse(localStorage.getItem('psiclo_professional'));
    } catch (_) {
      return null;
    }
  },

  getToken,
};
