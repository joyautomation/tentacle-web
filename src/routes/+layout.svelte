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
        <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
          <!-- Tentacle logo - curved arrangement of ovals -->
          <ellipse cx="15" cy="75" rx="12" ry="8" fill="#f97316" transform="rotate(-25 15 75)"/>
          <ellipse cx="28" cy="58" rx="11" ry="7" fill="#f97316" transform="rotate(-15 28 58)"/>
          <ellipse cx="38" cy="42" rx="10" ry="6.5" fill="#f97316" transform="rotate(-5 38 42)"/>
          <ellipse cx="45" cy="27" rx="9" ry="6" fill="#f97316" transform="rotate(5 45 27)"/>
          <ellipse cx="55" cy="15" rx="8" ry="5.5" fill="#f97316" transform="rotate(15 55 15)"/>
          <ellipse cx="68" cy="8" rx="7" ry="5" fill="#f97316" transform="rotate(25 68 8)"/>
          <ellipse cx="82" cy="6" rx="6" ry="4.5" fill="#f97316" transform="rotate(35 82 6)"/>
        </svg>
        <span>Tentacle</span>
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
      <a href="/projects" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
        </svg>
        Projects
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Righteous', sans-serif;
    font-size: 1.25rem;
    color: var(--theme-text);
    text-decoration: none;
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
