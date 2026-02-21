<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { subscribe } from '$lib/graphql/client';

  interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    serviceType: string;
    moduleId: string;
    logger: string | null;
  }

  interface Props {
    serviceType: string;
    initialLogs: LogEntry[];
  }

  let { serviceType, initialLogs }: Props = $props();

  const MAX_LINES = 500;

  let logs = $state<LogEntry[]>([]);

  // Initialize from SSR data (reverse to show newest first)
  $effect(() => {
    if (initialLogs.length > 0 && logs.length === 0) {
      logs = [...initialLogs].reverse();
    }
  });
  let showDebug = $state(true);
  let showInfo = $state(true);
  let showWarn = $state(true);
  let showError = $state(true);

  let unsubscribe: (() => void) | null = null;

  const filteredLogs = $derived(
    logs.filter(log => {
      if (log.level === 'debug' && !showDebug) return false;
      if (log.level === 'info' && !showInfo) return false;
      if (log.level === 'warn' && !showWarn) return false;
      if (log.level === 'error' && !showError) return false;
      return true;
    })
  );

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
  }

  function levelColor(level: string): string {
    switch (level) {
      case 'error': return 'var(--color-red-500, #ef4444)';
      case 'warn': return 'var(--color-yellow-500, #eab308)';
      case 'info': return 'var(--color-sky-500, #0ea5e9)';
      case 'debug': return 'var(--color-purple-500, #a855f7)';
      default: return 'var(--theme-text-muted)';
    }
  }

  onMount(() => {
    // Subscribe to real-time log stream
    unsubscribe = subscribe<{ serviceLogs: LogEntry }>(
      `subscription($serviceType: String!) {
        serviceLogs(serviceType: $serviceType) {
          timestamp
          level
          message
          serviceType
          moduleId
          logger
        }
      }`,
      { serviceType },
      (data) => {
        logs = [data.serviceLogs, ...logs].slice(0, MAX_LINES);
      }
    );
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<div class="log-viewer">
  <div class="log-toolbar">
    <div class="filters">
      <label class="filter-toggle" class:active={showDebug}>
        <input type="checkbox" bind:checked={showDebug} />
        <span class="filter-label" style="--level-color: {levelColor('debug')}">DBG</span>
      </label>
      <label class="filter-toggle" class:active={showInfo}>
        <input type="checkbox" bind:checked={showInfo} />
        <span class="filter-label" style="--level-color: {levelColor('info')}">INF</span>
      </label>
      <label class="filter-toggle" class:active={showWarn}>
        <input type="checkbox" bind:checked={showWarn} />
        <span class="filter-label" style="--level-color: {levelColor('warn')}">WRN</span>
      </label>
      <label class="filter-toggle" class:active={showError}>
        <input type="checkbox" bind:checked={showError} />
        <span class="filter-label" style="--level-color: {levelColor('error')}">ERR</span>
      </label>
    </div>
    <div class="toolbar-right">
      <span class="line-count">{filteredLogs.length} lines</span>
    </div>
  </div>

  <div class="log-output">
    {#if filteredLogs.length === 0}
      <div class="empty-state">
        <p>No log entries yet. Logs will appear here in real-time as the service runs.</p>
      </div>
    {:else}
      {#each filteredLogs as entry}
        <div class="log-line">
          <span class="log-time">{formatTime(entry.timestamp)}</span>
          <span class="log-level" style="color: {levelColor(entry.level)}">{entry.level.toUpperCase().padEnd(5)}</span>
          {#if entry.logger}
            <span class="log-logger">[{entry.logger}]</span>
          {/if}
          <span class="log-message">{entry.message}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  .log-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-lg);
    overflow: hidden;
  }

  .log-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--theme-surface);
    border-bottom: 1px solid var(--theme-border);
  }

  .filters {
    display: flex;
    gap: 0.25rem;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    cursor: pointer;

    input {
      display: none;
    }

    .filter-label {
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600;
      border-radius: var(--rounded-md);
      border: 1px solid var(--theme-border);
      color: var(--theme-text-muted);
      transition: all 0.15s ease;
    }

    &.active .filter-label {
      color: var(--level-color);
      border-color: var(--level-color);
      background: color-mix(in srgb, var(--level-color) 10%, transparent);
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .line-count {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
  }

  .log-output {
    flex: 1;
    overflow-y: auto;
    background: color-mix(in srgb, var(--theme-background) 80%, #000);
    padding: 0.5rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    min-height: 400px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;

    p {
      color: var(--theme-text-muted);
      font-family: 'Space Grotesk', sans-serif;
      font-size: 0.875rem;
    }
  }

  .log-line {
    display: flex;
    gap: 0.5rem;
    padding: 0.0625rem 0.25rem;
    white-space: nowrap;

    &:hover {
      background: color-mix(in srgb, var(--theme-text) 5%, transparent);
    }
  }

  .log-time {
    color: var(--theme-text-muted);
    flex-shrink: 0;
  }

  .log-level {
    flex-shrink: 0;
    font-weight: 600;
    width: 3.5rem;
  }

  .log-logger {
    color: var(--theme-text-muted);
    flex-shrink: 0;
  }

  .log-message {
    color: var(--theme-text);
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
