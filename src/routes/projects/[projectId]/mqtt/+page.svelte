<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { graphql } from '$lib/graphql/client';
  import type { PageData } from './$types';

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

  let { data }: { data: PageData } = $props();

  const projectId = $derived(data.projectId);

  // Data state - initialize from server data
  let mqttConfig = $state<MqttConfig | null>(data.mqttConfig);
  let error = $state<string | null>(data.error);
  let saving = $state(false);

  // Sync with server data when it changes
  $effect(() => {
    mqttConfig = data.mqttConfig;
    error = data.error;
  });

  // UI state
  let filterText = $state('');
  let showDefaultsModal = $state(false);
  let showEditModal = $state(false);
  let editingVariableId = $state<string | null>(null);
  let deadbandValue = $state(0);
  let deadbandMaxTime = $state<number | null>(null);

  // Get only enabled variables
  const enabledVariables = $derived(() => {
    if (!mqttConfig?.variables) return [];
    return mqttConfig.variables.filter(v => v.enabled);
  });

  // Filter enabled variables
  const filteredVariables = $derived(() => {
    const enabled = enabledVariables();
    if (!filterText.trim()) return enabled;
    const filter = filterText.toLowerCase();
    return enabled.filter(v => v.variableId.toLowerCase().includes(filter));
  });

  async function refreshData() {
    await invalidateAll();
  }

  function openDefaultsModal() {
    if (mqttConfig) {
      deadbandValue = mqttConfig.defaults.deadband.value;
      deadbandMaxTime = mqttConfig.defaults.deadband.maxTime;
    }
    showDefaultsModal = true;
  }

  function openEditModal(variableId: string) {
    editingVariableId = variableId;
    const entry = mqttConfig?.variables.find(v => v.variableId === variableId);
    if (entry?.deadband) {
      deadbandValue = entry.deadband.value;
      deadbandMaxTime = entry.deadband.maxTime;
    } else if (mqttConfig?.defaults.deadband) {
      deadbandValue = mqttConfig.defaults.deadband.value;
      deadbandMaxTime = mqttConfig.defaults.deadband.maxTime;
    }
    showEditModal = true;
  }

  async function applyDefaults() {
    saving = true;
    try {
      await graphql(`
        mutation($projectId: String!, $deadband: DeadBandInput!) {
          setMqttDefaults(projectId: $projectId, deadband: $deadband) {
            deadband {
              value
              maxTime
            }
          }
        }
      `, {
        projectId,
        deadband: {
          value: deadbandValue,
          maxTime: deadbandMaxTime
        }
      });
      await refreshData();
      showDefaultsModal = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to apply defaults';
    }
    saving = false;
  }

  async function applyVariableConfig() {
    if (!editingVariableId) return;
    saving = true;
    try {
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!, $config: MqttVariableConfigInput!) {
          enableMqttVariables(projectId: $projectId, variableIds: $variableIds, config: $config)
        }
      `, {
        projectId,
        variableIds: [editingVariableId],
        config: {
          enabled: true,
          deadband: {
            value: deadbandValue,
            maxTime: deadbandMaxTime
          }
        }
      });
      await refreshData();
      showEditModal = false;
      editingVariableId = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to apply config';
    }
    saving = false;
  }

  async function disableVariable(variableId: string) {
    saving = true;
    try {
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId, variableIds: [variableId] });
      await refreshData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to disable variable';
    }
    saving = false;
  }

  async function disableAll() {
    if (!mqttConfig?.variables) return;
    saving = true;
    try {
      const variableIds = mqttConfig.variables.filter(v => v.enabled).map(v => v.variableId);
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId, variableIds });
      await refreshData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to disable all';
    }
    saving = false;
  }

  // Format milliseconds to a readable string
  function formatMs(ms: number): string {
    if (ms >= 60000) {
      const mins = ms / 60000;
      return mins === Math.floor(mins) ? `${mins}m` : `${mins.toFixed(1)}m`;
    }
    if (ms >= 1000) {
      const secs = ms / 1000;
      return secs === Math.floor(secs) ? `${secs}s` : `${secs.toFixed(1)}s`;
    }
    return `${ms}ms`;
  }

  function getDeadbandDisplay(entry: MqttVariableEntry): { value: number; maxTime: string | null; isDefault: boolean } {
    if (entry.deadband) {
      return {
        value: entry.deadband.value,
        maxTime: entry.deadband.maxTime ? formatMs(entry.deadband.maxTime) : null,
        isDefault: false
      };
    } else if (mqttConfig?.defaults.deadband) {
      return {
        value: mqttConfig.defaults.deadband.value,
        maxTime: mqttConfig.defaults.deadband.maxTime ? formatMs(mqttConfig.defaults.deadband.maxTime) : null,
        isDefault: true
      };
    }
    return { value: 0, maxTime: null, isDefault: true };
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="header-left">
      <h2>MQTT Publishing</h2>
      {#if mqttConfig}
        <span class="enabled-count">
          {mqttConfig.enabledCount} variables enabled
        </span>
      {/if}
    </div>
    <div class="header-actions">
      <button class="btn btn-ghost" onclick={openDefaultsModal} disabled={saving}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Default Settings
      </button>
      {#if enabledVariables().length > 0}
        <button class="btn btn-secondary" onclick={disableAll} disabled={saving}>
          Disable All
        </button>
      {/if}
    </div>
  </header>

  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button onclick={() => error = null}>&times;</button>
    </div>
  {/if}

  <div class="info-box">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
    <p>
      Enable MQTT publishing for individual tags from the <strong>device tag tree</strong>.
      Use this page to manage currently enabled variables and adjust deadband settings.
    </p>
  </div>

  {#if enabledVariables().length > 0}
    <div class="toolbar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Filter variables..."
          bind:value={filterText}
        />
        {#if filterText}
          <button class="clear-btn" onclick={() => filterText = ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="content">
    {#if enabledVariables().length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        </div>
        <h3>No MQTT Variables Configured</h3>
        <p>Enable MQTT publishing for tags from each device's tag tree.</p>
        <a href="/projects/{projectId}/devices" class="btn btn-primary">
          Go to Devices
        </a>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Variable ID</th>
              <th>Deadband</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredVariables() as entry (entry.variableId)}
              {@const deadband = getDeadbandDisplay(entry)}
              <tr>
                <td class="variable-id">{entry.variableId}</td>
                <td class="deadband-col">
                  <button
                    class="deadband-btn"
                    class:is-default={deadband.isDefault}
                    onclick={() => openEditModal(entry.variableId)}
                    disabled={saving}
                    title={deadband.isDefault ? 'Using default deadband settings - click to customize' : 'Click to edit deadband settings'}
                  >
                    <span class="deadband-value">{deadband.value}</span>
                    {#if deadband.maxTime}
                      <span class="deadband-separator">/</span>
                      <span class="deadband-time">{deadband.maxTime}</span>
                    {/if}
                    {#if deadband.isDefault}
                      <span class="default-indicator" title="Using defaults">*</span>
                    {/if}
                  </button>
                </td>
                <td class="col-actions">
                  <button
                    class="btn btn-sm btn-ghost danger"
                    onclick={() => disableVariable(entry.variableId)}
                    disabled={saving}
                    title="Disable MQTT for this variable"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    Disable
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="table-footer">
          Showing {filteredVariables().length} of {enabledVariables().length} enabled variables
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Default Settings Modal -->
{#if showDefaultsModal}
  <div class="modal-backdrop" onclick={() => showDefaultsModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Default Deadband Settings</h3>
        <button class="icon-btn" onclick={() => showDefaultsModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <p class="modal-desc">
        These defaults apply to variables that don't have custom deadband settings.
      </p>

      <form onsubmit={(e) => { e.preventDefault(); applyDefaults(); }}>
        <div class="form-group">
          <label for="default-deadband">Deadband Value</label>
          <input
            id="default-deadband"
            type="number"
            step="0.01"
            min="0"
            bind:value={deadbandValue}
          />
          <span class="help-text">Minimum change required to publish (0 = publish all changes)</span>
        </div>

        <div class="form-group">
          <label for="default-maxtime">Max Time (ms)</label>
          <input
            id="default-maxtime"
            type="number"
            step="1000"
            min="0"
            bind:value={deadbandMaxTime}
            placeholder="Optional"
          />
          <span class="help-text">Force publish after this time regardless of deadband</span>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showDefaultsModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Apply'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Edit Variable Modal -->
{#if showEditModal}
  <div class="modal-backdrop" onclick={() => showEditModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Configure Deadband</h3>
        <button class="icon-btn" onclick={() => showEditModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <p class="modal-desc">
        Configure deadband for <code>{editingVariableId}</code>
      </p>

      <form onsubmit={(e) => { e.preventDefault(); applyVariableConfig(); }}>
        <div class="form-group">
          <label for="edit-deadband">Deadband Value</label>
          <input
            id="edit-deadband"
            type="number"
            step="0.01"
            min="0"
            bind:value={deadbandValue}
          />
          <span class="help-text">Minimum change required to publish (0 = publish all changes)</span>
        </div>

        <div class="form-group">
          <label for="edit-maxtime">Max Time (ms)</label>
          <input
            id="edit-maxtime"
            type="number"
            step="1000"
            min="0"
            bind:value={deadbandMaxTime}
            placeholder="Optional"
          />
          <span class="help-text">Force publish after this time regardless of deadband</span>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showEditModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Apply'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style lang="scss">
  .page {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;

    h2 {
      margin: 0;
    }
  }

  .enabled-count {
    font-size: 0.875rem;
    color: var(--theme-text-muted);
    padding: 0.25rem 0.75rem;
    background: var(--theme-surface);
    border-radius: var(--rounded-full);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--rounded-lg);
    color: var(--red-500);

    button {
      background: none;
      border: none;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
  }

  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: var(--rounded-lg);
    color: var(--theme-text);

    svg {
      color: var(--theme-primary);
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    flex: 1;
    max-width: 400px;

    svg {
      color: var(--theme-text-muted);
      flex-shrink: 0;
    }

    input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      font-size: 0.875rem;
      color: var(--theme-text);

      &::placeholder {
        color: var(--theme-text-muted);
      }
    }

    .clear-btn {
      background: none;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: var(--theme-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--rounded-sm);

      &:hover {
        color: var(--theme-text);
        background: var(--theme-surface-hover);
      }
    }
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: var(--rounded-lg);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.btn-sm {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
    }

    &.btn-primary {
      background: var(--theme-primary);
      color: white;

      &:hover:not(:disabled) {
        filter: brightness(1.1);
      }
    }

    &.btn-secondary {
      background: var(--theme-surface);
      color: var(--theme-text);
      border: 1px solid var(--theme-border);

      &:hover:not(:disabled) {
        background: var(--theme-surface-hover);
      }
    }

    &.btn-ghost {
      background: transparent;
      color: var(--theme-text-muted);

      &:hover:not(:disabled) {
        background: var(--theme-surface);
        color: var(--theme-text);
      }

      &.danger:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.1);
        color: var(--red-500);
      }
    }
  }

  .content {
    flex: 1;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    color: var(--theme-text-muted);
  }

  .empty-state {
    .empty-icon {
      color: var(--theme-text-muted);
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    h3 {
      margin: 0 0 0.5rem;
      color: var(--theme-text);
    }

    p {
      margin: 0 0 1.5rem;
    }
  }

  .table-container {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }

  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--theme-border);
  }

  th {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted);
    background: var(--theme-bg);

    &:first-child {
      border-top-left-radius: var(--rounded-xl);
    }

    &:last-child {
      border-top-right-radius: var(--rounded-xl);
    }
  }

  tbody tr {
    transition: background 0.1s;

    &:hover {
      background: var(--theme-surface-hover);
    }

    &:last-child td {
      border-bottom: none;
    }
  }

  .variable-id {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .deadband-col {
    width: 180px;
  }

  .deadband-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    background: rgba(6, 182, 212, 0.15);
    color: var(--theme-primary);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: var(--rounded-full);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background: rgba(6, 182, 212, 0.25);
      border-color: var(--theme-primary);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.is-default {
      background: var(--theme-surface-hover);
      border-color: var(--theme-border);
      color: var(--theme-text-muted);

      &:hover:not(:disabled) {
        background: var(--theme-surface);
        border-color: var(--theme-text-muted);
        color: var(--theme-text);
      }

      .deadband-value,
      .deadband-time {
        color: var(--theme-text-muted);
      }
    }

    .deadband-value {
      font-family: monospace;
      font-weight: 600;
    }

    .deadband-separator {
      opacity: 0.5;
      font-size: 0.625rem;
    }

    .deadband-time {
      font-family: monospace;
      font-size: 0.625rem;
      opacity: 0.8;
    }

    .default-indicator {
      font-weight: 700;
      font-size: 0.75rem;
      opacity: 0.6;
      margin-left: -0.125rem;
    }
  }

  .col-actions {
    width: 100px;
    text-align: right;
  }

  .table-footer {
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
    border-top: 1px solid var(--theme-border);
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
    max-width: 400px;
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
      margin: 0;
      font-size: 1.125rem;
    }
  }

  .modal-desc {
    padding: 0 1.5rem;
    margin: 1rem 0;
    font-size: 0.875rem;
    color: var(--theme-text-muted);

    code {
      font-family: monospace;
      background: var(--theme-bg);
      padding: 0.125rem 0.375rem;
      border-radius: var(--rounded-sm);
      color: var(--theme-text);
    }
  }

  form {
    padding: 0 1.5rem 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
    }

    input {
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

    .help-text {
      display: block;
      font-size: 0.75rem;
      color: var(--theme-text-muted);
      margin-top: 0.25rem;
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--theme-border);

    button {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: var(--rounded-lg);
      cursor: pointer;
      transition: all 0.15s;

      &[type="button"] {
        background: transparent;
        border: 1px solid var(--theme-border);
        color: var(--theme-text);

        &:hover {
          background: var(--theme-surface-hover);
        }
      }

      &.primary {
        background: var(--theme-primary);
        border: none;
        color: white;

        &:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
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
  }
</style>
