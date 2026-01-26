<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { graphql } from '$lib/graphql/client';
  import NetworkTopology from '$lib/components/NetworkTopology.svelte';

  interface Service {
    serviceType: string;
    instanceId: string;
    projectId: string;
    uptime: number;
    metadata?: Record<string, unknown>;
  }

  interface Device {
    id: string;
    host: string;
    port: number;
    enabled: boolean;
  }

  const projectId = $derived($page.params.projectId);

  let services = $state<Service[]>([]);
  let devices = $state<Device[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const result = await graphql<{
        services: Service[];
        devices: Device[];
      }>(`
        query($projectId: String!) {
          services(projectId: $projectId) {
            serviceType
            instanceId
            projectId
            uptime
            metadata
          }
          devices(projectId: $projectId) {
            id
            host
            port
            enabled
          }
        }
      `, { projectId: $page.params.projectId });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        services = result.data.services;
        devices = result.data.devices;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load project data';
    }
    loading = false;
  });

  const isConnected = $derived(services.length > 0);
</script>

<div class="page">
  <header class="page-header">
    <h1>{projectId}</h1>
    {#if loading}
      <span class="status status-loading">Loading...</span>
    {:else if isConnected}
      <span class="status status-connected">Connected</span>
    {:else}
      <span class="status status-disconnected">No Services</span>
    {/if}
  </header>

  <div class="content">
    {#if loading}
      <section class="topology-section">
        <h2>System Topology</h2>
        <div class="topology-loading">
          <div class="spinner"></div>
          <p>Loading topology...</p>
        </div>
      </section>
    {:else if error}
      <div class="info-box error">
        <h3>Error Loading Project</h3>
        <p>{error}</p>
      </div>
    {:else}
      <section class="topology-section">
        <h2>System Topology</h2>
        <p class="topology-hint">Click on a service or device to configure it</p>
        <NetworkTopology {projectId} {services} {devices} />
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

  .status-loading {
    background: var(--theme-surface);
    color: var(--theme-text-muted);
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

  .topology-loading {
    width: 100%;
    min-height: 300px;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--theme-border);
      border-top-color: var(--theme-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    p {
      font-size: 0.875rem;
      color: var(--theme-text-muted);
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
