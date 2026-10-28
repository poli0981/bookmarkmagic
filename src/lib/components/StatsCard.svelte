<script lang="ts">
  import { num, t } from '../i18n/index.svelte';
  import type { TreeStats } from '../core/model';

  interface Props {
    stats: TreeStats;
    duplicates: number;
  }

  let { stats, duplicates }: Props = $props();
</script>

<!-- A readout: mono numerals, small spaced labels. -->
<dl>
  <div><dt class="eyebrow">{t('import.stats.bookmarks')}</dt><dd class="mono">{num(stats.bookmarks)}</dd></div>
  <div><dt class="eyebrow">{t('import.stats.folders')}</dt><dd class="mono">{num(stats.folders)}</dd></div>
  <div><dt class="eyebrow">{t('import.stats.depth')}</dt><dd class="mono">{num(stats.maxDepth)}</dd></div>
  <div class:hot={duplicates > 0}>
    <dt class="eyebrow">{t('import.stats.duplicates')}</dt><dd class="mono">{num(duplicates)}</dd>
  </div>
</dl>

<style>
  dl {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    margin: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    overflow: hidden;
  }

  div {
    padding: var(--sp-2) var(--sp-3);
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  div:nth-child(2n) {
    border-right: none;
  }

  div:nth-last-child(-n + 2) {
    border-bottom: none;
  }

  dd {
    margin: 0;
    font-size: var(--fs-4);
    font-weight: 600;
    line-height: 1.25;
    font-variant-numeric: tabular-nums;
  }

  .hot dd {
    color: var(--warn);
  }
</style>
