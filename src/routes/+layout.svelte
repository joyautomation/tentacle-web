<script lang="ts">
  import "@fontsource/righteous";
  import "@fontsource/space-grotesk";
  import "@fontsource/ibm-plex-mono";
  import "@joyautomation/salt/styles.scss";
  import "../app.scss";
  import { Toast } from "@joyautomation/salt";
  import ThemeSwitch from "$lib/components/ThemeSwitch.svelte";
  import { onMount } from "svelte";
  import { onNavigate } from "$app/navigation";
  import { themeState, type Theme } from "./theme.svelte";

  const { data, children } = $props();

  onMount(() => {
    themeState.initialize(data.theme as Theme | null);
  });

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<header class="app-header">
  <a href="/" class="logo">
    <img src="/logo.png" alt="Tentacle" />
  </a>
  <nav class="header-nav">
    <!-- Menu items will go here -->
  </nav>
  <div class="header-actions">
    <span
      class="mode-badge"
      class:mode-dev={data.mode === "dev"}
      class:mode-systemd={data.mode === "systemd"}
      class:mode-docker={data.mode === "docker"}
      class:mode-kubernetes={data.mode === "kubernetes"}
      class:mode-unknown={data.mode === "unknown"}
      title="Deployment mode: {data.mode}"
    >
      {data.mode}
    </span>
    <ThemeSwitch />
  </div>
</header>

<main class="main-content">
  {@render children()}
</main>
<Toast />

<style lang="scss">
  .app-header {
    display: flex;
    align-items: center;
    height: var(--header-height);
    padding: 0 1.5rem;
    background-color: var(--theme-background);
    border-bottom: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
  }

  .logo {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;

    img {
      height: 2rem;
      width: auto;
    }
  }

  .header-nav {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: 2rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
  }

  .mode-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1875rem 0.5rem;
    border-radius: var(--rounded-full);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;

    &.mode-dev {
      background: var(--badge-amber-bg);
      color: var(--badge-amber-text);
      border-color: var(--badge-amber-border);
    }

    &.mode-systemd {
      background: var(--badge-sky-bg);
      color: var(--badge-sky-text);
      border-color: var(--badge-sky-border);
    }

    &.mode-docker {
      background: var(--badge-blue-bg);
      color: var(--badge-blue-text);
      border-color: var(--badge-blue-border);
    }

    &.mode-kubernetes {
      background: var(--badge-purple-bg);
      color: var(--badge-purple-text);
      border-color: var(--badge-purple-border);
    }

    &.mode-unknown {
      background: var(--badge-muted-bg);
      color: var(--badge-muted-text);
      border-color: var(--badge-muted-border);
    }
  }

  .main-content {
    margin-top: var(--header-height);
    min-height: calc(100vh - var(--header-height));
  }
</style>
