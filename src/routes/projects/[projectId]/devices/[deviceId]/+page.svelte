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

  interface Tag {
    id: string;
    deviceId: string;
    address: string;
    datatype: string | null;
    writable: boolean;
    deadbandValue: number | null;
    deadbandMaxTime: number | null;
    disableRBE: boolean | null;
  }

  const projectId = $derived($page.params.projectId);
  const deviceId = $derived($page.params.deviceId);

  let device = $state<Device | null>(null);
  let tags = $state<Tag[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Edit device modal
  let showEditModal = $state(false);
  let editDevice = $state({
    host: '',
    port: 44818,
    type: 'rockwell',
    slot: 0,
    scanRate: 1000,
    enabled: true,
  });

  // Add tag modal
  let showAddTagModal = $state(false);
  let saving = $state(false);
  let newTag = $state({
    address: '',
    datatype: '',
    writable: false,
    deadbandValue: null as number | null,
    deadbandMaxTime: null as number | null,
    disableRBE: false,
  });

  async function loadDevice() {
    loading = true;
    error = null;
    try {
      const [deviceResult, tagsResult] = await Promise.all([
        graphql<{ device: Device | null }>(`
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
        `, { projectId: $page.params.projectId, deviceId: $page.params.deviceId }),
        graphql<{ tags: Tag[] }>(`
          query($projectId: String!, $deviceId: String!) {
            tags(projectId: $projectId, deviceId: $deviceId) {
              id
              deviceId
              address
              datatype
              writable
              deadbandValue
              deadbandMaxTime
              disableRBE
            }
          }
        `, { projectId: $page.params.projectId, deviceId: $page.params.deviceId }),
      ]);

      if (deviceResult.errors) {
        error = deviceResult.errors[0].message;
      } else if (deviceResult.data?.device) {
        device = deviceResult.data.device;
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

      if (tagsResult.data) {
        tags = tagsResult.data.tags;
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

  async function addTag() {
    if (!newTag.address) {
      error = 'Tag address is required';
      return;
    }

    saving = true;
    error = null;

    // Generate tag ID from address
    const tagId = newTag.address.replace(/\./g, '_');

    try {
      const result = await graphql<{ upsertTag: Tag }>(`
        mutation($projectId: String!, $deviceId: String!, $tagId: String!, $input: TagInput!) {
          upsertTag(projectId: $projectId, deviceId: $deviceId, tagId: $tagId, input: $input) {
            id
            deviceId
            address
            datatype
            writable
            deadbandValue
            deadbandMaxTime
            disableRBE
          }
        }
      `, {
        projectId: $page.params.projectId,
        deviceId: $page.params.deviceId,
        tagId,
        input: {
          address: newTag.address,
          datatype: newTag.datatype || null,
          writable: newTag.writable,
          deadbandValue: newTag.deadbandValue,
          deadbandMaxTime: newTag.deadbandMaxTime,
          disableRBE: newTag.disableRBE,
        },
      });

      if (result.errors) {
        error = result.errors[0].message;
      } else if (result.data) {
        tags = [...tags, result.data.upsertTag];
        showAddTagModal = false;
        resetNewTag();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add tag';
    }
    saving = false;
  }

  async function deleteTag(tagId: string) {
    if (!confirm(`Delete tag "${tagId}"?`)) {
      return;
    }

    try {
      const result = await graphql<{ deleteTag: boolean }>(`
        mutation($projectId: String!, $deviceId: String!, $tagId: String!) {
          deleteTag(projectId: $projectId, deviceId: $deviceId, tagId: $tagId)
        }
      `, {
        projectId: $page.params.projectId,
        deviceId: $page.params.deviceId,
        tagId,
      });

      if (result.errors) {
        error = result.errors[0].message;
      } else {
        tags = tags.filter(t => t.id !== tagId);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete tag';
    }
  }

  function resetNewTag() {
    newTag = {
      address: '',
      datatype: '',
      writable: false,
      deadbandValue: null,
      deadbandMaxTime: null,
      disableRBE: false,
    };
  }

  onMount(() => {
    loadDevice();
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
          <h3>Tags ({tags.length})</h3>
          <button class="primary" onclick={() => showAddTagModal = true}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Tag
          </button>
        </header>

        {#if tags.length === 0}
          <div class="empty-state">
            <p>No tags configured. Add tags to start polling data from this device.</p>
            <button class="primary" onclick={() => showAddTagModal = true}>Add Tag</button>
          </div>
        {:else}
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Datatype</th>
                  <th>Writable</th>
                  <th>Deadband</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each tags as tag (tag.id)}
                  <tr>
                    <td class="tag-address">{tag.address}</td>
                    <td>{tag.datatype || '-'}</td>
                    <td>
                      {#if tag.writable}
                        <span class="badge">Yes</span>
                      {:else}
                        <span class="badge muted">No</span>
                      {/if}
                    </td>
                    <td>
                      {#if tag.deadbandValue !== null}
                        {tag.deadbandValue}{tag.deadbandMaxTime ? ` / ${tag.deadbandMaxTime}ms` : ''}
                      {:else}
                        -
                      {/if}
                    </td>
                    <td class="actions">
                      <button class="icon-btn danger" onclick={() => deleteTag(tag.id)} title="Delete tag">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
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

<!-- Add Tag Modal -->
{#if showAddTagModal}
  <div class="modal-backdrop" onclick={() => showAddTagModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Add Tag</h3>
        <button class="icon-btn" onclick={() => showAddTagModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <form onsubmit={(e) => { e.preventDefault(); addTag(); }}>
        <div class="form-group">
          <label for="tag-address">Tag Address</label>
          <input
            id="tag-address"
            type="text"
            bind:value={newTag.address}
            placeholder="e.g., Motor_Speed, Array[0], UDT.Member"
            required
          />
          <span class="form-hint">The tag name in the PLC</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="tag-datatype">Datatype (optional)</label>
            <select id="tag-datatype" bind:value={newTag.datatype}>
              <option value="">Auto-detect</option>
              <option value="BOOL">BOOL</option>
              <option value="SINT">SINT</option>
              <option value="INT">INT</option>
              <option value="DINT">DINT</option>
              <option value="LINT">LINT</option>
              <option value="REAL">REAL</option>
              <option value="LREAL">LREAL</option>
              <option value="STRING">STRING</option>
            </select>
          </div>

          <div class="form-group checkbox-inline">
            <label>
              <input type="checkbox" bind:checked={newTag.writable} />
              <span>Writable</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="tag-deadband">Deadband Value</label>
            <input
              id="tag-deadband"
              type="number"
              step="any"
              bind:value={newTag.deadbandValue}
              placeholder="Optional"
            />
          </div>

          <div class="form-group">
            <label for="tag-maxtime">Max Time (ms)</label>
            <input
              id="tag-maxtime"
              type="number"
              bind:value={newTag.deadbandMaxTime}
              placeholder="Optional"
            />
          </div>
        </div>

        <div class="form-group checkbox">
          <label>
            <input type="checkbox" bind:checked={newTag.disableRBE} />
            <span>Disable RBE (Report by Exception)</span>
          </label>
          <span class="form-hint">Always publish values, even when unchanged</span>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showAddTagModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add Tag'}
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

  .table-container {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    overflow: hidden;
  }

  table {
    margin: 0;
  }

  .tag-address {
    font-family: monospace;
    font-size: 0.875rem;
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: rgba(6, 182, 212, 0.1);
    color: var(--theme-primary);
    border-radius: var(--rounded-full);
    font-size: 0.75rem;

    &.muted {
      background: var(--theme-surface-hover);
      color: var(--theme-text-muted);
    }
  }

  .actions {
    text-align: right;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);

    p {
      color: var(--theme-text-muted);
      margin-bottom: 1rem;
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
