<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { graphql, subscribe } from '$lib/graphql/client';
  import VariableTree from '$lib/components/VariableTree.svelte';

  interface Variable {
    projectId: string;
    variableId: string;
    value: unknown;
    datatype: string;
    quality: string;
    source: string;
    lastUpdated: string;
  }

  type ViewMode = 'tree' | 'table';

  const projectId = $derived($page.params.projectId);

  let variables = $state<Variable[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let viewMode = $state<ViewMode>('tree');
  let unsubscribe: (() => void) | null = null;

  onMount(async () => {
    // Initial load
    try {
      const result = await graphql<{ variables: Variable[] }>(`
        query($projectId: String!) {
          variables(projectId: $projectId) {
            projectId
            variableId
            value
            datatype
            quality
            source
            lastUpdated
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

    // Subscribe to updates
    unsubscribe = subscribe<{ variableUpdates: Variable }>(
      `subscription($projectId: String!) {
        variableUpdates(projectId: $projectId) {
          projectId
          variableId
          value
          datatype
          quality
          source
          lastUpdated
        }
      }`,
      { projectId: $page.params.projectId },
      (data) => {
        const updated = data.variableUpdates;
        const index = variables.findIndex(v => v.variableId === updated.variableId);
        if (index >= 0) {
          variables[index] = updated;
        } else {
          variables = [...variables, updated];
        }
      },
      (err) => {
        console.error('Subscription error:', err);
      }
    );
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString();
    } catch {
      return '-';
    }
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="header-left">
      <h2>Variables</h2>
      <span class="variable-count">{variables.length} variables</span>
    </div>
    <div class="view-toggle">
      <button
        class="toggle-btn"
        class:active={viewMode === 'tree'}
        onclick={() => viewMode = 'tree'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9z"/>
          <path d="M6 9v3h6M18 9v9h-3"/>
        </svg>
        Tree
      </button>
      <button
        class="toggle-btn"
        class:active={viewMode === 'table'}
        onclick={() => viewMode = 'table'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M3 15h18M9 3v18"/>
        </svg>
        Table
      </button>
    </div>
  </header>

  <div class="content">
    {#if loading}
      <div class="loading">Loading variables...</div>
    {:else if error}
      <div class="info-box error">
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    {:else if variables.length === 0}
      <div class="empty-state">
        <h3>No Variables</h3>
        <p>No variables found for this project. Configure devices and tags to see data here.</p>
      </div>
    {:else if viewMode === 'tree'}
      <VariableTree {variables} />
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Variable ID</th>
              <th>Value</th>
              <th>Type</th>
              <th>Quality</th>
              <th>Source</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {#each variables as variable (variable.variableId)}
              <tr>
                <td class="variable-id">{variable.variableId}</td>
                <td class="variable-value">{formatValue(variable.value)}</td>
                <td class="variable-type">{variable.datatype}</td>
                <td>
                  <span class="quality quality-{variable.quality}">{variable.quality}</span>
                </td>
                <td class="variable-source">{variable.source}</td>
                <td class="variable-time">{formatTime(variable.lastUpdated)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
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
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .variable-count {
    font-size: 0.875rem;
    color: var(--theme-text-muted);
  }

  .view-toggle {
    display: flex;
    gap: 0.25rem;
    background: var(--theme-surface);
    padding: 0.25rem;
    border-radius: var(--rounded-lg);
    border: 1px solid var(--theme-border);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    border-radius: var(--rounded-md);
    background: transparent;
    color: var(--theme-text-muted);
    cursor: pointer;
    transition: all 0.15s;

    svg {
      opacity: 0.7;
    }

    &:hover:not(.active) {
      color: var(--theme-text);
      background: var(--theme-surface-hover);

      svg {
        opacity: 1;
      }
    }

    &.active {
      background: var(--theme-primary);
      color: white;

      svg {
        opacity: 1;
      }
    }
  }

  .table-container {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    overflow: hidden;
  }

  table {
    margin: 0;
  }

  .variable-id {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .variable-value {
    font-family: monospace;
    font-weight: 500;
    color: var(--theme-primary);
  }

  .variable-type {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .variable-source {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .variable-time {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .quality {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: var(--rounded-full);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .quality-good {
    background: rgba(34, 197, 94, 0.1);
    color: var(--green-600);
  }

  .quality-bad {
    background: rgba(239, 68, 68, 0.1);
    color: var(--red-500);
  }

  .quality-uncertain {
    background: rgba(245, 158, 11, 0.1);
    color: var(--amber-600);
  }
</style>
