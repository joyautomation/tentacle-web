<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { graphql, subscribe } from '$lib/graphql/client';
  import VariableTree from '$lib/components/VariableTree.svelte';

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

  interface Variable {
    projectId: string;
    deviceId: string | null;
    variableId: string;
    value: unknown;
    datatype: string;
    quality: string;
    source: string;
    lastUpdated: string;
  }

  interface DeadBandConfig {
    value: number;
    maxTime: number | null;
  }

  interface MqttVariableEntry {
    variableId: string;
    enabled: boolean;
    deadband: DeadBandConfig | null;
  }

  interface MqttConfig {
    defaults: {
      deadband: DeadBandConfig;
    };
    variables: MqttVariableEntry[];
    enabledCount: number;
  }

  interface BrowseResult {
    browseId: string;
    variables: Variable[] | null;
  }

  interface BrowseProgress {
    browseId: string;
    projectId: string;
    deviceId: string;
    phase: string;
    totalTags: number;
    completedTags: number;
    errorCount: number;
    message: string | null;
    percentComplete: number;
  }

  const projectId = $derived($page.params.projectId);
  const deviceId = $derived($page.params.deviceId);

  let device = $state<Device | null>(null);
  let variables = $state<Variable[]>([]);
  let mqttConfig = $state<MqttConfig | null>(null);
  let loading = $state(true);
  let browsing = $state(false);
  let error = $state<string | null>(null);

  // Browse progress state
  let browseProgress = $state<BrowseProgress | null>(null);
  let unsubscribeBrowse: (() => void) | null = null;

  // Edit device modal
  let showEditModal = $state(false);
  let saving = $state(false);
  let editDevice = $state({
    host: '',
    port: 44818,
    type: 'rockwell',
    slot: 0,
    scanRate: 1000,
    enabled: true,
  });

  async function loadDevice() {
    loading = true;
    error = null;
    try {
      const result = await graphql<{ device: Device | null }>(`
        query($projectId: String!, $deviceId: String!) {
          device(projectId: $projectId, deviceId: $deviceId) {
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
      `, { projectId: $page.params.projectId, deviceId: $page.params.deviceId });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data?.device) {
        device = result.data.device;
        editDevice = {
          host: device.host,
          port: device.port,
          type: device.type,
          slot: device.slot ?? 0,
          scanRate: device.scanRate,
          enabled: device.enabled,
        };
      } else {
        error = 'Device not found';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load device';
    }
    loading = false;
  }

  async function updateDevice() {
    if (!device) return;

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
        deviceId: $page.params.deviceId,
        input: {
          host: editDevice.host,
          port: editDevice.port,
          type: editDevice.type,
          slot: editDevice.type === 'rockwell' ? editDevice.slot : null,
          scanRate: editDevice.scanRate,
          enabled: editDevice.enabled,
        },
      });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        device = result.data.upsertDevice;
        showEditModal = false;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update device';
    }
    saving = false;
  }

  async function browseDeviceTags() {
    browsing = true;
    error = null;
    browseProgress = null;

    // Clean up any existing subscription
    if (unsubscribeBrowse) {
      unsubscribeBrowse();
      unsubscribeBrowse = null;
    }

    try {
      // Start async browse to get browseId
      const result = await graphql<{ browseTags: BrowseResult }>(`
        mutation($projectId: String!, $plcId: String, $async: Boolean) {
          browseTags(projectId: $projectId, plcId: $plcId, async: $async) {
            browseId
            variables {
              projectId
              deviceId
              variableId
              value
              datatype
              quality
              source
              lastUpdated
            }
          }
        }
      `, {
        projectId: $page.params.projectId,
        plcId: $page.params.deviceId,
        async: true,
      });

      if (result.errors) {
        error = result.errors[0].message;
        browsing = false;
        return;
      }

      if (!result.data?.browseTags.browseId) {
        error = 'Failed to start browse operation';
        browsing = false;
        return;
      }

      const browseId = result.data.browseTags.browseId;

      // Subscribe to progress updates
      unsubscribeBrowse = subscribe<{ browseProgress: BrowseProgress }>(
        `subscription($browseId: String!) {
          browseProgress(browseId: $browseId) {
            browseId
            projectId
            deviceId
            phase
            totalTags
            completedTags
            errorCount
            message
            percentComplete
          }
        }`,
        { browseId },
        (data) => {
          browseProgress = data.browseProgress;

          // When completed, load the final variables
          if (data.browseProgress.phase === 'completed') {
            loadVariables().then(() => {
              browsing = false;
              browseProgress = null;
            });
            if (unsubscribeBrowse) {
              unsubscribeBrowse();
              unsubscribeBrowse = null;
            }
          } else if (data.browseProgress.phase === 'failed') {
            error = data.browseProgress.message || 'Browse failed';
            browsing = false;
            browseProgress = null;
            if (unsubscribeBrowse) {
              unsubscribeBrowse();
              unsubscribeBrowse = null;
            }
          }
        },
        (err) => {
          error = err.message;
          browsing = false;
          browseProgress = null;
        }
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to browse tags';
      browsing = false;
      browseProgress = null;
    }
  }

  // Load variables on mount (if service is running, we might already have them)
  async function loadVariables() {
    try {
      const result = await graphql<{ variables: Variable[] }>(`
        query($projectId: String!) {
          variables(projectId: $projectId) {
            projectId
            deviceId
            variableId
            value
            datatype
            quality
            source
            lastUpdated
          }
        }
      `, { projectId: $page.params.projectId });

      if (result.data) {
        // Filter variables to only show those from this device
        // (deviceId may be null if services haven't been restarted yet)
        variables = result.data.variables.filter(v =>
          v.deviceId === $page.params.deviceId || v.deviceId === null
        );
      }
    } catch {
      // Variables may not be available yet - that's OK
    }
  }

  // Load MQTT configuration for the project
  async function loadMqttConfig() {
    try {
      const result = await graphql<{ mqttConfig: MqttConfig }>(`
        query($projectId: String!) {
          mqttConfig(projectId: $projectId) {
            defaults {
              deadband {
                value
                maxTime
              }
            }
            variables {
              variableId
              enabled
              deadband {
                value
                maxTime
              }
            }
            enabledCount
          }
        }
      `, { projectId: $page.params.projectId });

      if (result.data) {
        mqttConfig = result.data.mqttConfig;
      }
    } catch {
      // MQTT config may not be available - that's OK
    }
  }

  // Handle MQTT config changes from VariableTree
  function handleMqttChange() {
    loadMqttConfig();
  }

  onMount(() => {
    loadDevice();
    loadVariables();
    loadMqttConfig();
  });
</script>

<div class="page">
  <header class="page-header">
    <div class="breadcrumb">
      <a href="/projects/{projectId}/devices">Devices</a>
      <span>/</span>
      <span>{deviceId}</span>
    </div>
    <div class="header-row">
      <div>
        <h2>{deviceId}</h2>
        {#if device}
          <p class="subtitle">{device.host}:{device.port} - {device.type}</p>
        {/if}
      </div>
      {#if device}
        <button class="secondary" onclick={() => showEditModal = true}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit Device
        </button>
      {/if}
    </div>
  </header>

  <div class="content">
    {#if error}
      <div class="info-box error">
        <p>{error}</p>
        <button onclick={() => error = null}>Dismiss</button>
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading device...</div>
    {:else if !device}
      <div class="info-box error">
        <h3>Device Not Found</h3>
        <p>The device "{deviceId}" does not exist.</p>
        <a href="/projects/{projectId}/devices">Back to Devices</a>
      </div>
    {:else}
      <!-- Device Info Card -->
      <div class="card device-info-card">
        <h3>Connection Settings</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Host</span>
            <span class="info-value mono">{device.host}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Port</span>
            <span class="info-value">{device.port}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Type</span>
            <span class="info-value">{device.type}</span>
          </div>
          {#if device.slot !== null}
            <div class="info-item">
              <span class="info-label">Slot</span>
              <span class="info-value">{device.slot}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="info-label">Scan Rate</span>
            <span class="info-value">{device.scanRate} ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="status status-{device.enabled ? 'connected' : 'disconnected'}">
              {device.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <!-- Tags Section -->
      <section class="tags-section">
        <header class="section-header">
          <h3>Tags {variables.length > 0 ? `(${variables.length})` : ''}</h3>
          <button class="secondary" onclick={browseDeviceTags} disabled={browsing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {browsing ? 'Browsing...' : 'Browse Tags'}
          </button>
        </header>

        {#if browsing}
          <div class="browse-loading">
            {#if browseProgress}
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {browseProgress.percentComplete}%"></div>
                </div>
                <div class="progress-text">
                  <span class="phase">{browseProgress.phase}</span>
                  <span class="counts">{browseProgress.completedTags}/{browseProgress.totalTags} tags ({browseProgress.percentComplete}%)</span>
                </div>
                {#if browseProgress.message}
                  <p class="progress-message">{browseProgress.message}</p>
                {/if}
                {#if browseProgress.errorCount > 0}
                  <p class="progress-errors">{browseProgress.errorCount} errors</p>
                {/if}
              </div>
            {:else}
              <div class="spinner"></div>
              <p>Starting browse operation...</p>
            {/if}
          </div>
        {:else if variables.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h4>No Tags Discovered</h4>
            <p>Click "Browse Tags" to discover available tags from this PLC.</p>
          </div>
        {:else}
          <VariableTree
            {variables}
            projectId={$page.params.projectId}
            {mqttConfig}
            onMqttChange={handleMqttChange}
          />
        {/if}
      </section>
    {/if}
  </div>
</div>

<!-- Edit Device Modal -->
{#if showEditModal}
  <div class="modal-backdrop" onclick={() => showEditModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Edit Device</h3>
        <button class="icon-btn" onclick={() => showEditModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <form onsubmit={(e) => { e.preventDefault(); updateDevice(); }}>
        <div class="form-group">
          <label for="edit-host">Host / IP Address</label>
          <input id="edit-host" type="text" bind:value={editDevice.host} required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="edit-port">Port</label>
            <input id="edit-port" type="number" bind:value={editDevice.port} min="1" max="65535" />
          </div>
          <div class="form-group">
            <label for="edit-type">Type</label>
            <select id="edit-type" bind:value={editDevice.type}>
              <option value="rockwell">Rockwell</option>
              <option value="generic-cip">Generic CIP</option>
            </select>
          </div>
        </div>

        {#if editDevice.type === 'rockwell'}
          <div class="form-group">
            <label for="edit-slot">Slot Number</label>
            <input id="edit-slot" type="number" bind:value={editDevice.slot} min="0" max="15" />
          </div>
        {/if}

        <div class="form-group">
          <label for="edit-scanrate">Scan Rate (ms)</label>
          <input id="edit-scanrate" type="number" bind:value={editDevice.scanRate} min="100" max="60000" />
        </div>

        <div class="form-group checkbox">
          <label>
            <input type="checkbox" bind:checked={editDevice.enabled} />
            <span>Enable device</span>
          </label>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showEditModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
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

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--theme-text-muted);
    margin-bottom: 0.5rem;

    a {
      color: var(--theme-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .subtitle {
    color: var(--theme-text-muted);
    margin-top: 0.25rem;
  }

  .device-info-card {
    margin-bottom: 2rem;

    h3 {
      font-size: 1rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--theme-border);
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.9375rem;

    &.mono {
      font-family: monospace;
    }
  }

  .tags-section {
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;

    h3 {
      font-size: 1.125rem;
    }
  }

  .browse-loading {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--theme-border);
      border-top-color: var(--theme-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    p {
      color: var(--theme-text);
      margin: 0;
    }

    .hint {
      font-size: 0.875rem;
      color: var(--theme-text-muted);
      margin-top: 0.5rem;
    }

    .progress-container {
      max-width: 400px;
      margin: 0 auto;
    }

    .progress-bar {
      height: 8px;
      background: var(--theme-border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 1rem;
    }

    .progress-fill {
      height: 100%;
      background: var(--theme-primary);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .phase {
      text-transform: capitalize;
      color: var(--theme-text);
      font-weight: 500;
    }

    .counts {
      color: var(--theme-text-muted);
      font-family: monospace;
    }

    .progress-message {
      font-size: 0.875rem;
      color: var(--theme-text-muted);
    }

    .progress-errors {
      font-size: 0.875rem;
      color: var(--red-500);
      margin-top: 0.5rem;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);

    .empty-icon {
      color: var(--theme-text-muted);
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    h4 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--theme-text);
      margin: 0 0 0.5rem;
    }

    p {
      color: var(--theme-text-muted);
      margin: 0;
    }
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

    &.checkbox, &.checkbox-inline {
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

    &.checkbox-inline {
      display: flex;
      align-items: flex-end;
      padding-bottom: 0.5rem;
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

    a {
      color: var(--theme-primary);
    }
  }
</style>
