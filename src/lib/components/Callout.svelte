<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from './icons/Icon.svelte';

  interface Props {
    tone?: 'info' | 'warn' | 'danger' | 'success';
    children: Snippet;
  }

  let { tone = 'info', children }: Props = $props();

  const ICONS: Record<NonNullable<Props['tone']>, IconName> = {
    info: 'info',
    warn: 'warning',
    danger: 'error',
    success: 'check',
  };
</script>

<div class="callout {tone}" role={tone === 'danger' ? 'alert' : undefined}>
  <span class="glyph">
    <Icon name={ICONS[tone]} motion={tone === 'success' ? 'draw' : 'none'} size={16} />
  </span>
  <div class="text">{@render children()}</div>
</div>

<style>
  .callout {
    display: flex;
    gap: var(--sp-3);
    align-items: flex-start;
    padding: var(--sp-3);
    border: 1px solid var(--border);
    border-left: 3px solid var(--fg-muted);
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    font-size: var(--fs-1);
  }

  .glyph {
    display: flex;
    padding-top: 1px;
    color: var(--fg-muted);
  }

  .text {
    min-width: 0;
  }

  .warn {
    border-left-color: var(--warn);
  }

  .warn .glyph {
    color: var(--warn);
  }

  .danger {
    border-left-color: var(--danger);
  }

  .danger .glyph {
    color: var(--danger);
  }

  .success {
    border-left-color: var(--success);
  }

  .success .glyph {
    color: var(--success);
  }
</style>
