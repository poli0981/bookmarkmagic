<script lang="ts">
  import { num, t } from '../i18n/index.svelte';
  import type { TreeStats } from '../core/model';

  interface Props {
    stats: TreeStats;
    duplicates: number;
  }

  let { stats, duplicates }: Props = $props();
</script>

<dl>
  <div><dt>{t('import.stats.bookmarks')}</dt><dd>{num(stats.bookmarks)}</dd></div>
  <div><dt>{t('import.stats.folders')}</dt><dd>{num(stats.folders)}</dd></div>
  <div><dt>{t('import.stats.depth')}</dt><dd>{num(stats.maxDepth)}</dd></div>
  <div><dt>{t('import.stats.duplicates')}</dt><dd>{num(duplicates)}</dd></div>
</dl>

<style>
  dl {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-2);
    margin: 0;
  }

  div {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-2) var(--sp-3);
  }

  dt {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  dd {
    margin: 0;
    font-size: var(--fs-3);
    font-variant-numeric: tabular-nums;
  }
</style>
