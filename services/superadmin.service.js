const API_URL = 'https://psiclo-back.vercel.app/api/admin';

let _secret = '';

export const superadminService = {
  setSecret(s) { _secret = s; },

  headers() {
    return {
      'Content-Type': 'application/json',
      'X-Superadmin-Secret': _secret,
    };
  },

  async testSecret(secret) {
    try {
      const res = await fetch(`${API_URL}/professionals`, {
        headers: { 'X-Superadmin-Secret': secret },
      });
      return res.ok;
    } catch { return false; }
  },

  async listProfessionals() {
    try {
      const res = await fetch(`${API_URL}/professionals`, { headers: this.headers() });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return { data };
    } catch (e) { return { error: e.message }; }
  },

  async createProfessional(body) {
    try {
      const res = await fetch(`${API_URL}/professionals`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return { data };
    } catch (e) { return { error: e.message }; }
  },

  async updateProfessional(id, body) {
    try {
      const res = await fetch(`${API_URL}/professionals/${id}`, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return { data };
    } catch (e) { return { error: e.message }; }
  },
};
