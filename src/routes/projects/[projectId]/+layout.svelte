<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const projectId = $derived($page.params.projectId);
</script>

<div class="project-layout">
  <nav class="project-nav">
    <a href="/projects" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Projects
    </a>
    <span class="separator">/</span>
    <span class="project-name">{projectId}</span>
  </nav>

  <div class="project-tabs">
    <a href="/projects/{projectId}" class="tab" class:active={$page.url.pathname === `/projects/${projectId}`}>
      Overview
    </a>
    <a href="/projects/{projectId}/variables" class="tab" class:active={$page.url.pathname.includes('/variables')}>
      Variables
    </a>
    <a href="/projects/{projectId}/devices" class="tab" class:active={$page.url.pathname.includes('/devices')}>
      Devices
    </a>
  </div>

  {@render children()}
</div>

<style lang="scss">
  .project-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .project-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--theme-border);
    font-size: 0.875rem;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--theme-text-muted);
    text-decoration: none;

    &:hover {
      color: var(--theme-primary);
    }
  }

  .separator {
    color: var(--theme-border);
  }

  .project-name {
    color: var(--theme-text);
    font-weight: 500;
  }

  .project-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--theme-border);
    background: var(--theme-surface);
  }

  .tab {
    padding: 0.875rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-text-muted);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s ease;

    &:hover {
      color: var(--theme-text);
    }

    &.active {
      color: var(--theme-primary);
      border-bottom-color: var(--theme-primary);
    }
  }
</style>
