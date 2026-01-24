<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { graphql } from '$lib/graphql/client';

  interface Variable {
    projectId: string;
    variableId: string;
    value: unknown;
    datatype: string;
    quality: string;
    source: string;
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

  const projectId = $derived($page.params.projectId);

  // Data state
  let variables = $state<Variable[]>([]);
  let mqttConfig = $state<MqttConfig | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);

  // UI state
  let filterText = $state('');
  let selectedIds = $state<Set<string>>(new Set());
  let showDeadbandModal = $state(false);
  let deadbandValue = $state(0);
  let deadbandMaxTime = $state<number | null>(60000);
  let bulkDeadbandMode = $state(false);

  // Build a map of variable ID to MQTT config
  const mqttConfigMap = $derived(() => {
    const map = new Map<string, MqttVariableEntry>();
    if (mqttConfig?.variables) {
      for (const entry of mqttConfig.variables) {
        map.set(entry.variableId, entry);
      }
    }
    return map;
  });

  // Filter variables
  const filteredVariables = $derived(() => {
    if (!filterText.trim()) return variables;
    const filter = filterText.toLowerCase();
    return variables.filter(v => v.variableId.toLowerCase().includes(filter));
  });

  // Check if all filtered are selected
  const allFilteredSelected = $derived(() => {
    const filtered = filteredVariables();
    if (filtered.length === 0) return false;
    return filtered.every(v => selectedIds.has(v.variableId));
  });

  // Count enabled in current filter
  const enabledInFilter = $derived(() => {
    const map = mqttConfigMap();
    return filteredVariables().filter(v => map.get(v.variableId)?.enabled).length;
  });

  // Find orphaned MQTT entries (enabled for variables that don't exist)
  const orphanedEntries = $derived(() => {
    if (!mqttConfig?.variables) return [];
    const variableIds = new Set(variables.map(v => v.variableId));
    return mqttConfig.variables.filter(entry =>
      entry.enabled && !variableIds.has(entry.variableId)
    );
  });

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [varsResult, mqttResult] = await Promise.all([
        graphql<{ variables: Variable[] }>(`
          query($projectId: String!) {
            variables(projectId: $projectId) {
              projectId
              variableId
              value
              datatype
              quality
              source
            }
          }
        `, { projectId: $page.params.projectId }),
        graphql<{ mqttConfig: MqttConfig }>(`
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
        `, { projectId: $page.params.projectId })
      ]);

      if (varsResult.errors) {
        error = varsResult.errors[0].message;
      } else if (varsResult.data) {
        variables = varsResult.data.variables;
      }

      if (mqttResult.data) {
        mqttConfig = mqttResult.data.mqttConfig;
        deadbandValue = mqttConfig.defaults.deadband.value;
        deadbandMaxTime = mqttConfig.defaults.deadband.maxTime;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
    }
    loading = false;
  }

  function toggleSelection(variableId: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(variableId)) {
      newSelected.delete(variableId);
    } else {
      newSelected.add(variableId);
    }
    selectedIds = newSelected;
  }

  function toggleSelectAll() {
    const filtered = filteredVariables();
    if (allFilteredSelected()) {
      // Deselect all filtered
      const newSelected = new Set(selectedIds);
      for (const v of filtered) {
        newSelected.delete(v.variableId);
      }
      selectedIds = newSelected;
    } else {
      // Select all filtered
      const newSelected = new Set(selectedIds);
      for (const v of filtered) {
        newSelected.add(v.variableId);
      }
      selectedIds = newSelected;
    }
  }

  async function enableSelected() {
    if (selectedIds.size === 0) return;
    saving = true;
    try {
      const variableIds = Array.from(selectedIds);
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          enableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId: $page.params.projectId, variableIds });

      await loadData();
      selectedIds = new Set();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to enable variables';
    }
    saving = false;
  }

  async function disableSelected() {
    if (selectedIds.size === 0) return;
    saving = true;
    try {
      const variableIds = Array.from(selectedIds);
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId: $page.params.projectId, variableIds });

      await loadData();
      selectedIds = new Set();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to disable variables';
    }
    saving = false;
  }

  async function enableAll() {
    saving = true;
    try {
      const variableIds = variables.map(v => v.variableId);
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          enableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId: $page.params.projectId, variableIds });

      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to enable all';
    }
    saving = false;
  }

  async function disableAll() {
    saving = true;
    try {
      const variableIds = variables.map(v => v.variableId);
      await graphql(`
        mutation($projectId: String!, $variableIds: [String!]!) {
          disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
        }
      `, { projectId: $page.params.projectId, variableIds });

      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to disable all';
    }
    saving = false;
  }

  function openDeadbandModal(bulk: boolean = false) {
    bulkDeadbandMode = bulk;
    if (mqttConfig) {
      deadbandValue = mqttConfig.defaults.deadband.value;
      deadbandMaxTime = mqttConfig.defaults.deadband.maxTime;
    }
    showDeadbandModal = true;
  }

  async function applyDeadband() {
    saving = true;
    try {
      if (bulkDeadbandMode) {
        // Apply to all selected variables by enabling with config
        const variableIds = Array.from(selectedIds);
        await graphql(`
          mutation($projectId: String!, $variableIds: [String!]!, $config: MqttVariableConfigInput!) {
            enableMqttVariables(projectId: $projectId, variableIds: $variableIds, config: $config)
          }
        `, {
          projectId: $page.params.projectId,
          variableIds,
          config: {
            enabled: true,
            deadband: {
              value: deadbandValue,
              maxTime: deadbandMaxTime
            }
          }
        });
      } else {
        // Apply as default
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
          projectId: $page.params.projectId,
          deadband: {
            value: deadbandValue,
            maxTime: deadbandMaxTime
          }
        });
      }
      await loadData();
      showDeadbandModal = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to apply deadband';
    }
    saving = false;
  }

  async function toggleSingleVariable(variableId: string, currentlyEnabled: boolean) {
    saving = true;
    try {
      if (currentlyEnabled) {
        await graphql(`
          mutation($projectId: String!, $variableIds: [String!]!) {
            disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
          }
        `, { projectId: $page.params.projectId, variableIds: [variableId] });
      } else {
        await graphql(`
          mutation($projectId: String!, $variableIds: [String!]!) {
            enableMqttVariables(projectId: $projectId, variableIds: $variableIds)
          }
        `, { projectId: $page.params.projectId, variableIds: [variableId] });
      }
      await loadData();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to toggle variable';
    }
    saving = false;
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="header-left">
      <h2>MQTT Configuration</h2>
      {#if mqttConfig}
        <span class="enabled-count">
          {mqttConfig.enabledCount} / {variables.length} enabled
        </span>
      {/if}
    </div>
    <div class="header-actions">
      <button class="btn btn-ghost" onclick={() => openDeadbandModal(false)} disabled={saving}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m-8.66-8.66l4.24 4.24m8.48-8.48l4.24 4.24m-16.96 0l4.24-4.24m8.48 8.48l4.24-4.24"/>
        </svg>
        Default Deadband
      </button>
      <button class="btn btn-secondary" onclick={disableAll} disabled={saving}>
        Disable All
      </button>
      <button class="btn btn-primary" onclick={enableAll} disabled={saving}>
        Enable All
      </button>
    </div>
  </header>

  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button onclick={() => error = null}>&times;</button>
    </div>
  {/if}

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

    {#if selectedIds.size > 0}
      <div class="selection-actions">
        <span class="selection-count">{selectedIds.size} selected</span>
        <button class="btn btn-sm btn-secondary" onclick={disableSelected} disabled={saving}>
          Disable
        </button>
        <button class="btn btn-sm btn-primary" onclick={enableSelected} disabled={saving}>
          Enable
        </button>
        <button class="btn btn-sm btn-ghost" onclick={() => openDeadbandModal(true)} disabled={saving}>
          Set Deadband
        </button>
        <button class="btn btn-sm btn-ghost" onclick={() => selectedIds = new Set()}>
          Clear
        </button>
      </div>
    {/if}
  </div>

  <div class="content">
    {#if loading}
      <div class="loading">Loading variables...</div>
    {:else if variables.length === 0}
      <div class="empty-state">
        <h3>No Variables</h3>
        <p>No variables found. Configure devices and tags first.</p>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="col-checkbox">
                <input
                  type="checkbox"
                  checked={allFilteredSelected()}
                  onchange={toggleSelectAll}
                />
              </th>
              <th class="col-mqtt">MQTT</th>
              <th>Variable ID</th>
              <th>Type</th>
              <th>Deadband</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredVariables() as variable (variable.variableId)}
              {@const config = mqttConfigMap().get(variable.variableId)}
              {@const isEnabled = config?.enabled ?? false}
              <tr class:enabled={isEnabled}>
                <td class="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(variable.variableId)}
                    onchange={() => toggleSelection(variable.variableId)}
                  />
                </td>
                <td class="col-mqtt">
                  <input
                    type="checkbox"
                    class="mqtt-checkbox"
                    checked={isEnabled}
                    onchange={() => toggleSingleVariable(variable.variableId, isEnabled)}
                    disabled={saving}
                    title={isEnabled ? 'Disable MQTT' : 'Enable MQTT'}
                  />
                </td>
                <td class="variable-id">{variable.variableId}</td>
                <td class="variable-type">{variable.datatype}</td>
                <td class="deadband-col">
                  {#if config?.deadband}
                    <span class="deadband-badge">
                      {config.deadband.value}
                      {#if config.deadband.maxTime}
                        <span class="deadband-time">/ {config.deadband.maxTime}ms</span>
                      {/if}
                    </span>
                  {:else if isEnabled && mqttConfig?.defaults.deadband}
                    <span class="deadband-badge default">
                      {mqttConfig.defaults.deadband.value}
                      {#if mqttConfig.defaults.deadband.maxTime}
                        <span class="deadband-time">/ {mqttConfig.defaults.deadband.maxTime}ms</span>
                      {/if}
                      <span class="default-label">(default)</span>
                    </span>
                  {:else}
                    <span class="no-deadband">-</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span>Showing {filteredVariables().length} of {variables.length} variables</span>
        <span class="filter-enabled">
          {enabledInFilter()} enabled in view
        </span>
      </div>
    {/if}

    {#if orphanedEntries().length > 0}
      <div class="orphaned-section">
        <div class="orphaned-header">
          <div class="orphaned-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h3>Orphaned MQTT Entries</h3>
            <span class="orphaned-count">{orphanedEntries().length} entries</span>
          </div>
          <p class="orphaned-desc">
            These variables are enabled for MQTT but don't exist in the current tag list.
            They may have been deleted or renamed in the PLC.
          </p>
        </div>
        <div class="orphaned-list">
          {#each orphanedEntries() as entry (entry.variableId)}
            <div class="orphaned-item">
              <span class="orphaned-name">{entry.variableId}</span>
              <button
                class="btn btn-sm btn-secondary"
                onclick={() => toggleSingleVariable(entry.variableId, true)}
                disabled={saving}
              >
                Remove
              </button>
            </div>
          {/each}
        </div>
        <button
          class="btn btn-secondary orphaned-clear-all"
          onclick={async () => {
            saving = true;
            try {
              const variableIds = orphanedEntries().map(e => e.variableId);
              await graphql(`
                mutation($projectId: String!, $variableIds: [String!]!) {
                  disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
                }
              `, { projectId: $page.params.projectId, variableIds });
              await loadData();
            } catch (e) {
              error = e instanceof Error ? e.message : 'Failed to remove orphaned entries';
            }
            saving = false;
          }}
          disabled={saving}
        >
          Remove All Orphaned
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showDeadbandModal}
  <div class="modal-backdrop" onclick={() => showDeadbandModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h3>{bulkDeadbandMode ? 'Set Deadband for Selected' : 'Default Deadband Settings'}</h3>
      <p class="modal-desc">
        {#if bulkDeadbandMode}
          Apply deadband configuration to {selectedIds.size} selected variable(s).
        {:else}
          Set the default deadband used for variables without custom settings.
        {/if}
      </p>

      <div class="form-group">
        <label for="deadband-value">Deadband Value</label>
        <input
          id="deadband-value"
          type="number"
          step="0.01"
          min="0"
          bind:value={deadbandValue}
        />
        <span class="help-text">Minimum change required to publish (0 = publish all changes)</span>
      </div>

      <div class="form-group">
        <label for="deadband-maxtime">Max Time (ms)</label>
        <input
          id="deadband-maxtime"
          type="number"
          step="1000"
          min="0"
          bind:value={deadbandMaxTime}
          placeholder="Optional"
        />
        <span class="help-text">Maximum time between publishes regardless of deadband (optional)</span>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" onclick={() => showDeadbandModal = false}>
          Cancel
        </button>
        <button class="btn btn-primary" onclick={applyDeadband} disabled={saving}>
          {saving ? 'Applying...' : 'Apply'}
        </button>
      </div>
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
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
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

  .toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
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

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(var(--theme-primary-rgb), 0.1);
    border-radius: var(--rounded-lg);
  }

  .selection-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--theme-primary);
    margin-right: 0.5rem;
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
    }
  }

  .content {
    flex: 1;
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
  }

  tbody tr {
    transition: background 0.1s;

    &:hover {
      background: var(--theme-surface-hover);
    }

    &:last-child td {
      border-bottom: none;
    }

    &.enabled {
      background: rgba(var(--theme-primary-rgb), 0.05);
    }
  }

  .col-checkbox {
    width: 40px;
    text-align: center;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
  }

  .col-mqtt {
    width: 60px;
    text-align: center;

    .mqtt-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--theme-primary);

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
  }

  .variable-id {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .variable-type {
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .deadband-col {
    font-size: 0.8125rem;
  }

  .deadband-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: rgba(var(--theme-primary-rgb), 0.1);
    color: var(--theme-primary);
    border-radius: var(--rounded-md);
    font-family: monospace;

    &.default {
      background: var(--theme-surface-hover);
      color: var(--theme-text-muted);
    }

    .deadband-time {
      color: inherit;
      opacity: 0.7;
    }

    .default-label {
      font-family: inherit;
      font-size: 0.75rem;
      opacity: 0.7;
    }
  }

  .no-deadband {
    color: var(--theme-text-muted);
  }

  .table-footer {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
    border-top: 1px solid var(--theme-border);
    background: var(--theme-surface);
    border-radius: 0 0 var(--rounded-xl) var(--rounded-xl);
    margin-top: -1px;
  }

  .filter-enabled {
    color: var(--theme-primary);
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
    padding: 1.5rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

    h3 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
    }

    .modal-desc {
      color: var(--theme-text-muted);
      font-size: 0.875rem;
      margin: 0 0 1.5rem;
    }
  }

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
    }

    input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid var(--theme-border);
      border-radius: var(--rounded-md);
      background: var(--theme-bg);
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
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--theme-text-muted);
  }

  .empty-state h3 {
    margin-bottom: 0.5rem;
    color: var(--theme-text);
  }

  // Orphaned entries section
  .orphaned-section {
    margin-top: 1.5rem;
    padding: 1rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: var(--rounded-xl);
  }

  .orphaned-header {
    margin-bottom: 1rem;
  }

  .orphaned-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;

    svg {
      color: var(--amber-600);
    }

    h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--amber-600);
    }
  }

  .orphaned-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: rgba(245, 158, 11, 0.2);
    color: var(--amber-600);
    border-radius: var(--rounded-full);
  }

  .orphaned-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--theme-text-muted);
  }

  .orphaned-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .orphaned-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--theme-surface);
    border-radius: var(--rounded-md);
  }

  .orphaned-name {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--theme-text);
  }

  .orphaned-clear-all {
    width: 100%;
  }
</style>
