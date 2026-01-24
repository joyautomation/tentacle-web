<script lang="ts">
  import { slide } from 'svelte/transition';

  interface Variable {
    projectId: string;
    variableId: string;
    value: unknown;
    datatype: string;
    quality: string;
    source: string;
    lastUpdated: string;
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
  }

  let { variables }: Props = $props();

  // Track expanded state by path
  let expandedPaths = $state<Set<string>>(new Set());

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
</script>

<div class="tree-controls">
  <button class="small ghost" onclick={expandAll}>Expand All</button>
  <button class="small ghost" onclick={collapseAll}>Collapse All</button>
</div>

<div class="tree">
  {#each [...tree.children.values()] as node (node.path)}
    {@render treeNode(node, 0)}
  {/each}
</div>

{#snippet treeNode(node: TreeNode, depth: number)}
  <div class="tree-item" style="--depth: {depth}">
    {#if node.variable}
      <!-- Leaf node (actual variable) -->
      <div class="tree-leaf">
        <span class="leaf-name">{node.name}</span>
        <span class="leaf-value value-{node.variable.datatype}">{formatValue(node.variable.value)}</span>
        <span class="leaf-type">{node.variable.datatype}</span>
        <span class="leaf-quality quality-{node.variable.quality}">{node.variable.quality}</span>
        <span class="leaf-time">{formatTime(node.variable.lastUpdated)}</span>
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

<style lang="scss">
  .tree-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tree {
    background: var(--theme-surface);
    border: 1px solid var(--theme-border);
    border-radius: var(--rounded-xl);
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
    grid-template-columns: 1fr auto auto auto auto;
    align-items: center;
    gap: 1rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--rounded-md);
    transition: background-color 0.15s;

    &:hover {
      background: var(--theme-surface-hover);
    }
  }

  .leaf-name {
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .leaf-value {
    font-family: monospace;
    font-weight: 500;
    color: var(--theme-primary);
    min-width: 6rem;
    text-align: right;
  }

  .leaf-value.value-boolean {
    color: var(--amber-500);
  }

  .leaf-type {
    font-size: 0.75rem;
    color: var(--theme-text-muted);
    min-width: 4rem;
  }

  .leaf-quality {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: var(--rounded-full);
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
</style>
