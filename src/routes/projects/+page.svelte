<script lang="ts">
  import { onMount } from 'svelte';
  import { graphql } from '$lib/graphql/client';

  let projects = $state<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const result = await graphql<{ projects: string[] }>(`
        query {
          projects
        }
      `);

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        projects = result.data.projects;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load projects';
    }
    loading = false;
  });
</script>

<div class="page">
  <header class="page-header">
    <h1>Projects</h1>
    <p class="subtitle">Manage your PLC projects and configurations</p>
  </header>

  <div class="content">
    {#if loading}
      <div class="loading">Loading projects...</div>
    {:else if error}
      <div class="info-box error">
        <h3>Connection Error</h3>
        <p>{error}</p>
      </div>
    {:else if projects.length === 0}
      <div class="empty-state">
        <h3>No Projects Found</h3>
        <p>No active PLC projects were discovered. Configure a tentacle service with a project ID to get started.</p>
      </div>
    {:else}
      <div class="projects-list">
        {#each projects as project}
          <a href="/projects/{project}" class="card card-interactive project-row">
            <div class="project-info">
              <div class="project-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <circle cx="8" cy="12" r="2"/>
                  <path d="M14 10h4M14 14h4"/>
                </svg>
              </div>
              <div>
                <h3>{project}</h3>
                <span class="project-id">Project ID: {project}</span>
              </div>
            </div>
            <div class="project-actions">
              <span class="status status-connected">Connected</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

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

  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .project-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    text-decoration: none;
    color: var(--theme-text);
  }

  .project-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    h3 {
      font-size: 1rem;
      margin-bottom: 0.125rem;
    }
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
  }

  .project-id {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .project-actions {
    display: flex;
    align-items: center;
    gap: 1rem;

    svg {
      color: var(--theme-text-muted);
    }
  }
</style>
