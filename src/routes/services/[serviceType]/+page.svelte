<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const serviceNames: Record<string, string> = {
    nats: 'NATS',
    graphql: 'GraphQL',
    web: 'Web UI',
    ethernetip: 'EtherNet/IP',
    mqtt: 'MQTT',
    plc: 'PLC',
    network: 'Network',
  };

  const serviceDescriptions: Record<string, string> = {
    nats: 'Central message bus for inter-service communication',
    graphql: 'GraphQL API gateway for the tentacle platform',
    web: 'Web-based management interface',
    ethernetip: 'EtherNet/IP scanner for Allen-Bradley/Rockwell PLCs',
    mqtt: 'MQTT Sparkplug B bridge for publishing PLC data',
    plc: 'PLC runtime project',
    network: 'Network interface monitoring and configuration management',
  };

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  const isRunning = $derived((data.instances?.length ?? 0) > 0);
  const description = $derived(
    serviceDescriptions[data.serviceType] ?? 'Tentacle service'
  );
</script>

<div class="service-overview">
  <div class="status-header">
    <div class="status-info">
      <h1>{serviceNames[data.serviceType] || data.serviceType}</h1>
      <p class="description">{description}</p>
    </div>
    <span class="status-badge" class:running={isRunning} class:stopped={!isRunning}>
      {isRunning ? 'Running' : 'Stopped'}
    </span>
  </div>

  {#if data.error}
    <div class="info-box error">
      <p>{data.error}</p>
    </div>
  {/if}

  {#if (data.instances?.length ?? 0) > 0}
    <section class="section">
      <h2>Instances</h2>
      <div class="instances">
        {#each data.instances as instance}
          <div class="card">
            <div class="card-header">
              <span class="instance-id">{instance.moduleId}</span>
              <span class="status-dot running"></span>
            </div>
            <div class="card-body">
              <div class="detail-row">
                <span class="label">Uptime</span>
                <span class="value">{formatUptime(instance.uptime)}</span>
              </div>
              <div class="detail-row">
                <span class="label">Started</span>
                <span class="value">{formatDate(instance.startedAt)}</span>
              </div>
              {#if instance.version}
                <div class="detail-row">
                  <span class="label">Version</span>
                  <span class="value">{instance.version}</span>
                </div>
              {/if}
              {#if instance.metadata}
                {#each Object.entries(instance.metadata) as [key, value]}
                  <div class="detail-row">
                    <span class="label">{key}</span>
                    <span class="value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {:else if !data.error}
    <div class="info-box">
      <p>No active instances of this service found.</p>
    </div>
  {/if}
</div>

<style lang="scss">
  .service-overview {
    padding: 2rem;
    max-width: 800px;
  }

  .status-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  .status-info {
    h1 { font-size: 1.5rem; font-weight: 600; color: var(--theme-text); margin: 0; }
    .description { margin: 0.25rem 0 0; color: var(--theme-text-muted); font-size: 0.875rem; }
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--rounded-full);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    &.running {
      background: color-mix(in srgb, var(--color-green-500, #22c55e) 15%, transparent);
      color: var(--color-green-500, #22c55e);
    }
    &.stopped {
      background: color-mix(in srgb, var(--theme-text-muted) 15%, transparent);
      color: var(--theme-text-muted);
    }
  }

  .section {
    margin-bottom: 1.5rem;
    h2 {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--theme-text-muted);
      margin: 0 0 0.75rem;
    }
  }

  .card {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--theme-border);
    background: color-mix(in srgb, var(--theme-surface) 50%, var(--theme-background));
  }

  .instance-id {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8125rem;
    color: var(--theme-text);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    &.running {
      background: var(--color-green-500, #22c55e);
      box-shadow: 0 0 6px var(--color-green-500, #22c55e);
    }
  }

  .card-body {
    padding: 0.75rem 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
    &:not(:last-child) {
      border-bottom: 1px solid color-mix(in srgb, var(--theme-border) 50%, transparent);
    }
  }

  .label {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .value {
    font-size: 0.8125rem;
    color: var(--theme-text);
  }

  .instances {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info-box {
    padding: 1rem;
    border-radius: var(--rounded-lg);
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    margin-bottom: 1.5rem;
    p { margin: 0; font-size: 0.875rem; color: var(--theme-text-muted); }
    &.error {
      border-color: var(--color-red-500, #ef4444);
      display: flex;
      align-items: center;
      justify-content: space-between;
      p { color: var(--color-red-500, #ef4444); }
    }
  }
</style>
