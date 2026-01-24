<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { graphql } from '$lib/graphql/client';

  interface Device {
    id: string;
    projectId: string;
    host: string;
    port: number;
    type: string;
    slot: number | null;
    scanRate: number;
    enabled: boolean;
  }

  const projectId = $derived($page.params.projectId);

  let devices = $state<Device[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Add device modal state
  let showAddModal = $state(false);
  let saving = $state(false);
  let newDevice = $state({
    id: '',
    host: '',
    port: 44818,
    type: 'rockwell',
    slot: 0,
    scanRate: 1000,
    enabled: true,
  });

  async function loadDevices() {
    loading = true;
    error = null;
    try {
      const result = await graphql<{ devices: Device[] }>(`
        query($projectId: String!) {
          devices(projectId: $projectId) {
            id
            projectId
            host
            port
            type
            slot
            scanRate
            enabled
          }
        }
      `, { projectId: $page.params.projectId });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        devices = result.data.devices;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load devices';
    }
    loading = false;
  }

  async function addDevice() {
    if (!newDevice.id || !newDevice.host) {
      error = 'Device ID and host are required';
      return;
    }

    saving = true;
    error = null;

    try {
      const result = await graphql<{ upsertDevice: Device }>(`
        mutation($projectId: String!, $deviceId: String!, $input: DeviceInput!) {
          upsertDevice(projectId: $projectId, deviceId: $deviceId, input: $input) {
            id
            projectId
            host
            port
            type
            slot
            scanRate
            enabled
          }
        }
      `, {
        projectId: $page.params.projectId,
        deviceId: newDevice.id,
        input: {
          host: newDevice.host,
          port: newDevice.port,
          type: newDevice.type,
          slot: newDevice.type === 'rockwell' ? newDevice.slot : null,
          scanRate: newDevice.scanRate,
          enabled: newDevice.enabled,
        },
      });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        devices = [...devices, result.data.upsertDevice];
        showAddModal = false;
        resetNewDevice();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add device';
    }
    saving = false;
  }

  async function deleteDevice(deviceId: string) {
    if (!confirm(`Delete device "${deviceId}"? This will also delete all its tags.`)) {
      return;
    }

    try {
      const result = await graphql<{ deleteDevice: boolean }>(`
        mutation($projectId: String!, $deviceId: String!) {
          deleteDevice(projectId: $projectId, deviceId: $deviceId)
        }
      `, {
        projectId: $page.params.projectId,
        deviceId,
      });

      if (result.errors) {
        error = result.errors[0].message;
      } else {
        devices = devices.filter(d => d.id !== deviceId);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete device';
    }
  }

  function resetNewDevice() {
    newDevice = {
      id: '',
      host: '',
      port: 44818,
      type: 'rockwell',
      slot: 0,
      scanRate: 1000,
      enabled: true,
    };
  }

  onMount(() => {
    loadDevices();
  });
</script>

<div class="page">
  <header class="page-header">
    <div>
      <h2>Devices</h2>
      <p class="subtitle">Configure EtherNet/IP PLCs and their tags</p>
    </div>
    <button class="primary" onclick={() => showAddModal = true}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add Device
    </button>
  </header>

  <div class="content">
    {#if error}
      <div class="info-box error">
        <p>{error}</p>
        <button onclick={() => error = null}>Dismiss</button>
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading devices...</div>
    {:else if devices.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="6" width="20" height="12" rx="2"/>
            <circle cx="8" cy="12" r="2"/>
            <path d="M14 10h4M14 14h4"/>
          </svg>
        </div>
        <h3>No Devices Configured</h3>
        <p>Add your first EtherNet/IP device to start reading PLC data.</p>
        <button class="primary" onclick={() => showAddModal = true}>Add Device</button>
      </div>
    {:else}
      <div class="devices-list">
        {#each devices as device (device.id)}
          <div class="device-row">
            <a href="/projects/{projectId}/devices/{device.id}" class="device-link">
              <div class="device-info">
                <div class="device-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="6" width="20" height="12" rx="2"/>
                    <circle cx="8" cy="12" r="2"/>
                    <path d="M14 10h4M14 14h4"/>
                  </svg>
                </div>
                <div>
                  <h3>{device.id}</h3>
                  <span class="device-host">{device.host}:{device.port}</span>
                  <span class="device-type">{device.type}{device.slot !== null ? ` (slot ${device.slot})` : ''}</span>
                </div>
              </div>
            </a>
            <div class="device-actions">
              <span class="status status-{device.enabled ? 'connected' : 'disconnected'}">
                {device.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button class="icon-btn danger" onclick={() => deleteDevice(device.id)} title="Delete device">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showAddModal}
  <div class="modal-backdrop" onclick={() => showAddModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Add Device</h3>
        <button class="icon-btn" onclick={() => showAddModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <form onsubmit={(e) => { e.preventDefault(); addDevice(); }}>
        <div class="form-group">
          <label for="device-id">Device ID</label>
          <input
            id="device-id"
            type="text"
            bind:value={newDevice.id}
            placeholder="e.g., plc1, main-plc"
            required
          />
        </div>

        <div class="form-group">
          <label for="device-host">Host / IP Address</label>
          <input
            id="device-host"
            type="text"
            bind:value={newDevice.host}
            placeholder="e.g., 192.168.1.100"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="device-port">Port</label>
            <input
              id="device-port"
              type="number"
              bind:value={newDevice.port}
              min="1"
              max="65535"
            />
          </div>

          <div class="form-group">
            <label for="device-type">Type</label>
            <select id="device-type" bind:value={newDevice.type}>
              <option value="rockwell">Rockwell (Allen-Bradley)</option>
              <option value="generic-cip">Generic CIP</option>
            </select>
          </div>
        </div>

        {#if newDevice.type === 'rockwell'}
          <div class="form-group">
            <label for="device-slot">Slot Number</label>
            <input
              id="device-slot"
              type="number"
              bind:value={newDevice.slot}
              min="0"
              max="15"
            />
            <span class="form-hint">CPU slot in the rack (usually 0)</span>
          </div>
        {/if}

        <div class="form-group">
          <label for="device-scanrate">Scan Rate (ms)</label>
          <input
            id="device-scanrate"
            type="number"
            bind:value={newDevice.scanRate}
            min="100"
            max="60000"
          />
          <span class="form-hint">How often to poll tags</span>
        </div>

        <div class="form-group checkbox">
          <label>
            <input type="checkbox" bind:checked={newDevice.enabled} />
            <span>Enable device</span>
          </label>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showAddModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Device'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style lang="scss">
  .page {
    padding: 2rem;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .subtitle {
    color: var(--theme-text-muted);
    margin-top: 0.25rem;
  }

  .devices-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .device-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--theme-primary);
    }
  }

  .device-link {
    flex: 1;
    padding: 1rem 1.5rem;
    text-decoration: none;
    color: var(--theme-text);
  }

  .device-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    h3 {
      font-size: 1rem;
      margin-bottom: 0.125rem;
    }
  }

  .device-icon {
    width: 48px;
    height: 48px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: var(--rounded-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-primary);
  }

  .device-host {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
    font-family: monospace;
  }

  .device-type {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    margin-left: 0.5rem;
  }

  .device-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-right: 1rem;
  }

  .icon-btn {
    background: transparent;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: var(--theme-text-muted);
    border-radius: var(--rounded-md);
    transition: all 0.2s;

    &:hover {
      background: var(--theme-surface-hover);
      color: var(--theme-text);
    }

    &.danger:hover {
      background: rgba(239, 68, 68, 0.1);
      color: var(--red-500);
    }
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);

    h3 {
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }

    p {
      color: var(--theme-text-muted);
      margin-bottom: 1.5rem;
    }
  }

  .empty-icon {
    color: var(--theme-text-muted);
  }

  // Modal styles
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--theme-border);

    h3 {
      font-size: 1.125rem;
    }
  }

  form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
    }

    input, select {
      width: 100%;
      padding: 0.625rem 0.75rem;
      background: var(--theme-background);
      border: 1px solid var(--theme-border);
      border-radius: var(--rounded-lg);
      font-size: 0.875rem;
      color: var(--theme-text);

      &:focus {
        outline: none;
        border-color: var(--theme-primary);
      }
    }

    &.checkbox {
      label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
      }

      input[type="checkbox"] {
        width: auto;
      }
    }
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-hint {
    display: block;
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    margin-top: 0.25rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--theme-border);
  }

  .info-box.error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
</style>
