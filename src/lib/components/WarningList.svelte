<script lang="ts">
  import { tPlural } from '../i18n/index.svelte';
  import type { ParseWarning } from '../core/model';
  import Icon from './icons/Icon.svelte';

  interface Props {
    warnings: readonly ParseWarning[];
  }

  let { warnings }: Props = $props();
</script>

{#if warnings.length > 0}
  <details>
    <summary>
      <Icon name="warning" size={14} />
      <span>{tPlural('import.warnings.title', warnings.length)}</span>
      <Icon name="chevron" size={12} />
    </summary>
    <ul>
      {#each warnings as warning (warning.code)}
        <li>{tPlural(`warnings.${warning.code}`, warning.count)}</li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  details {
    border: 1px solid var(--border-strong);
    border-left: 3px solid var(--warn);
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    font-size: var(--fs-1);
  }

  summary {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    color: var(--warn);
    font-weight: 600;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary span {
    flex: 1;
  }

  /* The disclosure chevron is state, so it turns with or without motion. */
  details[open] summary :global(svg:last-child) {
    transform: rotate(90deg);
  }

  ul {
    margin: 0;
    padding: 0 var(--sp-3) var(--sp-3) calc(var(--sp-3) + var(--sp-4));
    color: var(--fg-muted);
  }

  li + li {
    margin-top: var(--sp-1);
  }
</style>
