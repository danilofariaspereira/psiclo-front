/**
 * Store global minimalista baseado em pub/sub.
 * Evita dependência de framework mantendo reatividade simples.
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
    // Retorna unsubscribe
    return () => {
      listeners[key] = listeners[key].filter((f) => f !== fn);
    };
  },
};
