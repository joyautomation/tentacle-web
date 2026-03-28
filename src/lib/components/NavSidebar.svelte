<script lang="ts">
  import { page } from '$app/stores';
  import {
    XMark,
    Home,
    CpuChip,
    Signal,
    ServerStack,
    ArrowsRightLeft,
    GlobeAlt,
    ComputerDesktop,
    ShieldCheck,
    CircleStack,
    Squares2x2
  } from '@joyautomation/salt/icons';

  interface Service {
    serviceType: string;
    moduleId: string;
    enabled: boolean;
  }

  interface Props {
    services: Service[];
    open: boolean;
  }

  let { services, open = $bindable(false) }: Props = $props();

  const uniqueServices = $derived(
    [...new Map(services.map((s) => [s.serviceType, s])).values()]
  );

  const serviceIcons: Record<string, typeof Squares2x2> = {
    plc: CpuChip,
    ethernetip: CpuChip,
    mqtt: Signal,
    nats: ServerStack,
    gateway: ArrowsRightLeft,
    network: GlobeAlt,
    nftables: ShieldCheck,
    snmp: ComputerDesktop,
    opcua: CircleStack
  };

  const serviceLabels: Record<string, string> = {
    plc: 'PLC',
    ethernetip: 'EtherNet/IP',
    mqtt: 'MQTT',
    nats: 'NATS',
    gateway: 'Gateway',
    network: 'Network',
    nftables: 'NFTables',
    snmp: 'SNMP',
    opcua: 'OPC-UA'
  };

  function getIcon(serviceType: string) {
    return serviceIcons[serviceType.toLowerCase()] ?? Squares2x2;
  }

  function getLabel(serviceType: string) {
    return serviceLabels[serviceType.toLowerCase()] ?? serviceType;
  }

  function close() {
    open = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="sidebar-backdrop" class:visible={open} onclick={close} role="presentation" aria-hidden="true"></div>

<nav class="sidebar" class:open aria-label="Service navigation" aria-hidden={!open}>
  <div class="sidebar-header">
    <span class="sidebar-title">Navigation</span>
    <button class="sidebar-close" onclick={close} aria-label="Close navigation">
      <XMark size="1.25rem" />
    </button>
  </div>

  <ul class="sidebar-nav">
    <li>
      <a
        href="/"
        class="sidebar-item"
        class:active={$page.url.pathname === '/'}
        onclick={close}
      >
        <Home size="1.25rem" />
        <span>Topology</span>
      </a>
    </li>

    {#if uniqueServices.length > 0}
      <li class="sidebar-section-label">Services</li>
      {#each uniqueServices as service}
        {@const Icon = getIcon(service.serviceType)}
        <li>
          <a
            href="/services/{service.serviceType}"
            class="sidebar-item"
            class:active={$page.url.pathname.startsWith('/services/' + service.serviceType)}
            onclick={close}
          >
            <Icon size="1.25rem" />
            <span>{getLabel(service.serviceType)}</span>
            {#if !service.enabled}
              <span class="disabled-badge">off</span>
            {/if}
          </a>
        </li>
      {/each}
    {/if}
  </ul>
</nav>

<style lang="scss">
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 199;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;

    &.visible {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 16rem;
    background: var(--theme-background);
    border-right: 1px solid var(--theme-border);
    z-index: 200;
    display: flex;
    flex-direction: column;
    transform: translateX(-100%);
    will-change: transform;
    transition: transform 0.25s ease;
    overflow-y: auto;

    &.open {
      transform: translateX(0);
    }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    height: var(--header-height);
    border-bottom: 1px solid var(--theme-border);
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sidebar-close {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-text-muted);
    padding: 0.25rem;
    border-radius: var(--rounded-lg);
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--theme-surface);
      color: var(--theme-text);
    }
  }

  .sidebar-nav {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0;
    flex: 1;
  }

  .sidebar-section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.75rem 1rem 0.25rem;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    color: var(--theme-text-muted);
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--theme-surface);
      color: var(--theme-text);
    }

    &.active {
      background: var(--theme-surface);
      color: var(--theme-primary);
    }
  }

  .disabled-badge {
    margin-left: auto;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: var(--rounded-full);
    background: var(--badge-muted-bg);
    color: var(--badge-muted-text);
    border: 1px solid var(--badge-muted-border);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
