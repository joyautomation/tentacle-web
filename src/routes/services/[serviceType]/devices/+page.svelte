<script lang="ts">
  import type { PageData } from "./$types";
  import { subscribe, graphql } from "$lib/graphql/client";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { state as saltState } from "@joyautomation/salt";
  import Sunburst from "$lib/components/Sunburst.svelte";
  import DiagramSelector from "$lib/components/DiagramSelector.svelte";
  import type { VizMode } from "$lib/components/DiagramSelector.svelte";

  let { data }: { data: PageData } = $props();

  const isGateway = $derived(data.serviceType === 'gateway');

  let expandedDevices: Record<string, boolean> = $state({});
  let expandedTags: Record<string, boolean> = $state({});

  let vizMode: VizMode = $state('tree');

  type Variable = {
    variableId: string;
    value: unknown;
    datatype: string;
    cipType: string | null;
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

  // Subscribe to batched variable updates via SSE — scoped to this service's module
  onMount(() => {
    const serviceType = $page.params.serviceType;
    const unsub = subscribe<{ variableBatchUpdates: Variable[] }>(
      `subscription { variableBatchUpdates(moduleId: "${serviceType}") { variableId value datatype quality moduleId deviceId lastUpdated } }`,
      undefined,
      (result) => {
        const batch = result.variableBatchUpdates;
        if (batch) {
          for (const v of batch) {
            if (variableMap.has(v.variableId)) {
              const existing = variableMap.get(v.variableId)!;
              variableMap.set(v.variableId, {
                ...existing,
                value: v.value,
                quality: v.quality,
                lastUpdated: v.lastUpdated,
              });
            }
          }
          scheduleFlush();
        }
      },
    );
    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      unsub();
    };
  });

  type TagNode = {
    name: string;
    udtType?: string;
    variable?: Variable;
    members: { name: string; variable: Variable }[];
  };

  type TypeGroup = {
    typeName: string;
    instances: TagNode[];
  };

  type Device = {
    deviceId: string;
    typeGroups: TypeGroup[];
    scalars: TagNode[];
    totalVars: number;
  };

  const devices = $derived(() => {
    void updateVersion; // depend on debounced version
    const vars = [...variableMap.values()];
    const deviceMap = new Map<string, Variable[]>();
    for (const v of vars) {
      const did = v.deviceId ?? "unknown";
      if (!deviceMap.has(did)) deviceMap.set(did, []);
      deviceMap.get(did)!.push(v);
    }

    const result: Device[] = [];
    for (const [deviceId, dvars] of deviceMap) {
      // Group into base tags and their members
      const tagMap = new Map<string, TagNode>();
      const scalars: Variable[] = [];

      for (const v of dvars) {
        const dotIdx = v.variableId.indexOf(".");
        if (dotIdx === -1) {
          // Skip UDT parent tags — their members show in the struct section
          if (v.datatype !== "udt") {
            scalars.push(v);
          } else {
            // Store the UDT parent so we can grab its udtType
            if (!tagMap.has(v.variableId)) {
              tagMap.set(v.variableId, {
                name: v.variableId,
                udtType: v.udtType ?? undefined,
                members: [],
              });
            } else {
              tagMap.get(v.variableId)!.udtType = v.udtType ?? undefined;
            }
          }
        } else {
          const baseName = v.variableId.substring(0, dotIdx);
          const memberName = v.variableId.substring(dotIdx + 1);
          if (!tagMap.has(baseName)) {
            tagMap.set(baseName, {
              name: baseName,
              udtType: v.udtType ?? undefined,
              members: [],
            });
          }
          tagMap.get(baseName)!.members.push({ name: memberName, variable: v });
        }
      }

      // Sort members within each tag
      for (const tag of tagMap.values()) {
        tag.members.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Group struct tags by UDT type name
      const typeGroupMap = new Map<string, TagNode[]>();
      for (const tag of tagMap.values()) {
        if (tag.members.length === 0) continue; // skip parent-only tags with no members
        const typeName = tag.udtType ?? "Unknown Type";
        if (!typeGroupMap.has(typeName)) typeGroupMap.set(typeName, []);
        typeGroupMap.get(typeName)!.push(tag);
      }

      // Sort groups and instances
      const typeGroups: TypeGroup[] = [...typeGroupMap.entries()]
        .map(([typeName, instances]) => ({
          typeName,
          instances: instances.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.typeName.localeCompare(b.typeName));

      const scalarTags = scalars
        .map(
          (s) => ({ name: s.variableId, variable: s, members: [] }) as TagNode,
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      result.push({
        deviceId,
        typeGroups,
        scalars: scalarTags,
        totalVars: dvars.length,
      });
    }

    result.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
    return result;
  });

  // Build D3 hierarchy for sunburst visualization
  type SunburstNode = {
    name: string;
    children?: SunburstNode[];
    value?: number;
    displayValue?: string;
  };
  const sunburstData = $derived((): SunburstNode => {
    const devs = devices();
    return {
      name: "Devices",
      children: devs.map((device) => ({
        name: device.deviceId,
        children: [
          ...device.typeGroups.map((group) => ({
            name: group.typeName,
            children: group.instances.map((tag) => ({
              name: tag.name,
              children:
                tag.members.length > 0
                  ? tag.members.map((m) => ({ name: m.name, value: 1, displayValue: formatValue(m.variable.value) }))
                  : [{ name: "(empty)", value: 1 }],
            })),
          })),
          ...(device.scalars.filter((t) => t.variable).length > 0
            ? [{
                name: "Atomic",
                children: device.scalars
                  .filter((t) => t.variable)
                  .map((tag) => ({ name: tag.name, value: 1, displayValue: formatValue(tag.variable!.value) })),
              }]
            : []),
        ],
      })),
    };
  });

  function toggleDevice(id: string) {
    expandedDevices[id] = !expandedDevices[id];
  }

  function toggleTag(key: string) {
    expandedTags[key] = !expandedTags[key];
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(3);
    }
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  }

  function getQualityColor(quality: string): string {
    if (quality === "good") return "var(--color-green-500, #22c55e)";
    if (quality === "bad") return "var(--color-red-500, #ef4444)";
    return "var(--theme-text-muted)";
  }

  // ═══════════════════════════════════════════════════════════════════
  // Gateway device management
  // ═══════════════════════════════════════════════════════════════════

  let showAddDevice = $state(false);
  let saving = $state(false);
  let newDevice = $state({
    deviceId: '',
    protocol: 'ethernetip' as string,
    host: '',
    port: '',
    endpointUrl: '',
    version: '2c',
    community: 'public',
    unitId: '1',
  });

  function resetNewDevice() {
    newDevice = {
      deviceId: '',
      protocol: 'ethernetip',
      host: '',
      port: '',
      endpointUrl: '',
      version: '2c',
      community: 'public',
      unitId: '1',
    };
  }

  async function addDevice() {
    if (!newDevice.deviceId) return;
    saving = true;
    try {
      const variables: Record<string, unknown> = {
        gatewayId: 'gateway',
        device: {
          deviceId: newDevice.deviceId,
          protocol: newDevice.protocol,
          ...(newDevice.protocol !== 'opcua' && newDevice.host ? { host: newDevice.host } : {}),
          ...(newDevice.port ? { port: parseInt(newDevice.port) } : {}),
          ...(newDevice.protocol === 'opcua' && newDevice.endpointUrl ? { endpointUrl: newDevice.endpointUrl } : {}),
          ...(newDevice.protocol === 'snmp' ? { version: newDevice.version, community: newDevice.community } : {}),
          ...(newDevice.protocol === 'modbus' && newDevice.unitId ? { unitId: parseInt(newDevice.unitId) } : {}),
        },
      };

      const result = await graphql(`
        mutation SetGatewayDevice($gatewayId: String!, $device: GatewayDeviceInput!) {
          setGatewayDevice(gatewayId: $gatewayId, device: $device) {
            gatewayId
          }
        }
      `, variables);

      if (result.errors) {
        saltState.addNotification({ message: result.errors[0].message, type: 'error' });
      } else {
        saltState.addNotification({ message: `Device "${newDevice.deviceId}" added`, type: 'success' });
        resetNewDevice();
        showAddDevice = false;
        await invalidateAll();
      }
    } catch (err) {
      saltState.addNotification({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      saving = false;
    }
  }

  async function removeDevice(deviceId: string) {
    saving = true;
    try {
      const result = await graphql(`
        mutation DeleteGatewayDevice($gatewayId: String!, $deviceId: String!) {
          deleteGatewayDevice(gatewayId: $gatewayId, deviceId: $deviceId) {
            gatewayId
          }
        }
      `, { gatewayId: 'gateway', deviceId });

      if (result.errors) {
        saltState.addNotification({ message: result.errors[0].message, type: 'error' });
      } else {
        saltState.addNotification({ message: `Device "${deviceId}" removed`, type: 'success' });
        await invalidateAll();
      }
    } catch (err) {
      saltState.addNotification({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      saving = false;
    }
  }

  const protocolLabels: Record<string, string> = {
    ethernetip: 'EtherNet/IP',
    opcua: 'OPC UA',
    snmp: 'SNMP',
    modbus: 'Modbus TCP',
  };

  function formatDeviceInfo(device: { protocol: string; config: Record<string, unknown> }): string {
    switch (device.protocol) {
      case 'ethernetip':
        return `${device.config.host ?? ''}:${device.config.port ?? 44818}`;
      case 'opcua':
        return String(device.config.endpointUrl ?? '');
      case 'snmp':
        return `${device.config.host ?? ''}:${device.config.port ?? 161} (v${device.config.version ?? '2c'})`;
      case 'modbus':
        return `${device.config.host ?? ''}:${device.config.port ?? 502} (unit ${device.config.unitId ?? 1})`;
      default:
        return '';
    }
  }
</script>

{#if isGateway}
<div class="devices-page">
  {#if data.error}
    <div class="error-box"><p>{data.error}</p></div>
  {/if}

  <div class="devices-header">
    <h1>Devices</h1>
    <span class="count-badge">{data.gatewayConfig?.devices?.length ?? 0} devices</span>
    <button class="add-btn" onclick={() => { showAddDevice = !showAddDevice; }} disabled={saving}>
      {showAddDevice ? 'Cancel' : '+ Add Device'}
    </button>
  </div>

  {#if showAddDevice}
    <div class="add-form">
      <div class="form-row">
        <label for="gw-device-id">Device ID</label>
        <input id="gw-device-id" type="text" bind:value={newDevice.deviceId} placeholder="e.g. plc-1" />
      </div>
      <div class="form-row">
        <label for="gw-protocol">Protocol</label>
        <select id="gw-protocol" bind:value={newDevice.protocol}>
          <option value="ethernetip">EtherNet/IP</option>
          <option value="opcua">OPC UA</option>
          <option value="snmp">SNMP</option>
          <option value="modbus">Modbus TCP</option>
        </select>
      </div>
      {#if newDevice.protocol === 'opcua'}
        <div class="form-row">
          <label for="gw-endpoint">Endpoint URL</label>
          <input id="gw-endpoint" type="text" bind:value={newDevice.endpointUrl} placeholder="opc.tcp://192.168.1.50:4840" />
        </div>
      {:else}
        <div class="form-row">
          <label for="gw-host">Host</label>
          <input id="gw-host" type="text" bind:value={newDevice.host} placeholder="192.168.1.100" />
        </div>
        <div class="form-row">
          <label for="gw-port">Port</label>
          <input id="gw-port" type="text" bind:value={newDevice.port} placeholder={newDevice.protocol === 'ethernetip' ? '44818' : newDevice.protocol === 'snmp' ? '161' : '502'} />
        </div>
      {/if}
      {#if newDevice.protocol === 'snmp'}
        <div class="form-row">
          <label for="gw-version">SNMP Version</label>
          <select id="gw-version" bind:value={newDevice.version}>
            <option value="1">v1</option>
            <option value="2c">v2c</option>
            <option value="3">v3</option>
          </select>
        </div>
        <div class="form-row">
          <label for="gw-community">Community</label>
          <input id="gw-community" type="text" bind:value={newDevice.community} placeholder="public" />
        </div>
      {/if}
      {#if newDevice.protocol === 'modbus'}
        <div class="form-row">
          <label for="gw-unitid">Unit ID</label>
          <input id="gw-unitid" type="text" bind:value={newDevice.unitId} placeholder="1" />
        </div>
      {/if}
      <div class="form-actions">
        <button class="save-btn" onclick={addDevice} disabled={saving || !newDevice.deviceId}>
          {saving ? 'Saving...' : 'Add Device'}
        </button>
      </div>
    </div>
  {/if}

  {#if data.gatewayConfig?.devices && data.gatewayConfig.devices.length > 0}
    <div class="tree">
      {#each data.gatewayConfig.devices as device}
        <div class="tree-leaf device-row">
          <span class="protocol-badge">{protocolLabels[device.protocol] ?? device.protocol}</span>
          <span class="leaf-name">{device.deviceId}</span>
          <span class="device-host">{formatDeviceInfo(device)}</span>
          <span class="var-count">{data.gatewayConfig.variables.filter(v => v.deviceId === device.deviceId).length} vars</span>
          <button class="delete-btn" onclick={() => removeDevice(device.deviceId)} disabled={saving} title="Remove device">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {:else if !data.error && !showAddDevice}
    <div class="empty-state">
      <p>No devices configured. Click "Add Device" to connect to a scanner.</p>
    </div>
  {/if}
</div>
{:else}
<div class="devices-page">
  {#if data.error}
    <div class="error-box">
      <p>{data.error}</p>
    </div>
  {/if}

  <div class="devices-header">
    <h1>Devices</h1>
    <span class="count-badge">{devices().length} devices</span>
    <span class="count-badge">{variableMap.size} tags</span>
    <DiagramSelector bind:mode={vizMode} />
  </div>

  {#if vizMode === "tree"}
  <div class="tree-content">
    {#if devices().length > 0}
      <div class="tree">
        {#each devices() as device}
          <div class="tree-node">
            <button
              class="tree-toggle"
              onclick={() => toggleDevice(device.deviceId)}
            >
              <svg
                class="chevron"
                class:expanded={expandedDevices[device.deviceId]}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span class="device-icon">DEV</span>
              <span class="tree-label">{device.deviceId}</span>
              {#if data.deviceInfo[device.deviceId]}
                <span class="device-host"
                  >{data.deviceInfo[device.deviceId].host}:{data.deviceInfo[
                    device.deviceId
                  ].port}</span
                >
              {/if}
              <span class="member-count">{device.totalVars} tags</span>
            </button>
            {#if expandedDevices[device.deviceId]}
              <div class="tree-children">
                <!-- UDT type groups -->
                {#each device.typeGroups as group}
                  <div class="tree-node">
                    <button
                      class="tree-toggle"
                      onclick={() =>
                        toggleTag(device.deviceId + ":type:" + group.typeName)}
                    >
                      <svg
                        class="chevron"
                        class:expanded={expandedTags[
                          device.deviceId + ":type:" + group.typeName
                        ]}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      <span class="type-icon">T</span>
                      <span class="tree-label">{group.typeName}</span>
                      <span class="member-count"
                        >{group.instances.length} instances</span
                      >
                    </button>
                    {#if expandedTags[device.deviceId + ":type:" + group.typeName]}
                      <div class="tree-children">
                        {#each group.instances as tag}
                          <div class="tree-node">
                            <button
                              class="tree-toggle"
                              onclick={() =>
                                toggleTag(device.deviceId + "." + tag.name)}
                            >
                              <svg
                                class="chevron"
                                class:expanded={expandedTags[
                                  device.deviceId + "." + tag.name
                                ]}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                              <span class="struct-icon">S</span>
                              <span class="tree-label">{tag.name}</span>
                              <span class="member-count"
                                >{tag.members.length} members</span
                              >
                            </button>
                            {#if expandedTags[device.deviceId + "." + tag.name]}
                              <div class="tree-children">
                                {#each tag.members as member}
                                  <div class="tree-leaf">
                                    <span
                                      class="quality-dot"
                                      style="background: {getQualityColor(
                                        member.variable.quality,
                                      )}"
                                      title="Quality: {member.variable.quality}"
                                    ></span>
                                    <span class="leaf-name">{member.name}</span>
                                    <span class="leaf-value"
                                      >{formatValue(
                                        member.variable.value,
                                      )}</span
                                    >
                                    <span class="leaf-type"
                                      >{member.variable.datatype}</span
                                    >
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

                <!-- Scalar tags -->
                {#each device.scalars as tag}
                  {#if tag.variable}
                    <div class="tree-leaf">
                      <span
                        class="quality-dot"
                        style="background: {getQualityColor(
                          tag.variable.quality,
                        )}"
                        title="Quality: {tag.variable.quality}"
                      ></span>
                      <span class="leaf-name">{tag.name}</span>
                      <span class="leaf-value"
                        >{formatValue(tag.variable.value)}</span
                      >
                      <span class="leaf-type">{tag.variable.datatype}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if !data.error}
      <div class="empty-state">
        <p>
          No devices connected. The EtherNet/IP scanner will show devices here
          when a PLC project subscribes to tags.
        </p>
      </div>
    {/if}
  </div>
  {:else if (sunburstData().children && sunburstData().children?.length) || 0 > 0}
    <div class="diagram-content">
      <Sunburst data={sunburstData()} />
    </div>
  {:else if !data.error}
    <div class="empty-state">
      <p>
        No devices connected. The EtherNet/IP scanner will show devices here
        when a PLC project subscribes to tags.
      </p>
    </div>
  {/if}
</div>
{/if}

<style lang="scss">
  .devices-page {
    padding: 2rem;
  }

  .tree-content {
    max-width: 900px;
  }

  .diagram-content {
    display: flex;
    justify-content: center;
  }

  .devices-header {
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
    font-family: "IBM Plex Mono", monospace;
    background: var(--badge-teal-bg);
    color: var(--badge-teal-text);
  }

  .tree {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    overflow: hidden;
  }

  .tree-node {
    &:not(:last-child) {
      border-bottom: 1px solid
        color-mix(in srgb, var(--theme-border) 50%, transparent);
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

  .device-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 20px;
    border-radius: var(--rounded-sm);
    background: var(--badge-amber-bg);
    color: var(--badge-amber-text);
    font-size: 0.5625rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--rounded-sm);
    background: var(--badge-teal-bg);
    color: var(--badge-teal-text);
    font-size: 0.6875rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .struct-icon {
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
    font-family: "IBM Plex Mono", monospace;
    font-weight: 500;
  }

  .device-host {
    font-size: 0.6875rem;
    font-family: "IBM Plex Mono", monospace;
    color: var(--badge-muted-text);
    padding: 0.1rem 0.35rem;
    border-radius: var(--rounded-sm);
    background: var(--badge-muted-bg);
  }

  .member-count {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    margin-left: auto;
  }

  .tree-children {
    border-top: 1px solid
      color-mix(in srgb, var(--theme-border) 50%, transparent);

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
      border-bottom: 1px solid
        color-mix(in srgb, var(--theme-border) 30%, transparent);
    }
  }

  .quality-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .leaf-name {
    font-family: "IBM Plex Mono", monospace;
    color: var(--theme-text);
  }

  .leaf-value {
    margin-left: auto;
    font-family: "IBM Plex Mono", monospace;
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
  .add-btn {
    margin-left: auto;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-md);
    background: var(--theme-surface);
    color: var(--theme-text);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--theme-text) 5%, var(--theme-surface));
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .add-form {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;

    label {
      font-size: 0.8125rem;
      color: var(--theme-text-muted);
      min-width: 100px;
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

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .save-btn {
    padding: 0.375rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    border-radius: var(--rounded-md);
    background: var(--theme-primary);
    color: white;
    cursor: pointer;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .protocol-badge {
    padding: 0.15rem 0.4rem;
    border-radius: var(--rounded-sm);
    font-size: 0.6875rem;
    font-weight: 600;
    background: var(--badge-teal-bg);
    color: var(--badge-teal-text);
    flex-shrink: 0;
  }

  .device-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .var-count {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    margin-left: auto;
  }

  .delete-btn {
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

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
