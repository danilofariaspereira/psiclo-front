/**
 * app.js — SPA router
 * Carrega sidebar/header uma vez, troca só o conteúdo do <main>.
 */
import { authService } from './services/auth.service.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderHeader } from './components/Header.js';
import { store } from './state/store.js';

// ── Mapa de rotas ─────────────────────────────────────────────
const ROUTES = {
  dashboard: () => import('./pages/dashboard.js'),
  leads:     () => import('./pages/leads.js'),
  clients:   () => import('./pages/clients.js'),
  schedule:  () => import('./pages/schedule.js'),
  financial: () => import('./pages/financial.js'),
  balance:   () => import('./pages/balance.js'),
};

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  leads:     'Leads',
  clients:   'Clientes',
  schedule:  'Agenda',
  financial: 'Financeiro',
  balance:   'Balanço financeiro',
};

let currentRoute = null;
let currentModule = null;

// ── Bootstrap ─────────────────────────────────────────────────
async function boot() {
  const session = await authService.getSession();

  if (!session) {
    showLogin();
    return;
  }

  store.set('professional', session.professional);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = '';

  renderSidebar(getRoute());
  renderHeader(PAGE_TITLES[getRoute()] || 'Dashboard');

  // Intercepta cliques nos links da sidebar para navegação SPA
  document.getElementById('sidebar').addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    const route = hrefToRoute(href);
    if (route && ROUTES[route]) {
      e.preventDefault();
      navigate(route);
    }
  });

  navigate(getRoute());
}

// ── Navegação ─────────────────────────────────────────────────
async function navigate(route) {
  if (!ROUTES[route]) route = 'dashboard';
  if (route === currentRoute) return;

  // Desmonta página anterior
  if (currentModule?.unmount) currentModule.unmount();

  currentRoute = route;
  window.location.hash = route;

  // Atualiza link ativo na sidebar sem remontar
  document.querySelectorAll('.sidebar__link').forEach(a => {
    const r = hrefToRoute(a.getAttribute('href'));
    a.classList.toggle('sidebar__link--active', r === route);
    a.setAttribute('aria-current', r === route ? 'page' : 'false');
  });

  // Atualiza título do header sem remontar
  const titleEl = document.querySelector('.app-header__title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[route] || '';
  document.title = `PSICLO — ${PAGE_TITLES[route] || ''}`;

  // Animação de entrada
  const content = document.getElementById('app-content');
  content.innerHTML = '';
  content.classList.remove('page-enter');
  void content.offsetWidth; // reflow para reiniciar animação
  content.classList.add('page-enter');

  // Carrega e monta o módulo da rota
  try {
    const mod = await ROUTES[route]();
    currentModule = mod;
    await mod.mount(content);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--color-error);padding:2rem">Erro ao carregar página: ${err.message}</p>`;
  }
}

// ── Login ─────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('app-shell').style.display = 'none';

  const btn = document.getElementById('login-btn');
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');

  const doLogin = async () => {
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    try {
      await authService.login(emailEl.value.trim(), passEl.value);
      // Navega para / de forma limpa — evita cache do browser
      window.location.replace('/');
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  };

  btn.addEventListener('click', doLogin);
  passEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}

// ── Helpers ───────────────────────────────────────────────────
function getRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  return ROUTES[hash] ? hash : 'dashboard';
}

function hrefToRoute(href) {
  if (!href) return null;
  // Aceita tanto "dashboard.html" quanto "#dashboard"
  const match = href.match(/([a-z]+)(?:\.html)?$/);
  return match ? match[1] : null;
}

window.addEventListener('hashchange', () => navigate(getRoute()));

// ── Logout por inatividade — 8 horas sem interacao ───────────
const INACTIVITY_MS = 8 * 60 * 60 * 1000; // 8 horas
let _inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(async () => {
    // So faz logout se houver sessao ativa
    const session = await authService.getSession().catch(() => null);
    if (!session) return;
    await authService.logout();
    // Mostra aviso antes de recarregar
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999;';
    msg.innerHTML = '<div style="background:#fff;border-radius:12px;padding:2rem;text-align:center;max-width:340px"><p style="font-weight:700;margin-bottom:.5rem">Sessao encerrada</p><p style="font-size:.88rem;color:#64748b">Voce ficou inativo por 8 horas. Faca login novamente.</p></div>';
    document.body.appendChild(msg);
    setTimeout(() => window.location.replace('/'), 2500);
  }, INACTIVITY_MS);
}

// Reinicia o timer a cada interacao do usuario
['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, resetInactivityTimer, { passive: true });
});
resetInactivityTimer(); // inicia ao carregar

boot();
