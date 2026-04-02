import { supabase } from './supabase.js';
import { store } from '../state/store.js';

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    store.set('user', data.user);
    return data;
  },

  async logout() {
    await supabase.auth.signOut();
    store.set('user', null);
    store.set('professional', null);
    window.location.href = '/pages/login.html';
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) store.set('user', session.user);
    return session;
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};
