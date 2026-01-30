<script lang="ts">
  import type { PageData } from './$types';
  import NetworkTopology from '$lib/components/NetworkTopology.svelte';

  let { data }: { data: PageData } = $props();

  const isConnected = $derived(data.services.length > 0);
</script>

<div class="page">
  <header class="page-header">
    <h1>{data.projectId}</h1>
    {#if isConnected}
      <span class="status status-connected">Connected</span>
    {:else}
      <span class="status status-disconnected">No Services</span>
    {/if}
  </header>

  <div class="content">
    {#if data.error}
      <div class="info-box error">
        <h3>Error Loading Project</h3>
        <p>{data.error}</p>
      </div>
    {:else}
      <section class="topology-section">
        <h2>System Topology</h2>
        <p class="topology-hint">Click on a service or device to configure it</p>
        <NetworkTopology projectId={data.projectId} services={data.services} devices={data.devices} />
      </section>
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
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .status-disconnected {
    background: var(--color-red-500, #ef4444);
    color: white;
  }

  .topology-section {
    h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--theme-text);
    }

    .topology-hint {
      font-size: 0.8125rem;
      color: var(--theme-text-muted);
      margin-bottom: 1rem;
    }
  }

</style>
