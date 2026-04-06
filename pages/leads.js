import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { dateUtils } from '../utils/date.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';
let conversionChart = null;
let sourceChart = null;

async function apiFetch(path, options = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API}${path}${options.method && options.method !== 'GET' ? '' : `${sep}_=${Date.now()}`}`;
  const res = await fetch(url, { ...options, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export async function mount(container) {
  container.innerHTML = `
<div class="page-header">
  <h1 class="page-title">Leads</h1>
  <div style="display:flex;gap:.5rem;align-items:center">
    <select id="filter-status" class="form-select" style="width:auto">
      <option value="">Todos</option><option value="new">Novos</option>
      <option value="contacted">Contactados</option><option value="converted">Convertidos</option><option value="lost">Perdidos</option>
    </select>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
  <div class="card card--blue"><p class="card__title">Conversão de leads</p><p style="font-size:.75rem;color:rgba(255,255,255,.65);margin-bottom:.75rem">Proporção entre pendentes e convertidos.</p><div style="position:relative;height:180px"><canvas id="chart-conversion"></canvas></div></div>
  <div class="card card--blue"><p class="card__title">Origem dos leads</p><p style="font-size:.75rem;color:rgba(255,255,255,.65);margin-bottom:.75rem">De onde vieram seus leads.</p><div style="position:relative;height:180px"><canvas id="chart-source"></canvas></div></div>
</div>
<div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Origem</th><th>Data</th><th>Ações</th></tr></thead><tbody id="leads-body"><tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Carregando...</td></tr></tbody></table></div></div>`;

  loadLeads();
  loadCharts();
  document.getElementById('filter-status').addEventListener('change', loadLeads);
}

export function unmount() {
  if (conversionChart) { conversionChart.destroy(); conversionChart = null; }
  if (sourceChart) { sourceChart.destroy(); sourceChart = null; }
}

async function loadCharts() {
  try {
    const stats = await apiFetch('/leads/stats');
    const { byStatus = {}, bySource = {} } = stats;
    const converted = byStatus['converted'] || 0;
    const pending = (byStatus['new'] || 0) + (byStatus['contacted'] || 0);
    const lost = byStatus['lost'] || 0;

    if (conversionChart) conversionChart.destroy();
    conversionChart = new Chart(document.getElementById('chart-conversion'), {
      type: 'doughnut',
      data: { labels: ['Convertidos', 'Pendentes', 'Perdidos'], datasets: [{ data: [converted || 0.001, pending || 0.001, lost || 0.001], backgroundColor: ['#a5f3c0', '#fde68a', '#fca5a5'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,.85)', font: { size: 11 }, padding: 10 } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw === 0.001 ? 0 : c.raw}` } } } },
    });

    const sourceLabels = Object.keys(bySource);
    const sourceData = Object.values(bySource);
    const colors = ['rgba(255,255,255,0.85)','rgba(255,255,255,0.65)','rgba(255,255,255,0.5)','rgba(255,255,255,0.4)','rgba(255,255,255,0.3)','rgba(255,255,255,0.25)'];
    if (sourceChart) sourceChart.destroy();
    sourceChart = new Chart(document.getElementById('chart-source'), {
      type: 'bar',
      data: { labels: sourceLabels, datasets: [{ data: sourceData, backgroundColor: sourceLabels.map((_, i) => colors[i % colors.length]), borderRadius: 6, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: 'rgba(255,255,255,.7)', font: { size: 10 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } }, y: { ticks: { color: 'rgba(255,255,255,.85)', font: { size: 10 } }, grid: { display: false } } } },
    });
  } catch (_) {}
}

const WA_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.57a.75.75 0 0 0 .916.916l5.718-1.475A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.204-1.443l-.372-.22-3.394.875.893-3.302-.242-.384A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`;

async function loadLeads() {
  const tbody = document.getElementById('leads-body');
  const status = document.getElementById('filter-status').value;
  const qs = status ? `?status=${status}` : '';
  try {
    const leads = await apiFetch(`/leads${qs}`);
    if (!leads.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum lead encontrado.</td></tr>`; return; }
    tbody.innerHTML = leads.map((l) => {
      const phone = esc(l.phone || '');
      const waMsg = encodeURIComponent(`Olá, Júlia Vidal. Tudo bem?\n\nEntrei em contato por meio do seu site e fiquei bastante interessado(a) no seu trabalho. Gostaria de obter mais informações sobre as sessões e entender melhor como funciona o atendimento.\n\nPoderia, por gentileza, esclarecer algumas dúvidas?\n\nAgradeço desde já e fico no aguardo do seu retorno.`);
      const waHref = phone ? `https://wa.me/55${l.phone.replace(/\D/g, '')}?text=${waMsg}` : null;
      const statusBadge = l.status === 'converted' ? `<span class="badge badge--converted">Convertido</span>` : `<span class="badge badge--pending">Pendente</span>`;
      return `<tr>
        <td>${esc(l.name || '')}</td><td>${phone || '—'}</td><td>${esc(l.email || '') || '—'}</td>
        <td>${esc(l.source || '') || '—'}</td><td>${dateUtils.format(l.created_at)}</td>
        <td style="display:flex;gap:.4rem;align-items:center">
          ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn btn--primary btn--sm" style="display:inline-flex;align-items:center;gap:.3rem">${WA_SVG} WhatsApp</a>` : ''}
          ${statusBadge}
          <button class="btn btn--danger btn--sm" onclick="deleteLead('${esc(l.id)}')">Excluir</button>
        </td>
      </tr>`;
    }).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-error)">Erro ao carregar leads.</td></tr>`; }
}

window.deleteLead = (id) => {
  Modal.open({
    title: 'Excluir lead', content: '<p>Tem certeza? Esta ação não pode ser desfeita (LGPD).</p>', confirmLabel: 'Excluir',
    onConfirm: async () => {
      try { await apiFetch(`/leads/${id}`, { method: 'DELETE' }); notify.success('Lead excluído.'); loadLeads(); }
      catch { notify.error('Erro ao excluir.'); }
    },
  });
};
