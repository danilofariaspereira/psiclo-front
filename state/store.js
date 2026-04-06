/**
 * Store global minimalista baseado em pub/sub.
 * Evita dependência de framework mantendo reatividade simples.
 * Cache de dados estáticos com TTL no sessionStorage.
 */
const state = {
  user: null,
  professional: null,
  currentPage: 'dashboard',
};

const listeners = {};

export const store = {
  get(key) {
    return state[key];
  },

  set(key, value) {
    state[key] = value;
    (listeners[key] || []).forEach((fn) => fn(value));
  },

  subscribe(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return () => {
      listeners[key] = listeners[key].filter((f) => f !== fn);
    };
  },

  // Cache de dados estáticos (config, expenses, goal) — TTL em ms
  cache: {
    get(key) {
      try {
        const raw = sessionStorage.getItem(`_psiclo_cache_${key}`);
        if (!raw) return null;
        const { data, ts, ttl } = JSON.parse(raw);
        if (Date.now() - ts > ttl) { sessionStorage.removeItem(`_psiclo_cache_${key}`); return null; }
        return data;
      } catch (_) { return null; }
    },
    set(key, data, ttlMs = 5 * 60 * 1000) {
      try {
        sessionStorage.setItem(`_psiclo_cache_${key}`, JSON.stringify({ data, ts: Date.now(), ttl: ttlMs }));
      } catch (_) {}
    },
    del(key) {
      try { sessionStorage.removeItem(`_psiclo_cache_${key}`); } catch (_) {}
    },
  },
};
