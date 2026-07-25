<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tone?: 'info' | 'warn' | 'danger' | 'success';
    children: Snippet;
  }

  let { tone = 'info', children }: Props = $props();
</script>

<div class="callout {tone}" role={tone === 'danger' ? 'alert' : undefined}>
  {@render children()}
</div>

<style>
  .callout {
    padding: var(--sp-3);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--fg-muted);
    background: var(--bg-raised);
    font-size: var(--fs-1);
  }

  .warn {
    border-left-color: var(--warn);
  }

  .danger {
    border-left-color: var(--danger);
  }

  .success {
    border-left-color: var(--success);
  }
</style>
