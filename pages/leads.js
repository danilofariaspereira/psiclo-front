import { authService } from '../services/auth.service.js';
import { renderSidebar } from '../components/Sidebar.js';
import { renderHeader } from '../components/Header.js';
import { Modal } from '../components/Modal.js';
import { notify } from '../utils/notify.js';
import { dateUtils } from '../utils/date.js';
import { store } from '../state/store.js';
import { esc } from '../utils/sanitize.js';

const API = 'https://psiclo-back.vercel.app/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function init() {
  const session = await authService.getSession();
  if (!session) { window.location.href = './login.html'; return; }

  store.set('professional', session.professional);
  renderSidebar('leads');
  renderHeader('Leads');

  loadLeads();
  loadCharts();

  document.getElementById('filter-status').addEventListener('change', loadLeads);
}

let conversionChart = null;
let sourceChart = null;

async function loadCharts() {
  try {
    const stats = await apiFetch('/leads/stats');
    const { byStatus = {}, bySource = {} } = stats;

    // Gráfico de conversão (rosca)
    const converted = byStatus['converted'] || 0;
    const pending = (byStatus['new'] || 0) + (byStatus['contacted'] || 0);
    const lost = byStatus['lost'] || 0;

    if (conversionChart) conversionChart.destroy();
    conversionChart = new Chart(document.getElementById('chart-conversion'), {
      type: 'doughnut',
      data: {
        labels: ['Convertidos', 'Pendentes', 'Perdidos'],
        datasets: [{ data: [converted || 0.001, pending || 0.001, lost || 0.001], backgroundColor: ['#16a34a', '#f59e0b', '#dc2626'], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw === 0.001 ? 0 : c.raw}` } },
        },
      },
    });

    // Gráfico de origem (barras horizontais)
    const sourceLabels = Object.keys(bySource);
    const sourceData = Object.values(bySource);
    const colors = ['#0288d1','#7c3aed','#f59e0b','#16a34a','#dc2626','#9ca3af','#0ea5e9','#8b5cf6'];

    if (sourceChart) sourceChart.destroy();
    sourceChart = new Chart(document.getElementById('chart-source'), {
      type: 'bar',
      data: {
        labels: sourceLabels,
        datasets: [{ data: sourceData, backgroundColor: sourceLabels.map((_, i) => colors[i % colors.length]), borderRadius: 6, borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, stepSize: 1 }, grid: { display: false } },
          y: { ticks: { font: { size: 10 } } },
        },
      },
    });
  } catch (_) {}
}

const WA_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.852L.057 23.57a.75.75 0 0 0 .916.916l5.718-1.475A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.528-5.204-1.443l-.372-.22-3.394.875.893-3.302-.242-.384A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`;

async function loadLeads() {
  const tbody = document.getElementById('leads-body');
  const status = document.getElementById('filter-status').value;
  const qs = status ? `?status=${status}` : '';

  try {
    const leads = await apiFetch(`/leads${qs}`);

    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-text-muted)">Nenhum lead encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = leads.map((l) => {
      const phone = esc(l.phone || '');
      const name = esc(l.name || '');
      const waMsg = encodeURIComponent(`Ola ${l.name || ''}, sou a Julia Vidal. Hoje tinhamos um agendamento e voce nao compareceu. Gostaria de saber se esta tudo bem e se podemos remarcar.`);
      const waHref = phone ? `https://wa.me/55${l.phone.replace(/\D/g, '')}?text=${waMsg}` : null;
      return `
        <tr>
          <td>${name}</td>
          <td>${phone || '—'}</td>
          <td>${esc(l.email || '') || '—'}</td>
          <td>${esc(l.source || '') || '—'}</td>
          <td>${dateUtils.format(l.created_at)}</td>
          <td style="display:flex;gap:.4rem;align-items:center">
            ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener noreferrer" class="btn btn--primary btn--sm" style="display:inline-flex;align-items:center;gap:.3rem">${WA_SVG} WhatsApp</a>` : ''}
            ${l.status !== 'converted'
              ? `<span class="badge badge--pending">Pendente</span>`
              : `<span class="badge badge--converted">Convertido</span>`}
            <button class="btn btn--danger btn--sm" onclick="deleteLead('${esc(l.id)}')">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-error)">Erro ao carregar leads.</td></tr>`;
  }
}

window.markConverted = async (id) => {
  try {
    await apiFetch(`/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'converted' }),
    });
    notify.success('Lead marcado como convertido.');
    loadLeads();
  } catch { notify.error('Erro ao atualizar.'); }
};

window.deleteLead = (id) => {
  Modal.open({
    title: 'Excluir lead',
    content: '<p>Tem certeza? Esta ação não pode ser desfeita (LGPD).</p>',
    confirmLabel: 'Excluir',
    onConfirm: async () => {
      try {
        await apiFetch(`/leads/${id}`, { method: 'DELETE' });
        notify.success('Lead excluído.');
        loadLeads();
      } catch {
        notify.error('Erro ao excluir.');
      }
    },
  });
};

init();
