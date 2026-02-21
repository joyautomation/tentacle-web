<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const serviceType = $derived($page.params.serviceType ?? '');

  const serviceNames: Record<string, string> = {
    nats: 'NATS',
    graphql: 'GraphQL',
    web: 'Web UI',
    ethernetip: 'EtherNet/IP',
    mqtt: 'MQTT',
    plc: 'PLC',
    network: 'Network',
    nftables: 'NAT / Firewall',
    opcua: 'OPC UA',
  };

  const serviceName = $derived(serviceNames[serviceType] ?? serviceType);

  const currentTab = $derived(() => {
    const path = $page.url.pathname;
    if (path.endsWith('/logs')) return 'logs';
    if (path.endsWith('/traffic')) return 'traffic';
    if (path.endsWith('/info')) return 'info';
    if (path.endsWith('/status')) return 'status';
    if (path.endsWith('/config')) return 'config';
    return 'default';
  });
</script>

<div class="service-layout">
  <nav class="service-nav">
    <a href="/" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Topology
    </a>
    <span class="separator">/</span>
    <span class="current">{serviceName}</span>
  </nav>

  <div class="service-tabs">
    {#if serviceType === 'plc'}
      <a href="/services/{serviceType}" class="tab" class:active={currentTab() === 'default'}>
        Config
      </a>
      <a href="/services/{serviceType}/info" class="tab" class:active={currentTab() === 'info'}>
        Info
      </a>
      <a href="/services/{serviceType}/logs" class="tab" class:active={currentTab() === 'logs'}>
        Logs
      </a>
    {:else if serviceType === 'network'}
      <a href="/services/{serviceType}" class="tab" class:active={currentTab() === 'default'}>
        Overview
      </a>
      <a href="/services/{serviceType}/status" class="tab" class:active={currentTab() === 'status'}>
        Status
      </a>
      <a href="/services/{serviceType}/config" class="tab" class:active={currentTab() === 'config'}>
        Config
      </a>
      <a href="/services/{serviceType}/logs" class="tab" class:active={currentTab() === 'logs'}>
        Logs
      </a>
    {:else if serviceType === 'nftables'}
      <a href="/services/{serviceType}" class="tab" class:active={currentTab() === 'default'}>
        Overview
      </a>
      <a href="/services/{serviceType}/status" class="tab" class:active={currentTab() === 'status'}>
        Status
      </a>
      <a href="/services/{serviceType}/config" class="tab" class:active={currentTab() === 'config'}>
        Config
      </a>
      <a href="/services/{serviceType}/logs" class="tab" class:active={currentTab() === 'logs'}>
        Logs
      </a>
    {:else if serviceType === 'nats'}
      <a href="/services/{serviceType}" class="tab" class:active={currentTab() === 'default'}>
        Overview
      </a>
      <a href="/services/{serviceType}/traffic" class="tab" class:active={currentTab() === 'traffic'}>
        Traffic
      </a>
    {:else}
      <a href="/services/{serviceType}" class="tab" class:active={currentTab() === 'default'}>
        Overview
      </a>
      <a href="/services/{serviceType}/logs" class="tab" class:active={currentTab() === 'logs'}>
        Logs
      </a>
    {/if}
  </div>

  {@render children()}
</div>

<style lang="scss">
  .service-layout {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - var(--header-height));
  }

  .service-nav {
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

  .current {
    color: var(--theme-text);
    font-weight: 500;
  }

  .service-tabs {
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
