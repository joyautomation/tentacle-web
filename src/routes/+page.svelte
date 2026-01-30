<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Delete modal state
  let deleteModalOpen = $state(false);
  let projectToDelete = $state<{ id: string } | null>(null);
  let deleteConfirmText = $state('');
  let deleting = $state(false);

  function openDeleteModal(project: { id: string }, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    projectToDelete = project;
    deleteConfirmText = '';
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    deleteModalOpen = false;
    projectToDelete = null;
    deleteConfirmText = '';
  }

  function formatLastActivity(iso: string | null): string {
    if (!iso) return 'Never';
    try {
      const date = new Date(iso);
      const now = Date.now();
      const diff = now - date.getTime();

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  }
</script>

<div class="page">
  <header class="page-header">
    <h1>Dashboard</h1>
    <p class="subtitle">Tentacle Stack Overview</p>
  </header>

  <div class="content">
    {#if data.error}
      <div class="info-box error">
        <h3>Connection Error</h3>
        <p>{data.error}</p>
        <p class="hint">Make sure tentacle-graphql is running at the configured endpoint.</p>
      </div>
    {:else if data.projects.length === 0}
      <div class="empty-state">
        <h3>No Projects Found</h3>
        <p>No active PLC projects were discovered. Start a tentacle service to see projects here.</p>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{data.projects.length}</span>
          <span class="stat-label">Active Projects</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{data.projects.filter(p => p.isConnected && !p.isStale).length}</span>
          <span class="stat-label">Connected</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{data.projects.filter(p => p.isStale).length}</span>
          <span class="stat-label">Stale</span>
        </div>
      </div>

      <section class="section">
        <h2>Projects</h2>
        <div class="projects-grid">
          {#each data.projects as project}
            <a href="/projects/{project.id}" class="card card-interactive project-card" class:stale={project.isStale}>
              <div class="project-header">
                <div class="project-icon" class:stale={project.isStale}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="6" width="20" height="12" rx="2"/>
                    <circle cx="8" cy="12" r="2"/>
                    <path d="M14 10h4M14 14h4"/>
                  </svg>
                </div>
                {#if project.isStale}
                  <button
                    class="delete-btn"
                    onclick={(e) => openDeleteModal(project, e)}
                    title="Delete project"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                {/if}
              </div>
              <h3>{project.id}</h3>
              <div class="project-meta">
                <span class="status" class:status-connected={project.isConnected && !project.isStale} class:status-stale={project.isStale}>
                  {project.isStale ? 'Stale' : project.isConnected ? 'Connected' : 'Disconnected'}
                </span>
                <span class="meta-separator">•</span>
                <span class="variable-count">{project.variableCount} vars</span>
              </div>
              <span class="last-activity">Last activity: {formatLastActivity(project.lastActivity)}</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if deleteModalOpen && projectToDelete}
  <div class="modal-backdrop" onclick={closeDeleteModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>Delete Project</h3>
      <p class="modal-warning">
        This will permanently delete the project <strong>{projectToDelete.id}</strong> and all its associated data (config, cache, MQTT settings).
      </p>
      <p class="modal-instruction">
        Type <strong>{projectToDelete.id}</strong> to confirm:
      </p>
      <form
        method="POST"
        action="?/deleteProject"
        use:enhance={() => {
          deleting = true;
          return async ({ update }) => {
            await update();
            deleting = false;
            closeDeleteModal();
          };
        }}
      >
        <input type="hidden" name="projectId" value={projectToDelete.id} />
        <input
          type="text"
          name="confirmText"
          bind:value={deleteConfirmText}
          placeholder="Enter project name"
          class="confirm-input"
        />
        {#if form?.error}
          <p class="form-error">{form.error}</p>
        {/if}
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick={closeDeleteModal} disabled={deleting}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-danger"
            disabled={deleteConfirmText !== projectToDelete.id || deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style lang="scss">
  .page {
    padding: 2rem;
  }

  .page-header {
    margin-bottom: 2rem;

    h1 {
      margin-bottom: 0.25rem;
    }
  }

  .subtitle {
    color: var(--theme-text-muted);
  }

  .hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--theme-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--theme-text-muted);
  }

  .section {
    margin-bottom: 2rem;

    h2 {
      margin-bottom: 1rem;
    }
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .project-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    text-decoration: none;
    color: var(--theme-text);

    h3 {
      font-size: 1.125rem;
    }
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .project-icon {
    width: 48px;
    height: 48px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: var(--rounded-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-primary);

    &.stale {
      background: rgba(245, 158, 11, 0.1);
      color: var(--amber-500);
    }
  }

  .project-card.stale {
    border-color: var(--amber-500);
    opacity: 0.8;
  }

  .project-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .meta-separator {
    color: var(--theme-text-muted);
  }

  .variable-count {
    color: var(--theme-text-muted);
  }

  .last-activity {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
  }

  .status-stale {
    background: rgba(245, 158, 11, 0.1);
    color: var(--amber-500);
  }

  .delete-btn {
    padding: 0.375rem;
    border: none;
    border-radius: var(--rounded-md);
    background: transparent;
    color: var(--theme-text-muted);
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      color: var(--red-500);
    }
  }

  // Modal styles
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
    margin: 1rem;

    h3 {
      margin-bottom: 1rem;
      color: var(--red-500);
    }
  }

  .modal-warning {
    margin-bottom: 1rem;
    color: var(--theme-text-muted);
    font-size: 0.875rem;

    strong {
      color: var(--theme-text);
    }
  }

  .modal-instruction {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;

    strong {
      color: var(--theme-primary);
      font-family: monospace;
    }
  }

  .confirm-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-md);
    background: var(--theme-bg);
    color: var(--theme-text);
    font-size: 0.875rem;
    margin-bottom: 1rem;

    &:focus {
      outline: none;
      border-color: var(--theme-primary);
    }
  }

  .form-error {
    color: var(--red-500);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: var(--rounded-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-secondary {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    color: var(--theme-text);

    &:hover:not(:disabled) {
      background: var(--theme-surface-hover);
    }
  }

  .btn-danger {
    background: var(--red-500);
    border: 1px solid var(--red-500);
    color: white;

    &:hover:not(:disabled) {
      background: var(--red-600);
      border-color: var(--red-600);
    }
  }
</style>
