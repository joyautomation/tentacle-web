<script lang="ts">
  import SystemTopology from '$lib/components/SystemTopology.svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Live-updating services list — initialized from server data
  let liveServices = $state(data.services);
  let graphqlConnected = $state(data.graphqlConnected);

  // Poll services every 5 seconds for real-time topology updates
  onMount(() => {
    // Fingerprint services to detect actual changes (avoid re-render on identical data)
    let lastFingerprint = '';

    function fingerprint(svcs: typeof liveServices): string {
      return svcs
        .map(s => `${s.serviceType}:${s.moduleId}:${JSON.stringify(s.metadata ?? {})}`)
        .sort()
        .join('|');
    }

    lastFingerprint = fingerprint(liveServices);

    const poll = async () => {
      try {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ services { serviceType moduleId uptime version metadata enabled } }`
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data?.services) {
            const newFp = fingerprint(json.data.services);
            if (newFp !== lastFingerprint) {
              lastFingerprint = newFp;
              liveServices = json.data.services;
            }
            graphqlConnected = true;
          }
        } else {
          if (graphqlConnected) graphqlConnected = false;
        }
      } catch {
        if (graphqlConnected) graphqlConnected = false;
      }
    };

    const interval = setInterval(poll, 5000);
    // Initial poll after a short delay to catch fast changes
    setTimeout(poll, 1000);

    return () => clearInterval(interval);
  });
</script>

<div class="page">
  {#if !graphqlConnected}
    <div class="disconnected-banner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div class="banner-text">
        <strong>GraphQL service unreachable</strong>
        <span>Start tentacle-graphql to view system status.</span>
      </div>
    </div>
  {/if}
  <SystemTopology services={liveServices} {graphqlConnected} />
</div>

<style lang="scss">
  .page {
    padding: 2rem;
  }

  .disconnected-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: var(--rounded-lg);
    color: var(--theme-text);

    svg {
      flex-shrink: 0;
      margin-top: 0.125rem;
      color: #ef4444;
    }

    .banner-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;

      strong {
        font-size: 0.875rem;
        color: #ef4444;
      }

      span {
        font-size: 0.8125rem;
        color: var(--theme-text-muted);
      }
    }
  }
</style>
