<script lang="ts">
  import '../app.scss';
  import '@fontsource/space-grotesk/400.css';
  import '@fontsource/space-grotesk/500.css';
  import '@fontsource/space-grotesk/700.css';
  import '@fontsource/righteous/400.css';

  let { children } = $props();
</script>

<div class="app-layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <a href="/" class="logo">
        <img src="/logo.png" alt="Tentacle" />
      </a>
    </div>

    <nav class="sidebar-nav">
      <a href="/" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="9"/>
          <rect x="14" y="3" width="7" height="5"/>
          <rect x="14" y="12" width="7" height="9"/>
          <rect x="3" y="16" width="7" height="5"/>
        </svg>
        Dashboard
      </a>
      <a href="/nats" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        NATS Diagnostics
      </a>
    </nav>

    <div class="sidebar-footer">
      <span class="version">v0.0.1</span>
    </div>
  </aside>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style lang="scss">
  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: var(--sidebar-width);
    background: var(--theme-surface);
    border-right: 1px solid var(--theme-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
  }

  .sidebar-header {
    padding: 1.25rem;
    border-bottom: 1px solid var(--theme-border);
  }

  .logo {
    display: block;
    text-decoration: none;

    img {
      width: 100%;
      height: auto;
    }
  }

  .sidebar-nav {
    flex: 1;
    padding: 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: var(--rounded-lg);
    color: var(--theme-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.15s ease;

    svg {
      opacity: 0.7;
    }

    &:hover {
      background: var(--theme-surface-hover);
      color: var(--theme-text);

      svg {
        opacity: 1;
      }
    }

    &.active {
      background: rgba(6, 182, 212, 0.1);
      color: var(--theme-primary);

      svg {
        opacity: 1;
      }
    }
  }

  .sidebar-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--theme-border);
  }

  .version {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
  }

  .main-content {
    flex: 1;
    margin-left: var(--sidebar-width);
    min-height: 100vh;
  }
</style>
