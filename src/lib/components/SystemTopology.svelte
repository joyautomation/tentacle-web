<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import * as d3 from 'd3';

  interface Service {
    serviceType: string;
    moduleId: string;
    uptime: number;
    version: string | null;
    metadata: Record<string, unknown> | null;
  }

  interface Props {
    services: Service[];
    graphqlConnected: boolean;
  }

  let { services, graphqlConnected }: Props = $props();

  type NodeType = 'nats' | 'graphql' | 'web' | 'ethernetip' | 'mqtt' | 'plc' | 'network' | 'nftables';

  type NodeDatum = {
    id: string;
    name: string;
    type: NodeType;
    subtitle?: string;
    depth: number;
    connected: boolean;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  };

  type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & {
    source: NodeDatum | string;
    target: NodeDatum | string;
  };

  let container: HTMLDivElement;
  let simulation: d3.Simulation<NodeDatum, LinkDatum> | null = null;
  let svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let currentNodes: NodeDatum[] = [];

  function getNodeColor(type: NodeType): string {
    switch (type) {
      case 'nats': return 'var(--color-purple-500, #a855f7)';
      case 'graphql': return 'var(--color-pink-500, #ec4899)';
      case 'web': return 'var(--color-sky-500, #0ea5e9)';
      case 'ethernetip': return 'var(--color-cyan-500, #06b6d4)';
      case 'mqtt': return 'var(--color-green-500, #22c55e)';
      case 'plc': return 'var(--color-amber-500, #f59e0b)';
      default: return 'var(--theme-text-muted)';
    }
  }

  function getNodeRadius(type: NodeType): number {
    switch (type) {
      case 'nats': return 50;
      case 'graphql':
      case 'web': return 40;
      case 'ethernetip':
      case 'mqtt':
      case 'plc': return 35;
      default: return 30;
    }
  }

  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  function buildGraph(): { nodes: NodeDatum[]; links: LinkDatum[] } {
    const nodes: NodeDatum[] = [];
    const links: LinkDatum[] = [];

    // NATS — always present as central hub
    nodes.push({
      id: 'nats',
      name: 'NATS',
      type: 'nats',
      subtitle: graphqlConnected ? 'Message Bus' : 'Disconnected',
      connected: graphqlConnected,
      depth: 0
    });

    // tentacle-graphql — always shown, dimmed when disconnected
    const gqlService = services.find(s => s.serviceType === 'graphql');
    nodes.push({
      id: 'graphql',
      name: 'GraphQL',
      type: 'graphql',
      subtitle: graphqlConnected
        ? (gqlService ? `Up ${formatUptime(gqlService.uptime)}` : 'API')
        : 'Offline',
      connected: graphqlConnected,
      depth: 1
    });
    links.push({ source: 'nats', target: 'graphql' });

    // tentacle-web — always present (we're rendering it)
    nodes.push({
      id: 'web',
      name: 'Web UI',
      type: 'web',
      subtitle: 'This App',
      connected: true,
      depth: 2
    });
    links.push({ source: 'graphql', target: 'web' });

    // Additional discovered services from heartbeats
    const knownStaticTypes = new Set(['graphql']);
    services
      .filter(s => !knownStaticTypes.has(s.serviceType))
      .forEach(service => {
        const nodeId = `${service.serviceType}-${service.moduleId}`;
        // Skip if we already have this node
        if (nodes.some(n => n.id === nodeId)) return;

        let name: string;
        switch (service.serviceType) {
          case 'ethernetip': name = 'EtherNet/IP'; break;
          case 'mqtt': name = 'MQTT'; break;
          case 'plc': name = service.moduleId; break;
          default: name = service.serviceType;
        }

        nodes.push({
          id: nodeId,
          name,
          type: service.serviceType as NodeType,
          subtitle: `Up ${formatUptime(service.uptime)}`,
          connected: true,
          depth: 1
        });
        links.push({ source: 'nats', target: nodeId });
      });

    return { nodes, links };
  }

  function handleResize() {
    if (!container || !svgSelection || !simulation) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const layerRadius = Math.min(width, height) * 0.15;

    // Update viewBox without destroying anything
    svgSelection.attr('viewBox', `0 0 ${width} ${height}`);

    // Re-center NATS pin
    const natsNode = currentNodes.find(n => n.id === 'nats');
    if (natsNode) {
      natsNode.fx = width / 2;
      natsNode.fy = height / 2;
    }

    // Update radial force center and radius, then gently reheat
    simulation
      .force('radial', d3.forceRadial<NodeDatum>(
        d => d.depth * layerRadius,
        width / 2,
        height / 2
      ).strength(1.5))
      .alpha(0.3)
      .restart();
  }

  function render() {
    if (!container) return;

    // Stop previous simulation
    simulation?.stop();

    // Clear previous
    d3.select(container).selectAll('*').remove();
    svgSelection = null;

    const { nodes, links } = buildGraph();
    if (nodes.length === 0) return;

    currentNodes = nodes;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svgSelection = svg;

    // Defs for glow filter
    const defs = svg.append('defs');

    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Container group for zoom
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Pin NATS to center
    const natsNode = nodes.find(n => n.id === 'nats');
    if (natsNode) {
      natsNode.fx = width / 2;
      natsNode.fy = height / 2;
    }

    // Seed initial positions so connected nodes start in the same quadrant
    const cx = width / 2;
    const cy = height / 2;
    const layer1 = nodes.filter(n => n.depth === 1);
    const angleStep = (2 * Math.PI) / Math.max(layer1.length, 1);
    layer1.forEach((n, i) => {
      const angle = angleStep * i - Math.PI / 2;
      n.x = cx + Math.cos(angle) * 120;
      n.y = cy + Math.sin(angle) * 120;
    });
    // Place depth-2 nodes near their parent (same angle, further out)
    nodes.filter(n => n.depth === 2).forEach(n => {
      // Find the link whose target is this node and get its source position
      const parentLink = links.find(l => {
        const targetId = typeof l.target === 'string' ? l.target : (l.target as NodeDatum).id;
        return targetId === n.id;
      });
      if (parentLink) {
        const sourceId = typeof parentLink.source === 'string' ? parentLink.source : (parentLink.source as NodeDatum).id;
        const parent = nodes.find(p => p.id === sourceId);
        if (parent?.x != null && parent?.y != null) {
          const angle = Math.atan2(parent.y - cy, parent.x - cx);
          n.x = cx + Math.cos(angle) * 200;
          n.y = cy + Math.sin(angle) * 200;
        }
      }
    });

    // Radial distance per depth layer
    const layerRadius = Math.min(width, height) * 0.15;

    // Force simulation with radial star layout
    simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links)
        .id(d => d.id)
        .distance(layerRadius * 0.9)
        .strength(1)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('radial', d3.forceRadial<NodeDatum>(
        d => d.depth * layerRadius,
        cx,
        cy
      ).strength(1.5))
      .force('collision', d3.forceCollide<NodeDatum>()
        .radius(d => getNodeRadius(d.type) + 20)
      );

    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--theme-border)')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', d => {
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : (d.target as NodeDatum).id));
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as NodeDatum).id));
        return (!targetNode?.connected || !sourceNode?.connected) ? 0.2 : 0.6;
      })
      .attr('stroke-dasharray', d => {
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : (d.target as NodeDatum).id));
        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : (d.source as NodeDatum).id));
        return (!targetNode?.connected || !sourceNode?.connected) ? '4 4' : 'none';
      });

    // Draw nodes
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node');

    // Node circles — dashed + dimmed when disconnected
    nodeGroups.append('circle')
      .attr('r', d => getNodeRadius(d.type))
      .attr('fill', 'var(--theme-surface)')
      .attr('stroke', d => getNodeColor(d.type))
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', d => d.connected ? 'none' : '6 4')
      .attr('opacity', d => d.connected ? 1 : 0.4)
      .attr('filter', d => d.connected ? 'url(#glow)' : 'none');

    // Node abbreviation text
    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => getNodeColor(d.type))
      .attr('font-size', d => d.type === 'nats' ? '12px' : '10px')
      .attr('font-weight', '600')
      .attr('opacity', d => d.connected ? 1 : 0.4)
      .text(d => {
        switch (d.type) {
          case 'nats': return 'NATS';
          case 'graphql': return 'GQL';
          case 'web': return 'WEB';
          case 'ethernetip': return 'EIP';
          case 'mqtt': return 'MQTT';
          case 'plc': return 'PLC';
          case 'network': return 'NET';
          case 'nftables': return 'NAT';
          default: return d.name.slice(0, 4).toUpperCase();
        }
      });

    // Node labels below
    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => getNodeRadius(d.type) + 16)
      .attr('fill', 'var(--theme-text)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('opacity', d => d.connected ? 1 : 0.4)
      .text(d => d.name);

    // Node subtitles
    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', d => getNodeRadius(d.type) + 30)
      .attr('fill', d => !d.connected ? '#ef4444' : 'var(--theme-text-muted)')
      .attr('font-size', '10px')
      .attr('opacity', d => d.connected ? 1 : 0.6)
      .text(d => d.subtitle || '');

    // Drag behavior with click-vs-drag discrimination
    let dragMoved = false;
    const drag = d3.drag<SVGGElement, NodeDatum>()
      .on('start', (event, d) => {
        dragMoved = false;
        if (!event.active) simulation?.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        dragMoved = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation?.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        // Navigate on click (not drag)
        if (!dragMoved) {
          goto(`/services/${d.type}`);
        }
      });

    nodeGroups.call(drag);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NodeDatum).x ?? 0)
        .attr('y1', d => (d.source as NodeDatum).y ?? 0)
        .attr('x2', d => (d.target as NodeDatum).x ?? 0)
        .attr('y2', d => (d.target as NodeDatum).y ?? 0);

      nodeGroups.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
  }

  // Re-render when data changes
  $effect(() => {
    services;
    graphqlConnected;

    if (container) {
      render();
    }
  });

  onMount(() => {
    render();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    simulation?.stop();
  });
</script>

<div class="topology-container" bind:this={container}></div>

<style lang="scss">
  .topology-container {
    width: 100%;
    height: calc(100vh - var(--header-height) - 4rem);
    min-height: 400px;
    overflow: hidden;

    :global(svg) {
      display: block;
    }

    :global(.node) {
      cursor: pointer;
      transition: opacity 0.2s;
    }

    :global(.node:active) {
      cursor: grabbing;
    }

    :global(.node:hover circle) {
      stroke-width: 4;
      filter: url(#glow) brightness(1.2);
    }
  }
</style>
