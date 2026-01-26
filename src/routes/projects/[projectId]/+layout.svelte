<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const projectId = $derived($page.params.projectId);
  const deviceId = $derived($page.params.deviceId);

  // Build breadcrumb segments based on current path
  const breadcrumbs = $derived(() => {
    const segments: Array<{ label: string; href: string }> = [
      { label: 'Projects', href: '/projects' },
      { label: projectId, href: `/projects/${projectId}` },
    ];

    const path = $page.url.pathname;

    if (path.includes('/devices')) {
      segments.push({ label: 'EtherNet/IP', href: `/projects/${projectId}/devices` });
      if (deviceId) {
        segments.push({ label: deviceId, href: `/projects/${projectId}/devices/${deviceId}` });
      }
    } else if (path.includes('/mqtt')) {
      segments.push({ label: 'MQTT', href: `/projects/${projectId}/mqtt` });
    }

    return segments;
  });

  // Check which tab is active
  const currentTab = $derived(() => {
    const path = $page.url.pathname;
    if (path.includes('/devices')) return 'ethernetip';
    if (path.includes('/mqtt')) return 'mqtt';
    return 'overview';
  });
</script>

<div class="project-layout">
  <nav class="project-nav">
    {#each breadcrumbs() as segment, i}
      {#if i > 0}
        <span class="separator">/</span>
      {/if}
      {#if i === breadcrumbs().length - 1}
        <span class="current">{segment.label}</span>
      {:else}
        <a href={segment.href} class="breadcrumb-link">
          {#if i === 0}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          {/if}
          {segment.label}
        </a>
      {/if}
    {/each}
  </nav>

  <div class="project-tabs">
    <a href="/projects/{projectId}" class="tab" class:active={currentTab() === 'overview'}>
      Overview
    </a>
    <a href="/projects/{projectId}/devices" class="tab" class:active={currentTab() === 'ethernetip'}>
      EtherNet/IP
    </a>
    <a href="/projects/{projectId}/mqtt" class="tab" class:active={currentTab() === 'mqtt'}>
      MQTT
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

  .breadcrumb-link {
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

  .current {
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
