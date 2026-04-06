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

boot();
