<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { graphql } from '$lib/graphql/client';

  interface Variable {
    variableId: string;
    value: unknown;
    datatype: string;
    quality: string;
    source: string;
  }

  const projectId = $derived($page.params.projectId);

  let variables = $state<Variable[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const result = await graphql<{ variables: Variable[] }>(`
        query($projectId: String!) {
          variables(projectId: $projectId) {
            variableId
            value
            datatype
            quality
            source
          }
        }
      `, { projectId: $page.params.projectId });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        variables = result.data.variables;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load variables';
    }
    loading = false;
  });

  const variableCount = $derived(variables.length);
  const goodQualityCount = $derived(variables.filter(v => v.quality === 'good').length);
</script>

<div class="page">
  <header class="page-header">
    <h1>{projectId}</h1>
    <span class="status status-connected">Connected</span>
  </header>

  <div class="content">
    {#if loading}
      <div class="loading">Loading project data...</div>
    {:else if error}
      <div class="info-box error">
        <h3>Error Loading Project</h3>
        <p>{error}</p>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{variableCount}</span>
          <span class="stat-label">Variables</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{goodQualityCount}</span>
          <span class="stat-label">Good Quality</span>
        </div>
      </div>

      <div class="quick-links">
        <a href="/projects/{projectId}/variables" class="card card-interactive quick-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 7h16M4 12h16M4 17h10"/>
          </svg>
          <div>
            <h3>Variables</h3>
            <p>View and edit real-time variable values</p>
          </div>
        </a>

        <a href="/projects/{projectId}/devices" class="card card-interactive quick-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="8" cy="12" r="2"/>
            <path d="M14 10h4M14 14h4"/>
          </svg>
          <div>
            <h3>Devices</h3>
            <p>Configure EtherNet/IP PLCs and tags</p>
          </div>
        </a>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .page {
    padding: 2rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--theme-primary);
  }

  .stat-label {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .quick-links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .quick-link {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    text-decoration: none;
    color: var(--theme-text);

    svg {
      flex-shrink: 0;
      color: var(--theme-primary);
      margin-top: 0.125rem;
    }

    h3 {
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    p {
      font-size: 0.875rem;
      color: var(--theme-text-muted);
    }
  }
</style>
