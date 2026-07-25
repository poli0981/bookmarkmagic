<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    type?: 'button' | 'submit';
    onclick?: () => void;
    children: Snippet;
  }

  let { variant = 'secondary', disabled = false, type = 'button', onclick, children }: Props =
    $props();
</script>

<button class={variant} {type} {disabled} {onclick}>{@render children()}</button>

<style>
  button {
    font: inherit;
    padding: var(--sp-2) var(--sp-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-raised);
    color: var(--fg);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--accent);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }

  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
</style>
