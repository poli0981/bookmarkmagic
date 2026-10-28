<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon, { type IconMotion, type IconName } from './icons/Icon.svelte';

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    icon?: IconName;
    iconMotion?: IconMotion;
    /**
     * Accessible name for an icon-only button. Required in practice: with no
     * children and no label, the button would be announced as just "button".
     */
    label?: string;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    icon,
    iconMotion = 'none',
    label,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  class="btn {variant} {size}"
  class:icon-only={children === undefined}
  {type}
  aria-label={label}
  title={rest.title ?? label}
  {...rest}
>
  {#if icon !== undefined}<Icon name={icon} motion={iconMotion} size={size === 'sm' ? 14 : 16} />{/if}
  {#if children !== undefined}<span>{@render children()}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    font: inherit;
    font-size: var(--fs-1);
    font-weight: 500;
    line-height: 1.2;
    padding: 7px var(--sp-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-strong);
    background: var(--bg);
    color: var(--fg);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background-color var(--dur-1) linear,
      border-color var(--dur-1) linear,
      color var(--dur-1) linear;
  }

  .sm {
    padding: 4px var(--sp-2);
    font-size: var(--fs-0);
  }

  .icon-only {
    padding: 6px;
  }

  .sm.icon-only {
    padding: 4px;
  }

  .btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Disabled is said with colour and the cursor, not opacity: dimmed text drops
     under the contrast floor while it is still meant to be read. */
  .btn:disabled {
    cursor: not-allowed;
    background: var(--bg-sunken);
    border-color: var(--border);
    color: var(--fg-muted);
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-fg);
  }

  .primary:hover:not(:disabled) {
    color: var(--accent-fg);
    background: color-mix(in srgb, var(--accent) 88%, var(--fg));
  }

  .danger {
    background: var(--danger);
    border-color: var(--danger);
    /* Not #fff: dark mode lightens --danger, where white ink fails 4.5:1. */
    color: var(--danger-fg);
  }

  .danger:hover:not(:disabled) {
    color: var(--danger-fg);
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 88%, var(--fg));
  }

  .ghost {
    background: transparent;
    border-color: transparent;
    color: var(--fg-muted);
  }

  .ghost:hover:not(:disabled) {
    background: var(--bg-raised);
    border-color: var(--border);
  }
</style>
