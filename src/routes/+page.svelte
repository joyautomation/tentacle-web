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
    <h1>Dashboard</h1>
    <p class="subtitle">Tentacle Stack Overview</p>
  </header>

  <div class="content">
    {#if loading}
      <div class="loading">Loading projects...</div>
    {:else if error}
      <div class="info-box error">
        <h3>Connection Error</h3>
        <p>{error}</p>
        <p class="hint">Make sure tentacle-graphql is running at the configured endpoint.</p>
      </div>
    {:else if projects.length === 0}
      <div class="empty-state">
        <h3>No Projects Found</h3>
        <p>No active PLC projects were discovered. Start a tentacle service to see projects here.</p>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{projects.length}</span>
          <span class="stat-label">Active Projects</span>
        </div>
      </div>

      <section class="section">
        <h2>Projects</h2>
        <div class="projects-grid">
          {#each projects as project}
            <a href="/projects/{project}" class="card card-interactive project-card">
              <div class="project-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <circle cx="8" cy="12" r="2"/>
                  <path d="M14 10h4M14 14h4"/>
                </svg>
              </div>
              <h3>{project}</h3>
              <span class="status status-connected">Connected</span>
            </a>
          {/each}
        </div>
      </section>
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
</style>
