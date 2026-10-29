/**
 * Projects Management View
 * List, create, and switch projects connected to the Backend API
 */

import { api } from '../api.js';
import { loadProject, getState } from '../store.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { card } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { escapeHtml } from '../utils/html.js';

export async function renderProjects(root) {
  root.innerHTML = `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-lg);">
        <div>
          <h1 class="page-title" style="margin-bottom: 2px;">Projects Workspace</h1>
          <p class="muted page-sub" style="margin-bottom: 0;">
            Manage social impact assessments and select a project to calculate SROI
          </p>
        </div>
        <button class="btn btn-primary" id="btnCreateNewProject">${icons.plus} New Project</button>
      </div>

      <div id="projectsTableContainer">
        <div class="muted" style="padding: var(--sp-2xl); text-align: center;">Loading projects from database...</div>
      </div>
    </div>
  `;

  const container = document.getElementById('projectsTableContainer');

  const loadList = async () => {
    try {
      const res = await api.getProjects();
      const projects = res?.data || [];

      if (projects.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--sp-2xl);">
            <h3>No projects found</h3>
            <p class="muted" style="margin-bottom: var(--sp-lg);">Get started by creating your first SROI project assessment.</p>
            <button class="btn btn-primary" id="btnCreateFirstProject">${icons.plus} Create Project</button>
          </div>
        `;
        document.getElementById('btnCreateFirstProject')?.addEventListener('click', triggerCreateModal);
        return;
      }

      container.innerHTML = card({
        body: `
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th class="num">Horizon</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${projects
                  .map(
                    (p) => `
                  <tr data-project-id="${p.id}">
                    <td class="strong">
                      ${escapeHtml(p.name)}
                      ${p.organization_name ? `<div class="muted" style="font-size: 0.75rem;">${escapeHtml(p.organization_name)}</div>` : ''}
                    </td>
                    <td><span class="badge badge-planned">${escapeHtml(p.category || 'General')}</span></td>
                    <td><span class="badge badge-integrated">${escapeHtml(p.evaluation_type)}</span></td>
                    <td class="num">${p.analysis_period_years || 5} Years</td>
                    <td><span class="badge badge-${p.status === 'ready' ? 'production' : 'planned'}">${escapeHtml(p.status)}</span></td>
                    <td>
                      <div style="display: flex; gap: var(--sp-sm);">
                        <button class="btn btn-primary" data-open-project="${p.id}" style="height: 32px; font-size: 0.75rem;">
                          Open Calculator
                        </button>
                        <button class="btn-icon" data-delete-project="${p.id}" title="Delete Project">
                          ${icons.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      });

      container.querySelectorAll('[data-open-project]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const pId = Number(btn.dataset.openProject);
          await loadProject(pId);
          window.location.hash = '#/wizard/step-1';
        });
      });

      container.querySelectorAll('[data-delete-project]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pId = Number(btn.dataset.deleteProject);
          confirmModal({
            title: 'Delete Project',
            message: 'Are you sure you want to delete this project? It can be restored later.',
            onConfirm: async () => {
              try {
                await api.deleteProject(pId);
                loadList();
              } catch (err) {
                alert(`Failed to delete project: ${err.message}`);
              }
            },
          });
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    }
  };

  const triggerCreateModal = () => {
    openCreateProjectModal({
      onCreated: async (newP) => {
        await loadProject(newP.id);
        window.location.hash = '#/wizard/step-1';
      },
    });
  };

  document.getElementById('btnCreateNewProject')?.addEventListener('click', triggerCreateModal);

  loadList();
}

function openCreateProjectModal({ onCreated }) {
  const formHtml = `
    <form id="createProjectForm" class="stack" style="gap: var(--sp-md);">
      <div class="field">
        <label class="field-label">Project Name *</label>
        <input type="text" name="name" class="input" required placeholder="e.g. University Community Tutoring Initiative" />
      </div>
      <div class="field">
        <label class="field-label">Organization / Institution</label>
        <input type="text" name="organization_name" class="input" placeholder="e.g. Naresuan University" />
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">Category</label>
          <input type="text" name="category" class="input" placeholder="Education, Health, Environment..." />
        </div>
        <div class="field">
          <label class="field-label">Evaluation Type</label>
          <select name="evaluation_type" class="input">
            <option value="forecast">Forecast (Ex-ante prospective)</option>
            <option value="evaluative">Evaluative (Ex-post actuals)</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label class="field-label">Currency</label>
          <input type="text" name="currency" class="input" value="THB" maxlength="3" required />
        </div>
        <div class="field">
          <label class="field-label">Analysis Period (Years)</label>
          <input type="number" name="analysis_period_years" min="1" max="100" class="input" value="5" required />
        </div>
        <div class="field">
          <label class="field-label">Discount Rate (%)</label>
          <input type="number" name="discount_rate" min="0" max="100" step="0.1" class="input" value="3.5" required />
        </div>
      </div>
      <div class="field">
        <label class="field-label">Description</label>
        <textarea name="description" class="input" rows="2" placeholder="Brief summary of project objectives and target beneficiaries"></textarea>
      </div>
      <div id="newProjectModalError" class="alert alert-danger" style="display: none;"></div>
    </form>
  `;

  openModal({
    title: 'Create New SROI Project',
    body: formHtml,
    footer: `
      <button class="btn btn-secondary" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="btnSubmitNewProject">Create Project</button>
    `,
  });

  document.getElementById('btnSubmitNewProject')?.addEventListener('click', async () => {
    const form = document.getElementById('createProjectForm');
    const errBox = document.getElementById('newProjectModalError');
    if (!form) return;

    const data = {
      name: form.name.value.trim(),
      organization_name: form.organization_name.value.trim(),
      category: form.category.value.trim(),
      evaluation_type: form.evaluation_type.value,
      currency: form.currency.value.trim().toUpperCase(),
      analysis_period_years: parseInt(form.analysis_period_years.value, 10),
      discount_rate: parseFloat(form.discount_rate.value) / 100,
      description: form.description.value.trim(),
    };

    if (!data.name || !data.currency) {
      if (errBox) {
        errBox.textContent = 'Please fill in project name and currency.';
        errBox.style.display = 'block';
      }
      return;
    }

    try {
      const res = await api.createProject(data);
      closeModal();
      onCreated(res.data);
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      }
    }
  });
}
