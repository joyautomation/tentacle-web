<script lang="ts">
  import { slide } from 'svelte/transition';
  import { graphql } from '$lib/graphql/client';

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

  interface TreeNode {
    name: string;
    path: string;
    children: Map<string, TreeNode>;
    variable?: Variable;
    isExpanded: boolean;
  }

  interface Props {
    variables: Variable[];
    projectId: string;
    mqttConfig?: MqttConfig | null;
    onMqttChange?: () => void;
  }

  let { variables, projectId, mqttConfig = null, onMqttChange }: Props = $props();

  // Track expanded state by path
  let expandedPaths = $state<Set<string>>(new Set());

  // Saving state
  let saving = $state(false);

  // Deadband modal state
  let showDeadbandModal = $state(false);
  let editingVariableId = $state<string | null>(null);
  let deadbandValue = $state(0);
  let deadbandMaxTime = $state<number | null>(null);

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

  // Build tree from variables
  function buildTree(vars: Variable[]): TreeNode {
    const root: TreeNode = {
      name: 'root',
      path: '',
      children: new Map(),
      isExpanded: true,
    };

    for (const variable of vars) {
      // Split variable ID into path segments using dots (UDT paths like "MyUDT.Member.Value")
      const segments = variable.variableId.split('.');
      let current = root;
      let currentPath = '';

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;
        const isLast = i === segments.length - 1;

        if (!current.children.has(segment)) {
          current.children.set(segment, {
            name: segment,
            path: currentPath,
            children: new Map(),
            isExpanded: expandedPaths.has(currentPath),
          });
        }

        const node = current.children.get(segment)!;

        if (isLast) {
          // Leaf node - attach the variable
          node.variable = variable;
        }

        current = node;
      }
    }

    return root;
  }

  // Reactive tree built from variables
  let tree = $derived(buildTree(variables));

  function toggleNode(path: string): void {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    expandedPaths = new Set(expandedPaths); // Trigger reactivity
  }

  function expandAll(): void {
    const collectPaths = (node: TreeNode): string[] => {
      const paths: string[] = [];
      if (node.path && node.children.size > 0) {
        paths.push(node.path);
      }
      for (const child of node.children.values()) {
        paths.push(...collectPaths(child));
      }
      return paths;
    };
    expandedPaths = new Set(collectPaths(tree));
  }

  function collapseAll(): void {
    expandedPaths = new Set();
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      // Format numbers nicely
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(3);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString();
    } catch {
      return '-';
    }
  }

  // Count total leaf nodes (variables) under a node
  function countLeaves(node: TreeNode): number {
    if (node.variable) return 1;
    let count = 0;
    for (const child of node.children.values()) {
      count += countLeaves(child);
    }
    return count;
  }

  // MQTT toggle handler
  async function toggleMqtt(variableId: string, currentlyEnabled: boolean) {
    saving = true;
    try {
      if (currentlyEnabled) {
        await graphql(`
          mutation($projectId: String!, $variableIds: [String!]!) {
            disableMqttVariables(projectId: $projectId, variableIds: $variableIds)
          }
        `, { projectId, variableIds: [variableId] });
      } else {
        await graphql(`
          mutation($projectId: String!, $variableIds: [String!]!) {
            enableMqttVariables(projectId: $projectId, variableIds: $variableIds)
          }
        `, { projectId, variableIds: [variableId] });
      }
      onMqttChange?.();
    } catch (e) {
      console.error('Failed to toggle MQTT:', e);
    }
    saving = false;
  }

  // Open deadband modal for a variable
  function openDeadbandModal(variableId: string) {
    editingVariableId = variableId;
    const config = mqttConfigMap().get(variableId);
    if (config?.deadband) {
      deadbandValue = config.deadband.value;
      deadbandMaxTime = config.deadband.maxTime;
    } else if (mqttConfig?.defaults.deadband) {
      deadbandValue = mqttConfig.defaults.deadband.value;
      deadbandMaxTime = mqttConfig.defaults.deadband.maxTime;
    } else {
      deadbandValue = 0;
      deadbandMaxTime = null;
    }
    showDeadbandModal = true;
  }

  // Apply deadband configuration
  async function applyDeadband() {
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
      showDeadbandModal = false;
      editingVariableId = null;
      onMqttChange?.();
    } catch (e) {
      console.error('Failed to apply deadband:', e);
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

  // Get deadband display for a variable
  function getDeadbandDisplay(variableId: string): { value: number; maxTime: string | null; isDefault: boolean } | null {
    const config = mqttConfigMap().get(variableId);
    if (!config?.enabled) return null;

    if (config.deadband) {
      return {
        value: config.deadband.value,
        maxTime: config.deadband.maxTime ? formatMs(config.deadband.maxTime) : null,
        isDefault: false
      };
    } else if (mqttConfig?.defaults.deadband) {
      return {
        value: mqttConfig.defaults.deadband.value,
        maxTime: mqttConfig.defaults.deadband.maxTime ? formatMs(mqttConfig.defaults.deadband.maxTime) : null,
        isDefault: true
      };
    }
    return null;
  }
</script>

<div class="tree-controls">
  <button class="small ghost" onclick={expandAll}>Expand All</button>
  <button class="small ghost" onclick={collapseAll}>Collapse All</button>
  {#if mqttConfig}
    <span class="mqtt-summary">
      <span class="mqtt-icon">📡</span>
      {mqttConfig.enabledCount} MQTT enabled
    </span>
  {/if}
</div>

<div class="tree">
  <div class="tree-header">
    <span class="col-name">Tag Name</span>
    <span class="col-value">Value</span>
    <span class="col-type">Type</span>
    <span class="col-quality">Quality</span>
    <span class="col-time">Last Update</span>
    {#if mqttConfig}
      <span class="col-mqtt">MQTT</span>
    {/if}
  </div>
  <div class="tree-body">
    {#each [...tree.children.values()] as node (node.path)}
      {@render treeNode(node, 0)}
    {/each}
  </div>
</div>

{#snippet treeNode(node: TreeNode, depth: number)}
  <div class="tree-item" style="--depth: {depth}">
    {#if node.variable}
      <!-- Leaf node (actual variable) -->
      {@const config = mqttConfigMap().get(node.variable.variableId)}
      {@const isEnabled = config?.enabled ?? false}
      {@const deadband = getDeadbandDisplay(node.variable.variableId)}
      <div class="tree-leaf" class:mqtt-enabled={isEnabled} class:has-mqtt={!!mqttConfig}>
        <span class="leaf-name">{node.name}</span>
        <span class="leaf-value value-{node.variable.datatype}">{formatValue(node.variable.value)}</span>
        <span class="leaf-type">{node.variable.datatype}</span>
        <span class="leaf-quality quality-{node.variable.quality}">{node.variable.quality}</span>
        <span class="leaf-time">{formatTime(node.variable.lastUpdated)}</span>
        {#if mqttConfig}
          <div class="leaf-mqtt">
            {#if isEnabled && deadband}
              <button
                class="deadband-btn"
                class:is-default={deadband.isDefault}
                onclick={() => openDeadbandModal(node.variable!.variableId)}
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
            {/if}
            <label class="mqtt-checkbox" title={isEnabled ? 'Disable MQTT publishing' : 'Enable MQTT publishing'}>
              <input
                type="checkbox"
                checked={isEnabled}
                onchange={() => toggleMqtt(node.variable!.variableId, isEnabled)}
                disabled={saving}
              />
              <span class="toggle-track">
                <span class="toggle-thumb"></span>
              </span>
            </label>
          </div>
        {/if}
      </div>
    {:else if node.children.size > 0}
      <!-- Folder node -->
      <button
        class="tree-folder"
        class:expanded={expandedPaths.has(node.path)}
        onclick={() => toggleNode(node.path)}
      >
        <span class="folder-icon">{expandedPaths.has(node.path) ? '▼' : '▶'}</span>
        <span class="folder-name">{node.name}</span>
        <span class="folder-count">{countLeaves(node)}</span>
      </button>

      {#if expandedPaths.has(node.path)}
        <div class="tree-children" transition:slide={{ duration: 150 }}>
          {#each [...node.children.values()].sort((a, b) => {
            // Sort folders first, then alphabetically
            const aIsFolder = a.children.size > 0 && !a.variable;
            const bIsFolder = b.children.size > 0 && !b.variable;
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.name.localeCompare(b.name);
          }) as child (child.path)}
            {@render treeNode(child, depth + 1)}
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

<!-- Deadband Modal -->
{#if showDeadbandModal}
  <div class="modal-backdrop" onclick={() => showDeadbandModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal-header">
        <h3>Configure Deadband</h3>
        <button class="icon-btn" onclick={() => showDeadbandModal = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </header>

      <p class="modal-desc">
        Configure deadband for <code>{editingVariableId}</code>
      </p>

      <form onsubmit={(e) => { e.preventDefault(); applyDeadband(); }}>
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
          <span class="help-text">Force publish after this time regardless of deadband</span>
        </div>

        <div class="modal-actions">
          <button type="button" onclick={() => showDeadbandModal = false}>Cancel</button>
          <button type="submit" class="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Apply'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style lang="scss">
  .tree-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .mqtt-summary {
    margin-left: auto;
    font-size: 0.8125rem;
    color: var(--theme-primary);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    background: rgba(6, 182, 212, 0.1);
    border-radius: var(--rounded-full);
  }

  .mqtt-icon {
    font-size: 0.875rem;
  }

  .tree {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
    overflow: hidden;
  }

  .tree-header {
    display: grid;
    grid-template-columns: 1fr 6rem 5rem 5rem 5rem;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--theme-bg);
    border-bottom: 1px solid var(--theme-border);
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted);

    &:has(.col-mqtt) {
      grid-template-columns: 1fr 6rem 5rem 5rem 5rem 8rem;
    }

    .col-value,
    .col-time {
      text-align: right;
    }

    .col-quality,
    .col-mqtt {
      text-align: center;
    }
  }

  .tree-body {
    padding: 0.5rem;
  }

  .tree-item {
    padding-left: calc(var(--depth) * 1.25rem);
  }

  .tree-folder {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: var(--rounded-md);
    color: var(--theme-text);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background: var(--theme-surface-hover);
    }

    &.expanded {
      .folder-icon {
        color: var(--theme-primary);
      }
    }
  }

  .folder-icon {
    font-size: 0.625rem;
    color: var(--theme-text-muted);
    transition: color 0.15s;
  }

  .folder-name {
    font-weight: 500;
  }

  .folder-count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    padding: 0.125rem 0.5rem;
    background: var(--theme-surface-hover);
    border-radius: var(--rounded-full);
  }

  .tree-children {
    border-left: 1px solid var(--theme-border);
    margin-left: 0.75rem;
  }

  .tree-leaf {
    display: grid;
    grid-template-columns: 1fr 6rem 5rem 5rem 5rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--rounded-md);
    transition: background-color 0.15s;

    &:hover {
      background: var(--theme-surface-hover);
    }

    &.mqtt-enabled {
      background: rgba(6, 182, 212, 0.05);

      &:hover {
        background: rgba(6, 182, 212, 0.1);
      }
    }

    &.has-mqtt {
      grid-template-columns: 1fr 6rem 5rem 5rem 5rem 8rem;
    }
  }

  .leaf-mqtt {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .mqtt-checkbox {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;

    input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;

      &:checked + .toggle-track {
        background: var(--theme-primary);

        .toggle-thumb {
          transform: translateX(14px);
        }
      }

      &:focus + .toggle-track {
        box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
      }

      &:disabled + .toggle-track {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .toggle-track {
      width: 32px;
      height: 18px;
      background: var(--theme-surface-hover);
      border: 1px solid var(--theme-border);
      border-radius: var(--rounded-full);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      padding: 2px;
    }

    .toggle-thumb {
      width: 12px;
      height: 12px;
      background: var(--theme-text-muted);
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    input[type="checkbox"]:checked + .toggle-track .toggle-thumb {
      background: white;
    }
  }

  .leaf-name {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .leaf-value {
    font-family: monospace;
    font-weight: 500;
    font-size: 0.8125rem;
    color: var(--theme-primary);
    text-align: right;
  }

  .leaf-value.value-boolean {
    color: var(--amber-500);
  }

  .leaf-type {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
  }

  .leaf-quality {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: var(--rounded-full);
    text-align: center;
    justify-self: center;
  }

  .quality-good {
    background: rgba(34, 197, 94, 0.1);
    color: var(--green-600);
  }

  .quality-bad {
    background: rgba(239, 68, 68, 0.1);
    color: var(--red-500);
  }

  .quality-uncertain {
    background: rgba(245, 158, 11, 0.1);
    color: var(--amber-600);
  }

  .leaf-time {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    min-width: 5rem;
    text-align: right;
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
      font-size: 1.125rem;
      margin: 0;
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
