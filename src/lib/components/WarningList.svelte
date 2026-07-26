<script lang="ts">
  import { num, t } from '../i18n/index.svelte';
  import type { ParseWarning } from '../core/model';

  interface Props {
    warnings: readonly ParseWarning[];
  }

  let { warnings }: Props = $props();
</script>

{#if warnings.length > 0}
  <details>
    <summary>{t('import.warnings.title', { n: num(warnings.length) })}</summary>
    <ul>
      {#each warnings as warning (warning.code)}
        <li>{t(`warnings.${warning.code}`, { n: num(warning.count) })}</li>
      {/each}
    </ul>
  </details>
{/if}

<style>
  details {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-2) var(--sp-3);
    background: var(--bg-raised);
    font-size: var(--fs-1);
  }

  summary {
    cursor: pointer;
    color: var(--warn);
  }

  ul {
    margin: var(--sp-2) 0 0;
    padding-left: var(--sp-4);
    color: var(--fg-muted);
  }
</style>
