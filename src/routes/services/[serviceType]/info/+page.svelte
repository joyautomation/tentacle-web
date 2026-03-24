<script lang="ts">
  import type { PageData } from './$types';
  import { subscribe, graphql } from '$lib/graphql/client';
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { state as saltState } from '@joyautomation/salt';
  import Sunburst from '$lib/components/Sunburst.svelte';
  import TidyTree from '$lib/components/TidyTree.svelte';
  import DiagramSelector from '$lib/components/DiagramSelector.svelte';
  import type { VizMode } from '$lib/components/DiagramSelector.svelte';

  let { data }: { data: PageData } = $props();

  const isGateway = $derived(data.serviceType === 'gateway');

  let expandedTypes: Record<string, boolean> = $state({});
  let expandedInstances: Record<string, boolean> = $state({});

  let vizMode: VizMode = $state('tree');

  type Variable = {
    variableId: string;
    value: unknown;
    datatype: string;
    udtType: string | null;
    quality: string;
    moduleId: string;
    deviceId: string | null;
    lastUpdated: string;
  };

  // Mutable variable map for live updates
  let variableMap: Map<string, Variable> = $state(new Map());

  // Debounced version counter — drives $derived recomputation
  let updateVersion = $state(0);
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush() {
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        updateVersion++;
      }, 500);
    }
  }

  // Initialize from server data
  $effect(() => {
    const m = new Map<string, Variable>();
    for (const v of data.variables) {
      m.set(v.variableId, v);
    }
    variableMap = m;
  });

  // Subscribe to batched variable updates via SSE — merge value/quality/lastUpdated
  // to preserve udtType and other metadata from the initial query
  onMount(() => {
    const unsub = subscribe<{ variableBatchUpdates: Variable[] }>(
      `subscription { variableBatchUpdates { variableId value datatype quality moduleId deviceId lastUpdated } }`,
      undefined,
      (result) => {
        const batch = result.variableBatchUpdates;
        if (batch) {
          for (const v of batch) {
            if (variableMap.has(v.variableId)) {
              const existing = variableMap.get(v.variableId)!;
              variableMap.set(v.variableId, { ...existing, value: v.value, quality: v.quality, lastUpdated: v.lastUpdated });
            }
          }
          scheduleFlush();
        }
      }
    );
    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      unsub();
    };
  });

  type StructInstance = {
    name: string;
    members: { name: string; variable: Variable }[];
  };

  type StructType = {
    typeName: string;
    instances: StructInstance[];
    memberNames: string[];
  };

  // Build organized view: UDT types (grouped by udtType from tentacle-plc) and scalars
  const organized = $derived(() => {
    void updateVersion; // depend on debounced version
    const instanceMap = new Map<string, { name: string; udtType?: string; members: Map<string, Variable> }>();
    const scalars: Variable[] = [];
    const vars = [...variableMap.values()];

    for (const v of vars) {
      const dotIdx = v.variableId.indexOf('.');
      if (dotIdx === -1) {
        if (v.datatype === 'udt') {
          // UDT parent — store so we can grab its udtType
          if (!instanceMap.has(v.variableId)) {
            instanceMap.set(v.variableId, { name: v.variableId, udtType: v.udtType ?? undefined, members: new Map() });
          } else {
            instanceMap.get(v.variableId)!.udtType = v.udtType ?? undefined;
          }
        } else {
          scalars.push(v);
        }
      } else {
        const baseName = v.variableId.substring(0, dotIdx);
        const memberName = v.variableId.substring(dotIdx + 1);
        if (!instanceMap.has(baseName)) {
          instanceMap.set(baseName, { name: baseName, udtType: v.udtType ?? undefined, members: new Map() });
        }
        instanceMap.get(baseName)!.members.set(memberName, v);
      }
    }

    // Group instances by udtType name
    const typeMap = new Map<string, StructInstance[]>();
    for (const [key, inst] of instanceMap) {
      // If no atomic members, synthesize from the UDT value object
      if (inst.members.size === 0) {
        const parent = variableMap.get(key);
        if (parent && parent.datatype === 'udt' && parent.value && typeof parent.value === 'object') {
          for (const [memberName, memberValue] of Object.entries(parent.value as Record<string, unknown>)) {
            inst.members.set(memberName, {
              variableId: `${key}.${memberName}`,
              value: memberValue,
              datatype: typeof memberValue === 'boolean' ? 'boolean' : typeof memberValue === 'string' ? 'string' : 'number',
              udtType: parent.udtType,
              quality: parent.quality,
              moduleId: parent.moduleId,
              deviceId: parent.deviceId,
              lastUpdated: parent.lastUpdated,
            });
          }
        }
        if (inst.members.size === 0) continue; // still empty, skip
      }
      const typeName = inst.udtType ?? 'Unknown Type';
      if (!typeMap.has(typeName)) typeMap.set(typeName, []);
      const memberNames = Array.from(inst.members.keys()).sort();
      typeMap.get(typeName)!.push({
        name: inst.name,
        members: memberNames.map(m => ({ name: m, variable: inst.members.get(m)! })),
      });
    }

    // Convert to sorted array
    const structTypes: StructType[] = [...typeMap.entries()]
      .map(([typeName, instances]) => ({
        typeName,
        instances: instances.sort((a, b) => a.name.localeCompare(b.name)),
        memberNames: instances[0]?.members.map(m => m.name) ?? [],
      }))
      .sort((a, b) => a.typeName.localeCompare(b.typeName));

    return { structTypes, scalars: scalars.sort((a, b) => a.variableId.localeCompare(b.variableId)) };
  });

  // Build D3 hierarchy for sunburst visualization
  type SunburstNode = { name: string; children?: SunburstNode[]; value?: number; displayValue?: string };
  const sunburstData = $derived((): SunburstNode => {
    const org = organized();
    const children: SunburstNode[] = [];

    if (org.structTypes.length > 0) {
      children.push({
        name: 'UDT Variables',
        children: org.structTypes.map(st => ({
          name: st.typeName,
          children: st.instances.map(inst => ({
            name: inst.name,
            children: inst.members.map(m => ({ name: m.name, value: 1, displayValue: formatValue(m.variable.value) })),
          })),
        })),
      });
    }

    if (org.scalars.length > 0) {
      children.push({
        name: 'Scalar Variables',
        children: org.scalars.map(v => ({ name: v.variableId, value: 1, displayValue: formatValue(v.value) })),
      });
    }

    return { name: 'Variables', children };
  });

  function toggleType(name: string) {
    expandedTypes[name] = !expandedTypes[name];
  }

  function toggleInstance(name: string) {
    expandedInstances[name] = !expandedInstances[name];
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(3);
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  function getQualityColor(quality: string): string {
    if (quality === 'good') return 'var(--color-green-500, #22c55e)';
    if (quality === 'bad') return 'var(--color-red-500, #ef4444)';
    return 'var(--theme-text-muted)';
  }

  // ═══════════════════════════════════════════════════════════════════
  // Gateway variable management
  // ═══════════════════════════════════════════════════════════════════

  let showAddVar = $state(false);
  let gwSaving = $state(false);
  let newVar = $state({
    id: '',
    deviceId: '',
    tag: '',
    datatype: 'number' as string,
    description: '',
    bidirectional: false,
  });

  function resetNewVar() {
    newVar = { id: '', deviceId: '', tag: '', datatype: 'number', description: '', bidirectional: false };
  }

  async function addVariable() {
    if (!newVar.id || !newVar.deviceId || !newVar.tag) return;
    gwSaving = true;
    try {
      const result = await graphql(`
        mutation SetGatewayVariable($gatewayId: String!, $variable: GatewayVariableInput!) {
          setGatewayVariable(gatewayId: $gatewayId, variable: $variable) { gatewayId }
        }
      `, {
        gatewayId: 'gateway',
        variable: {
          id: newVar.id,
          deviceId: newVar.deviceId,
          tag: newVar.tag,
          datatype: newVar.datatype,
          description: newVar.description || undefined,
          bidirectional: newVar.bidirectional || undefined,
        },
      });

      if (result.errors) {
        saltState.addNotification({ message: result.errors[0].message, type: 'error' });
      } else {
        saltState.addNotification({ message: `Variable "${newVar.id}" added`, type: 'success' });
        resetNewVar();
        showAddVar = false;
        await invalidateAll();
      }
    } catch (err) {
      saltState.addNotification({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      gwSaving = false;
    }
  }

  async function removeVariable(variableId: string) {
    gwSaving = true;
    try {
      const result = await graphql(`
        mutation DeleteGatewayVariable($gatewayId: String!, $variableId: String!) {
          deleteGatewayVariable(gatewayId: $gatewayId, variableId: $variableId) { gatewayId }
        }
      `, { gatewayId: 'gateway', variableId });

      if (result.errors) {
        saltState.addNotification({ message: result.errors[0].message, type: 'error' });
      } else {
        saltState.addNotification({ message: `Variable "${variableId}" removed`, type: 'success' });
        await invalidateAll();
      }
    } catch (err) {
      saltState.addNotification({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      gwSaving = false;
    }
  }
</script>

{#if isGateway}
<div class="variables-page">
  {#if data.error}
    <div class="error-box"><p>{data.error}</p></div>
  {/if}

  <div class="variables-header">
    <h1>Variables</h1>
    <span class="count-badge">{data.gatewayConfig?.variables?.length ?? 0} variables</span>
    <button class="gw-add-btn" onclick={() => { showAddVar = !showAddVar; }} disabled={gwSaving}>
      {showAddVar ? 'Cancel' : '+ Add Variable'}
    </button>
  </div>

  {#if showAddVar}
    <div class="gw-add-form">
      <div class="gw-form-row">
        <label for="gw-var-id">Variable ID</label>
        <input id="gw-var-id" type="text" bind:value={newVar.id} placeholder="e.g. temperature" />
      </div>
      <div class="gw-form-row">
        <label for="gw-var-device">Device</label>
        <select id="gw-var-device" bind:value={newVar.deviceId}>
          <option value="">Select device...</option>
          {#each data.gatewayConfig?.devices ?? [] as device}
            <option value={device.deviceId}>{device.deviceId} ({device.protocol})</option>
          {/each}
        </select>
      </div>
      <div class="gw-form-row">
        <label for="gw-var-tag">Tag / Node / OID</label>
        <input id="gw-var-tag" type="text" bind:value={newVar.tag} placeholder="Tag name, OPC UA nodeId, or SNMP OID" />
      </div>
      <div class="gw-form-row">
        <label for="gw-var-datatype">Datatype</label>
        <select id="gw-var-datatype" bind:value={newVar.datatype}>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="string">String</option>
        </select>
      </div>
      <div class="gw-form-row">
        <label for="gw-var-desc">Description</label>
        <input id="gw-var-desc" type="text" bind:value={newVar.description} placeholder="Optional" />
      </div>
      <div class="gw-form-row">
        <label for="gw-var-bidir">Writable</label>
        <label class="gw-toggle">
          <input type="checkbox" bind:checked={newVar.bidirectional} />
          <span class="gw-toggle-slider"></span>
        </label>
      </div>
      <div class="gw-form-actions">
        <button class="gw-save-btn" onclick={addVariable} disabled={gwSaving || !newVar.id || !newVar.deviceId || !newVar.tag}>
          {gwSaving ? 'Saving...' : 'Add Variable'}
        </button>
      </div>
    </div>
  {/if}

  {#if data.gatewayConfig?.variables && data.gatewayConfig.variables.length > 0}
    <div class="tree">
      {#each data.gatewayConfig.variables as variable}
        <div class="tree-leaf gw-var-row">
          <span class="leaf-type">{variable.datatype}</span>
          <span class="leaf-name">{variable.id}</span>
          <span class="gw-var-device">{variable.deviceId}</span>
          <span class="gw-var-tag">{variable.tag}</span>
          {#if variable.bidirectional}
            <span class="gw-bidir-badge">RW</span>
          {/if}
          <button class="gw-delete-btn" onclick={() => removeVariable(variable.id)} disabled={gwSaving} title="Remove variable">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {:else if !data.error && !showAddVar}
    <div class="empty-state">
      <p>No variables configured. Add devices first, then add variables to map tags.</p>
    </div>
  {/if}
</div>
{:else}
<div class="variables-page">
  {#if data.error}
    <div class="error-box">
      <p>{data.error}</p>
    </div>
  {/if}

  <div class="variables-header">
    <h1>Variables</h1>
    <span class="count-badge">{variableMap.size} variables</span>
    <DiagramSelector bind:mode={vizMode} />
  </div>

  {#if vizMode === 'tree'}
  <div class="tree-content">
  <!-- UDT Variables grouped by type -->
  {#if organized().structTypes.length > 0}
    <section class="section">
      <h2>UDT Variables</h2>
      <div class="tree">
        {#each organized().structTypes as structType}
          <div class="tree-node">
            <button class="tree-toggle" onclick={() => toggleType(structType.typeName)}>
              <svg class="chevron" class:expanded={expandedTypes[structType.typeName]} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
              <span class="template-icon">T</span>
              <span class="tree-label">{structType.typeName}</span>
              <span class="member-count">{structType.instances.length} instances</span>
            </button>
            {#if expandedTypes[structType.typeName]}
              <div class="tree-children">
                {#each structType.instances as instance}
                  <div class="tree-node">
                    <button class="tree-toggle" onclick={() => toggleInstance(instance.name)}>
                      <svg class="chevron" class:expanded={expandedInstances[instance.name]} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                      <span class="tree-label">{instance.name}</span>
                      <span class="member-count">{instance.members.length} members</span>
                    </button>
                    {#if expandedInstances[instance.name]}
                      <div class="tree-children">
                        {#each instance.members as member}
                          <div class="tree-leaf">
                            <span class="quality-dot" style="background: {getQualityColor(member.variable.quality)}" title="Quality: {member.variable.quality}"></span>
                            <span class="leaf-name">{member.name}</span>
                            <span class="leaf-value">{formatValue(member.variable.value)}</span>
                            <span class="leaf-type">{member.variable.datatype}</span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Scalar variables -->
  {#if organized().scalars.length > 0}
    <section class="section">
      <h2>Scalar Variables</h2>
      <div class="tree">
        {#each organized().scalars as variable}
          <div class="tree-leaf">
            <span class="quality-dot" style="background: {getQualityColor(variable.quality)}" title="Quality: {variable.quality}"></span>
            <span class="leaf-name">{variable.variableId}</span>
            <span class="leaf-value">{formatValue(variable.value)}</span>
            <span class="leaf-type">{variable.datatype}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if variableMap.size === 0 && !data.error}
    <div class="empty-state">
      <p>No variables being polled. Start a PLC project to see variables here.</p>
    </div>
  {/if}
  </div>
  {:else if vizMode === 'sunburst'}
    {#if sunburstData().children && sunburstData().children.length > 0}
      <div class="diagram-content">
        <Sunburst data={sunburstData()} />
      </div>
    {:else if !data.error}
      <div class="empty-state">
        <p>No variables being polled. Start a PLC project to see variables here.</p>
      </div>
    {/if}
  {:else if vizMode === 'tidy'}
    {#if sunburstData().children && sunburstData().children.length > 0}
      <TidyTree data={sunburstData()} />
    {:else if !data.error}
      <div class="empty-state">
        <p>No variables being polled. Start a PLC project to see variables here.</p>
      </div>
    {/if}
  {/if}
</div>
{/if}

<style lang="scss">
  .variables-page {
    padding: 2rem;
  }

  .tree-content {
    max-width: 900px;
  }

  .diagram-content {
    display: flex;
    justify-content: center;
  }

  .variables-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--theme-text);
      margin: 0;
    }
  }

  .count-badge {
    padding: 0.2rem 0.5rem;
    border-radius: var(--rounded-md);
    font-size: 0.75rem;
    font-family: 'IBM Plex Mono', monospace;
    background: var(--badge-teal-bg);
    color: var(--badge-teal-text);
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

  .tree {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    overflow: hidden;
  }

  .tree-node {
    &:not(:last-child) {
      border-bottom: 1px solid color-mix(in srgb, var(--theme-border) 50%, transparent);
    }
  }

  .tree-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background: none;
    border: none;
    color: var(--theme-text);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    font-family: inherit;

    &:hover {
      background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    }
  }

  .chevron {
    flex-shrink: 0;
    color: var(--theme-text-muted);
    transition: transform 0.15s ease;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .template-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--rounded-sm);
    background: var(--badge-purple-bg);
    color: var(--badge-purple-text);
    font-size: 0.6875rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tree-label {
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
  }

  .member-count {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    margin-left: auto;
  }

  .tree-children {
    border-top: 1px solid color-mix(in srgb, var(--theme-border) 50%, transparent);

    .tree-node {
      padding-left: 1rem;
    }

    .tree-leaf {
      padding-left: 2.5rem;
    }
  }

  .tree-leaf {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;

    &:not(:last-child) {
      border-bottom: 1px solid color-mix(in srgb, var(--theme-border) 30%, transparent);
    }
  }

  .quality-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .leaf-name {
    font-family: 'IBM Plex Mono', monospace;
    color: var(--theme-text);
  }

  .leaf-value {
    margin-left: auto;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--theme-text-muted);
    font-size: 0.75rem;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .leaf-type {
    font-size: 0.6875rem;
    color: var(--badge-muted-text);
    padding: 0.1rem 0.35rem;
    border-radius: var(--rounded-sm);
    background: var(--badge-muted-bg);
    flex-shrink: 0;
  }

  .error-box {
    padding: 1rem;
    border-radius: var(--rounded-lg);
    background: var(--theme-surface);
    border: 1px solid var(--color-red-500, #ef4444);
    margin-bottom: 1.5rem;

    p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-red-500, #ef4444);
    }
  }

  .empty-state {
    padding: 3rem 2rem;
    text-align: center;

    p {
      color: var(--theme-text-muted);
      font-size: 0.875rem;
    }
  }

  // Gateway-specific styles
  .gw-add-btn {
    margin-left: auto;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-md);
    background: var(--theme-surface);
    color: var(--theme-text);
    cursor: pointer;

    &:hover:not(:disabled) { background: color-mix(in srgb, var(--theme-text) 5%, var(--theme-surface)); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .gw-add-form {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .gw-form-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;

    label {
      font-size: 0.8125rem;
      color: var(--theme-text-muted);
      min-width: 110px;
      flex-shrink: 0;
    }

    input, select {
      flex: 1;
      padding: 0.375rem 0.5rem;
      font-size: 0.8125rem;
      font-family: 'IBM Plex Mono', monospace;
      border: 1px solid var(--theme-border);
      border-radius: var(--rounded-md);
      background: var(--theme-bg, #000);
      color: var(--theme-text);
    }
  }

  .gw-form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .gw-save-btn {
    padding: 0.375rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    border-radius: var(--rounded-md);
    background: var(--theme-primary);
    color: white;
    cursor: pointer;
    &:hover:not(:disabled) { opacity: 0.9; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  .gw-toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    cursor: pointer;

    input { opacity: 0; width: 0; height: 0; }
  }

  .gw-toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--theme-border);
    border-radius: 20px;
    transition: background 0.2s;

    &::before {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      left: 3px;
      bottom: 3px;
      background: var(--theme-text);
      border-radius: 50%;
      transition: transform 0.2s;
    }
  }

  .gw-toggle input:checked + .gw-toggle-slider {
    background: var(--color-green-500, #22c55e);
  }

  .gw-toggle input:checked + .gw-toggle-slider::before {
    transform: translateX(16px);
  }

  .gw-var-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .gw-var-device {
    font-size: 0.6875rem;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--badge-muted-text);
    padding: 0.1rem 0.35rem;
    border-radius: var(--rounded-sm);
    background: var(--badge-muted-bg);
  }

  .gw-var-tag {
    font-size: 0.75rem;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--theme-text-muted);
    margin-left: auto;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gw-bidir-badge {
    font-size: 0.5625rem;
    font-weight: 700;
    padding: 0.1rem 0.3rem;
    border-radius: var(--rounded-sm);
    background: var(--badge-amber-bg);
    color: var(--badge-amber-text);
  }

  .gw-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--rounded-sm);
    background: none;
    color: var(--theme-text-muted);
    cursor: pointer;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      color: var(--color-red-500, #ef4444);
      background: color-mix(in srgb, var(--color-red-500, #ef4444) 10%, transparent);
    }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
</style>
