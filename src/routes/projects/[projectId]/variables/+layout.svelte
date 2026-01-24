<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const projectId = $derived($page.params.projectId);
  const currentPath = $derived($page.url.pathname);
</script>

<div class="variables-layout">
  <div class="sub-tabs">
    <a
      href="/projects/{projectId}/variables"
      class="sub-tab"
      class:active={currentPath === `/projects/${projectId}/variables`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20V10M18 20V4M6 20v-4"/>
      </svg>
      Live Data
    </a>
    <a
      href="/projects/{projectId}/variables/mqtt"
      class="sub-tab"
      class:active={currentPath === `/projects/${projectId}/variables/mqtt`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 11a9 9 0 0 1 9 9"/>
        <path d="M4 4a16 16 0 0 1 16 16"/>
        <circle cx="5" cy="19" r="1"/>
      </svg>
      MQTT Config
    </a>
  </div>

  {@render children()}
</div>

<style lang="scss">
  .variables-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .sub-tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    background: var(--theme-bg);
    border-bottom: 1px solid var(--theme-border);
  }

  .sub-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--theme-text-muted);
    text-decoration: none;
    border-radius: var(--rounded-lg);
    transition: all 0.15s ease;

    svg {
      opacity: 0.6;
    }

    &:hover {
      color: var(--theme-text);
      background: var(--theme-surface);

      svg {
        opacity: 0.8;
      }
    }

    &.active {
      color: var(--theme-primary);
      background: rgba(var(--theme-primary-rgb), 0.1);

      svg {
        opacity: 1;
      }
    }
  }
</style>
